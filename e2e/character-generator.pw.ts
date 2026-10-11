import { expect, test, type Page } from "@playwright/test";

const HIRAGANA_PATTERN =
  "[あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん]";

const INVALID_LENGTHS = ["", "0", "10001", "-3", "1.5", "1e2"];

test.describe("Character Generator", () => {
  test.beforeEach(async ({ page }) => {
    await openCharacterGenerator(page);
  });

  test("starts with length 10, hiragana, no result and a disabled copy button", async ({
    page,
  }) => {
    await expect(lengthField(page)).toHaveValue("10");
    await expect(typeSelect(page)).toHaveValue("hiragana");
    await expect(resultField(page)).toHaveValue("");
    await expect(copyButton(page)).toBeDisabled();
  });

  test("generates 10 unvoiced hiragana only when the button is pressed", async ({ page }) => {
    await expect(resultField(page)).toHaveValue("");

    await generateButton(page).click();

    await expect(resultField(page)).toHaveValue(new RegExp(`^${HIRAGANA_PATTERN}{10}$`));
    await expect(copyButton(page)).toBeEnabled();
  });

  test("generates ASCII letters and digits of the requested length", async ({ page }) => {
    await typeSelect(page).selectOption("alphanumeric");
    await lengthField(page).fill("62");
    await generateButton(page).click();

    await expect(resultField(page)).toHaveValue(/^[a-zA-Z0-9]{62}$/);
  });

  test("generates at both ends of the allowed range", async ({ page }) => {
    await lengthField(page).fill("1");
    await generateButton(page).click();
    await expect(resultField(page)).toHaveValue(new RegExp(`^${HIRAGANA_PATTERN}$`));

    await lengthField(page).fill("10000");
    await generateButton(page).click();
    expect(await resultField(page).inputValue()).toHaveLength(10000);
  });

  test("generates when Enter is pressed in the length field", async ({ page }) => {
    await lengthField(page).fill("5");
    await lengthField(page).press("Enter");

    await expect(resultField(page)).toHaveValue(new RegExp(`^${HIRAGANA_PATTERN}{5}$`));
  });

  for (const invalidLength of INVALID_LENGTHS) {
    test(`shows an error and keeps the input for length "${invalidLength}"`, async ({ page }) => {
      await lengthField(page).fill(invalidLength);
      await generateButton(page).click();

      await expect(page.getByRole("alert")).toContainText("1〜10000の整数");
      await expect(lengthField(page)).toHaveValue(invalidLength);
      await expect(lengthField(page)).toHaveAttribute("aria-invalid", "true");
      await expect(resultField(page)).toHaveValue("");
      await expect(copyButton(page)).toBeDisabled();
    });
  }

  test("clears the previous result when the length is invalid and recovers after fixing it", async ({
    page,
  }) => {
    await generateButton(page).click();
    await expect(resultField(page)).not.toHaveValue("");

    await lengthField(page).fill("0");
    await generateButton(page).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(resultField(page)).toHaveValue("");

    await lengthField(page).fill("3");
    await expect(page.getByRole("alert")).toHaveCount(0);

    await generateButton(page).click();

    await expect(resultField(page)).toHaveValue(new RegExp(`^${HIRAGANA_PATTERN}{3}$`));
  });

  test("copies the generated result", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await typeSelect(page).selectOption("alphanumeric");
    await lengthField(page).fill("30");
    await generateButton(page).click();
    await copyButton(page).click();

    await expect(page.getByText("コピーしました")).toBeVisible();

    const generated = await resultField(page).inputValue();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(generated);
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
    await expect(generateButton(page)).toBeEnabled();

    await generateButton(page).click();
    await copyButton(page).click();

    await expect(page.getByText("コピーできませんでした")).toBeVisible();
  });

  test("lists the tools in order and marks Character Generator as current", async ({ page }) => {
    const navigation = page.getByRole("navigation", { name: "ツール" });
    const links = navigation.getByRole("link");

    await expect(links).toHaveCount(3);
    await expect(links.nth(2)).toHaveAccessibleName("文字生成");
    await expect(links.nth(2)).toHaveAttribute("aria-current", "page");
    await expect(links.nth(0)).not.toHaveAttribute("aria-current", "page");
    await expect(links.nth(1)).not.toHaveAttribute("aria-current", "page");
  });

  test("moves to the JSON Formatter from the navigation", async ({ page }) => {
    await page
      .getByRole("navigation", { name: "ツール" })
      .getByRole("link", { name: "JSON整形" })
      .click();

    await expect(page).toHaveURL(/\/json$/);
    await expect(page.locator("h1")).toContainText("JSON Formatter");
  });
});

test.describe("Character Generator on a desktop screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("places the settings on the left, the result on the right and Copy at the end of the result header", async ({
    page,
  }) => {
    await openCharacterGenerator(page);

    const lengthBox = await lengthField(page).boundingBox();
    const generateBox = await generateButton(page).boundingBox();
    const resultBox = await resultField(page).boundingBox();
    const copyBox = await copyButton(page).boundingBox();

    expect(lengthBox!.x + lengthBox!.width).toBeLessThanOrEqual(resultBox!.x);
    expect(generateBox!.x + generateBox!.width).toBeLessThanOrEqual(resultBox!.x);
    expect(generateBox!.width).toBeLessThan(resultBox!.width);

    const copyRightEdge = copyBox!.x + copyBox!.width;
    const resultRightEdge = resultBox!.x + resultBox!.width;

    expect(copyBox!.y + copyBox!.height).toBeLessThanOrEqual(resultBox!.y);
    expect(resultRightEdge - copyRightEdge).toBeLessThan(24);
    expect(resultRightEdge - copyRightEdge).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Character Generator on a narrow screen", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("stacks the settings above the result and generates without horizontal scrolling", async ({
    page,
  }) => {
    await openCharacterGenerator(page);

    const navigation = page.getByRole("navigation", { name: "ツール" });
    const navigationBox = await navigation.boundingBox();
    const mainBox = await page.getByRole("main").boundingBox();

    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(mainBox!.y);

    const generateBox = await generateButton(page).boundingBox();
    const resultBox = await resultField(page).boundingBox();

    expect(generateBox!.y + generateBox!.height).toBeLessThanOrEqual(resultBox!.y);

    await typeSelect(page).selectOption("alphanumeric");
    await lengthField(page).fill("10000");
    await generateButton(page).click();
    expect(await resultField(page).inputValue()).toHaveLength(10000);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

async function openCharacterGenerator(page: Page) {
  await page.goto("/character-generator");
  await expect(generateButton(page)).toBeEnabled();
}

function lengthField(page: Page) {
  return page.getByLabel("文字数", { exact: true });
}

function typeSelect(page: Page) {
  return page.getByLabel("文字の種類", { exact: true });
}

function generateButton(page: Page) {
  return page.getByRole("button", { name: "生成する" });
}

function resultField(page: Page) {
  return page.getByLabel("生成結果", { exact: true });
}

function copyButton(page: Page) {
  return page.getByRole("button", { name: "コピー" });
}
