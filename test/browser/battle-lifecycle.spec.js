import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
async function start(page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation: "portrait" }),
    );
  });
  await page.goto("/?mode=roulette");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.locator("#begin-btn").click();
  await page.evaluate(async () => {
    await (
      await import("/src/characters.js")
    ).charactersReady;
    __arena.game.countdown = 0;
    __arena.game.ai = () => {};
  });
}
test("floor abilities render above every arena and clip at its edges", async ({
  page,
}) => {
  await start(page);
  const results = await page.evaluate(async () => {
    const { Combat } = await import("/src/combat.js");
    const { drawTerrain } = await import("/src/battle-effects.js");
    __arena.game.update = () => {};
    const results = [];
    for (const mapId of ["classic", "garden", "tower"])
      for (const kind of ["magma", "flood", "quicksand"]) {
        const g = new Combat({ mode: "duel", mapId, element: "earth" });
        const center =
          mapId === "classic"
            ? { x: 520, y: 360 }
            : mapId === "garden"
              ? { x: 1450, y: 680 }
              : { x: 1680, y: 680 };
        Object.assign(g.player, { x: center.x - 100, y: center.y });
        g.time = 1;
        const renderer = __arena.renderer,
          c = renderer.canvas,
          ctx = c.getContext("2d");
        const sample = () => {
          const v = renderer.view,
            x = Math.round((center.x + 20) * v.scale + v.tx),
            y = Math.round((center.y + 10) * v.scale + v.ty);
          return [...ctx.getImageData(x, y, 1, 1).data];
        };
        renderer.draw(g);
        const before = sample();
        const h = { ...center, kind, r: 80, life: 8, owner: g.player };
        g.hazards = [h];
        renderer.draw(g);
        const after = sample();
        const delta = after
          .slice(0, 3)
          .reduce((sum, n, i) => sum + Math.abs(n - before[i]), 0);
        const floor = document.createElement("canvas");
        floor.width = 2048;
        floor.height = 1360;
        const fc = floor.getContext("2d");
        const edge =
          mapId === "classic"
            ? { x: 880, y: 350 }
            : mapId === "garden"
              ? { x: 1620, y: 680 }
              : { x: 1920, y: 680 };
        g.hazards = [{ ...h, ...edge }];
        drawTerrain(fc, g, 1);
        const inside = fc.getImageData(edge.x - 15, edge.y, 1, 1).data[3];
        const outside = fc.getImageData(edge.x + 35, edge.y, 1, 1).data[3];
        results.push({ mapId, kind, delta, inside, outside });
      }
    return results;
  });
  for (const r of results) {
    expect(
      r.delta,
      `${r.mapId} ${r.kind} must be visible above floor`,
    ).toBeGreaterThan(40);
    expect(r.inside).toBeGreaterThan(0);
    expect(r.outside).toBe(0);
  }
});
for (const orientation of ["portrait", "landscape"])
  test(`respawn joystick pans the camera in ${orientation} and resets on revival`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await start(page);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.evaluate(async (orientation) => {
      const { Combat } = await import("/src/combat.js");
      const { setOrientation } = await import("/src/orientation.js");
      setOrientation(orientation);
      const g = __arena.game;
      Object.assign(
        g,
        new Combat({ mode: "roulette", mapId: "garden", players: 4 }),
      );
      g.ai = () => {};
      Object.assign(g.player, { x: 1024, y: 680 });
      g.fell(g.player);
    }, orientation);
    await expect(page.locator("#move-label")).toHaveText("LOOK");
    const before = await page.evaluate(() => ({
      focus: { ...__arena.game.spectatorFocus },
      view: { ...__arena.renderer.view },
      x: __arena.game.player.x,
    }));
    const r = await page.locator("#joystick").boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width * 0.9, r.y + r.height / 2);
    await page.waitForTimeout(500);
    await page.mouse.up();
    const after = await page.evaluate(() => ({
      focus: { ...__arena.game.spectatorFocus },
      view: { ...__arena.renderer.view },
      x: __arena.game.player.x,
    }));
    expect(
      Math.hypot(
        after.focus.x - before.focus.x,
        after.focus.y - before.focus.y,
      ),
    ).toBeGreaterThan(60);
    expect(after.x).toBe(before.x);
    expect(after.view).not.toEqual(before.view);
    await page.evaluate(() => {
      const g = __arena.game;
      g.time = g.player.respawnAt;
    });
    await expect(page.locator("#move-label")).toHaveText("MOVE");
    expect(await page.evaluate(() => __arena.game.spectatorFocus)).toBeNull();
    expect(await page.evaluate(() => __arena.game.player.alive)).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
test("all 23 elementals have visible upright fading death frames, including Divine", async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { Combat } = await import("/src/combat.js");
    const { CHARACTERS, drawFallenCharacter } =
      await import("/src/characters.js");
    const { fighterColor } = await import("/src/render.js");
    __arena.game.update = () => {};
    const c = document.createElement("canvas");
    c.width = 180;
    c.height = 150;
    const ctx = c.getContext("2d");
    const sheet = document.createElement("canvas");
    sheet.width = 1080;
    sheet.height = 1200;
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#1a2531";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    const results = [];
    for (const [i, element] of CHARACTERS.entries()) {
      const g = new Combat({ mode: "roulette", element, mapId: "classic" });
      g.rebirthUsed.add(g.player.id);
      g.fell(g.player);
      const death = g.fallenAnimations[0],
        frames = [];
      for (const [j, elapsed] of [0.1, 0.75, 1.25, 1.5].entries()) {
        death.elapsed = elapsed;
        ctx.clearRect(0, 0, 180, 150);
        ctx.save();
        ctx.translate(80, 95);
        const drawn = drawFallenCharacter(
          ctx,
          death,
          fighterColor(death.fighter),
        );
        ctx.restore();
        const data = ctx.getImageData(0, 0, 180, 150).data;
        let pixels = 0,
          hash = 0;
        for (let k = 3; k < data.length; k += 4) {
          if (data[k] > 20) pixels++;
          hash = (hash + data[k] * k) % 1000000007;
        }
        frames.push({ pixels, hash, drawn });
        if (j < 3)
          sc.drawImage(
            c,
            (i % 3) * 360 + j * 120,
            Math.floor(i / 3) * 150,
            120,
            100,
          );
      }
      sc.fillStyle = "#e6d8b7";
      sc.font = "14px sans-serif";
      sc.fillText(element, (i % 3) * 360 + 12, Math.floor(i / 3) * 150 + 120);
      results.push({ element, frames });
    }
    return { results, image: sheet.toDataURL().split(",")[1] };
  });
  for (const { element, frames } of result.results) {
    expect(frames[0].drawn, element).toBe(true);
    expect(frames[0].pixels, element).toBeGreaterThan(100);
    expect(frames[1].hash, element).not.toBe(frames[0].hash);
    expect(frames[2].pixels, element).toBeGreaterThan(20);
    expect(frames[3].pixels, element).toBe(0);
  }
  await writeFile(
    "/tmp/elemental-death-animations.png",
    Buffer.from(result.image, "base64"),
  );
});

test("the Sunken Colosseum is selectable by the match shuffle and still renders", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.05;
  });
  await start(page);
  await expect(page.locator("#arena-title")).toHaveText("THE SUNKEN COLOSSEUM");
  expect(await page.evaluate(() => __arena.game.mapId)).toBe("classic");
  expect(await page.evaluate(() => __arena.game.map)).toBeNull();
  await page.screenshot({ path: "/tmp/elemental-classic-restored.png" });
});
test("the main renderer keeps a felled fighter visible during its death animation", async ({
  page,
}) => {
  await start(page);
  const changed = await page.evaluate(async () => {
    const { Combat } = await import("/src/combat.js");
    const g = __arena.game;
    Object.assign(
      g,
      new Combat({ mode: "roulette", mapId: "garden", element: "fire" }),
    );
    g.update = () => {};
    Object.assign(g.player, { x: 1024, y: 680 });
    g.fell(g.player);
    g.fallenAnimations[0].elapsed = 0.6;
    const r = __arena.renderer,
      c = r.canvas,
      ctx = c.getContext("2d");
    const sample = () => {
      const v = r.view;
      return ctx.getImageData(
        Math.round(g.player.x * v.scale + v.tx - 90),
        Math.round(g.player.y * v.scale + v.ty - 90),
        180,
        180,
      ).data;
    };
    r.draw(g);
    const visible = sample();
    g.advanceDeaths(2);
    r.draw(g);
    const faded = sample();
    let changed = 0;
    for (let i = 0; i < visible.length; i += 4)
      if (
        Math.abs(visible[i] - faded[i]) +
          Math.abs(visible[i + 1] - faded[i + 1]) +
          Math.abs(visible[i + 2] - faded[i + 2]) >
        20
      )
        changed++;
    return changed;
  });
  expect(changed).toBeGreaterThan(100);
});
