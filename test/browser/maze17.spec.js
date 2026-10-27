import { test, expect } from "@playwright/test";
async function start(page, mode, element = "light", orientation = "landscape") {
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem("elemental-settings", JSON.stringify({ orientation }));
  }, orientation);
  await page.goto(`/?mode=${mode}`);
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.locator(`[data-element="${element}"]`).click();
  if (mode === "ffa") await page.locator("#ffa-count").selectOption("4");
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.countdown = 0;
    __arena.game.ai = () => {};
  });
}
test("Corruption maze follows the fighter and its escape portals work in both phone orientations", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const orientation of ["portrait", "landscape"]) {
    await start(page, "corruption", "light", orientation);
    await expect(page.locator("#arena-title")).toHaveText(
      "THE UMBRAL LABYRINTH",
    );
    await page.evaluate(() =>
      Object.assign(__arena.game.player, { x: 1024, y: 680 }),
    );
    await page.waitForFunction(
      () =>
        Math.abs(
          __arena.game.player.x * __arena.renderer.view.scale +
            __arena.renderer.view.tx -
            document.getElementById("game").width / 2,
        ) < 2,
    );
    const before = await page.evaluate(() => __arena.renderer.view.ty);
    await page.keyboard.down("s");
    await expect
      .poll(() => page.evaluate(() => __arena.game.player.y))
      .toBeGreaterThan(716);
    await page.keyboard.up("s");
    expect(await page.evaluate(() => __arena.renderer.view.ty)).toBeLessThan(
      before,
    );
    await page.evaluate(() => {
      const g = __arena.game,
        p = g.portals.portals[0];
      Object.assign(g.player, { x: p.x, y: p.y, vx: 0, vy: 0 });
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = __arena.game,
            exit = g.portals.portals[1];
          return (
            !g.player.transit &&
            Math.hypot(g.player.x - exit.x, g.player.y - exit.y) < 50
          );
        }),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => __arena.game.map.walkable(__arena.game.player)),
    ).toBe(true);
    for (const selector of [
      "#joystick",
      "#attack-btn",
      "#charge-btn",
      "#leave-btn",
    ]) {
      const r = await page.locator(selector).boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(-1);
      expect(r.y).toBeGreaterThanOrEqual(-1);
      expect(r.x + r.width).toBeLessThanOrEqual(391);
      expect(r.y + r.height).toBeLessThanOrEqual(845);
    }
    await page.screenshot({ path: `/tmp/v17-maze-${orientation}.png` });
  }
  await page.evaluate(async () => {
    const { paintCorruptionMap } =
      await import("/src/corruption-map-render.js");
    const c = document.createElement("canvas");
    c.id = "maze-overview";
    c.width = 1280;
    c.height = 1280;
    c.style =
      "position:fixed;inset:0;z-index:999999;width:100vw;height:100vh;object-fit:contain;background:#080d13";
    const ctx = c.getContext("2d"),
      m = __arena.game.map;
    ctx.translate(640 - m.cx, 640 - m.cy);
    paintCorruptionMap(ctx, m);
    document.body.append(c);
  });
  await page
    .locator("#maze-overview")
    .screenshot({ path: "/tmp/v17-maze-overview.png" });
  expect(errors).toEqual([]);
  await context.close();
});
test("FFA shows a ten-second respawn countdown and the last standing fighter wins", async ({
  page,
}) => {
  await start(page, "ffa");
  await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.fell(g.player);
    g.checkMatchEnd();
  });
  await expect(page.locator("#health-label")).toHaveText("RESPAWN 10s");
  await expect(page.locator("#game-overlay")).toBeHidden();
  await page.evaluate(async () => {
    const g = __arena.game,
      { Combat } = await import("/src/combat.js");
    g.time = g.player.respawnAt;
    Combat.prototype.update.call(g, 0.01, { x: 0, y: 0 }, false);
  });
  expect(await page.evaluate(() => __arena.game.player.alive)).toBe(true);
  await expect(page.locator("#health-label")).toHaveText("120 / 120 HP");
  await page.evaluate(() => {
    const g = __arena.game;
    for (const a of g.fighters.slice(1)) g.fell(a, { killer: g.player });
    g.checkMatchEnd();
  });
  await expect(page.locator("#game-overlay")).toBeVisible({ timeout: 8000 });
  expect(await page.evaluate(() => __arena.game.result)).toBe("victory");
});
test("Death grows from a dark opening and venom tints the sprite without changing its silhouette", async ({
  page,
}) => {
  await start(page, "fused3", "sanctuary");
  const result = await page.evaluate(async () => {
    const { drawTerrain } = await import("/src/battle-effects.js");
    const { makeFighter } = await import("/src/combat.js");
    await (
      await import("/src/characters.js")
    ).charactersReady;
    const g = __arena.game;
    g.update = () => {};
    const c = document.createElement("canvas");
    c.width = c.height = 200;
    const ctx = c.getContext("2d");
    const a = makeFighter("sample", "earth", 1, 0, 0);
    function body(tint) {
      ctx.clearRect(0, 0, 200, 200);
      ctx.save();
      ctx.translate(100, 150);
      a.venomTint = tint;
      __arena.renderer.characterBody(ctx, a, 0);
      ctx.restore();
      return [...ctx.getImageData(0, 0, 200, 200).data];
    }
    const plain = body(0),
      purple = body(0.16);
    const sameAlpha = plain.every((v, i) => i % 4 !== 3 || v === purple[i]);
    let changed = 0,
      violet = 0;
    for (let i = 0; i < plain.length; i += 4)
      if (plain[i + 3] > 160 && purple[i + 2] > plain[i + 2]) {
        changed++;
        if (purple[i + 2] > purple[i + 1]) violet++;
      }
    const h = {
      kind: "death",
      x: 100,
      y: 100,
      r: 66,
      opensAt: 0.5,
      life: Infinity,
      owner: g.player,
    };
    g.hazards = [h];
    function floor(time) {
      ctx.clearRect(0, 0, 200, 200);
      g.time = time;
      drawTerrain(ctx, g, time);
      const pixels = ctx.getImageData(0, 0, 200, 200).data;
      let area = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 100) area++;
      return area;
    }
    return { sameAlpha, changed, violet, early: floor(0.1), full: floor(0.5) };
  });
  expect(result.sameAlpha).toBe(true);
  expect(result.changed).toBeGreaterThan(200);
  expect(result.violet).toBeGreaterThan(200);
  expect(result.full).toBeGreaterThan(result.early * 5);
});
