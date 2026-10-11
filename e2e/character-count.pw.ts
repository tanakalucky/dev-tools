import { expect, test, type Page } from "@playwright/test";

test.describe("Character Count", () => {
  test.beforeEach(async ({ page }) => {
    await openCharacterCount(page);
  });

  test("starts at zero and updates the count as the user types", async ({ page }) => {
    await expect(countOutput(page)).toHaveText("0");

    await textField(page).pressSequentially("abc");
    await expect(countOutput(page)).toHaveText("3");

    await textField(page).press("Backspace");
    await expect(countOutput(page)).toHaveText("2");
  });

  test("counts Japanese text and emoji as visible characters", async ({ page }) => {
    await textField(page).fill("こんにちは👨‍👩‍👧‍👦");

    await expect(countOutput(page)).toHaveText("6");
  });

  test("excludes newlines but includes ASCII spaces, full-width spaces and tabs", async ({
    page,
  }) => {
    await textField(page).fill("a b　c\td\ne\n\nf");

    await expect(countOutput(page)).toHaveText("9");
  });

  test("has no buttons on the page", async ({ page }) => {
    await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
  });

  test("lists the tools in order in the left navigation", async ({ page }) => {
    const navigation = page.getByRole("navigation", { name: "ツール" });
    const links = navigation.getByRole("link");

    await expect(links).toHaveCount(4);
    await expect(links.nth(0)).toHaveAccessibleName("JSON整形");
    await expect(links.nth(1)).toHaveAccessibleName("文字数確認");
    await expect(links.nth(2)).toHaveAccessibleName("文字生成");
    await expect(links.nth(3)).toHaveAccessibleName("全角半角");
    await expect(links.nth(1)).toHaveAttribute("aria-current", "page");
    await expect(links.nth(0)).not.toHaveAttribute("aria-current", "page");

    const navigationBox = await navigation.boundingBox();
    const mainBox = await page.getByRole("main").boundingBox();

    expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(mainBox!.x);
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

test.describe("Character Count on a desktop screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("places the input on the left and the count on the right", async ({ page }) => {
    await openCharacterCount(page);

    const inputBox = await textField(page).boundingBox();
    const countBox = await countOutput(page).boundingBox();

    expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(countBox!.x);
  });
});

test.describe("Character Count on a narrow screen", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("keeps navigation above the content and counts without horizontal scrolling", async ({
    page,
  }) => {
    await openCharacterCount(page);

    const navigation = page.getByRole("navigation", { name: "ツール" });
    await expect(navigation.getByRole("link", { name: "文字数確認" })).toBeVisible();

    const navigationBox = await navigation.boundingBox();
    const mainBox = await page.getByRole("main").boundingBox();

    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(mainBox!.y);

    const inputBox = await textField(page).boundingBox();
    const countBox = await countOutput(page).boundingBox();

    expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(countBox!.y);

    await textField(page).fill("a".repeat(500));
    await expect(countOutput(page)).toHaveText("500");

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

async function openCharacterCount(page: Page) {
  await page.goto("/character-count");
  await expect(textField(page)).toBeEnabled();
}

function textField(page: Page) {
  return page.getByLabel("テキスト", { exact: true });
}

function countOutput(page: Page) {
  return page.getByRole("status", { name: "文字数" });
}
