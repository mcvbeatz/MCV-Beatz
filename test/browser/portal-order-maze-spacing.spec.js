import { test, expect } from "@playwright/test";

for (const element of ["spirit", "divine"]) {
  test(`${element} Portals button closes oldest first and returns to placement`, async ({
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
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.goto("/?mode=tdm");
    await page.waitForFunction(() => window.__app?.screen === "setup");
    await page.locator("#begin-btn").click();
    await page.evaluate(async (element) => {
      const g = __arena.game;
      const { makeFighter } = await import("/src/combat.js");
      g.countdown = 0;
      g.update = () => {};
      g.map = null;
      Object.assign(g.player, makeFighter("player", element, 0, 300, 350));
      g.fighters = [g.player];
      g.portals.begin(g.player);
      g.portals.place(g.player, 450, 250);
      g.portals.place(g.player, 650, 250);
    }, element);
    const button = page
      .locator("button.ability:visible")
      .filter({ has: page.locator("strong", { hasText: /^Portals$/ }) });
    await expect(button).toContainText("Tap to close oldest");
    await button.click();
    expect(
      await page.evaluate(() =>
        __arena.game.portals.owned(__arena.game.player).map((p) => p.x),
      ),
    ).toEqual([650]);
    await expect(button).toContainText("Tap to close oldest");
    await button.click();
    expect(
      await page.evaluate(
        () => __arena.game.portals.owned(__arena.game.player).length,
      ),
    ).toBe(0);
    await expect(button).toContainText("Tap, then place");
    await button.click();
    await expect(page.locator("#portal-instruction")).toHaveText(
      "Tap the arena to place the first portal.",
    );
    await page.screenshot({ path: `/tmp/${element}-portal-controls.png` });
    expect(errors).toEqual([]);
  });
}

test("Survive the Night runs crowded AI without wall escapes or browser errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__app);
  const result = await page.evaluate(async () => {
    const { Combat, makeFighter, distance } = await import("/src/combat.js");
    const g = new Combat({ mode: "corruption", players: 8, random: () => 0.5 });
    for (let i = 0; i < 3; i++) {
      const p = g.map.cells[80];
      Object.assign(
        g.fighters[i],
        makeFighter(g.fighters[i].id, "dark", 1, p.x, p.y),
      );
    }
    let onFloor = true;
    const started = performance.now();
    for (let i = 0; i < 600 && !g.finished; i++) {
      g.update(0.02, { x: 0, y: 0 }, true);
      onFloor &&= g.fighters.every((a) => g.map.walkable(a));
    }
    return {
      elapsed: performance.now() - started,
      onFloor,
      separation: distance(g.fighters[0], g.fighters[1]),
      finite: g.fighters.every(
        (a) => Number.isFinite(a.x) && Number.isFinite(a.y),
      ),
    };
  });
  expect(result.onFloor).toBe(true);
  expect(result.finite).toBe(true);
  expect(result.separation).toBeGreaterThan(32);
  expect(result.elapsed).toBeLessThan(6000);
  expect(errors).toEqual([]);
});
