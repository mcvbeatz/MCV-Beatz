import { test, expect } from "@playwright/test";
async function start(page, mode, orientation = "landscape") {
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem("elemental-settings", JSON.stringify({ orientation }));
  }, orientation);
  await page.goto(`/?mode=${mode}`);
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.locator('[data-element="light"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.countdown = 0;
    __arena.game.ai = () => {};
  });
}
async function clearWave(page) {
  await page.evaluate(() => {
    const g = __arena.game;
    for (const a of g.fighters.filter((a) => a.team === 1))
      g.fell(a, { killer: g.player });
    g.checkMatchEnd();
  });
  await expect(page.locator("#wave-reward")).toBeVisible();
}
test("Waves selection can change, waits seven seconds and freezes while paused", async ({
  page,
}) => {
  test.setTimeout(60000);
  await start(page, "gauntlet");
  await clearWave(page);
  const air = page.locator('[data-reward="shard:air"]');
  const earth = page.locator('[data-reward="shard:earth"]');
  await air.click();
  await expect(air).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#wave-reward-timer")).toContainText(
    "Air shard selected",
  );
  expect(await page.evaluate(() => __arena.game.wave)).toBe(1);
  await earth.click();
  await expect(earth).toHaveAttribute("aria-pressed", "true");
  await expect(air).toHaveAttribute("aria-pressed", "false");
  await page.locator("#pause-btn").click();
  const remaining = await page.evaluate(() => __arena.game.rewardRemaining);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => __arena.game.rewardRemaining)).toBe(
    remaining,
  );
  await page.locator("#pause-btn").click();
  await expect(page.locator("#wave-reward")).toBeHidden({ timeout: 8500 });
  expect(
    await page.evaluate(() => ({
      wave: __arena.game.wave,
      form: __arena.game.player.element,
    })),
  ).toEqual({ wave: 2, form: "mirror" });
});
test("Team Waves auto-selects its first advantage after seven seconds without a click", async ({
  page,
}) => {
  test.setTimeout(60000);
  await start(page, "gauntlet-team");
  await clearWave(page);
  const first = await page
    .locator("[data-reward]")
    .first()
    .getAttribute("data-reward");
  await expect(page.locator("#wave-reward-timer")).toContainText(
    "first option is automatic",
  );
  expect(await page.evaluate(() => __arena.game.rewardSelection)).toBeNull();
  await expect(page.locator("#wave-reward")).toBeHidden({ timeout: 8500 });
  const parts = await page.evaluate(() => __arena.game.player.parts);
  expect(parts).toContain(first.split(":")[1]);
  expect(await page.evaluate(() => __arena.game.wave)).toBe(2);
});
test("advantage timer and choices fit a small phone in either orientation", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  for (const orientation of ["portrait", "landscape"]) {
    await start(page, "gauntlet-team", orientation);
    await clearWave(page);
    await page.evaluate(() => {
      __arena.game.update = () => {};
    });
    for (const el of await page
      .locator("#wave-reward-timer, #reward-options button")
      .all()) {
      const r = await el.boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(-1);
      expect(r.y).toBeGreaterThanOrEqual(-1);
      expect(r.x + r.width).toBeLessThanOrEqual(321);
      expect(r.y + r.height).toBeLessThanOrEqual(569);
    }
    await page.screenshot({ path: `/tmp/v17-rewards-${orientation}.png` });
  }
  await context.close();
});
test("Roulette stays live after a full wipe, respawns everyone, and ends on kills only at timeout", async ({
  page,
}) => {
  await start(page, "roulette");
  await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.time = 20;
    for (const a of g.fighters) g.fell(a);
    g.checkMatchEnd();
  });
  await expect(page.locator("#game-overlay")).toBeHidden();
  expect(await page.evaluate(() => __arena.game.finished)).toBe(false);
  await page.evaluate(async () => {
    const g = __arena.game,
      { Combat } = await import("/src/combat.js");
    g.time = 30;
    Combat.prototype.update.call(g, 0.01, { x: 0, y: 0 }, false);
  });
  expect(
    await page.evaluate(() => __arena.game.fighters.every((a) => a.alive)),
  ).toBe(true);
  await page.evaluate(() => {
    const g = __arena.game;
    g.time = 179;
    g.player.kills = 9;
    g.fell(g.player);
    g.time = 180;
    g.checkMatchEnd();
  });
  await expect(page.locator("#game-overlay")).toBeVisible();
  await expect(page.locator("#overlay-text")).toContainText(
    "Most eliminations · 9 kills",
  );
});
test("new fusion sprites match the rendered roster and all three menu portraits load", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/?mode=fused3");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.evaluate(
    async () => await (await import("/src/characters.js")).charactersReady,
  );
  await page.locator('[data-element="phoenix"]').click();
  await page.locator("#begin-btn").click();
  const colorCounts = await page.evaluate(async () => {
    const g = __arena.game;
    const { makeFighter } = await import("/src/combat.js");
    const { drawCharacter } = await import("/src/characters.js");
    g.update = () => {};
    g.effects = [];
    g.hazards = [];
    g.portals.portals = [];
    g.fighters = ["phoenix", "terraformer", "sanctuary", "invincible"].map(
      (e, i) =>
        makeFighter(i ? "rival-" + i : "player", e, i, 300 + i * 140, 360),
    );
    g.player = g.fighters[0];
    return g.fighters.map((a) => {
      const c = document.createElement("canvas");
      c.width = c.height = 150;
      const ctx = c.getContext("2d");
      ctx.translate(75, 120);
      drawCharacter(ctx, a, 0);
      const data = ctx.getImageData(0, 0, 150, 150).data,
        colors = new Set();
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3] > 160)
          colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return colors.size;
    });
  });
  expect(colorCounts.every((n) => n > 250)).toBe(true);
  await page.screenshot({ path: "/tmp/v17-roster-comparison.png" });
  await page.locator("#leave-btn").click();
  for (const e of ["phoenix", "terraformer", "sanctuary"]) {
    await page.locator(`[data-element="${e}"]`).click();
    await expect(page.locator("#profile-name")).toHaveText(
      new RegExp(e, "i"),
    );
  }
  await page.evaluate(() => __app.show("elements"));
  await page.screenshot({ path: "/tmp/v17-character-library.png" });
});
