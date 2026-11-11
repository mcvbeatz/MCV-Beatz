import { test, expect } from "@playwright/test";
async function start(page, mode) {
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
for (const [mode, title] of [
  ["ctf", "THE EVERGREEN LABYRINTH"],
  ["gridiron", "THE EMERALD STADIUM"],
  ["turnpike", "THE CLOUDWAY CIRCUIT"],
]) {
  test(`${mode} launches eight fighters on its dedicated map without browser errors`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page, mode);
    await expect(page.locator("#arena-title")).toHaveText(title);
    expect(await page.evaluate(() => __arena.game.fighters.length)).toBe(8);
    await page.screenshot({ path: `public/guides/${mode}.png` });
    const data = await page.evaluate(async () => {
      const { paintBattleMap } = await import("/src/battle-maps-render.js");
      const m = __arena.game.map;
      const canvas = document.createElement("canvas");
      canvas.width = m.width;
      canvas.height = m.height;
      paintBattleMap(canvas.getContext("2d"), m);
      return canvas.toDataURL();
    });
    const fs = await import("node:fs/promises");
    await fs.writeFile(
      `/tmp/${mode}-map.png`,
      Buffer.from(data.split(",")[1], "base64"),
    );
    expect(errors).toEqual([]);
  });
}
test("Gridiron HUD shows possession rules, scores and sudden death", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, "gridiron");
  await page.evaluate(async () => {
    const g = __arena.game;
    g.scores = [2, 2];
    g.time = 180;
    g.checkMatchEnd();
  });
  await expect(page.locator("#objective-score")).toContainText("SUDDEN DEATH");
  await page.evaluate(async () => {
    const g = __arena.game;
    const { updateGridiron } = await import("/src/event-modes.js");
    g.ball.x = 1550;
    g.ball.y = 550;
    updateGridiron(g);
  });
  expect(await page.evaluate(() => __arena.game.winnerTeam)).toBe(0);
  expect(errors).toEqual([]);
});
test("racing ability controls use a pickup and retain the teleport destination interaction", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, "turnpike");
  await expect(page.locator("#ability-name")).toHaveText("Ability pickup");
  await expect(page.locator("#charge-btn")).toBeDisabled();
  await page.evaluate(() => {
    __arena.game.player.raceItem = "explosion";
  });
  await expect(page.locator("#ability-name")).toHaveText("Explosion");
  await page.locator("#charge-btn").click();
  expect(await page.evaluate(() => __arena.game.player.raceItem)).toBeNull();
  await page.evaluate(() => {
    const g = __arena.game;
    g.time = 1;
    g.player.raceItem = "teleport";
  });
  await page.locator("#charge-btn").click();
  await expect(page.locator("#ability-status")).toHaveText(
    "Tap the arena to teleport",
  );
  const p = await page.evaluate(() => {
    const a = __arena.game.player,
      v = __arena.renderer.view;
    return { x: (a.x + 100) * v.scale + v.tx, y: a.y * v.scale + v.ty };
  });
  const box = await page.locator("#game").boundingBox();
  await page.mouse.click(box.x + p.x, box.y + p.y);
  expect(await page.evaluate(() => __arena.game.player.raceItem)).toBeNull();
  expect(await page.evaluate(() => !!__arena.game.player.blink)).toBe(true);
  await expect(page.locator("#objective-score")).toContainText("LAP 1/3");
  expect(errors).toEqual([]);
});
test("Invincible exposes a working instant Explosion button", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page, "fused3");
  await page.evaluate(async () => {
    const { makeFighter } = await import("/src/combat.js");
    const g = __arena.game;
    g.map = null;
    Object.assign(g.player, makeFighter("player", "invincible", 0, 450, 350));
    g.fighters = [g.player, makeFighter("target", "air", 1, 550, 350)];
  });
  await expect(page.locator("#ability-name")).toHaveText("Explosion");
  await page.locator("#charge-btn").click();
  expect(await page.evaluate(() => __arena.game.fighters[1].hp)).toBe(115);
  expect(errors).toEqual([]);
});

for (const mode of ["gridiron", "turnpike"])
  test(`${mode} controls fit landscape phones and rotated portrait`, async ({
    page,
  }) => {
    await start(page, mode);
    for (const [width, height] of [
      [844, 390],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const selector of [
        "#objective-score",
        "#attack-btn",
        "#joystick",
        ...(mode === "turnpike" ? ["#charge-btn"] : ["#utility-btn"]),
      ]) {
        await expect(page.locator(selector)).toBeVisible();
        const b = await page.locator(selector).boundingBox();
        expect(b.x).toBeGreaterThanOrEqual(-1);
        expect(b.y).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.width).toBeLessThanOrEqual(width + 1);
        expect(b.y + b.height).toBeLessThanOrEqual(height + 1);
      }
      await page.screenshot({ path: `/tmp/${mode}-${width}.png` });
    }
  });
