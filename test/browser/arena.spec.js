import { test, expect } from "@playwright/test";
test("play a duel with movement, lock, charging, pause and restart", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Begin battle" }).click();
  await page.keyboard.press("q");
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.lock))
    .toBe("enemy-0");
  const x = await page.evaluate(() => __arena.game.player.x);
  await page.keyboard.down("d");
  await page.waitForTimeout(200);
  await page.keyboard.up("d");
  expect(await page.evaluate(() => __arena.game.player.x)).toBeGreaterThan(x);
  await page.keyboard.down("k");
  await expect(page.locator("#charge-meter")).toBeVisible();
  await page.waitForTimeout(300);
  await page.keyboard.up("k");
  await expect(page.locator("#charge-meter")).toBeHidden();
  expect(
    await page.evaluate(() => __arena.game.player.abilityCd),
  ).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Battle paused.")).toBeVisible();
  const time = await page.evaluate(() => __arena.game.time);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => __arena.game.time)).toBe(time);
  await page.getByRole("button", { name: "Resume battle" }).click();
  expect(await page.evaluate(() => __arena.paused)).toBe(false);
  await page.keyboard.press("r");
  expect(await page.evaluate(() => __arena.game.player.hp)).toBe(120);
  expect(errors).toEqual([]);
});
test("team sizes, fused form switching, codex and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="team"]').click();
  await page.locator('[data-size="4"]').click();
  await page.locator("#begin-btn").click();
  expect(await page.evaluate(() => __arena.game.fighters.length)).toBe(8);
  await page.locator('[data-mode="fused"]').click();
  await page.locator("#begin-btn").click();
  expect(await page.evaluate(() => __arena.game.player.parts.length)).toBe(2);
  const form = await page.evaluate(() => __arena.game.player.element);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => __arena.game.player.element)).not.toBe(form);
  await page.getByRole("button", { name: "Element codex" }).click();
  await expect(page.locator("#info-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("all six origins can begin battle and use mouse ability controls", async ({
  page,
}) => {
  await page.goto("/");
  for (const element of ["light", "dark", "water", "air", "earth", "fire"]) {
    await page.locator(`[data-element="${element}"]`).click();
    await page.locator("#begin-btn").click();
    expect(await page.evaluate(() => __arena.game.player.base)).toBe(element);
    const b = page.locator("#charge-btn");
    await b.hover();
    await page.mouse.down();
    await expect(page.locator("#charge-meter")).toBeVisible();
    await page.mouse.up();
    await expect(page.locator("#charge-meter")).toBeHidden();
  }
});
