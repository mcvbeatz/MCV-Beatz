import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
async function ready(page, mode = "dungeon") {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0.1, sfx: 0.3, orientation: "landscape" }),
    );
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator('[data-element="fire"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.ai = () => {};
    __arena.game.countdown = 0;
  });
}
test("Dungeon renders the flooded vault, monsters and a complete key-and-boss progression", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator("#round-mode")).toContainText("DUNGEON");
  await expect(page.locator("#objective-score")).toContainText("WATER WARDEN");
  await page.evaluate(async () => {
    await (
      await import("/src/characters.js")
    ).charactersReady;
  });
  await page.screenshot({ path: "/tmp/dungeon-entry.png" });
  const overview = await page.evaluate(
    () => __arena.renderer.mazeBackground.toDataURL().split(",")[1],
  );
  await writeFile("/tmp/dungeon-map.png", Buffer.from(overview, "base64"));
  await page.evaluate(() => {
    const g = __arena.game;
    const a = g.fighters.find((a) => a.dungeonRole === "water");
    g.fell(a, { killer: g.player });
  });
  await expect(page.locator("#wave-reward")).toBeVisible();
  await expect(page.locator("#wave-reward h2")).toHaveText(
    "Choose your elemental token.",
  );
  const paused = await page.evaluate(() => __arena.game.time);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => __arena.game.time)).toBe(paused);
  await page.locator('[data-reward="shard:air"]').click();
  await expect(page.locator("#wave-reward")).toBeHidden();
  await page.evaluate(() => {
    const g = __arena.game;
    Object.assign(g.player, { x: g.tokens[0].x, y: g.tokens[0].y });
    g.touchTokens(g.player);
  });
  await expect(page.locator("#hud-name")).toHaveText("BLAZE");
  await page.evaluate(() => {
    const g = __arena.game;
    const a = g.fighters.find((a) => a.dungeonRole === "apparition");
    g.fell(a, { killer: g.player });
  });
  await expect(page.locator("#wave-reward-caption")).toContainText(
    "Apparition",
  );
  await page.locator('[data-reward="shard:light"]').click();
  await page.evaluate(async () => {
    const g = __arena.game;
    Object.assign(g.player, { x: g.tokens[0].x, y: g.tokens[0].y });
    g.touchTokens(g.player);
    Object.assign(g.player, { x: g.dungeon.key.x, y: g.dungeon.key.y });
    (await import("/src/dungeon.js")).updateDungeon(g);
  });
  await expect(page.locator("#hud-name")).toHaveText("PHOENIX");
  await expect(page.locator("#objective-score")).toContainText("KEY FOUND");
  await page.evaluate(async () => {
    const g = __arena.game;
    Object.assign(g.player, { x: 1850, y: 735 });
    (await import("/src/dungeon.js")).updateDungeon(g);
  });
  await expect(page.locator("#objective-score")).toContainText(
    "DEFEAT TERRAFORMER",
  );
  await page.evaluate(() => {
    const g = __arena.game;
    g.fell(
      g.fighters.find((a) => a.dungeonRole === "final"),
      { killer: g.player },
    );
    g.checkMatchEnd();
  });
  await expect
    .poll(() => page.evaluate(() => __arena.game.result))
    .toBe("victory");
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackId))
    .toBe("a-win-is-a-win");
  expect(errors).toEqual([]);
});
test("Team Waves move stick pans the field after the player falls", async ({
  page,
}) => {
  await ready(page, "gauntlet-team");
  const start = await page.evaluate(() => {
    const g = __arena.game;
    g.fell(g.player);
    return { x: g.player.x, y: g.player.y };
  });
  await expect(page.locator("#health-label")).toHaveText(
    "FELLED · MOVE TO LOOK",
  );
  const b = await page.locator("#joystick").boundingBox();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.86, b.y + b.height * 0.5);
  await expect
    .poll(() => page.evaluate(() => __arena.game.spectatorFocus?.x))
    .toBeGreaterThan(start.x + 15);
  await page.mouse.up();
  expect(
    await page.evaluate(() => ({
      x: __arena.game.player.x,
      y: __arena.game.player.y,
    })),
  ).toEqual(start);
});
test("Multi-Dimensional casts keep the corrected costume and all monsters have movement and bite frames", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter, drawFallenCharacter } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 750;
    const c = canvas.getContext("2d");
    c.fillStyle = "#263f48";
    c.fillRect(0, 0, 1200, 750);
    const selected = [];
    for (const [i, [fx, fy]] of [
      [0, 1],
      [1, 0],
      [0, -1],
    ].entries()) {
      const a = makeFighter("preview", "multi-dimensional", 0, 0, 0);
      Object.assign(a, { fx, fy, castTime: 0.25, castFx: fx, castFy: fy });
      const draw = c.drawImage.bind(c);
      c.drawImage = (...args) => {
        selected.push(args[0].src);
        draw(...args);
      };
      c.save();
      c.translate(200 + i * 400, 180);
      c.scale(2, 2);
      drawCharacter(c, a, 0);
      c.restore();
      c.drawImage = draw;
    }
    const species = [];
    for (const [row, kind] of ["alligator", "snake", "wolf"].entries()) {
      const pics = [];
      for (let col = 0; col < 8; col++) {
        const a = makeFighter("monster", "water", 1, 0, 0);
        Object.assign(a, {
          monsterKind: kind,
          parts: [],
          fx: col < 2 || col === 6 ? 0 : col < 4 || col === 7 ? 1 : 0,
          fy: col < 2 || col === 6 ? 1 : col < 4 || col === 7 ? 0 : -1,
          alive: true,
          vx: col % 2 ? 100 : 0,
          gaitDistance: 25,
          swing: col >= 6 ? 0.1 : 0,
        });
        const draw = c.drawImage.bind(c);
        c.drawImage = (...args) => {
          pics.push(args.slice(1, 5));
          draw(...args);
        };
        c.save();
        c.translate(75 + col * 150, 350 + row * 180);
        c.scale(1.7, 1.7);
        drawCharacter(c, a, 0);
        c.restore();
        c.drawImage = draw;
      }
      species.push(new Set(pics.map((f) => JSON.stringify(f))).size);
    }
    return { selected, species, image: canvas.toDataURL().split(",")[1] };
  });
  expect(
    result.selected.every((s) => s.includes("cast-multi-dimensional")),
  ).toBe(true);
  expect(result.species).toEqual([8, 8, 8]);
  await writeFile(
    "/tmp/dungeon-sprites.png",
    Buffer.from(result.image, "base64"),
  );
});

test("Dungeon token choices fit a landscape phone and remain selectable", async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => {
    const g = __arena.game;
    g.fell(
      g.fighters.find((a) => a.dungeonRole === "water"),
      { killer: g.player },
    );
  });
  await expect(page.locator("#wave-reward")).toBeVisible();
  for (const button of await page.locator("[data-reward]").all()) {
    await expect(button).toBeInViewport();
  }
  await page.screenshot({ path: "/tmp/dungeon-phone-reward.png" });
  await page.locator('[data-reward="shard:air"]').click();
  await expect(page.locator("#wave-reward")).toBeHidden();
});
