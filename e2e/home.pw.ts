import { expect, test, type Locator, type Page } from "@playwright/test";

test("home page loads and links to the tools in order", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("dev-tools");
  await expect(page.locator("h2")).toHaveText("ツール");

  const links = page.getByRole("main").getByRole("link");
  await expect(links).toHaveText(["JSON整形", "文字数確認", "文字生成"]);

  await links.nth(0).click();

  await expect(page).toHaveURL(/\/json$/);
  await expect(page.locator("h1")).toContainText("JSON Formatter");
});

test("home page links to the Character Count tool", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("main").getByRole("link", { name: "文字数確認" }).click();

  await expect(page).toHaveURL(/\/character-count$/);
  await expect(page.locator("h1")).toContainText("Character Count");
});

test("home page links to the Character Generator tool", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("main").getByRole("link", { name: "文字生成" }).click();

  await expect(page).toHaveURL(/\/character-generator$/);
  await expect(page.locator("h1")).toContainText("Character Generator");
});

test.describe("sidebar navigation labels on a desktop screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("keeps the sidebar width and shows no full label for text that fits", async ({ page }) => {
    await expect(sidebar(page)).toHaveJSProperty("offsetWidth", 208);
    expect(
      await sidebar(page).evaluate((element) => element.scrollWidth > element.clientWidth),
    ).toBe(false);

    for (const label of NAVIGATION_LABELS) {
      const link = sidebarLink(page, label);

      await link.hover();
      await expect(fullLabel(link, label)).toHaveCount(0);

      await link.focus();
      await expect(fullLabel(link, label)).toHaveCount(0);
    }
  });

  test("truncates a label that does not fit and reveals it on hover and focus until Escape", async ({
    page,
  }) => {
    await sidebar(page).evaluate((element) => {
      element.style.width = "8rem";
    });

    const link = sidebarLink(page, "文字数確認");
    await expect(link.locator("span.truncate")).toHaveCSS("text-overflow", "ellipsis");
    expect(
      await link
        .locator("span.truncate")
        .evaluate((element) => element.scrollWidth > element.clientWidth),
    ).toBe(true);
    expect(
      await sidebar(page).evaluate((element) => element.scrollWidth > element.clientWidth),
    ).toBe(false);
    await expect(fullLabel(link, "文字数確認")).toHaveCount(0);

    await link.hover();
    await expect(fullLabel(link, "文字数確認")).toBeVisible();

    await page.mouse.move(700, 400);
    await expect(fullLabel(link, "文字数確認")).toHaveCount(0);

    await sidebarLink(page, "JSON整形").focus();
    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    await expect(fullLabel(link, "文字数確認")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(fullLabel(link, "文字数確認")).toHaveCount(0);
  });
});

test.describe("sidebar navigation labels on a narrow screen", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("keeps every link reachable without horizontal scrolling of the page", async ({ page }) => {
    await page.goto("/");

    for (const label of NAVIGATION_LABELS) {
      await expect(sidebarLink(page, label)).toBeAttached();
    }

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
    expect(
      await sidebar(page).evaluate((element) => element.scrollWidth > element.clientWidth),
    ).toBe(false);
  });
});

const NAVIGATION_LABELS = ["JSON整形", "文字数確認", "文字生成"];

function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "ツール" });
}

function sidebarLink(page: Page, label: string) {
  return sidebar(page).getByRole("link", { name: label });
}

function fullLabel(link: Locator, label: string) {
  return link.locator("span[aria-hidden]").filter({ hasText: label });
}
