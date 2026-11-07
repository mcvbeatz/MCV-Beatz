import { test, expect } from "@playwright/test";
test("Speed burst button weakens Stone Prison, holds the fighter inside and dashes out on the breaking hit", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0, sfx: 0, orientation: "landscape" }),
    );
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.evaluate(() => __app.chooseMode("tdm"));
  await page.locator('[data-element="fire"]').click();
  await page.locator("#begin-btn").click();
  const start = await page.evaluate(() => {
    const g = __arena.game;
    g.ai = () => {};
    g.countdown = 0;
    g.applyFusion(g.player, ["air"], { burst: false });
    Object.assign(g.player, {
      prisonHp: 65,
      fx: 1,
      fy: 0,
      knockX: 0,
      knockY: 0,
    });
    return { x: g.player.x, y: g.player.y };
  });
  await expect(page.locator("#utility-btn")).toContainText("Speed burst");
  await expect(page.locator("#utility-btn")).toBeEnabled();
  await expect(page.locator("#arena-hint")).toContainText("Use Speed burst");
  await page.locator("#utility-btn").click();
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.prisonHp))
    .toBe(43);
  expect(
    await page.evaluate(() => ({
      x: __arena.game.player.x,
      y: __arena.game.player.y,
    })),
  ).toEqual(start);
  await page.screenshot({ path: "/tmp/prison-burst.png" });
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.burst))
    .toBe(0);
  await page.locator("#utility-btn").click();
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.prisonHp))
    .toBe(21);
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.burst))
    .toBe(0);
  await page.locator("#utility-btn").click();
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.prisonHp))
    .toBe(0);
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.x))
    .toBeGreaterThan(start.x + 10);
  expect(errors).toEqual([]);
});
