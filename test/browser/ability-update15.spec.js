import { test, expect } from "@playwright/test";
async function ready(page, mode = "duel", element = "dark") {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation: "landscape" }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator(`[data-element="${element}"]`).click();
  await page.locator("#begin-btn").click();
}
async function freeze(page) {
  await page.evaluate(() => {
    const g = __arena.game;
    g.ai = () => {};
    g.update = () => {};
    g.time = 2;
    g.effects = [];
    g.portals.portals = [];
    g.player.dimension = g.player.transit = null;
    Object.assign(g.player, { x: 300, y: 350, fx: 1, fy: 0 });
    Object.assign(g.fighters[1], { x: 350, y: 350, fx: -1, fy: 0 });
  });
}
test("Play countdown freezes the whole match, releases movement on Go, and Practice starts immediately", async ({
  page,
}) => {
  await ready(page, "tdm", "water");
  await expect(page.locator("#battle-countdown")).toHaveText("3");
  await page.evaluate(() => (__arena.game.ai = () => {}));
  const x = await page.evaluate(() => __arena.game.player.x);
  await page.keyboard.down("d");
  await expect(page.locator("#battle-countdown")).toHaveText("2");
  expect(await page.evaluate(() => __arena.game.time)).toBe(0);
  expect(await page.evaluate(() => __arena.game.player.x)).toBe(x);
  await expect(page.locator("#charge-btn")).toBeDisabled();
  await expect(page.locator("#battle-countdown")).toHaveText("1");
  await expect(page.locator("#battle-countdown")).toHaveText("Go!");
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.x))
    .toBeGreaterThan(x);
  await page.keyboard.up("d");
  await expect(page.locator("#battle-countdown")).toBeHidden();
  await page.locator("#leave-btn").click();
  await page.evaluate(() => __app.chooseMode("duel"));
  await page.locator("#begin-btn").click();
  await expect(page.locator("#battle-countdown")).toBeHidden();
});
test("Dark has separate Blindness, Mud has direct shortcuts, and Flash uses a full-screen fading white overlay", async ({
  page,
}) => {
  await ready(page);
  await freeze(page);
  await expect(page.locator("#extra-skill-0")).toContainText("Blindness");
  await page.locator("#extra-skill-0").click();
  expect(await page.evaluate(() => __arena.game.fighters[1].blind)).toBe(3);
  await expect(page.locator("#flash-whiteout")).toBeHidden();
  await page.evaluate(() => {
    __arena.game.player.whiteout = 3;
  });
  await expect(page.locator("#flash-whiteout")).toBeVisible();
  await expect(page.locator("#flash-whiteout")).toHaveCSS("opacity", "1");
  const box = await page.locator("#flash-whiteout").boundingBox();
  expect(box.width).toBe(1280);
  expect(box.height).toBe(720);
  await page.evaluate(() => {
    __arena.game.player.whiteout = 1;
  });
  await expect(page.locator("#flash-whiteout")).toHaveCSS("opacity", "0.5");
  await page.evaluate(() => {
    __arena.game.player.whiteout = 0;
  });
  await expect(page.locator("#flash-whiteout")).toBeHidden();
  await page.locator("#leave-btn").click();
  await page.evaluate(() => __app.chooseMode("fused"));
  await page.locator('[data-element="mud"]').click();
  await page.locator("#begin-btn").click();
  await expect(page.locator("#extra-skill-0")).toContainText("Hydro pump");
  await expect(page.locator("#extra-skill-1")).toContainText("Rock shield");
});
test("Divine owner outline has transparent interior and smoke conceals enemies from non-Dark viewers", async ({
  page,
}) => {
  await ready(page, "fused3", "divine");
  await freeze(page);
  await page.waitForTimeout(250);
  const pixels = await page.evaluate(() => {
    const r = __arena.renderer,
      g = __arena.game;
    r.draw(g, false);
    const original = r.outlineSprite
      .getContext("2d")
      .getImageData(0, 0, 160, 160).data;
    const edge = r.outlineEdge
      .getContext("2d")
      .getImageData(0, 0, 160, 160).data;
    let solid = 0,
      edgePixels = 0,
      filled = 0;
    for (let i = 3; i < original.length; i += 4) {
      if (original[i] === 255) {
        solid++;
        if (edge[i] > 0) filled++;
      }
      if (edge[i] > 0) edgePixels++;
    }
    return { solid, edgePixels, filled };
  });
  expect(pixels.solid).toBeGreaterThan(100);
  expect(pixels.edgePixels).toBeGreaterThan(100);
  expect(pixels.filled).toBe(0);
  await page.screenshot({ path: "/tmp/v15-divine-outline.png" });
  await page.evaluate(async () => {
    const { makeFighter } = await import("/src/combat.js");
    const g = __arena.game;
    Object.assign(g.player, makeFighter("player", "water", 0, 250, 350));
    g.fighters[1] = makeFighter("enemy", "fire", 1, 650, 350);
    g.hazards = [
      { kind: "vog", x: 650, y: 350, r: 170, life: 8, owner: g.fighters[1] },
    ];
  });
  async function region() {
    return page.evaluate(() => {
      const r = __arena.renderer;
      r.draw(__arena.game, false);
      const v = r.view;
      return [
        ...r.ctx.getImageData(
          Math.round(610 * v.scale + v.tx),
          Math.round(270 * v.scale + v.ty),
          Math.round(85 * v.scale),
          Math.round(100 * v.scale),
        ).data,
      ];
    });
  }
  const hidden = await region();
  await page.evaluate(() => (__arena.game.fighters[1].x += 25));
  expect(await region()).toEqual(hidden);
  await page.screenshot({ path: "/tmp/v15-vog.png" });
  await page.evaluate(() => (__arena.game.player.parts = ["dark"]));
  const visible = await region();
  expect(visible).not.toEqual(hidden);
  await page.evaluate(() => (__arena.game.fighters[1].x -= 25));
  expect(await region()).not.toEqual(visible);
});
test("Tornado renders an upright funnel and ready abilities have a brighter outline", async ({
  page,
}) => {
  await ready(page, "fused", "cloud");
  await freeze(page);
  await page.evaluate(() => {
    const g = __arena.game;
    g.cast(g.player, 1);
    g.projectiles[0].x = 520;
    g.projectiles[0].y = 400;
  });
  await page.screenshot({ path: "/tmp/v15-tornado.png" });
  const readyBorder = await page
    .locator("#charge-btn")
    .evaluate((e) => getComputedStyle(e).borderTopColor);
  await page.evaluate(() => (__arena.game.player.abilityCd = 3));
  await expect(page.locator("#charge-btn")).toBeDisabled();
  expect(
    await page
      .locator("#charge-btn")
      .evaluate((e) => getComputedStyle(e).borderTopColor),
  ).not.toBe(readyBorder);
  const coverage = await page.evaluate(() => {
    const r = __arena.renderer,
      g = __arena.game;
    r.draw(g, false);
    const a = r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data;
    const projectiles = g.projectiles;
    g.projectiles = [];
    r.draw(g, false);
    const b = r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data;
    g.projectiles = projectiles;
    let top = Infinity,
      bottom = -Infinity;
    for (let i = 0; i < a.length; i += 4)
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
        const y = Math.floor(i / 4 / r.canvas.width);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    return (bottom - top) / r.view.scale;
  });
  expect(coverage).toBeGreaterThan(80);
});

test("Blindness visibly darkens only the character without relying on canvas filters", async ({
  page,
}) => {
  await ready(page, "duel", "water");
  await freeze(page);
  const result = await page.evaluate(async () => {
    await (
      await import("/src/characters.js")
    ).charactersReady;
    const r = __arena.renderer,
      a = __arena.game.player,
      c = document.createElement("canvas");
    c.width = c.height = 160;
    const ctx = c.getContext("2d");
    ctx.translate(80, 130);
    r.characterBody(ctx, a, 2);
    const normal = ctx.getImageData(0, 0, 160, 160).data;
    ctx.clearRect(-80, -130, 160, 160);
    a.blind = 3;
    r.characterBody(ctx, a, 2);
    const blind = ctx.getImageData(0, 0, 160, 160).data;
    let original = 0,
      dark = 0,
      samples = 0;
    for (let i = 0; i < normal.length; i += 4)
      if (normal[i + 3] > 200) {
        original += normal[i] + normal[i + 1] + normal[i + 2];
        dark += blind[i] + blind[i + 1] + blind[i + 2];
        samples++;
      }
    return { samples, ratio: dark / original };
  });
  expect(result.samples).toBeGreaterThan(100);
  expect(result.ratio).toBeGreaterThan(0.3);
  expect(result.ratio).toBeLessThan(0.4);
});
