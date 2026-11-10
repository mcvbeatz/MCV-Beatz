import { test, expect } from "@playwright/test";
test("Ice and Abyssal have distinct animated victory poses, and Abyssal matches Terraformer scale", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto("/");
  await page.waitForFunction(() => window.__app);
  const result = await page.evaluate(async () => {
    const { drawCharacter, charactersReady, characterScale } =
        await import("/src/characters.js"),
      { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 440;
    const c = canvas.getContext("2d");
    c.fillStyle = "#203e44";
    c.fillRect(0, 0, 1000, 440);
    const heights = {},
      animations = {};
    const pose = (element, victory = false, victoryTime = 0) => {
      const a = makeFighter("preview", element, 0, 0, 0);
      Object.assign(a, { fx: 0, fy: 1, victory, victoryTime });
      const tile = document.createElement("canvas");
      tile.width = 160;
      tile.height = 180;
      const ctx = tile.getContext("2d");
      ctx.translate(80, 150);
      drawCharacter(ctx, a, 0);
      const data = ctx.getImageData(0, 0, 160, 180).data,
        rows = [];
      for (let y = 0; y < 180; y++)
        for (let x = 0; x < 160; x++)
          if (data[(y * 160 + x) * 4 + 3] > 150) {
            rows.push(y);
            break;
          }
      return {
        tile,
        height: Math.max(...rows) - Math.min(...rows),
        image: tile.toDataURL(),
      };
    };
    for (const [row, element] of ["ice", "abyssal"].entries()) {
      animations[element] = [];
      for (const [col, time] of [null, 0.1, 0.5, 1.8].entries()) {
        const p = pose(element, time !== null, time || 0);
        c.drawImage(p.tile, col * 200, row * 210);
        if (time === null) heights[element] = p.height;
        else animations[element].push(p.image);
      }
    }
    const terra = pose("terraformer");
    heights.terraformer = terra.height;
    c.drawImage(terra.tile, 800, 210);
    c.fillStyle = "#d7efe7";
    c.font = "16px sans-serif";
    c.fillText("ICE: idle / victory poses", 20, 195);
    c.fillText("ABYSSAL: idle / victory poses", 20, 410);
    c.fillText("TERRAFORMER", 810, 410);
    canvas.id = "victory-preview";
    Object.assign(canvas.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "9999",
    });
    document.body.appendChild(canvas);
    return {
      heights,
      counts: Object.values(animations).map((images) => new Set(images).size),
      sameScale: characterScale("abyssal") === characterScale("terraformer"),
    };
  });
  expect(result.sameScale).toBe(true);
  expect(
    Math.abs(result.heights.abyssal - result.heights.terraformer),
  ).toBeLessThanOrEqual(8);
  expect(result.counts).toEqual([3, 3]);
  await page
    .locator("#victory-preview")
    .screenshot({ path: "/tmp/ice-victory-preview.png" });
});
test("a won battle advances the new victory sprites during the celebration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0, sfx: 0 }),
    );
  });
  await page.goto("/?mode=fused3");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.locator('[data-element="abyssal"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.countdown = 0;
    g.finish(g.player.team, "Victory pose check");
  });
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.victoryTime))
    .toBeGreaterThan(0.3);
  expect(await page.evaluate(() => __arena.game.player.victory)).toBe(true);
});
