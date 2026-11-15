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
test("collected abilities appear beside Icicle Burst and work through touch controls while keeping Ice", async ({
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
  await expect(page.locator("#skill-switcher button")).toHaveCount(1);
  await expect(page.locator("#skill-switcher")).toHaveText("Ice");
  await expect(page.locator("#ability-name")).toHaveText("Icicle Burst");
  await page.locator("#utility-btn").click();
  expect(await page.evaluate(() => __arena.game.player.hp)).toBeGreaterThan(40);
  const b = await page.locator("#extra-skill-0").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  expect(await page.evaluate(() => __arena.game.player.shield)).toBeTruthy();
  await page.mouse.up();
  expect(await page.evaluate(() => __arena.game.player.shield)).toBe(0);
  await page.locator("#extra-skill-1").click();
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
test("Zombies ability buttons fit both phone orientations and survive revival", async ({
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
      "#utility-btn",
      "#extra-skill-0",
      "#extra-skill-1",
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

test("Gridiron Pass button and teammate taps launch forward passes", async ({
  page,
}) => {
  await start(page, "gridiron");
  const prepare = () =>
    page.evaluate(() => {
      const g = __arena.game;
      g.fighters.forEach((a, i) =>
        Object.assign(a, { x: 500 + i * 90, y: 800 }),
      );
      Object.assign(g.player, { x: 900, y: 500 });
      Object.assign(g.fighters[1], { x: 1120, y: 440 });
      Object.assign(g.fighters[2], { x: 1010, y: 620 });
      Object.assign(g.fighters[3], { x: 1040, y: 500 });
      Object.assign(g.ball, { carrier: g.player.id, pass: null });
    });
  await prepare();
  await expect(page.locator("#pass-btn")).toBeEnabled();
  await page.locator("#pass-btn").click();
  expect(await page.evaluate(() => __arena.game.ball.pass.target)).toBe(
    "rival-1",
  );
  await prepare();
  await page.waitForTimeout(100);
  const p = await page.evaluate(() => {
    const a = __arena.game.fighters[2],
      v = __arena.renderer.view;
    return { x: a.x * v.scale + v.tx, y: (a.y - 30) * v.scale + v.ty };
  });
  const box = await page.locator("#game").boundingBox();
  await page.mouse.click(box.x + p.x, box.y + p.y);
  expect(await page.evaluate(() => __arena.game.ball.pass?.target)).toBe(
    "rival-2",
  );
  for (const [width, height] of [
    [844, 390],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator("#pass-btn")).toBeVisible();
    const b = await page.locator("#pass-btn").boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(height);
  }
});

test("Electric gate lever supports touch and keyboard, blasts across rooms, pauses spawns, and remains overheated for one minute", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.evaluate(() => {
    const g = __arena.game,
      s = g.zombieGates[0];
    Object.assign(g.player, { x: s.x, y: s.y + 70 });
    g.fighters
      .filter((a) => a !== g.player)
      .forEach((a, i) => Object.assign(a, { x: 350 + i * 80, y: 1700 }));
  });
  await expect(page.locator("#arena-hint")).toContainText("ELECTRIC GATE");
  const point = await page.evaluate(() => {
    const s = __arena.game.zombieGates[0],
      v = __arena.renderer.view;
    return { x: s.x * v.scale + v.tx, y: (s.y - 25) * v.scale + v.ty };
  });
  const box = await page.locator("#game").boundingBox();
  await page.mouse.click(box.x + point.x, box.y + point.y);
  await expect
    .poll(() => page.evaluate(() => __arena.game.zombieGates[0].state))
    .toBe("locked");
  await expect(page.locator("#arena-hint")).toContainText("60s");
  await page.screenshot({ path: "/tmp/zombies-electric-gate.png" });
  const blast = await page.evaluate(async () => {
    const { spawnZombie } = await import("/src/zombies.js");
    const { updateZombieGates } = await import("/src/zombie-gates.js");
    const g = __arena.game,
      z = spawnZombie(g),
      outside = spawnZombie(g);
    Object.assign(z, { x: 450, y: 1700 });
    g.time = 60;
    updateZombieGates(g);
    return {
      alive: z.alive,
      outsideAlive: outside.alive,
      spawnsPaused: spawnZombie(g) === null,
      state: g.zombieGates[0].state,
      playerAlive: g.player.alive,
    };
  });
  expect(blast).toEqual({
    alive: false,
    outsideAlive: false,
    spawnsPaused: true,
    state: "overheated",
    playerAlive: true,
  });
  await expect(page.locator("#arena-hint")).toContainText("7s");
  await page.evaluate(async () => {
    const g = __arena.game;
    g.time = 67;
    (await import("/src/zombie-gates.js")).updateZombieGates(g);
  });
  await expect(page.locator("#arena-hint")).toContainText("OVERHEATING · 53s");
  await page.screenshot({ path: "/tmp/zombies-overheated-gate.png" });
  await page.keyboard.press("e");
  expect(await page.evaluate(() => __arena.game.zombieGates[0].state)).toBe(
    "overheated",
  );
  expect(
    await page.evaluate(
      async () => !!(await import("/src/zombies.js")).spawnZombie(__arena.game),
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    __arena.game.time = 120;
    (await import("/src/zombie-gates.js")).updateZombieGates(__arena.game);
  });
  await expect(page.locator("#arena-hint")).toContainText("ELECTRIC GATE");
  await page.keyboard.press("e");
  expect(await page.evaluate(() => __arena.game.zombieGates[0].blastAt)).toBe(
    180,
  );
  expect(errors).toEqual([]);
});
test("Domination is unavailable in menus and old mode requests fall back to Duel", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  expect(await page.locator('[data-mode="domination"]').count()).toBe(0);
  await page.evaluate(() => __app.chooseMode("domination"));
  await expect(page.locator("#setup-mode-title")).toHaveText("Duel");
  await page.locator("#begin-btn").click();
  expect(await page.evaluate(() => __arena.game.mode)).toBe("duel");
});
