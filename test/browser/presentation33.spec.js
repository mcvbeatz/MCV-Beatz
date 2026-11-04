import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("updated sprite poses and aura-free Divine outlines render consistently", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter, characterScale } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    const { Renderer } = await import("/src/render.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1350;
    const c = canvas.getContext("2d");
    c.fillStyle = "#253c42";
    c.fillRect(0, 0, 1400, 1350);
    let row = 0;
    const checks = [];
    for (const element of ["sanctuary", "mirror"])
      for (const [fx, fy] of [
        [0, 1],
        [1, 0],
        [0, -1],
      ]) {
        const a = makeFighter("preview", element, 0, 0, 0);
        Object.assign(a, { fx, fy });
        const frames = [];
        for (let col = 0; col < 7; col++) {
          if (col)
            Object.assign(a, {
              vx: fx * 150,
              vy: fy * 150,
              movingTime: 0.1,
              gaitDistance: (([0, 1, 3, 4, 5, 7][col - 1] + 0.1) * 75) / 8,
            });
          const draw = c.drawImage.bind(c);
          let selected;
          c.drawImage = (...args) => {
            selected ||= {
              src: args[0].src,
              crop: args.slice(1, 5),
              h: args[8],
            };
            draw(...args);
          };
          c.save();
          c.translate(100 + col * 200, 160 + row * 180);
          c.scale(1.7, 1.7);
          drawCharacter(c, a, 0);
          c.restore();
          c.drawImage = draw;
          frames.push(selected);
        }
        c.fillStyle = "white";
        c.fillText(
          element + " " + fx + "," + fy + " idle / six steps",
          8,
          row * 180 + 178,
        );
        checks.push({ element, frames });
        row++;
      }
    const r = new Renderer(document.createElement("canvas"));
    const masks = [];
    for (const [i, [fx, fy]] of [
      [0, 1],
      [1, 0],
      [0, -1],
    ].entries()) {
      const a = makeFighter("preview", "divine", 0, 0, 0);
      Object.assign(a, { fx, fy });
      for (let col = 0; col < 2; col++) {
        c.save();
        c.translate(100 + i * 400 + col * 190, 1260);
        c.scale(2, 2);
        if (col) r.outline(c, a, 0);
        else drawCharacter(c, a, 0);
        c.restore();
      }
      const alpha = (img) =>
        img
          .getContext("2d")
          .getImageData(0, 0, img.width, img.height)
          .data.filter((v, i) => i % 4 === 3 && v > 100).length;
      const full = document.createElement("canvas");
      full.width = full.height = 448;
      const fc = full.getContext("2d");
      fc.scale(2, 2);
      fc.translate(112, 180);
      drawCharacter(fc, a, 0);
      masks.push({
        body: alpha(r.outlineSprite),
        edge: alpha(r.outlineEdge),
        full: alpha(full),
      });
    }
    return {
      checks,
      masks,
      scales: ["phoenix", "invincible", "gravity"].map(characterScale),
      image: canvas.toDataURL().split(",")[1],
    };
  });
  await writeFile("/tmp/v33-poses.png", Buffer.from(result.image, "base64"));
  expect(result.scales).toEqual([1.275, 1.1, 1.1]);
  for (const { element, frames } of result.checks) {
    expect(
      new Set(frames.slice(1).map((f) => JSON.stringify(f.crop))).size,
    ).toBe(6);
    for (const f of frames.slice(1)) {
      expect(f.src).toContain("run-repair-" + element);
      expect(f.h / frames[0].h).toBeGreaterThan(0.8);
      expect(f.h / frames[0].h).toBeLessThan(1.2);
    }
  }
  for (const mask of result.masks) {
    expect(mask.body).toBeGreaterThan(1000);
    expect(mask.body).toBeLessThan(mask.full * 0.9);
    expect(mask.edge).toBeGreaterThan(150);
    expect(mask.edge).toBeLessThan(mask.body * 0.7);
  }
});
test("combat audio moderates overlaps, varies pitch and obeys SFX volume", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("body").click();
  const result = await page.evaluate(async () => {
    const { CombatSfx, SFX_KINDS } = await import("/src/combat-sfx.js");
    const ctx = new AudioContext();
    await ctx.resume();
    const s = new CombatSfx(ctx, 0.6);
    const played = SFX_KINDS.map((kind) => s.play(kind));
    const repeat = s.play("impact");
    const rates = [...s.voices].map((v) => v.playbackRate.value);
    s.volume(0);
    const mutedAt = ctx.currentTime;
    while (ctx.currentTime - mutedAt < 0.25)
      await new Promise((r) => setTimeout(r, 25));
    const volume = s.gain.gain.value;
    s.stop();
    const voices = s.voices.size;
    await ctx.close();
    return { played, repeat, rates, volume, voices };
  });
  expect(result.played).toEqual([true, true, true, true, true]);
  expect(result.repeat).toBe(false);
  expect(new Set(result.rates).size).toBe(5);
  expect(result.volume).toBeLessThan(0.001);
  expect(result.voices).toBe(0);
});
test("Boss movement stick pans the field while a felled player waits for allies", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0, sfx: 0, orientation: "landscape" }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.evaluate(() => {
    Math.random = () => 0.99;
    __app.chooseMode("boss");
  });
  await page.locator("#begin-btn").click();
  const before = await page.evaluate(() => {
    const g = __arena.game;
    g.countdown = 0;
    g.ai = () => {};
    g.fell(g.player);
    return { x: g.player.x, y: g.player.y };
  });
  await expect(page.locator("#health-label")).toHaveText(
    "FELLED · MOVE TO LOOK",
  );
  const b = await page.locator("#joystick").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.85, b.y + b.height / 2);
  await expect
    .poll(() => page.evaluate(() => __arena.game.spectatorFocus?.x))
    .toBeGreaterThan(before.x + 10);
  await page.mouse.up();
  const after = await page.evaluate(() => ({
    x: __arena.game.player.x,
    y: __arena.game.player.y,
    alive: __arena.game.player.alive,
  }));
  expect(after).toEqual({ ...before, alive: false });
});
