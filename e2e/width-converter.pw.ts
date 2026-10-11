import { expect, test, type Page } from "@playwright/test";

const FULL_WIDTH_SAMPLE = "ＡＢＣ１２３　ガ￥";
const HALF_WIDTH_SAMPLE = "ABC123 ｶﾞ¥";

test.describe("Width Converter", () => {
  test.beforeEach(async ({ page }) => {
    await openWidthConverter(page);
  });

  test("starts with 全角 → 半角, empty fields and a disabled copy button", async ({ page }) => {
    await expect(directionSelect(page)).toHaveValue("to-half");
    await expect(inputField(page)).toHaveValue("");
    await expect(resultField(page)).toHaveValue("");
    await expect(copyButton(page)).toBeDisabled();
  });

  test("converts only when the button is pressed, not while typing", async ({ page }) => {
    await inputField(page).fill(FULL_WIDTH_SAMPLE);
    await expect(resultField(page)).toHaveValue("");

    await convertButton(page).click();

    await expect(resultField(page)).toHaveValue(HALF_WIDTH_SAMPLE);
    await expect(copyButton(page)).toBeEnabled();

    await inputField(page).fill("Ａ");
    await expect(resultField(page)).toHaveValue(HALF_WIDTH_SAMPLE);

    await convertButton(page).click();

    await expect(resultField(page)).toHaveValue("A");
  });

  test("converts from halfwidth to fullwidth after switching the direction", async ({ page }) => {
    await directionSelect(page).selectOption("to-full");
    await inputField(page).fill(HALF_WIDTH_SAMPLE);
    await convertButton(page).click();

    await expect(resultField(page)).toHaveValue(FULL_WIDTH_SAMPLE);
  });

  test("keeps the previous result until Convert is pressed after changing direction", async ({
    page,
  }) => {
    await inputField(page).fill(FULL_WIDTH_SAMPLE);
    await convertButton(page).click();
    await expect(resultField(page)).toHaveValue(HALF_WIDTH_SAMPLE);

    await directionSelect(page).selectOption("to-full");
    await expect(resultField(page)).toHaveValue(HALF_WIDTH_SAMPLE);

    await inputField(page).fill(HALF_WIDTH_SAMPLE);
    await convertButton(page).click();
    await expect(resultField(page)).toHaveValue(FULL_WIDTH_SAMPLE);
  });

  test("keeps Copy disabled after converting an empty input", async ({ page }) => {
    await convertButton(page).click();

    await expect(resultField(page)).toHaveValue("");
    await expect(copyButton(page)).toBeDisabled();
  });

  test("keeps the result read-only", async ({ page }) => {
    await expect(resultField(page)).toHaveAttribute("readonly", "");
    await expect(inputField(page)).not.toHaveAttribute("readonly", "");
  });

  test("copies the converted result", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await inputField(page).fill(FULL_WIDTH_SAMPLE);
    await convertButton(page).click();
    await copyButton(page).click();

    await expect(page.getByText("コピーしました")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(HALF_WIDTH_SAMPLE);
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
    await page.reload();
    await expect(convertButton(page)).toBeEnabled();

    await inputField(page).fill(FULL_WIDTH_SAMPLE);
    await convertButton(page).click();
    await copyButton(page).click();

    await expect(page.getByText("コピーできませんでした")).toBeVisible();
  });

  test("lists the tools in order and marks Width Converter as current", async ({ page }) => {
    const links = page.getByRole("navigation", { name: "ツール" }).getByRole("link");

    await expect(links).toHaveCount(4);
    await expect(links.nth(3)).toHaveAccessibleName("全角半角");
    await expect(links.nth(3)).toHaveAttribute("aria-current", "page");

    for (const index of [0, 1, 2]) {
      await expect(links.nth(index)).not.toHaveAttribute("aria-current", "page");
    }
  });
});

test.describe("Width Converter on a desktop screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("places the input on the left, the result on the right and Copy at the end of the result header", async ({
    page,
  }) => {
    await openWidthConverter(page);

    const inputBox = await inputField(page).boundingBox();
    const resultBox = await resultField(page).boundingBox();
    const convertBox = await convertButton(page).boundingBox();
    const copyBox = await copyButton(page).boundingBox();

    expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(resultBox!.x);
    expect(inputBox!.y).toBe(resultBox!.y);
    expect(convertBox!.y + convertBox!.height).toBeLessThanOrEqual(inputBox!.y);

    const copyRightEdge = copyBox!.x + copyBox!.width;
    const resultRightEdge = resultBox!.x + resultBox!.width;

    expect(copyBox!.y + copyBox!.height).toBeLessThanOrEqual(resultBox!.y);
    expect(resultRightEdge - copyRightEdge).toBeLessThan(24);
    expect(resultRightEdge - copyRightEdge).toBeGreaterThanOrEqual(0);
  });

  test("gives the Convert button no box shadow", async ({ page }) => {
    await openWidthConverter(page);

    await expect(convertButton(page)).toHaveCSS("box-shadow", "none");
  });
});

test.describe("Width Converter on a narrow screen", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("stacks the input above the result and converts long text without horizontal scrolling", async ({
    page,
  }) => {
    await openWidthConverter(page);

    const inputBox = await inputField(page).boundingBox();
    const resultBox = await resultField(page).boundingBox();

    expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(resultBox!.y);
    expect(inputBox!.x).toBe(resultBox!.x);

    await inputField(page).fill("Ａ".repeat(5000));
    await convertButton(page).click();
    await expect(resultField(page)).toHaveValue("A".repeat(5000));

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

async function openWidthConverter(page: Page) {
  await page.goto("/width-converter");
  await expect(convertButton(page)).toBeEnabled();
}

function directionSelect(page: Page) {
  return page.getByLabel("変換の方向", { exact: true });
}

function inputField(page: Page) {
  return page.getByLabel("入力", { exact: true });
}

function resultField(page: Page) {
  return page.getByLabel("変換結果", { exact: true });
}

function convertButton(page: Page) {
  return page.getByRole("button", { name: "変換する" });
}

function copyButton(page: Page) {
  return page.getByRole("button", { name: "コピー" });
}
