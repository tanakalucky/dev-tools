import { expect, test } from "@playwright/test";

test("home page loads and links to the JSON formatter", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("dev-tools");
  await expect(page.locator("h2")).toHaveText("ツール");

  await page.getByRole("main").getByRole("link", { name: "JSON Formatter" }).click();

  await expect(page).toHaveURL(/\/json$/);
  await expect(page.locator("h1")).toContainText("JSON Formatter");
});
