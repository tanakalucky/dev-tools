import { expect, test } from "@playwright/test";

test("home page loads and links to the tools in order", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("dev-tools");
  await expect(page.locator("h2")).toHaveText("ツール");

  const links = page.getByRole("main").getByRole("link");
  await expect(links).toHaveText(["JSON Formatter", "Character Count"]);

  await links.nth(0).click();

  await expect(page).toHaveURL(/\/json$/);
  await expect(page.locator("h1")).toContainText("JSON Formatter");
});

test("home page links to the Character Count tool", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("main").getByRole("link", { name: "Character Count" }).click();

  await expect(page).toHaveURL(/\/character-count$/);
  await expect(page.locator("h1")).toContainText("Character Count");
});
