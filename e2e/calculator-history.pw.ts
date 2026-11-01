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
    if (width < 768) await page.getByRole("button", { name: "履歴 2", exact: true }).click();
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

for (const [width, height] of [
  [1440, 900],
  [1024, 600],
  [768, 480],
] as const) {
  test(`desktop ${width}x${height} confines scrolling to the history and expression`, async ({
    page,
  }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height });
    await open(page);
    const emptyCalculator = await calculator(page).boundingBox();
    const emptyHistory = await history(page).boundingBox();
    const entries = Array.from({ length: 50 }, (_, index) => ({
      ...seedEntry,
      id: `layout-${index}`,
    }));
    await seed(page, JSON.stringify({ version: 1, entries }));
    // Act
    await enter(page, "9".repeat(40) + "+1".repeat(15) + "=");
    const list = history(page).getByRole("list", { name: "計算履歴一覧" });
    await list.focus();
    await page.keyboard.press("End");
    const lastDelete = rows(page)
      .last()
      .getByRole("button", { name: /の履歴を削除/ });
    await lastDelete.focus();
    // Assert
    await expect(page.getByText("ちょっとした計算を、すぐ手元で。")).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: /dev tools/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "ツール" }).getByRole("link")).toHaveCount(5);
    expect(
      await page.evaluate(() => ({
        x: document.documentElement.scrollWidth > innerWidth,
        y: document.documentElement.scrollHeight > innerHeight,
        top: scrollY,
      })),
    ).toEqual({ x: false, y: false, top: 0 });
    const left = await calculator(page).boundingBox();
    const right = await history(page).boundingBox();
    expect(left!.x + left!.width).toBeLessThan(right!.x);
    expect(left!.y).toBe(right!.y);
    expect(left!.height).toBe(right!.height);
    expect(left!.y + left!.height).toBe(right!.y + right!.height);
    expect(left!.height).toBe(emptyCalculator!.height);
    expect(right!.height).toBe(emptyHistory!.height);
    expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    for (const button of [...(await calculator(page).getByRole("button").all()), lastDelete]) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    }
    await expect(lastDelete).toBeFocused();
    await rows(page).last().getByRole("button", { name: "式を直す" }).focus();
    await page.keyboard.press("Enter");
    await expect(calculator(page)).toBeFocused();
    await page.keyboard.type("3=");
    await expect(result(page)).toHaveText("24");
    await page.screenshot({
      path: testInfo.outputPath(`desktop-${width}-${height}.png`),
      fullPage: true,
    });
  });
}

for (const [width, height] of [
  [390, 800],
  [320, 568],
  [390, 480],
] as const) {
  test(`mobile ${width}x${height} switches panels without losing input and restores keyboard focus`, async ({
    page,
  }, testInfo) => {
    // Arrange
    await page.setViewportSize({ width, height });
    await open(page);
    await enter(page, "12+");
    // Act
    await page.getByRole("button", { name: "履歴 0", exact: true }).click();
    await expect(calculator(page)).toHaveCount(0);
    await expect(history(page)).toContainText("履歴はありません");
    await page.getByRole("button", { name: "電卓", exact: true }).click();
    await expect(page.getByTestId("calculator-expression")).toContainText("12 ＋");
    await enter(page, "3=");
    const saved = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    await page.getByRole("button", { name: "履歴 1", exact: true }).focus();
    await page.keyboard.press("Enter");
    await rows(page).first().getByRole("button", { name: "式を直す" }).click();
    await expect(calculator(page)).toBeFocused();
    await expect(history(page)).toHaveCount(0);
    await page.keyboard.type("4=");
    await expect(result(page)).toHaveText("46");
    await enter(page, "1/3=");
    await page.getByRole("button", { name: "履歴 3", exact: true }).click();
    await rows(page).first().getByRole("button", { name: "結果から続ける" }).click();
    await expect(calculator(page)).toBeFocused();
    await page.keyboard.type("*3=");
    // Assert
    await expect(result(page)).toHaveText("1");
    expect(saved).toContain('"text":"15"');
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight > innerHeight ||
          document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    for (const button of await calculator(page).getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    }
    await page.screenshot({
      path: testInfo.outputPath(`mobile-calculator-${width}-${height}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "履歴 4", exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`mobile-history-${width}-${height}.png`),
      fullPage: true,
    });
    await page.reload();
    await expect(calculator(page)).toBeVisible();
    await page.getByRole("button", { name: "履歴 4", exact: true }).click();
    await expect(rows(page)).toHaveCount(4);
  });
}

test("other tools keep their page headers and normal document scrolling", async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 1024, height: 480 });
  // Act
  await page.goto("/character-count");
  // Assert
  await expect(page.getByRole("heading", { name: "Character Count", exact: true })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
});

test("mobile long history scrolls internally and every navigation label stays available", async ({
  page,
}) => {
  // Arrange
  await page.setViewportSize({ width: 320, height: 568 });
  const entries = Array.from({ length: 50 }, (_, index) => ({
    ...seedEntry,
    id: `mobile-${index}`,
  }));
  await seed(page, JSON.stringify({ version: 1, entries }));
  // Act
  await page.getByRole("button", { name: "履歴 50", exact: true }).click();
  const list = history(page).getByRole("list", { name: "計算履歴一覧" });
  await list.focus();
  await page.keyboard.press("End");
  const lastEdit = rows(page).last().getByRole("button", { name: "式を直す" });
  await lastEdit.focus();
  // Assert
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const box = await lastEdit.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(568);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight > innerHeight ||
        document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.keyboard.press("Enter");
  await expect(calculator(page)).toBeFocused();
  await page.keyboard.type("3=");
  await expect(result(page)).toHaveText("24");
  const links = page.getByRole("navigation", { name: "ツール" }).getByRole("link");
  await links.first().focus();
  const allLinks = await links.all();
  for (const [index, link] of allLinks.entries()) {
    if (index > 0) await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    await expect(link).toBeInViewport({ ratio: 1 });
    const bounds = await link.boundingBox();
    expect(bounds!.width).toBeGreaterThan(80);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
});

for (const spacing of [0, 0.02]) {
  test(`navigation focus stays fully inside with fractional font geometry (${spacing}px spacing)`, async ({
    page,
  }) => {
    // Arrange: different font metrics exercise non-integer link edges on both local and CI browsers.
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page);
    await page.addStyleTag({
      content: `nav a { font-family: Arial, sans-serif; letter-spacing: ${spacing}px; }`,
    });
    const nav = page.getByRole("navigation", { name: "ツール" });
    const links = await nav.getByRole("link").all();
    // Act / Assert: real Tab navigation in both directions, including the end of the scroll range.
    await links[0]!.focus();
    for (const order of [links, [...links].reverse()]) {
      for (const [index, link] of order.entries()) {
        if (index > 0) await page.keyboard.press(order === links ? "Tab" : "Shift+Tab");
        await expect(link).toBeFocused();
        await expect(link).toBeInViewport({ ratio: 1 });
        const box = await link.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(4);
        expect(box!.x + box!.width).toBeLessThanOrEqual(316);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth || scrollY !== 0,
          ),
        ).toBe(false);
      }
    }
    expect(await nav.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  });
}
