import { expect, test } from "@playwright/test";

test("home page loads and shows title", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("dev-tools");
  await expect(page.locator("h2")).toHaveText("ツール");
});
