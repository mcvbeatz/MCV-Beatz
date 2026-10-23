import { test, expect } from "@playwright/test";
async function point(page, x, y) {
  return page.evaluate(
    ({ x, y }) => {
      const r = document.getElementById("game").getBoundingClientRect(),
        v = __arena.renderer.view;
      return { x: r.left + x * v.scale + v.tx, y: r.top + y * v.scale + v.ty };
    },
    { x, y },
  );
}
test("Spirit healing and Divine portal placement work directly from their fused tabs", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.evaluate(() => __app.chooseMode("fused"));
  await page.locator('[data-element="spirit"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.player.hp = 40;
    g.fighters[1].x = 820;
    g.fighters[1].y = 440;
  });
  await page.locator("#extra-skill-0").click();
  expect(await page.evaluate(() => __arena.game.player.hp)).toBe(63);
  await expect(page.locator('[data-form="spirit"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() =>
    __arena.game.applyFusion(__arena.game.player, ["earth"], { burst: false }),
  );
  await expect(page.locator("#extra-skill-1 strong")).toHaveText("Portals");
  await page.locator("#extra-skill-1").click();
  await expect(page.locator("#portal-notice")).toBeVisible();
  for (const [x, y] of [
    [460, 320],
    [650, 330],
  ]) {
    const p = await point(page, x, y);
    await page.mouse.click(p.x, p.y);
  }
  expect(await page.evaluate(() => __arena.game.portals.portals.length)).toBe(
    2,
  );
  await expect(page.locator('[data-form="divine"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#portal-notice")).toBeHidden();
});
test("summon bodies flash, tokens shine, and combat cues never draw floating text or reveal hidden Divine", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter } =
      await import("/src/characters.js");
    await charactersReady;
    const { makeFighter } = await import("/src/combat.js");
    const { drawCue } = await import("/src/battle-effects.js");
    const g = __arena.game,
      r = __arena.renderer;
    g.update = () => {};
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const ctx = c.getContext("2d");
    const a = makeFighter("echo", "fire", 0, 80, 130);
    a.echo = true;
    const snapshot = () => {
      ctx.clearRect(0, 0, 160, 160);
      ctx.save();
      ctx.translate(80, 130);
      drawCharacter(ctx, a, 0);
      ctx.restore();
      return c.toDataURL();
    };
    const normal = snapshot();
    a.spawnFlash = 0.6;
    const flashed = snapshot();
    const hidden = makeFighter("hidden", "divine", 0, 80, 100);
    g.fighters = [hidden];
    ctx.clearRect(0, 0, 160, 160);
    drawCue(
      ctx,
      { subject: "hidden", cue: "heal", color: "#fff", life: 0.4, max: 0.65 },
      g,
    );
    const leaked = ctx
      .getImageData(0, 0, 160, 160)
      .data.some((v, i) => i % 4 === 3 && v > 0);
    const ally = makeFighter("ally", "earth", 0, 450, 350);
    g.fighters = [g.player, ally];
    g.fell(ally);
    g.events = [
      { text: "ECHO SUMMONED", x: 450, y: 350, time: 0, color: "#fff" },
    ];
    g.cue("heal", g.player);
    const labels = [];
    const original = r.ctx.fillText.bind(r.ctx);
    r.ctx.fillText = (text, ...args) => {
      labels.push(text);
      return original(text, ...args);
    };
    r.draw(g);
    const pixels = () =>
      r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data;
    const start = pixels();
    g.tokens[0].bornAt = -10;
    r.draw(g);
    const settled = pixels();
    return {
      bodyFlashes: normal !== flashed,
      tokenShines: start.some((v, i) => v !== settled[i]),
      leaked,
      labels,
    };
  });
  expect(result.bodyFlashes).toBe(true);
  expect(result.tokenShines).toBe(true);
  expect(result.leaked).toBe(false);
  expect(
    result.labels.some((t) =>
      /SUMMONED|TOKEN|HEALED|ARRIVING|OPENING|VISION DISRUPTED/.test(t),
    ),
  ).toBe(false);
});
test("AI portal crossings and teleport preparation render during real simulation updates", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  const results = await page.evaluate(async () => {
    const { Combat, makeFighter } = await import("/src/combat.js");
    const r = __arena.renderer;
    const out = [];
    for (const element of ["spirit", "divine", "multi-dimensional"]) {
      const g = new Combat({ element: "earth", random: () => 0 });
      const a = makeFighter("enemy", element, 1, 750, 340);
      g.fighters[1] = a;
      let portals = 0,
        transits = 0,
        blinks = 0;
      for (let i = 0; i < 65; i++) {
        g.update(0.04);
        r.draw(g);
        portals = Math.max(portals, g.portals.owned(a).length);
        if (a.transit) transits++;
        if (a.blink) blinks++;
      }
      out.push({ element, portals, transits, blinks, x: a.x });
    }
    return out;
  });
  for (const row of results) {
    if (row.element === "multi-dimensional")
      expect(row.blinks).toBeGreaterThan(0);
    else {
      expect(row.portals).toBe(2);
      expect(row.transits).toBeGreaterThan(0);
    }
    expect(row.x).toBeLessThan(600);
  }
  expect(errors).toEqual([]);
});
