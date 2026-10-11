import { expect, test, type Locator, type Page } from "@playwright/test";

const KEY_NAMES: Record<string, string> = {
  "+": "足す",
  "-": "引く",
  "*": "掛ける",
  "/": "割る",
  ".": "小数点",
  "=": "計算結果",
  C: "すべてクリア",
  B: "1文字削除",
};

const KEY_LABELS = "AC ⌫ ÷ 7 8 9 × 4 5 6 − 1 2 3 ＋ 0 . ＝".split(" ");

test.describe("Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await openCalculator(page);
  });

  test("starts at 0 with an empty expression, 18 keys and Copy disabled", async ({ page }) => {
    await expect(resultOutput(page)).toHaveText("0");
    await expect(calculator(page)).not.toContainText("計算式");
    await expect(keys(page)).toHaveText(KEY_LABELS);
    await expect(copyButton(page)).toBeDisabled();
  });

  test("shows no mock-only content", async ({ page }) => {
    await expect(page.getByText("サンプル表示")).toHaveCount(0);
    await expect(page.getByText("静的モック")).toHaveCount(0);
    await expect(page.getByText("デザイン")).toHaveCount(0);
    await expect(page.getByText("表示のみ")).toHaveCount(0);
  });

  test("calculates the design sample 128 + 64 = 192", async ({ page }) => {
    await clickKeys(page, "128+64=");

    await expect(calculator(page)).toContainText("128 ＋ 64 ＝");
    await expect(resultOutput(page)).toHaveText("192");
  });

  test("multiplies before adding: 2+3×4=14", async ({ page }) => {
    await clickKeys(page, "2+3*4=");

    await expect(calculator(page)).toContainText("2 ＋ 3 × 4 ＝");
    await expect(resultOutput(page)).toHaveText("14");
  });

  test("subtracts and divides with decimals", async ({ page }) => {
    await clickKeys(page, "9.5-4/2=");

    await expect(resultOutput(page)).toHaveText("7.5");
  });

  test("shows 0.1+0.2 as 0.3 and rounds 1÷3 to 12 significant digits", async ({ page }) => {
    await clickKeys(page, "0.1+0.2=");
    await expect(resultOutput(page)).toHaveText("0.3");

    await clickKeys(page, "C1/3=");
    await expect(resultOutput(page)).toHaveText("0.333333333333");
  });

  test("shows the number being entered as the live result", async ({ page }) => {
    await clickKeys(page, "12+345");

    await expect(calculator(page)).toContainText("12 ＋ 345");
    await expect(resultOutput(page)).toHaveText("345");
    await expect(copyButton(page)).toBeDisabled();
  });

  test("replaces a repeated operator, ignores a second dot and normalizes a leading zero", async ({
    page,
  }) => {
    await clickKeys(page, "5+*3");
    await expect(calculator(page)).toContainText("5 × 3");

    await clickKeys(page, "C1.2.3");
    await expect(resultOutput(page)).toHaveText("1.23");

    await clickKeys(page, "C007");
    await expect(resultOutput(page)).toHaveText("7");
  });

  test("does nothing when = is pressed on an incomplete expression", async ({ page }) => {
    await clickKeys(page, "5=");
    await expect(expressionLine(page)).not.toContainText("＝");

    await clickKeys(page, "+=");
    await expect(expressionLine(page)).not.toContainText("＝");
    await expect(copyButton(page)).toBeDisabled();
  });

  test("starts a new calculation on a digit after a result and continues on an operator", async ({
    page,
  }) => {
    await clickKeys(page, "1+2=");
    await clickKeys(page, "*4=");
    await expect(calculator(page)).toContainText("3 × 4 ＝");
    await expect(resultOutput(page)).toHaveText("12");

    await clickKeys(page, "9");
    await expect(expressionLine(page)).not.toContainText("＝");
    await expect(resultOutput(page)).toHaveText("9");
  });

  test("removes one character per backspace and clears everything with AC", async ({ page }) => {
    await clickKeys(page, "12+34B");
    await expect(calculator(page)).toContainText("12 ＋ 3");
    await expect(resultOutput(page)).toHaveText("3");

    await clickKeys(page, "C");
    await expect(resultOutput(page)).toHaveText("0");
    await expect(calculator(page)).not.toContainText("計算式");
  });

  test("returns to editing the expression when backspace follows a result", async ({ page }) => {
    await clickKeys(page, "1+2=B3=");

    await expect(calculator(page)).toContainText("1 ＋ 23 ＝");
    await expect(resultOutput(page)).toHaveText("24");
  });

  test("shows a short error for division by zero and recovers on a digit", async ({ page }) => {
    await clickKeys(page, "5/0=");

    await expect(resultOutput(page)).toHaveText("0で割れません");
    await expect(copyButton(page)).toBeDisabled();

    await clickKeys(page, "7");
    await expect(resultOutput(page)).toHaveText("7");
    await expect(expressionLine(page)).not.toContainText("＝");
  });

  test("recovers from the error on AC and ignores operators while in error", async ({ page }) => {
    await clickKeys(page, "5/0=+");
    await expect(resultOutput(page)).toHaveText("0で割れません");

    await clickKeys(page, "C");
    await expect(resultOutput(page)).toHaveText("0");
  });

  test("lets the divisor be fixed with backspace after the error", async ({ page }) => {
    await clickKeys(page, "5/0=BB2=");

    await expect(resultOutput(page)).toHaveText("2.5");
  });

  test("tells the user when a number reaches the digit limit instead of silently cutting it", async ({
    page,
  }) => {
    await calculator(page).focus();
    await page.keyboard.type("1".repeat(41));

    await expect(resultOutput(page)).toHaveText("1".repeat(40));
    await expect(calculator(page)).toContainText("1つの数値は40桁までです");

    await page.keyboard.type("+");
    await expect(calculator(page)).not.toContainText("1つの数値は40桁までです");
  });

  test("accepts more than 12 digits and only rounds the result", async ({ page }) => {
    await clickKeys(page, "1234567890123-1234567890122=");

    await expect(resultOutput(page)).toHaveText("1");
  });
});

test.describe("Calculator copy", () => {
  test("is enabled only for a computed result", async ({ page }) => {
    await openCalculator(page);

    await clickKeys(page, "1+2");
    await expect(copyButton(page)).toBeDisabled();

    await clickKeys(page, "=");
    await expect(copyButton(page)).toBeEnabled();

    await clickKeys(page, "+");
    await expect(copyButton(page)).toBeDisabled();
  });

  test("copies the displayed 12-digit result and clears the feedback shortly after", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openCalculator(page);

    await clickKeys(page, "1/3=");
    await copyButton(page).click();

    await expect(page.getByText("コピーしました")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("0.333333333333");
    await expect(page.getByText("コピーしました")).toBeHidden();
  });

  test("hides the success feedback as soon as the calculation changes", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openCalculator(page);

    await clickKeys(page, "1+2=");
    await copyButton(page).click();
    await expect(page.getByText("コピーしました")).toBeVisible();

    await clickKeys(page, "C");
    await expect(page.getByText("コピーしました")).toBeHidden();
  });

  test("shows an error when copying fails", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Clipboard unavailable");
          },
        },
      });
    });
    await openCalculator(page);

    await clickKeys(page, "1+2=");
    await copyButton(page).click();

    await expect(page.getByText("コピーできませんでした")).toBeVisible();
  });
});

test.describe("Calculator keyboard", () => {
  test.beforeEach(async ({ page }) => {
    await openCalculator(page);
  });

  test("accepts digits, operators, Enter, Backspace and Escape while focus is in the calculator", async ({
    page,
  }) => {
    await calculator(page).focus();

    await page.keyboard.type("2+3*4");
    await expect(calculator(page)).toContainText("2 ＋ 3 × 4");

    await page.keyboard.press("Enter");
    await expect(resultOutput(page)).toHaveText("14");

    await page.keyboard.press("Backspace");
    await expect(expressionLine(page)).not.toContainText("＝");

    await page.keyboard.press("=");
    await expect(resultOutput(page)).toHaveText("14");

    await page.keyboard.press("Escape");
    await expect(resultOutput(page)).toHaveText("0");
  });

  test("accepts / - . and decimals from the keyboard", async ({ page }) => {
    await calculator(page).focus();

    await page.keyboard.type("7.5/2-.25=");

    await expect(resultOutput(page)).toHaveText("3.5");
  });

  test("keeps accepting shortcuts after a key was clicked with the pointer", async ({ page }) => {
    await key(page, "7").click();
    await page.keyboard.type("8+1");
    await page.keyboard.press("=");

    await expect(resultOutput(page)).toHaveText("79");
  });

  test("ignores shortcuts while focus is on a link outside the calculator", async ({ page }) => {
    await page.getByRole("navigation", { name: "ツール" }).getByRole("link").first().focus();
    await page.keyboard.type("123+4");

    await expect(page).toHaveURL(/\/calculator$/);
    await expect(resultOutput(page)).toHaveText("0");
    await expect(calculator(page)).not.toContainText("計算式");
  });

  test("ignores shortcuts while nothing is focused", async ({ page }) => {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.type("123+4");
    await page.keyboard.press("Escape");

    await expect(resultOutput(page)).toHaveText("0");
    await expect(calculator(page)).not.toContainText("計算式");
  });

  test("stops accepting shortcuts once focus leaves the calculator", async ({ page }) => {
    await key(page, "7").click();
    await page.getByRole("navigation", { name: "ツール" }).getByRole("link").first().focus();
    await page.keyboard.type("88");

    await expect(resultOutput(page)).toHaveText("7");
  });

  test("ignores shortcuts combined with Ctrl, Meta or Alt", async ({ page }) => {
    await calculator(page).focus();

    await page.keyboard.press("Control+1");
    await page.keyboard.press("Alt+2");
    await page.keyboard.press("Meta+3");

    await expect(resultOutput(page)).toHaveText("0");
  });

  test("lets Enter and Space activate a focused key once each, without a double press", async ({
    page,
  }) => {
    await key(page, "7").focus();

    await page.keyboard.press("Enter");
    await expect(resultOutput(page)).toHaveText("7");

    await page.keyboard.press("Space");
    await expect(resultOutput(page)).toHaveText("77");
  });

  test("lets Enter and Space activate Copy once each", async ({ page }) => {
    await page.addInitScript(() => {
      const writes: string[] = [];

      Object.defineProperty(window, "clipboardWrites", { value: writes });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (text: string) => void writes.push(text) },
      });
    });
    await openCalculator(page);
    await clickKeys(page, "1+2=");

    await copyButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("コピーしました")).toBeVisible();
    expect(await clipboardWrites(page)).toEqual(["3"]);

    await page.keyboard.press("Space");
    await expect.poll(() => clipboardWrites(page)).toEqual(["3", "3"]);
    await expect(resultOutput(page)).toHaveText("3");
  });

  test("shows that keyboard input is active only while focus is inside", async ({ page }) => {
    const idle = page.getByText("クリックでキーボード入力");
    const active = page.getByText("キーボード入力 有効");

    await expect(idle).toBeVisible();
    await expect(active).toBeHidden();

    await key(page, "7").click();
    await expect(active).toBeVisible();
    await expect(idle).toBeHidden();

    await page.getByRole("navigation", { name: "ツール" }).getByRole("link").first().focus();
    await expect(idle).toBeVisible();
    await expect(active).toBeHidden();
  });

  test("shows a visible focus ring on a key reached with Tab", async ({ page }) => {
    await page.getByRole("navigation", { name: "ツール" }).getByRole("link").last().focus();
    await page.keyboard.press("Tab");

    await expect(key(page, "C")).toBeFocused();
    await expect(key(page, "C")).not.toHaveCSS("box-shadow", "none");
  });
});

test.describe("Calculator navigation", () => {
  test("lists the tools in order and marks Calculator as current", async ({ page }) => {
    await openCalculator(page);

    const links = page.getByRole("navigation", { name: "ツール" }).getByRole("link");
    const labels = ["JSON整形", "文字数確認", "文字生成", "全角半角", "電卓"];

    await expect(links).toHaveCount(5);

    for (const [index, label] of labels.entries()) {
      await expect(links.nth(index)).toHaveAccessibleName(label);
    }

    await expect(links.nth(4)).toHaveAttribute("aria-current", "page");

    for (const index of [0, 1, 2, 3]) {
      await expect(links.nth(index)).not.toHaveAttribute("aria-current", "page");
    }
  });
});

test.describe("Calculator on a desktop screen", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keeps the card at most 396px wide with a four-column keypad and 2-column spans", async ({
    page,
  }) => {
    await openCalculator(page);

    const card = await boxOf(calculator(page));
    const main = await boxOf(page.getByRole("main"));
    const seven = await boxOf(key(page, "7"));
    const eight = await boxOf(key(page, "8"));
    const nine = await boxOf(key(page, "9"));
    const multiply = await boxOf(key(page, "掛ける"));
    const minus = await boxOf(key(page, "引く"));
    const clear = await boxOf(key(page, "C"));
    const backspace = await boxOf(key(page, "B"));
    const zero = await boxOf(key(page, "0"));
    const equals = await boxOf(key(page, "="));

    expect(card.width).toBeLessThanOrEqual(396);
    expect(card.width).toBeGreaterThan(380);
    expect(Math.abs(card.x + card.width / 2 - (main.x + main.width / 2))).toBeLessThan(2);

    expect(seven.x).toBeLessThan(eight.x);
    expect(eight.x).toBeLessThan(nine.x);
    expect(nine.x).toBeLessThan(multiply.x);
    expect(multiply.x).toBe(minus.x);
    expect(seven.y).toBe(multiply.y);
    expect(Math.round(seven.height)).toBe(49);

    expect(clear.x).toBeCloseTo(seven.x, 0);
    expect(clear.x + clear.width).toBeCloseTo(eight.x + eight.width, 0);
    expect(clear.y).toBe(backspace.y);
    expect(backspace.x).toBeCloseTo(nine.x, 0);

    expect(equals.x).toBeCloseTo(nine.x, 0);
    expect(equals.x + equals.width).toBeCloseTo(multiply.x + multiply.width, 0);
    expect(zero.y).toBe(equals.y);
    expect(zero.x).toBeCloseTo(seven.x, 0);
  });

  test("places Copy inside the display, above the live result", async ({ page }) => {
    await openCalculator(page);

    const copy = await boxOf(copyButton(page));
    const result = await boxOf(resultOutput(page));
    const card = await boxOf(calculator(page));

    expect(copy.y + copy.height).toBeLessThanOrEqual(result.y);
    expect(copy.x + copy.width).toBeLessThanOrEqual(card.x + card.width);
  });
});

for (const width of [390, 375]) {
  test.describe(`Calculator on a ${width}px wide screen`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("fits the viewport with 50px keys and no horizontal scrolling", async ({ page }) => {
      await openCalculator(page);

      const card = await boxOf(calculator(page));
      const seven = await boxOf(key(page, "7"));

      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(width);
      expect(Math.round(seven.height)).toBe(50);
      expect(seven.width).toBeGreaterThanOrEqual(44);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });

    test("keeps long numbers and the error inside the display", async ({ page }) => {
      await openCalculator(page);
      await calculator(page).focus();

      await page.keyboard.type("9".repeat(40));
      await expectResultInsideCard(page);
      expect(await hasHorizontalScroll(page)).toBe(false);

      await page.keyboard.type("/0=");
      await expect(resultOutput(page)).toHaveText("0で割れません");
      await expectResultInsideCard(page);
    });
  });
}

async function openCalculator(page: Page) {
  await page.goto("/calculator");
  await expect(key(page, "C")).toBeEnabled();
}

async function clickKeys(page: Page, sequence: string) {
  for (const character of sequence) {
    await key(page, character).click();
  }
}

async function expectResultInsideCard(page: Page) {
  const card = await boxOf(calculator(page));
  const result = await boxOf(resultOutput(page));

  expect(result.x).toBeGreaterThanOrEqual(card.x);
  expect(result.x + result.width).toBeLessThanOrEqual(card.x + card.width);
}

async function hasHorizontalScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

async function clipboardWrites(page: Page) {
  return page.evaluate(() => (window as unknown as { clipboardWrites: string[] }).clipboardWrites);
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();

  if (box === null) {
    throw new Error("The element has no bounding box");
  }

  return box;
}

function calculator(page: Page) {
  return page.getByRole("region", { name: "電卓" });
}

function keypad(page: Page) {
  return page.getByRole("group", { name: "キーパッド" });
}

function keys(page: Page) {
  return keypad(page).getByRole("button");
}

function key(page: Page, character: string) {
  return keypad(page).getByRole("button", { name: KEY_NAMES[character] ?? character, exact: true });
}

function resultOutput(page: Page) {
  return page.getByRole("status", { name: "計算結果" });
}

function copyButton(page: Page) {
  return page.getByRole("button", { name: "コピー", exact: true });
}

function expressionLine(page: Page) {
  return page.getByTestId("calculator-expression");
}
