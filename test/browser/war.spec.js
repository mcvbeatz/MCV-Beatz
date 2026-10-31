import { test, expect } from "@playwright/test";
async function ready(page, orientation = "landscape") {
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem("elemental-settings", JSON.stringify({ orientation }));
  }, orientation);
  await page.goto("/?mode=war");
  await page.waitForFunction(() => window.__app?.screen === "setup");
}
for (const [width, height] of [
  [844, 390],
  [390, 844],
])
  test(`every mode/map keeps landscape tabs at the top at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await page.locator("#begin-btn").click();
    const layouts = await page.evaluate(async () => {
      const { Combat } = await import("/src/combat.js");
      const { MODES } = await import("/src/mode-catalog.js");
      const result = [];
      for (const mode of Object.keys(MODES))
        for (const mapId of mode === "corruption"
          ? ["corruption"]
          : ["classic", "garden", "tower"]) {
          const g = __arena.game;
          Object.assign(
            g,
            new Combat({ mode, mapId, element: "earth", enemyElement: "air" }),
          );
          g.update = () => {};
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
          const tabs = document.getElementById("skill-switcher");
          result.push({
            mode,
            mapId,
            top: parseFloat(getComputedStyle(tabs).top),
            h: tabs.clientHeight,
            objective: !document.getElementById("objective-score").hidden,
          });
        }
      return result;
    });
    expect(layouts.some((x) => x.objective)).toBe(true);
    for (const l of layouts) expect(l.top, `${l.mode}/${l.mapId}`).toBe(8);
  });
for (const orientation of ["landscape", "portrait"])
  test(`War setup, ten fighters and volcanic battle work in ${orientation}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, orientation);
    await expect(page.locator("#setup-mode-title")).toHaveText("War");
    await expect(page.locator("#team-sizes [data-size]:visible")).toHaveText([
      "3 vs 3",
      "4 vs 4",
      "5 vs 5",
    ]);
    await page.locator('[data-size="5"]').click();
    await page.locator('[data-element="water"]').click();
    // Fire is last in Water's five-origin rival pool.
    await page.evaluate(() => (Math.random = () => 0.999));
    await page.locator("#begin-btn").click();
    await page.evaluate(async () => {
      await (
        await import("/src/characters.js")
      ).charactersReady;
      const g = __arena.game;
      g.countdown = 0;
      g.ai = () => {};
    });
    await expect(page.locator("#arena-title")).toHaveText("THE EMBER CALDERA");
    await expect(page.locator("#objective-score")).toContainText(
      "WATER −1 HP/s",
    );
    const state = await page.evaluate(() => ({
      count: __arena.game.fighters.length,
      teams: __arena.game.fighters.map((a) => [a.team, a.element]),
    }));
    expect(state.count).toBe(10);
    expect(
      state.teams.every(([team, e]) => e === (team ? "fire" : "water")),
    ).toBe(true);
    const samples = await page.evaluate(async () => {
      const { updateWar } = await import("/src/war.js");
      const g = __arena.game,
        r = __arena.renderer;
      g.update = () => {};
      g.time = 10;
      updateWar(g, 0);
      // Sample the healing drop, away from fighter bodies.
      const d = g.healthDrops.find((d) => d.team === 0);
      g.fighters
        .filter((a) => a.team === 0)
        .forEach((a, i) => {
          a.x = 700;
          a.y = 500 + i * 80;
        });
      g.player.x = d.x + 90;
      g.player.y = d.y;
      r.draw(g);
      const v = r.view,
        p = r.pixelRatio;
      const x = Math.round((d.x * v.scale + v.tx) * p.x),
        y = Math.round(
          ((d.y - 12 + Math.sin(g.time * 3 + d.bornAt) * 3) * v.scale + v.ty) *
            p.y,
        );
      const before = [...r.ctx.getImageData(x, y, 1, 1).data];
      const drops = g.healthDrops;
      g.healthDrops = [];
      r.draw(g);
      const after = [...r.ctx.getImageData(x, y, 1, 1).data];
      g.healthDrops = drops;
      return {
        delta: before
          .slice(0, 3)
          .reduce((s, n, i) => s + Math.abs(n - after[i]), 0),
        drops: drops.length,
      };
    });
    expect(samples.drops).toBe(2);
    expect(samples.delta).toBeGreaterThan(50);
    await page.screenshot({ path: `/tmp/elemental-war-${orientation}.png` });
    await page.locator("#leave-btn").click();
    await page.evaluate(() => __app.chooseMode("tdm"));
    await expect(page.locator('[data-size="5"]')).toBeHidden();
    await expect(page.locator('[data-size="4"]')).toHaveClass(/selected/);
    expect(errors).toEqual([]);
  });
test("War appears in Team Battles and its help explains supplies and volcanic heat", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => __app.show("team-battles"));
  await expect(page.locator('[data-launch="war"]')).toContainText("War");
  await page.locator('[data-help="war"]').click();
  await expect(page.locator("#slide-title")).toHaveText(
    "One element. One army.",
  );
  await page.locator("#slide-next").click();
  await expect(page.locator("#slide-card")).toContainText("59.8");
  await page.locator("#slide-next").click();
  await expect(page.locator("#slide-card")).toContainText("1 HP per second");
});
