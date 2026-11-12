import { test, expect } from "@playwright/test";
async function start(page, mode = "zombies", count = "4") {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0, sfx: 0, orientation: "landscape" }),
    );
  });
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.goto(`/?mode=${mode}`);
  await page.waitForFunction(() => window.__app?.screen === "setup");
  if (mode === "zombies") await page.locator("#ffa-count").selectOption(count);
  await page.locator("#begin-btn").click();
  await page.evaluate(async () => {
    const g = __arena.game;
    g.countdown = 0;
    g.update = () => {};
    await (
      await import("/src/characters.js")
    ).charactersReady;
  });
}
test("Zombies starts an Ice team on the open dungeon with unique room abilities", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, "zombies", "8");
  expect(await page.evaluate(() => __arena.game.fighters.length)).toBe(8);
  await expect(page.locator("#round-mode")).toContainText("ZOMBIES");
  await expect(page.locator("#objective-score")).toContainText("8 SURVIVORS");
  await expect(page.locator("#ability-name")).toHaveText("Icicle Burst");
  await page.screenshot({ path: "public/guides/zombies.png" });
  expect(errors).toEqual([]);
});
test("collected abilities appear as top tabs and work through touch controls while keeping Ice", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.evaluate(async () => {
    const { updateZombies } = await import("/src/zombies.js");
    const g = __arena.game;
    for (const id of ["healing", "shield", "teleport"]) {
      const d = g.zombieDrops.find((d) => d.id === id);
      g.player.x = d.x;
      g.player.y = d.y;
      updateZombies(g);
    }
    g.player.hp = 40;
  });
  await expect(page.locator("[data-zombie-skill]")).toHaveCount(4);
  await page.locator('[data-zombie-skill="healing"]').click();
  await page.locator("#charge-btn").click();
  expect(await page.evaluate(() => __arena.game.player.hp)).toBeGreaterThan(40);
  await page.locator('[data-zombie-skill="shield"]').click();
  const b = await page.locator("#charge-btn").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  expect(await page.evaluate(() => __arena.game.player.shield)).toBeTruthy();
  await page.mouse.up();
  expect(await page.evaluate(() => __arena.game.player.shield)).toBe(0);
  await page.locator('[data-zombie-skill="teleport"]').click();
  await page.locator("#charge-btn").click();
  const p = await page.evaluate(() => {
    const a = __arena.game.player,
      v = __arena.renderer.view;
    return { x: (a.x + 60) * v.scale + v.tx, y: a.y * v.scale + v.ty };
  });
  const box = await page.locator("#game").boundingBox();
  await page.mouse.click(box.x + p.x, box.y + p.y);
  expect(await page.evaluate(() => !!__arena.game.player.blink)).toBe(true);
  expect(await page.evaluate(() => __arena.game.player.element)).toBe("ice");
  expect(errors).toEqual([]);
});
test("Zombies ability tabs fit both phone orientations and survive revival", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    __arena.game.player.zombieSkills = [
      "lightning",
      "telekinesis",
      "invisibility",
    ];
  });
  for (const [width, height] of [
    [844, 390],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const selector of [
      "#skill-switcher",
      "#joystick",
      "#attack-btn",
      "#charge-btn",
      "#objective-score",
    ]) {
      await expect(page.locator(selector)).toBeVisible();
      const b = await page.locator(selector).boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.y).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(width + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(height + 1);
    }
    await page.screenshot({ path: `/tmp/zombies-${width}.png` });
  }
  await page.evaluate(() => {
    const g = __arena.game;
    g.fell(g.player);
  });
  await expect(page.locator("#health-label")).toContainText("FELLED");
  expect(await page.evaluate(() => __arena.game.finished)).toBe(false);
});
test("CTF shows a three-minute timer and sudden-death captures; Gridiron starts all Earth", async ({
  page,
}) => {
  await start(page, "ctf");
  await expect(page.locator("#timer")).toHaveText("03:00");
  await page.evaluate(() => {
    const g = __arena.game;
    g.time = 180;
    g.scores = [1, 1];
    g.checkMatchEnd();
  });
  await expect(page.locator("#objective-score")).toContainText("SUDDEN DEATH");
  await start(page, "gridiron");
  expect(
    await page.evaluate(() =>
      __arena.game.fighters.every((a) => a.element === "earth"),
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    const g = __arena.game;
    g.player.deaths = 5;
    g.scores = [0, 1];
    (await import("/src/event-modes.js")).updateGridironEvolution(g);
  });
  await expect(page.locator("#hud-name")).toHaveText("GRAVITY");
  const possession = await page.evaluate(async () => {
    const g = __arena.game;
    g.player.kills = 8;
    g.ball.carrier = null;
    g.ball.x = 250;
    g.ball.y = 550;
    (await import("/src/event-modes.js")).updateGridiron(g);
    return {
      carrier: g.ball.carrier,
      player: g.player.id,
      atStart: g.ball.x === g.player.spawn.x && g.ball.y === g.player.spawn.y,
    };
  });
  expect(possession.carrier).toBe(possession.player);
  expect(possession.atStart).toBe(true);
  await expect(page.locator("#objective-score")).toContainText("0 – 2");
});
