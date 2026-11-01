import { test, expect, type Page } from "@playwright/test";

const calculator = (page: Page) => page.getByRole("region", { name: "電卓", exact: true });
const result = (page: Page) => calculator(page).getByRole("status", { name: "計算結果" });
const history = (page: Page) => page.getByRole("region", { name: "計算履歴" });
async function open(page: Page) {
  await page.goto("/calculator");
  await expect(
    calculator(page).getByRole("button", { name: "貼り付け", exact: true }),
  ).toBeEnabled();
}
async function enter(page: Page, sequence: string) {
  await calculator(page).focus();
  await page.keyboard.type(sequence);
}
async function nativePaste(page: Page, text: string) {
  return calculator(page).evaluate((element, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    const event = new ClipboardEvent("paste", {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, text);
}
async function mockClipboard(
  page: Page,
  mode: "value" | "denied" | "absent" | "pending",
  value = "1,234.5",
) {
  await page.addInitScript(
    ({ mode, value }) => {
      let reads = 0;
      Object.defineProperty(window, "testPasteReads", { get: () => reads });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value:
          mode === "absent"
            ? undefined
            : {
                writeText: async () => {},
                readText: () => {
                  reads++;
                  if (mode === "denied")
                    return Promise.reject(new DOMException("Denied", "NotAllowedError"));
                  if (mode === "pending")
                    return new Promise<string>((resolve, reject) => {
                      Object.assign(window, {
                        resolveTestPaste: () => resolve(value),
                        rejectTestPaste: () => reject(new Error("Denied")),
                      });
                    });
                  return Promise.resolve(value);
                },
              },
      });
    },
    { mode, value },
  );
}
async function reads(page: Page) {
  return page.evaluate(() => (window as unknown as { testPasteReads: number }).testPasteReads);
}

test("Cmd/Ctrl+V is not intercepted and a native paste replaces exactly one operand", async ({
  page,
}) => {
  // Arrange: synthetic events/data only; never read or overwrite the host OS clipboard.
  await mockClipboard(page, "value");
  await open(page);
  await enter(page, "12+34");
  // Act
  for (const modifier of ["ctrlKey", "metaKey"]) {
    expect(
      await calculator(page).evaluate((element, modifier) => {
        const event = new KeyboardEvent("keydown", {
          key: "v",
          [modifier]: true,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
        return event.defaultPrevented;
      }, modifier),
    ).toBe(false);
  }
  expect(await nativePaste(page, " -1,234.5 ")).toBe(true);
  // Assert
  await expect(page.getByTestId("calculator-expression")).toContainText("12 ＋ -1234.5");
  await expect(result(page)).toHaveText("-1234.5");
  await expect(history(page).getByRole("listitem")).toHaveCount(0);
  expect(await reads(page)).toBe(0);
  await enter(page, "=");
  await expect(result(page)).toHaveText("-1222.5");
});

test("paste button reads only on activation, starts new input after a result, and restores focus", async ({
  page,
}) => {
  // Arrange
  await mockClipboard(page, "value");
  await open(page);
  await enter(page, "1+2=");
  expect(await reads(page)).toBe(0);
  // Act
  await calculator(page).getByRole("button", { name: "貼り付け" }).focus();
  await page.keyboard.press("Enter");
  // Assert
  await expect(result(page)).toHaveText("1234.5");
  await expect(calculator(page)).toBeFocused();
  expect(await reads(page)).toBe(1);
  await expect(history(page).getByRole("listitem")).toHaveCount(1);
  await expect(
    calculator(page).getByRole("button", { name: "コピー", exact: true }),
  ).toBeDisabled();
});

for (const invalid of ["1+2", "12,34", "Infinity", "9".repeat(41)]) {
  test(`invalid native paste preserves a completed calculation: ${invalid.slice(0, 15)}`, async ({
    page,
  }) => {
    // Arrange
    await open(page);
    await enter(page, "1/3=");
    // Act
    await nativePaste(page, invalid);
    // Assert
    await expect(result(page)).toHaveText("0.333333333333");
    await expect(page.getByTestId("calculator-expression")).toContainText("1 ÷ 3 ＝");
    await expect(history(page).getByRole("listitem")).toHaveCount(1);
    await expect(calculator(page)).toContainText(
      invalid.length > 40 ? "40桁まで" : "数値だけ貼り付けてください",
    );
  });
}

test("native paste at a pending operator preserves raw precision and handles subsequent negative input", async ({
  page,
}) => {
  // Arrange
  await open(page);
  await enter(page, "1/3=*");
  // Act
  await nativePaste(page, "3");
  await enter(page, "=");
  // Assert
  await expect(result(page)).toHaveText("1");
  await nativePaste(page, "-0");
  await enter(page, "7.5*2=");
  await expect(result(page)).toHaveText("-15");
});

for (const mode of ["denied", "absent"] as const) {
  test(`fallback supports native input when clipboard API is ${mode}`, async ({ page }) => {
    // Arrange
    await mockClipboard(page, mode);
    await open(page);
    await enter(page, "12+3");
    // Act
    await calculator(page).getByRole("button", { name: "貼り付け" }).click();
    const dialog = page.getByRole("dialog", { name: "数値を貼り付け" });
    const input = dialog.getByRole("textbox");
    await expect(input).toBeFocused();
    const inputPastePrevented = await input.evaluate((element) => {
      const data = new DataTransfer();
      data.setData("text/plain", "555");
      const event = new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(inputPastePrevented).toBe(false);
    expect(await reads(page)).toBe(mode === "absent" ? 0 : 1);
    await expect(page.getByTestId("calculator-expression")).toContainText("12 ＋ 3");
    await input.pressSequentially("1+2");
    await input.press("Enter");
    await expect(dialog.getByRole("alert")).toHaveText("数値だけ貼り付けてください");
    await expect(page.getByTestId("calculator-expression")).toContainText("12 ＋ 3");
    await input.fill("-1,234.5");
    await input.press("Enter");
    // Assert
    await expect(dialog).toBeHidden();
    await expect(calculator(page)).toBeFocused();
    await expect(result(page)).toHaveText("-1234.5");
    await expect(history(page).getByRole("listitem")).toHaveCount(0);
    await enter(page, "=");
    await expect(result(page)).toHaveText("-1222.5");
  });
}

test("canceling the fallback keeps the expression and does not run AC", async ({ page }) => {
  // Arrange
  await mockClipboard(page, "denied");
  await open(page);
  await enter(page, "12+3");
  // Act
  await calculator(page).getByRole("button", { name: "貼り付け" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("9");
  await page.keyboard.press("Escape");
  // Assert
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("calculator-expression")).toContainText("12 ＋ 3");
  await expect(calculator(page)).toBeFocused();
});

for (const outcome of ["resolve", "reject"] as const) {
  test(`ignores a stale async clipboard ${outcome} after calculator input`, async ({ page }) => {
    // Arrange
    await mockClipboard(page, "pending", "99");
    await open(page);
    // Act
    await calculator(page).getByRole("button", { name: "貼り付け" }).click();
    await calculator(page).getByRole("button", { name: "7", exact: true }).click();
    await page.evaluate((outcome) => {
      const test = window as unknown as {
        resolveTestPaste: () => void;
        rejectTestPaste: () => void;
      };
      if (outcome === "resolve") test.resolveTestPaste();
      else test.rejectTestPaste();
    }, outcome);
    // Assert
    await expect(result(page)).toHaveText("7");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(calculator(page).getByRole("button", { name: "貼り付け" })).toBeEnabled();
  });
}

test("does not intercept pasting into another editable field", async ({ page }) => {
  // Arrange
  await mockClipboard(page, "value");
  await open(page);
  await enter(page, "12");
  // Act
  const intercepted = await page.evaluate(() => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const data = new DataTransfer();
    data.setData("text/plain", "555");
    const event = new ClipboardEvent("paste", {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    input.remove();
    return event.defaultPrevented;
  });
  // Assert
  expect(intercepted).toBe(false);
  expect(await reads(page)).toBe(0);
  await expect(result(page)).toHaveText("12");
});

for (const [width, height] of [
  [1440, 900],
  [768, 480],
  [390, 800],
  [320, 568],
  [390, 480],
] as const) {
  test(`paste controls fit ${width}x${height} with modal fallback and unchanged panels`, async ({
    page,
  }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height });
    await mockClipboard(page, "denied");
    await open(page);
    // Act
    await calculator(page).getByRole("button", { name: "貼り付け" }).click();
    const dialog = page.getByRole("dialog", { name: "数値を貼り付け" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    // Assert
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: testInfo.outputPath(`paste-fallback-${width}-${height}.png`) });
    await dialog.getByRole("textbox").fill("1,234.5");
    await dialog.getByRole("button", { name: "入力", exact: true }).click();
    await expect(result(page)).toHaveText("1234.5");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight > innerHeight ||
          document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    if (width >= 768) {
      const left = await calculator(page).boundingBox();
      const right = await history(page).boundingBox();
      expect(left!.y).toBe(right!.y);
      expect(left!.height).toBe(right!.height);
    }
    await page.screenshot({ path: testInfo.outputPath(`paste-ready-${width}-${height}.png`) });
  });
}

for (const operation of ["copy", "delete", "clear"] as const) {
  for (const outcome of ["resolve", "reject"] as const) {
    test(`invalidates delayed clipboard ${outcome} after ${operation}`, async ({ page }) => {
      // Arrange
      await mockClipboard(page, "pending", "99");
      await open(page);
      await enter(page, "1+2=");
      await calculator(page).getByRole("button", { name: "貼り付け", exact: true }).click();
      // Act
      if (operation === "copy")
        await calculator(page).getByRole("button", { name: "コピー", exact: true }).click();
      else if (operation === "delete")
        await history(page)
          .getByRole("button", { name: /の履歴を削除/ })
          .click();
      else {
        page.once("dialog", (dialog) => dialog.accept());
        await history(page).getByRole("button", { name: "全削除" }).click();
      }
      await page.evaluate((outcome) => {
        const test = window as unknown as {
          resolveTestPaste: () => void;
          rejectTestPaste: () => void;
        };
        if (outcome === "resolve") test.resolveTestPaste();
        else test.rejectTestPaste();
      }, outcome);
      // Assert
      await expect(result(page)).toHaveText("3");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(
        calculator(page).getByRole("button", { name: "貼り付け", exact: true }),
      ).toBeEnabled();
      await expect(history(page).getByRole("listitem")).toHaveCount(operation === "copy" ? 1 : 0);
      expect(await reads(page)).toBe(1);
    });
  }
}
