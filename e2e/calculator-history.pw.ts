import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "dev-tools.calculator.history";
const seedEntry = {
  id: "seed",
  calculation: {
    operands: ["1", "2"],
    operators: ["+"],
    outcome: { kind: "result", text: "3", raw: "3" },
    carryDisplay: null,
    notice: null,
  },
};
const history = (page: Page) => page.getByRole("region", { name: "計算履歴" });
const rows = (page: Page) => history(page).getByRole("listitem");
const calculator = (page: Page) => page.getByRole("region", { name: "電卓", exact: true });
const result = (page: Page) => calculator(page).getByRole("status", { name: "計算結果" });

async function open(page: Page) {
  await page.goto("/calculator");
  await expect(calculator(page).getByRole("button", { name: "すべてクリア" })).toBeEnabled();
}
async function enter(page: Page, sequence: string) {
  await calculator(page).focus();
  await page.keyboard.type(sequence);
}
async function savedCount(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{"entries":[]}').entries.length,
    STORAGE_KEY,
  );
}
async function seed(page: Page, value: string) {
  await page.goto("/calculator");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value,
  });
  await open(page);
}

test.describe("Calculator persistent history (Arrange / Act / Assert)", () => {
  test("loads saved entries before enabling input and keeps displayed/persisted history identical on reload", async ({
    page,
  }) => {
    // Arrange
    await seed(page, JSON.stringify({ version: 1, entries: [seedEntry] }));
    // Act
    await page.reload();
    await expect(rows(page)).toHaveCount(1);
    await enter(page, "4+5===");
    await expect(rows(page)).toHaveCount(2);
    await expect.poll(() => savedCount(page)).toBe(2);
    await page.reload();
    // Assert
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText("4 ＋ 5 ＝");
    await expect(rows(page).last()).toContainText("1 ＋ 2 ＝");
    await expect(result(page)).toHaveText("0");
    expect(await savedCount(page)).toBe(2);
  });

  test("restores an editable expression, focuses the calculator, and preserves the source after recalculation", async ({
    page,
  }) => {
    // Arrange
    await open(page);
    await enter(page, "1+2=");
    // Act
    await rows(page).first().getByRole("button", { name: "式を直す" }).click();
    await expect(calculator(page)).toBeFocused();
    await expect(page.getByTestId("calculator-expression")).toContainText("1 ＋ 2");
    await page.keyboard.type("3=");
    // Assert
    await expect(result(page)).toHaveText("24");
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).last()).toContainText("1 ＋ 2 ＝");
    await expect.poll(() => savedCount(page)).toBe(2);
  });

  test("continues from the raw 40-digit result after reload, then restores the continued expression again", async ({
    page,
  }) => {
    // Arrange
    await open(page);
    await enter(page, "1/3=");
    await expect.poll(() => savedCount(page)).toBe(1);
    await page.reload();
    // Act
    await rows(page).first().getByRole("button", { name: "結果から続ける" }).click();
    await expect(result(page)).toHaveText("0.333333333333");
    await page.keyboard.type("*3=");
    await expect(result(page)).toHaveText("1");
    await expect.poll(() => savedCount(page)).toBe(2);
    await page.reload();
    await rows(page).first().getByRole("button", { name: "式を直す" }).click();
    await page.keyboard.type("=");
    // Assert
    await expect(result(page)).toHaveText("1");
    await expect(rows(page)).toHaveCount(3);
  });

  test("deletes individual entries, confirms all-delete, and keeps empty history after reload", async ({
    page,
  }) => {
    // Arrange
    await open(page);
    await enter(page, "1+2=*4=");
    // Act
    await rows(page)
      .last()
      .getByRole("button", { name: /の履歴を削除/ })
      .click();
    await expect(rows(page)).toHaveCount(1);
    await expect.poll(() => savedCount(page)).toBe(1);
    await page.reload();
    await expect(rows(page).first()).toContainText("3 × 4 ＝");
    page.once("dialog", (dialog) => dialog.dismiss());
    await history(page).getByRole("button", { name: "全削除" }).click();
    await expect(rows(page)).toHaveCount(1);
    page.once("dialog", (dialog) => dialog.accept());
    await history(page).getByRole("button", { name: "全削除" }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => savedCount(page)).toBe(0);
    await page.reload();
    // Assert
    await expect(rows(page)).toHaveCount(0);
    await expect(history(page).getByText("履歴はありません")).toBeVisible();
    await expect(history(page).getByRole("button", { name: "全削除" })).toBeDisabled();
  });

  test("evicts the oldest calculation at 51 and persists exactly the displayed 50", async ({
    page,
  }) => {
    // Arrange
    const entries = Array.from({ length: 50 }, (_, index) => ({
      ...seedEntry,
      id: `seed-${index}`,
    }));
    await seed(page, JSON.stringify({ version: 1, entries }));
    await expect(rows(page)).toHaveCount(50);
    // Act
    await enter(page, "9+9===");
    await expect(rows(page).first()).toContainText("9 ＋ 9 ＝");
    await expect
      .poll(async () =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!).entries[0].calculation.outcome.text,
          STORAGE_KEY,
        ),
      )
      .toBe("18");
    await page.reload();
    // Assert
    await expect(rows(page)).toHaveCount(50);
    const ids = await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)!).entries.map((entry: { id: string }) => entry.id),
      STORAGE_KEY,
    );
    expect(ids).toContain("seed-48");
    expect(ids).not.toContain("seed-49");
    await expect(rows(page).first()).toContainText("9 ＋ 9 ＝");
  });

  for (const [name, data] of [
    ["corrupt JSON", "{"],
    ["old format", '{"version":0,"entries":[]}'],
    ["malformed entries", '{"version":1,"entries":[null,{"id":"bad"}]}'],
  ]) {
    test(`recovers from ${name}`, async ({ page }) => {
      // Arrange
      await seed(page, data!);
      // Act
      await expect(rows(page)).toHaveCount(0);
      await enter(page, "2+3=");
      await page.reload();
      // Assert
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText("2 ＋ 3 ＝");
    });
  }

  test("stays usable with blocked storage reads and never overwrites unread data", async ({
    page,
  }) => {
    // Arrange
    await seed(page, JSON.stringify({ version: 1, entries: [seedEntry] }));
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("Read denied");
      };
      Storage.prototype.setItem = () => {
        throw new Error("Must not write unread storage");
      };
    });
    // Act
    await open(page);
    await enter(page, "2+3=");
    // Assert
    await expect(result(page)).toHaveText("5");
    await expect(rows(page)).toHaveCount(1);
    await expect(history(page)).toContainText("履歴を読み込めません");
    await expect(history(page)).not.toContainText("履歴を保存できません");
  });

  test("reports write failure, keeps current history, and retries after the next change", async ({
    page,
  }) => {
    // Arrange
    await open(page);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      let failed = false;
      Storage.prototype.setItem = function (key, value) {
        if (!failed) {
          failed = true;
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return original.call(this, key, value);
      };
    });
    // Act
    await enter(page, "1+2=");
    await expect(history(page)).toContainText("履歴を保存できません");
    await expect(rows(page)).toHaveCount(1);
    expect(await savedCount(page)).toBe(0);
    await enter(page, "*4=");
    // Assert
    await expect(result(page)).toHaveText("12");
    await expect(history(page)).not.toContainText("履歴を保存できません");
    await expect.poll(() => savedCount(page)).toBe(2);
    await page.reload();
    await expect(rows(page)).toHaveCount(2);
  });

  test("restores error expressions for repair and disables continuation from errors", async ({
    page,
  }) => {
    // Arrange
    await open(page);
    await enter(page, "5/0=");
    // Act
    await expect(rows(page).first().getByRole("button", { name: "結果から続ける" })).toBeDisabled();
    await rows(page).first().getByRole("button", { name: "式を直す" }).click();
    await page.keyboard.press("Backspace");
    await page.keyboard.type("2=");
    // Assert
    await expect(result(page)).toHaveText("2.5");
    await expect(rows(page)).toHaveCount(2);
  });
});

for (const width of [1440, 390, 320]) {
  test(`history fits a ${width}px screen with long expressions and usable controls`, async ({
    page,
  }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height: 1000 });
    await open(page);
    await enter(page, "128+64=");
    await enter(page, "9999999999999999999999999999999999999999+1=");
    // Act
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const controls = await rows(page).first().getByRole("button").all();
    // Assert
    expect(overflow).toBe(false);
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: testInfo.outputPath(`history-${width}.png`), fullPage: true });
  });
}
