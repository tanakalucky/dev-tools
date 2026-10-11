import { expect, test, type Page } from "@playwright/test";

const FORMATTED_NAME_TEST = '{\n  "name": "test"\n}';

test.describe("JSON Formatter", () => {
  test.beforeEach(async ({ page }) => {
    await openJsonFormatter(page);
  });

  test("formats ordinary JSON with two spaces only when the button is pressed", async ({
    page,
  }) => {
    await inputField(page).fill('{"name":"test"}');

    await expect(outputRegion(page)).toHaveJSProperty("textContent", "");

    await formatButton(page).click();

    await expect(outputRegion(page)).toHaveJSProperty("textContent", FORMATTED_NAME_TEST);
    await expect(inputField(page)).toHaveValue('{"name":"test"}');
  });

  test("formats the bare terminal form with escaped quotes", async ({ page }) => {
    await inputField(page).fill(String.raw`{\"name\":\"test\"}`);
    await formatButton(page).click();

    await expect(outputRegion(page)).toHaveJSProperty("textContent", FORMATTED_NAME_TEST);
  });

  test("keeps literal backslashes when unescaping the terminal form", async ({ page }) => {
    await inputField(page).fill(String.raw`{\"path\":\"C:\\dir\"}`);
    await formatButton(page).click();

    await expect(outputRegion(page)).toHaveJSProperty(
      "textContent",
      ["{", String.raw`  "path": "C:\\dir"`, "}"].join("\n"),
    );
  });

  test("shows an error and keeps the input for mixed malformed input", async ({ page }) => {
    const malformed = String.raw`{\"a\":"b"}`;

    await inputField(page).fill(malformed);
    await formatButton(page).click();

    await expect(page.getByRole("alert")).toContainText("JSONとして解析できません");
    await expect(inputField(page)).toHaveValue(malformed);
    await expect(outputRegion(page)).toHaveJSProperty("textContent", "");
    await expect(copyButton(page)).toBeDisabled();
  });

  test("clears the previous result and disables copy when input changes", async ({ page }) => {
    await inputField(page).fill('{"name":"test"}');
    await formatButton(page).click();
    await expect(outputRegion(page)).toHaveJSProperty("textContent", FORMATTED_NAME_TEST);

    await inputField(page).fill("{broken");
    await expect(outputRegion(page)).toHaveJSProperty("textContent", "");
    await expect(copyButton(page)).toBeDisabled();
    await formatButton(page).click();

    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("copies the formatted result", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await expect(copyButton(page)).toBeDisabled();

    await inputField(page).fill('{"name":"test"}');
    await formatButton(page).click();
    await copyButton(page).click();

    await expect(page.getByText("コピーしました")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(FORMATTED_NAME_TEST);
  });

  test("clears the input and the result", async ({ page }) => {
    await inputField(page).fill('{"name":"test"}');
    await formatButton(page).click();
    await expect(outputRegion(page)).toHaveJSProperty("textContent", FORMATTED_NAME_TEST);

    await page.getByRole("button", { name: "クリア" }).click();

    await expect(inputField(page)).toHaveValue("");
    await expect(outputRegion(page)).toHaveJSProperty("textContent", "");
    await expect(copyButton(page)).toBeDisabled();
  });

  test("marks JSON Formatter as current in the left navigation", async ({ page }) => {
    const navigation = page.getByRole("navigation", { name: "ツール" });
    const link = navigation.getByRole("link", { name: "JSON Formatter" });

    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByRole("link", { name: "Character Count" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    const navigationBox = await navigation.boundingBox();
    const mainBox = await page.getByRole("main").boundingBox();

    expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(mainBox!.x);
  });
});

test.describe("JSON Formatter on a narrow screen", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("keeps navigation visible above the content and formats without horizontal scrolling", async ({
    page,
  }) => {
    await openJsonFormatter(page);

    const navigation = page.getByRole("navigation", { name: "ツール" });
    await expect(navigation.getByRole("link", { name: "JSON Formatter" })).toBeVisible();

    const navigationBox = await navigation.boundingBox();
    const mainBox = await page.getByRole("main").boundingBox();

    expect(navigationBox!.y + navigationBox!.height).toBeLessThanOrEqual(mainBox!.y);

    await inputField(page).fill('{"name":"test"}');
    await formatButton(page).click();

    await expect(outputRegion(page)).toHaveJSProperty("textContent", FORMATTED_NAME_TEST);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

async function openJsonFormatter(page: Page) {
  await page.goto("/json");
  await expect(formatButton(page)).toBeEnabled();
}

function inputField(page: Page) {
  return page.getByLabel("入力", { exact: true });
}

function outputRegion(page: Page) {
  return page.getByRole("region", { name: "出力" });
}

function formatButton(page: Page) {
  return page.getByRole("button", { name: "整形する" });
}

function copyButton(page: Page) {
  return page.getByRole("button", { name: "結果をコピー" });
}
