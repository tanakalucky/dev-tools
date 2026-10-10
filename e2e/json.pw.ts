import { expect, test, type Page } from "@playwright/test";

const COPIED_TEXT = "出力をクリップボードにコピーしました。";
const COPY_FAILED_TEXT =
  "コピーできませんでした: クリップボードが利用できないか、ブラウザに拒否されました。";
const FORMATTED_TEXT = "2 スペースで整形しました。";
const MINIFIED_TEXT = "最小化しました。";
const DECODE_NOTICE =
  "JSON 文字列エンコードを 1 階層デコードしました。行番号と列番号は元の入力ではなく、デコード後のテキストを指します。";
const DECODE_LABEL = "オブジェクトまたは配列を含む JSON 文字列をデコードする (1 階層)";

type ClipboardStub = {
  calls: string[];
  // writeText の呼び出しごとに 1 件、呼び出し順に持つ。保留中の書き込みを個別に完了させるため。
  pending: { resolve: () => void; reject: () => void }[];
};

function controls(page: Page) {
  return {
    input: page.getByRole("textbox", { name: "入力 JSON", exact: true }),
    output: page.getByRole("textbox", { name: "出力 (読み取り専用)", exact: true }),
    format: page.getByRole("button", { name: "整形 (2 スペース)", exact: true }),
    minify: page.getByRole("button", { name: "最小化", exact: true }),
    copy: page.getByRole("button", { name: "出力をコピー", exact: true }),
    clear: page.getByRole("button", { name: "クリア", exact: true }),
  };
}

// ページはサーバーレンダリングされるため、ハイドレーション前の入力は失われる。
// React が引き継ぐとクライアントコンポーネントが data-hydrated="true" を設定する。
// その待機はページを読むだけで、入力・クリック・クリアはしないので、
// リロード後に残った状態を隠すことはない。
async function waitForHydration(page: Page) {
  await expect(page.locator(".json-tool")).toHaveAttribute("data-hydrated", "true");
}

// 2 フレーム待つことで保留中の React 更新が描画され、誤って戻った古い状態が
// 次の検証の前に画面へ出る。何も読まず、何も変更しない。
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

// navigator.clipboard を、テストが完了させるまで writeText が保留されるスタブに置き換える。
// 呼び出しごとに独立した遅延 Promise を持つため、複数の書き込みを同時に保留し、
// 任意の順序で完了できる。実際の OS クリップボードには触れず、権限も付与しない。
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

// 指定した 0 始まりの呼び出し番号 (既定は最初の呼び出し) の writeText を完了させる。
// 記録のない番号は例外になるため、発生していない書き込みを完了させることはできない。
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

test("ホームから JSON ツールへ移動でき、狭い画面でもラベルが付きキーボードで操作できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "dev-tools", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "JSON フォーマッター", exact: true }).click();
  await expect(page).toHaveURL(/\/json$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "JSON フォーマッター", exact: true }),
  ).toBeVisible();
  await waitForHydration(page);

  const { input, output, format, minify, copy, clear } = controls(page);
  await expect(page.getByRole("group", { name: "JSON の操作", exact: true })).toBeVisible();
  await expect(output).toHaveAttribute("readonly", "");
  for (const button of [format, minify, copy, clear]) {
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
  }

  // ここからはキーボードのみ: 入力し、Tab でボタンへ移動して操作する。
  await input.focus();
  await page.keyboard.type("[1,2]");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("checkbox", {
      name: DECODE_LABEL,
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

test("整形は 2 スペースでインデントし、大きな整数を正確に保つ", async ({ page }) => {
  const { input, output, format } = await openJsonTool(page);
  const source = '{"n":9007199254740993}';

  await input.fill(source);
  await format.click();

  await expect(output).toHaveValue('{\n  "n": 9007199254740993\n}');
  await expect(input).toHaveValue(source);
  await expect(page.getByText(FORMATTED_TEXT, { exact: true })).toBeVisible();
});

test("最小化は生のエスケープを保ち、文字列内のマークアップは無害なテキストのままになる", async ({
  page,
}) => {
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
  await expect(page.getByText(MINIFIED_TEXT, { exact: true })).toBeVisible();

  await format.click();
  await expect(output).toHaveValue(/^\{\n {2}"img": "<img src=x /);

  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.locator("[onerror]")).toHaveCount(0);
  await expect(page.locator("main script")).toHaveCount(0);
  expect(await page.evaluate(() => "__xss" in window)).toBe(false);
  expect(dialogs).toEqual([]);
});

test("不正な JSON は行と列を報告し、入力を保ち、古い状態を破棄する", async ({ page }) => {
  const { input, output, format, clear } = await openJsonTool(page);
  const broken = '{\n  "a" 1\n}';
  const alert = page.getByRole("alert");

  await input.fill(broken);
  await format.click();
  await expect(alert).toContainText("JSON が正しくありません");
  await expect(alert).toContainText("(2 行目、7 列目)");
  await expect(alert).toContainText("入力は変更されていません。");
  await expect(input).toHaveValue(broken);
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(output).toHaveValue("");

  // 編集すると古いエラーが消える。
  await input.press("End");
  await input.pressSequentially(" ");
  await expect(alert).toHaveCount(0);
  await expect(input).toHaveAttribute("aria-invalid", "false");

  // 編集すると古い出力も消える。
  await input.fill('{"a":1}');
  await format.click();
  await expect(output).toHaveValue('{\n  "a": 1\n}');
  await input.pressSequentially(" ");
  await expect(output).toHaveValue("");
  await expect(page.getByText(FORMATTED_TEXT, { exact: true })).toHaveCount(0);

  await format.click();
  await expect(output).toHaveValue('{\n  "a": 1\n}');
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(output).toHaveValue("");
  await expect(page.getByText(FORMATTED_TEXT, { exact: true })).toHaveCount(0);
  await expect(alert).toHaveCount(0);
  await expect(format).toBeDisabled();
  await expect(clear).toBeDisabled();
});

test("重複キーは警告になり、両方のキーが出力に残る", async ({ page }) => {
  const { input, output, format } = await openJsonTool(page);

  await input.fill('{"a":1,"a":2}');
  await format.click();

  await expect(output).toHaveValue('{\n  "a": 1,\n  "a": 2\n}');
  await expect(page.getByText("重複キーの警告が 1 件あります", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveText([
    '1 行目、8 列目: Duplicate key "a": the same key first appears at line 1, column 2',
  ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("コピー (クリップボードのスタブ契約): 成功表示は書き込みが解決した後にだけ出る", async ({
  page,
}) => {
  await stubDeferredClipboard(page);
  const { input, minify, copy } = await openJsonTool(page);

  await input.fill("[ 1, 2 ]");
  await minify.click();
  await copy.click();

  // スタブは表示中の出力を受け取ったが、書き込みはまだ保留中なので成功表示はまだ出ない。
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]"]);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await expect(page.getByText(MINIFIED_TEXT, { exact: true })).toBeVisible();

  await settleClipboard(page, "resolve");
  await expect(page.getByText(COPIED_TEXT, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("コピー (クリップボードのスタブ契約): 書き込み拒否または API 欠如では正直にエラーを表示する", async ({
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

  // Clipboard API がまったく存在しない、2 つ目の分離コンテキスト。
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
  await expect(page.getByText(FORMATTED_TEXT, { exact: true })).toBeVisible();

  // Copy the formatted output (call 1), minify while it is pending, then let it fail late.
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]", pretty]);
  await minify.click();
  await expect(output).toHaveValue("[1,2]");
  await settleClipboard(page, "reject", 1);
  await flushRender(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await expect(page.getByText(MINIFIED_TEXT, { exact: true })).toBeVisible();

  // A copy of the current output (call 2) is the only one allowed to report.
  await copy.click();
  await expect.poll(() => clipboardCalls(page)).toEqual(["[1,2]", pretty, "[1,2]"]);
  await expect(page.getByText(COPIED_TEXT)).toHaveCount(0);
  await settleClipboard(page, "resolve", 2);
  await expect(page.getByText(COPIED_TEXT, { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("エンコードされた JSON オブジェクトは通知付きでデコードされ、入力は変更されない", async ({
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

test("通常の JSON 文字列は文字列のままで、デコード通知は出ない", async ({ page }) => {
  const { input, output, format } = await openJsonTool(page);

  await input.fill('"hello"');
  await format.click();

  await expect(output).toHaveValue('"hello"');
  await expect(page.getByText(DECODE_NOTICE, { exact: true })).toHaveCount(0);
});

test("不正なエンコード済みコンテナはデコード後テキストのエラーを報告し、入力を保つ", async ({
  page,
}) => {
  const { input, output, format } = await openJsonTool(page);
  const source = String.raw`"{\n\"a\" 1}"`;
  const alert = page.getByRole("alert");

  await input.fill(source);
  await format.click();

  await expect(alert).toContainText("JSON が正しくありません");
  await expect(alert).toContainText("(2 行目、5 列目)");
  await expect(alert).toContainText("デコード後のテキストを指します");
  await expect(output).toHaveValue("");
  await expect(input).toHaveValue(source);
});

test("デコードオプションを外すか入力を編集すると、古いデコード状態が消える", async ({ page }) => {
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

test("プライバシー: 入力テキストは送信・保存・URL への付与・リロード後の保持がされない", async ({
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

  // 目印文字列は起動後にだけページへ入るので、それを含む通信はツールが起こしたものだ。
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

  // リロードからこれらの検証までの間に入力・クリック・クリアはしないので、
  // リロード後のページが自力で復元した内容だけが検証される。
  await page.reload();
  await waitForHydration(page);
  await expect(input).toHaveValue("");
  await expect(output).toHaveValue("");
  await expect(format).toBeDisabled();
  await expect(page.getByText(sentinel)).toHaveCount(0);

  expect(bootRequests).toBeGreaterThan(0);
  expect(outgoing.filter((entry) => entry.includes(sentinel))).toEqual([]);
});
