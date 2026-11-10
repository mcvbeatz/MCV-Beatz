import { test, expect } from "@playwright/test";
async function start(page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0, sfx: 0, orientation: "landscape" }),
    );
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?mode=tdm");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.locator("#begin-btn").click();
  await page.evaluate(async () => {
    const g = __arena.game;
    g.countdown = 0;
    g.update = () => {};
    g.ai = () => {};
    g.map = null;
    Object.assign(g.player, { x: 300, y: 350 });
    await (
      await import("/src/characters.js")
    ).charactersReady;
  });
}
test("an invisible allied Divine keeps a full-opacity health bar while a concealed enemy remains hidden", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  const result = await page.evaluate(async () => {
    const g = __arena.game,
      r = __arena.renderer,
      { makeFighter } = await import("/src/combat.js");
    const ally = makeFighter("ally", "divine", g.player.team, 450, 350),
      enemy = makeFighter("enemy", "divine", 1, 650, 350);
    ally.hp = 60;
    g.fighters = [g.player, ally, enemy];
    r.visibilityStates = new WeakMap();
    const original = r.healthIndicator;
    const calls = [];
    r.healthIndicator = function (c, a, viewer) {
      calls.push({ id: a.id, alpha: c.globalAlpha });
      return original.call(this, c, a, viewer);
    };
    r.draw(g);
    r.healthIndicator = original;
    const v = r.view,
      ratio = r.pixelRatio;
    const x = Math.round((435 * v.scale + v.tx) * ratio.x),
      y = Math.round((272 * v.scale + v.ty) * ratio.y);
    return {
      calls,
      pixel: [...r.ctx.getImageData(x, y, 1, 1).data],
      body: r.characterOpacity(ally, g.player, performance.now() / 1000),
    };
  });
  expect(result.calls).toContainEqual({ id: "ally", alpha: 1 });
  expect(result.calls.some((c) => c.id === "enemy")).toBe(false);
  expect(result.body).toBe(0);
  expect(result.pixel).toEqual([156, 211, 189, 255]);
  await page.screenshot({ path: "/tmp/divine-ally-health.png" });
  expect(errors).toEqual([]);
});
test("battle and maze minimaps draw green allies and orange enemies, with no hidden Divine marker", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__app);
  const result = await page.evaluate(async () => {
    const { Combat, makeFighter } = await import("/src/combat.js"),
      { drawBattleMinimap } = await import("/src/battle-maps-render.js"),
      { drawMazeMap } = await import("/src/corruption-map-render.js");
    const output = [];
    for (const mode of ["tdm", "corruption"]) {
      const g = new Combat({ mode, mapId: "garden", random: () => 0 }),
        map = g.map;
      g.player.team = 3;
      Object.assign(g.player, { x: map.cx || 1024, y: map.cy || 680 });
      const a = makeFighter("ally", "divine", 3, g.player.x - 300, g.player.y),
        b = makeFighter("enemy", "water", 7, g.player.x + 300, g.player.y),
        hidden = makeFighter(
          "hidden",
          "divine",
          7,
          g.player.x,
          g.player.y + 300,
        );
      g.fighters = [g.player, a, b, hidden]; // Keep line-of-sight independent of maze-wall layout for color verification.
      const actualSee = g.canSee.bind(g);
      g.canSee = (viewer, actor) =>
        actor === hidden ? actualSee(viewer, actor) : true;
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 400;
      const c = canvas.getContext("2d");
      const dots = [];
      const arc = c.arc.bind(c);
      c.arc = (x, y, r, ...args) => {
        if (r === 2.3 || r === 3) dots.push({ color: c.fillStyle, r });
        return arc(x, y, r, ...args);
      };
      (mode === "corruption" ? drawMazeMap : drawBattleMinimap)(
        c,
        g,
        640,
        400,
        false,
      );
      output.push(
        dots.filter((d) => d.color === "#72e6a2" || d.color === "#ff9b57"),
      );
    }
    return output;
  });
  for (const dots of result) {
    expect(dots.filter((d) => d.color === "#72e6a2")).toHaveLength(2);
    expect(dots.filter((d) => d.color === "#ff9b57")).toHaveLength(1);
  }
});
test("Divine closes an enemy and allied portal through real arena taps from an origin tab", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  const points = await page.evaluate(async () => {
    const g = __arena.game,
      { makeFighter } = await import("/src/combat.js");
    Object.assign(g.player, makeFighter("player", "divine", 0, 300, 350));
    g.switchForm(g.player, "earth");
    const enemy = makeFighter("enemy-owner", "spirit", 1, 750, 450),
      ally = makeFighter("ally-owner", "spirit", 0, 750, 350);
    g.fighters = [g.player, enemy, ally];
    const result = [];
    for (const [owner, x] of [
      [enemy, 450],
      [ally, 600],
    ]) {
      g.portals.begin(owner);
      g.portals.place(owner, x, 300);
      result.push(g.portals.owned(owner)[0]);
    }
    g.portals.placing = null;
    __arena.renderer.draw(g);
    const view = __arena.renderer.view;
    return result.map((p) => ({
      id: p.id,
      x: p.x * view.scale + view.tx,
      y: p.y * view.scale + view.ty,
    }));
  });
  const box = await page.locator("#game").boundingBox();
  for (const p of points) {
    await page.mouse.click(box.x + p.x, box.y + p.y);
    await expect
      .poll(() =>
        page.evaluate(
          (id) => __arena.game.portals.portals.some((p) => p.id === id),
          p.id,
        ),
      )
      .toBe(false);
  }
  expect(
    await page.evaluate(
      () =>
        __arena.game.effects.filter((e) => e.kind === "portal-close").length,
    ),
  ).toBe(2);
  expect(errors).toEqual([]);
});
