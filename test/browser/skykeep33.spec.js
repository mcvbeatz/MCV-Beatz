import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("Air home match loads the rooftop with visible holes and working phone controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    Math.random = () => 0.8;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation: "landscape" }),
    );
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?mode=war");
  await page.locator('[data-element="air"]').click();
  await page.locator("#begin-btn").click();
  await expect(page.locator("#arena-title")).toHaveText("THE SKYBREAK KEEP");
  const image = await page.evaluate(async () => {
    const g = __arena.game;
    g.countdown = 0;
    g.ai = () => {};
    const { paintBattleMap } = await import("/src/battle-maps-render.js");
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 1360;
    paintBattleMap(c.getContext("2d"), g.map);
    return c.toDataURL().split(",")[1];
  });
  await writeFile("/tmp/v33-skykeep.png", Buffer.from(image, "base64"));
  const before = await page.evaluate(() => __arena.game.player.x);
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  expect(await page.evaluate(() => __arena.game.player.x)).toBeGreaterThan(
    before + 20,
  );
  await page.screenshot({ path: "/tmp/v33-skykeep-phone.png" });
  expect(errors).toEqual([]);
});

test("Mud stays brown and keeps standing scale through every running direction", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 1120;
    canvas.height = 480;
    const c = canvas.getContext("2d");
    const rows = [];
    for (const [row, [fx, fy]] of [
      [0, 1],
      [1, 0],
      [0, -1],
    ].entries()) {
      const a = makeFighter("mud", "mud", 0, 0, 0);
      Object.assign(a, { fx, fy });
      const heights = [];
      for (let col = 0; col < 7; col++) {
        if (col)
          Object.assign(a, {
            vx: 150,
            movingTime: 1,
            gaitDistance: (([0, 1, 3, 4, 5, 7][col - 1] + 0.1) * 75) / 8,
          });
        const draw = c.drawImage.bind(c);
        c.drawImage = (...args) => {
          heights.push(args[8]);
          draw(...args);
        };
        c.save();
        c.translate(col * 160 + 80, row * 160 + 130);
        c.scale(1.6, 1.6);
        drawCharacter(c, a, 0);
        c.restore();
        c.drawImage = draw;
      }
      rows.push(heights);
    }
    const pixels = c.getImageData(0, 0, 1120, 480).data;
    let green = 0,
      solid = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i + 3] > 180) {
        solid++;
        if (
          pixels[i + 1] > pixels[i] * 1.3 &&
          pixels[i + 1] > pixels[i + 2] * 1.2 &&
          pixels[i + 1] > 40
        )
          green++;
      }
    return { rows, green, solid, image: canvas.toDataURL().split(",")[1] };
  });
  for (const row of result.rows)
    for (const h of row.slice(1)) {
      expect(h / row[0]).toBeGreaterThan(0.9);
      expect(h / row[0]).toBeLessThan(1.12);
    }
  expect(result.green / result.solid).toBeLessThan(0.005);
  await writeFile("/tmp/v33-mud.png", Buffer.from(result.image, "base64"));
});

test("chasm falls shrink into the opening while quicksand visibly covers the body", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawFallenCharacter, deathPose } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 360;
    const c = canvas.getContext("2d");
    const results = [];
    for (const [row, kind] of ["chasm", "quicksand"].entries()) {
      const counts = [];
      for (const [col, p] of [0, 0.3, 0.6, 0.9].entries()) {
        const death = {
          fighter: makeFighter("water", "water", 0, 0, 0),
          terrain: { kind, x: 0, y: 0, r: 55 },
          elapsed: p * 1.5,
          duration: 1.5,
        };
        c.save();
        c.translate(col * 240 + 120, row * 180 + 115);
        drawFallenCharacter(c, death);
        c.restore();
        const data = c.getImageData(col * 240, row * 180, 240, 180).data;
        let cyan = 0;
        for (let i = 0; i < data.length; i += 4)
          if (
            data[i + 3] > 100 &&
            data[i + 2] > 100 &&
            data[i + 1] > 90 &&
            data[i] < data[i + 2] * 0.6
          )
            cyan++;
        counts.push(cyan);
        if (p === 0.6 && deathPose(death).opacity !== 1)
          throw Error("Premature fade");
      }
      results.push(counts);
    }
    return { results, image: canvas.toDataURL().split(",")[1] };
  });
  for (const counts of result.results) {
    expect(counts[0]).toBeGreaterThan(100);
    expect(counts[2]).toBeLessThan(counts[0]);
    expect(counts[3]).toBeLessThan(counts[0] * 0.05);
  }
  await writeFile(
    "/tmp/v33-terrain-deaths.png",
    Buffer.from(result.image, "base64"),
  );
});
