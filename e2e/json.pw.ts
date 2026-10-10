import { expect, test, type Page } from "@playwright/test";

const COPIED_TEXT = "Output copied to the clipboard.";
const COPY_FAILED_TEXT = "Could not copy: the clipboard is unavailable or the browser refused.";

type ClipboardStub = {
  calls: string[];
  // One entry per writeText call, in call order, so each pending write is settled on its own.
  pending: { resolve: () => void; reject: () => void }[];
};

function controls(page: Page) {
  return {
    input: page.getByRole("textbox", { name: "Input JSON", exact: true }),
    output: page.getByRole("textbox", { name: "Output (read-only)", exact: true }),
    format: page.getByRole("button", { name: "Format (2 spaces)", exact: true }),
    minify: page.getByRole("button", { name: "Minify", exact: true }),
    copy: page.getByRole("button", { name: "Copy output", exact: true }),
    clear: page.getByRole("button", { name: "Clear", exact: true }),
  };
}

// The page is server-rendered, so typing before hydration would be lost. The client component
// sets data-hydrated="true" once React has taken over. Waiting for it reads the page only: it
// never types, clicks or clears, so it cannot hide state that survived a reload.
async function waitForHydration(page: Page) {
  await expect(page.locator(".json-tool")).toHaveAttribute("data-hydrated", "true");
}

// Two animation frames give any pending React update time to render, so a stale status that
// wrongly came back would be on screen before the next assertion. Reads nothing, changes nothing.
async function flushRender(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function openJsonTool(page: Page) {
  await page.goto("/json");
  await waitForHydration(page);
  return controls(page);
}

// Replaces navigator.clipboard with a stub whose writeText stays pending until the test settles
// it. Every call gets its own deferred promise, so several writes can be pending at once and be
// settled in any order. Nothing here touches the real OS clipboard and no clipboard permission
// is granted.
async function stubDeferredClipboard(page: Page) {
  await page.addInitScript(() => {
    const stub: ClipboardStub = { calls: [], pending: [] };
    const clipboard = {
      writeText(text: string) {
        stub.calls.push(text);
        return new Promise<void>((resolve, reject) => {
          stub.pending.push({
            resolve,
            reject: () => reject(new DOMException("Write refused", "NotAllowedError")),
          });
        });
      },
    };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    Object.defineProperty(window, "__clipboardStub", { value: stub });
  });
}

function clipboardCalls(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __clipboardStub: ClipboardStub }).__clipboardStub.calls,
  );
}

// Settles the writeText call with the given zero-based call index (the first call by default).
// An index with no recorded call throws, so a test cannot settle a write that never happened.
function settleClipboard(page: Page, how: "resolve" | "reject", call = 0) {
  return page.evaluate(
    ({ method, index }) => {
      const { pending } = (window as unknown as { __clipboardStub: ClipboardStub }).__clipboardStub;
      const deferred = pending[index];
      if (deferred === undefined) {
        throw new Error(`No clipboard write with call index ${index}`);
      }
      deferred[method]();
    },
    { method: how, index: call },
  );
}

test("home links to the JSON tool, which is labelled and keyboard-operable on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "dev-tools", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "JSON formatter", exact: true }).click();
  await expect(page).toHaveURL(/\/json$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "JSON formatter", exact: true }),
  ).toBeVisible();
  await waitForHydration(page);

  const { input, output, format, minify, copy, clear } = controls(page);
  await expect(page.getByRole("group", { name: "JSON actions", exact: true })).toBeVisible();
  await expect(output).toHaveAttribute("readonly", "");
  for (const button of [format, minify, copy, clear]) {
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
  }

  // Keyboard only from here: type, then reach the buttons with Tab and activate them.
  await input.focus();
  await page.keyboard.type("[1,2]");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("checkbox", {
      name: "Decode a JSON string that contains an object or array (1 layer)",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(format).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(output).toHaveValue("[\n  1,\n  2\n]");

  await page.keyboard.press("Tab");
  await expect(minify).toBeFocused();
  await page.keyboard.press("Space");
  await expect(output).toHaveValue("[1,2]");
  await expect(input).toHaveValue("[1,2]");
});

test("format indents with two spaces and keeps a large integer exactly", async ({ page }) => {
  const { input, output, format } = await openJsonTool(page);
  const source = '{"n":9007199254740993}';

  await input.fill(source);
  await format.click();

  await expect(output).toHaveValue('{\n  "n": 9007199254740993\n}');
  await expect(input).toHaveValue(source);
  await expect(page.getByText("Formatted with 2 spaces.", { exact: true })).toBeVisible();
});

test("minify keeps raw escapes, and markup inside strings stays inert text", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const { input, output, format, minify } = await openJsonTool(page);
  const source = String.raw`{ "img" : "<img src=x onerror=\"window.__xss=1;alert(1)\">",
  "script": "<script>window.__xss=1<\/script>", "esc": "a\/b\nA" }`;
  const minified = String.raw`{"img":"<img src=x onerror=\"window.__xss=1;alert(1)\">","script":"<script>window.__xss=1<\/script>","esc":"a\/b\nA"}`;

  await input.fill(source);
  await minify.click();
  await expect(output).toHaveValue(minified);
  await expect(page.getByText("Minified.", { exact: true })).toBeVisible();

  await format.click();
  await expect(output).toHaveValue(/^\{\n {2}"img": "<img src=x /);

  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.locator("[onerror]")).toHaveCount(0);
  await expect(page.locator("main script")).toHaveCount(0);
  expect(await page.evaluate(() => "__xss" in window)).toBe(false);
  expect(dialogs).toEqual([]);
});

test("invalid JSON reports line and column, keeps the input, and stale state is discarded", async ({
  page,
}) => {
  const { input, output, format, clear } = await openJsonTool(page);
  const broken = '{\n  "a" 1\n}';
  const alert = page.getByRole("alert");

  await input.fill(broken);
  await format.click();
  await expect(alert).toContainText("Invalid JSON");
  await expect(alert).toContainText("(Line 2, column 7)");
  await expect(alert).toContainText("Your input was left unchanged.");
  await expect(input).toHaveValue(broken);
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(output).toHaveValue("");

  // Editing drops the stale error.
  await input.press("End");
  await input.pressSequentially(" ");
  await expect(alert).toHaveCount(0);
  await expect(input).toHaveAttribute("aria-invalid", "false");

  // Editing also drops stale output.
  await input.fill('{"a":1}');
  await format.click();
  await expect(output).toHaveValue('{\n  "a": 1\n}');
  await input.pressSequentially(" ");
  await expect(output).toHaveValue("");
  await expect(page.getByText("Formatted with 2 spaces.", { exact: true })).toHaveCount(0);

  await format.click();
  await expect(output).toHaveValue('{\n  "a": 1\n}');
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(output).toHaveValue("");
  await expect(page.getByText("Formatted with 2 spaces.", { exact: true })).toHaveCount(0);
  await expect(alert).toHaveCount(0);
  await expect(format).toBeDisabled();
  await expect(clear).toBeDisabled();
});

test("duplicate keys produce a warning and both keys stay in the output", async ({ page }) => {
  const { input, output, format } = await openJsonTool(page);

  await input.fill('{"a":1,"a":2}');
  await format.click();

  await expect(output).toHaveValue('{\n  "a": 1,\n  "a": 2\n}');
  await expect(page.getByText("1 duplicate key warning", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveText([
    'Line 1, column 8: Duplicate key "a": the same key first appears at line 1, column 2',
  ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("copy (stubbed clipboard contract): success appears only after the write resolves", async ({
  page,
}) => {
  await stubDeferredClipboard(page);
  const { input, minify, copy } = await openJsonTool(page);

  await input.fill("[ 1, 2 ]");
  await minify.click();
  await copy.click();

  // The stub received the visible output, but the write is still pending: no success claim yet.
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]"]);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await expect(page.getByText("Minified.", { exact: true })).toBeVisible();

  await settleClipboard(page, "resolve");
  await expect(page.getByText(COPIED_TEXT, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("copy (stubbed clipboard contract): a rejected write or a missing API shows an honest error", async ({
  page,
  browser,
}) => {
  await stubDeferredClipboard(page);
  const rejected = await openJsonTool(page);
  await rejected.input.fill("[ 1, 2 ]");
  await rejected.minify.click();
  await rejected.copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]"]);
  await settleClipboard(page, "reject");
  await expect(page.getByRole("alert")).toContainText(COPY_FAILED_TEXT);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);

  // Second isolated context where the Clipboard API does not exist at all.
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const bare = await context.newPage();
    await bare.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    });
    const missing = await openJsonTool(bare);
    await missing.input.fill("[ 1, 2 ]");
    await missing.minify.click();
    await missing.copy.click();
    await expect(bare.getByRole("alert")).toContainText(COPY_FAILED_TEXT);
    await expect(bare.getByText(COPIED_TEXT)).toHaveCount(0);
    await expect(missing.output).toHaveValue("[1,2]");
  } finally {
    await context.close();
  }
});

test("copy (stubbed clipboard contract): two pending writes of one output, newer resolves then older rejects", async ({
  page,
}) => {
  await stubDeferredClipboard(page);
  const { input, minify, copy } = await openJsonTool(page);

  await input.fill("[ 1, 2 ]");
  await minify.click();
  await copy.click();
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]", "[1,2]"]);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);

  // The newer request (call 1) settles first and owns the status.
  await settleClipboard(page, "resolve", 1);
  await expect(page.getByText(COPIED_TEXT, { exact: true })).toBeVisible();

  // The older request (call 0) fails afterwards: its result must not replace the newer one.
  await settleClipboard(page, "reject", 0);
  await flushRender(page);
  await expect(page.getByText(COPIED_TEXT, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await clipboardCalls(page)).toEqual(["[1,2]", "[1,2]"]);
});

test("copy (stubbed clipboard contract): two pending writes of one output, newer rejects then older resolves", async ({
  page,
}) => {
  await stubDeferredClipboard(page);
  const { input, minify, copy } = await openJsonTool(page);

  await input.fill("[ 1, 2 ]");
  await minify.click();
  await copy.click();
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]", "[1,2]"]);

  // The newer request (call 1) fails first and owns the status.
  await settleClipboard(page, "reject", 1);
  await expect(page.getByRole("alert")).toContainText(COPY_FAILED_TEXT);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);

  // The older request (call 0) succeeds afterwards: no success claim for the failed latest copy.
  await settleClipboard(page, "resolve", 0);
  await flushRender(page);
  await expect(page.getByRole("alert")).toContainText(COPY_FAILED_TEXT);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  expect(await clipboardCalls(page)).toEqual(["[1,2]", "[1,2]"]);
});

test("copy (stubbed clipboard contract): an input edit while a write is pending discards its status", async ({
  page,
}) => {
  await stubDeferredClipboard(page);
  const { input, output, minify, copy } = await openJsonTool(page);

  await input.fill("[ 1, 2 ]");
  await minify.click();
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]"]);

  await input.press("End");
  await input.pressSequentially(" ");
  await expect(output).toHaveValue("");

  // The write for the discarded output succeeds late: no success claim may appear.
  await settleClipboard(page, "resolve");
  await flushRender(page);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(output).toHaveValue("");
  await expect(copy).toBeDisabled();
  expect(await clipboardCalls(page)).toEqual(["[1,2]"]);
});

test("copy (stubbed clipboard contract): Clear while a write is pending discards its status", async ({
  page,
}) => {
  await stubDeferredClipboard(page);
  const { input, output, minify, copy, clear } = await openJsonTool(page);

  await input.fill("[ 1, 2 ]");
  await minify.click();
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]"]);

  await clear.click();
  await expect(input).toHaveValue("");
  await expect(output).toHaveValue("");

  // The write for the cleared output fails late: no failure message may appear.
  await settleClipboard(page, "reject");
  await flushRender(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await expect(input).toHaveValue("");
  await expect(output).toHaveValue("");
  expect(await clipboardCalls(page)).toEqual(["[1,2]"]);
});

test("copy (stubbed clipboard contract): reformat and minify while a write is pending, then the latest copy wins", async ({
  page,
}) => {
  await stubDeferredClipboard(page);
  const { input, output, format, minify, copy } = await openJsonTool(page);
  const pretty = "[\n  1,\n  2\n]";

  await input.fill("[ 1, 2 ]");
  await minify.click();
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]"]);

  // Reformat while call 0 (minified text) is pending, then let it succeed late.
  await format.click();
  await expect(output).toHaveValue(pretty);
  await settleClipboard(page, "resolve", 0);
  await flushRender(page);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await expect(page.getByText("Formatted with 2 spaces.", { exact: true })).toBeVisible();

  // Copy the formatted output (call 1), minify while it is pending, then let it fail late.
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]", pretty]);
  await minify.click();
  await expect(output).toHaveValue("[1,2]");
  await settleClipboard(page, "reject", 1);
  await flushRender(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await expect(page.getByText("Minified.", { exact: true })).toBeVisible();

  // A copy of the current output (call 2) is the only one allowed to report.
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]", pretty, "[1,2]"]);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await settleClipboard(page, "resolve", 2);
  await expect(page.getByText(COPIED_TEXT, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

const DECODE_NOTICE =
  "Decoded 1 layer of JSON string encoding. Line and column numbers refer to the decoded text, not your original input.";
const DECODE_LABEL = "Decode a JSON string that contains an object or array (1 layer)";

test("encoded JSON object is decoded with a visible notice and the input is untouched", async ({
  page,
}) => {
  const { input, output, format } = await openJsonTool(page);
  const source = String.raw`"{\"n\":9007199254740993,\"s\":\"a\\\\b\"}"`;

  await input.fill(source);
  await format.click();

  await expect(output).toHaveValue(String.raw`{
  "n": 9007199254740993,
  "s": "a\\b"
}`);
  await expect(page.getByText(DECODE_NOTICE, { exact: true })).toBeVisible();
  await expect(input).toHaveValue(source);
});

test("an ordinary JSON string stays a string with no decode notice", async ({ page }) => {
  const { input, output, format } = await openJsonTool(page);

  await input.fill('"hello"');
  await format.click();

  await expect(output).toHaveValue('"hello"');
  await expect(page.getByText(DECODE_NOTICE, { exact: true })).toHaveCount(0);
});

test("a malformed encoded container reports a decoded-text error and keeps the input", async ({
  page,
}) => {
  const { input, output, format } = await openJsonTool(page);
  const source = String.raw`"{\n\"a\" 1}"`;
  const alert = page.getByRole("alert");

  await input.fill(source);
  await format.click();

  await expect(alert).toContainText("Invalid JSON");
  await expect(alert).toContainText("(Line 2, column 5)");
  await expect(alert).toContainText("refer to the decoded text");
  await expect(output).toHaveValue("");
  await expect(input).toHaveValue(source);
});

test("unchecking the decode option and editing input clear stale decode state", async ({
  page,
}) => {
  const { input, output, format } = await openJsonTool(page);
  const option = page.getByRole("checkbox", { name: DECODE_LABEL, exact: true });
  const source = String.raw`"{\"a\":1}"`;
  const notice = page.getByText(DECODE_NOTICE, { exact: true });

  await expect(option).toBeChecked();
  await input.fill(source);
  await format.click();
  await expect(notice).toBeVisible();

  await option.uncheck();
  await expect(output).toHaveValue("");
  await expect(notice).toHaveCount(0);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await format.click();
  await expect(output).toHaveValue(source);
  await expect(notice).toHaveCount(0);

  await option.check();
  await format.click();
  await expect(notice).toBeVisible();
  await input.press("End");
  await input.pressSequentially(" ");
  await expect(notice).toHaveCount(0);
  await expect(output).toHaveValue("");
});

test("privacy: entered text is not sent, stored, put in the URL, or kept across reload", async ({
  page,
}) => {
  const sentinel = "pw-sentinel-7f3c9e1a-synthetic";
  const outgoing: string[] = [];
  page.on("request", (request) => {
    outgoing.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`);
  });
  page.on("websocket", (socket) => {
    socket.on("framesent", (frame) => outgoing.push(`WS ${socket.url()} ${String(frame.payload)}`));
  });
  const { input, output, format, minify } = await openJsonTool(page);
  const bootRequests = outgoing.length;

  // The sentinel only enters the page after boot, so anything carrying it was caused by the tool.
  await input.fill(`{ "secret": "${sentinel}" }`);
  await format.click();
  await expect(output).toHaveValue(`{\n  "secret": "${sentinel}"\n}`);
  await minify.click();
  await expect(output).toHaveValue(`{"secret":"${sentinel}"}`);

  const persisted = await page.evaluate(() => ({
    local: JSON.stringify(Object.entries(localStorage)),
    session: JSON.stringify(Object.entries(sessionStorage)),
    cookie: document.cookie,
    url: location.href,
  }));
  expect(persisted.local).not.toContain(sentinel);
  expect(persisted.session).not.toContain(sentinel);
  expect(persisted.cookie).not.toContain(sentinel);
  expect(persisted.url).not.toContain(sentinel);

  // Nothing is typed, clicked or cleared between the reload and these assertions, so they see
  // exactly what the reloaded page restored on its own.
  await page.reload();
  await waitForHydration(page);
  await expect(input).toHaveValue("");
  await expect(output).toHaveValue("");
  await expect(format).toBeDisabled();
  await expect(page.getByText(sentinel)).toHaveCount(0);

  expect(bootRequests).toBeGreaterThan(0);
  expect(outgoing.filter((entry) => entry.includes(sentinel))).toEqual([]);
});
