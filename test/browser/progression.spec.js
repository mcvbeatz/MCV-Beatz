import { test, expect } from "@playwright/test";
async function ready(page, orientation = "portrait") {
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation, music: 0, sfx: 0 }),
    );
  }, orientation);
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
test("guest account exposes all progression panels, real artwork, filters and locked cosmetics on mobile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator('[data-screen="account"]').click();
  await expect(page.locator(".progress-tabs button")).toHaveCount(5);
  await expect(page.locator(".progress-storage")).toContainText(
    "saved on this device",
  );
  await page.locator('[data-tab="mastery"]').click();
  await expect(page.locator(".progress-content [data-element]")).toHaveCount(
    25,
  );
  await page.locator('[data-element="ice"]').click();
  await expect(page.locator(".cosmetic-card")).toHaveCount(4);
  await expect(page.locator('[data-equip="mastery:ice:5"]')).toBeDisabled();
  await page.locator('[data-tab="achievements"]').click();
  await page.locator("[data-filter]").selectOption("locked");
  await expect(page.locator(".progress-card")).toHaveCount(18);
  await page.locator('[data-tab="records"]').click();
  await page.locator("select[data-mode]").selectOption("gridiron");
  await expect(page.locator(".progress-content")).toContainText(
    "Interceptions",
  );
  await page.screenshot({ path: "/tmp/fusion-progression-portrait.png" });
  expect(errors).toEqual([]);
});
test("a completed Play match reports real events once, persists guest progress, and equips earned cosmetics", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.evaluate(() => __app.chooseMode("tdm"));
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.countdown = 0;
    for (const a of g.fighters.filter((a) => a.team !== g.player.team))
      g.fell(a, { killer: g.player });
    g.time = 180;
    g.finish(g.player.team, "Progression integration test");
    g.celebrationRemaining = 0;
  });
  await expect(page.locator("#match-report")).toBeVisible();
  await expect(page.locator("#match-report")).toContainText("Mastery XP");
  const before = await page.evaluate(
    () => __app.progressionStore().state.totals.matches,
  );
  expect(before).toBe(1);
  await page.evaluate(() => {
    __app.tick(__arena.game);
    __app.tick(__arena.game);
    __app.showResults(__arena.game);
  });
  expect(
    await page.evaluate(() => __app.progressionStore().state.totals.matches),
  ).toBe(1);
  await page.screenshot({ path: "/tmp/fusion-progression-results.png" });
  await page.locator("[data-records]").click();
  await expect(page.locator("select[data-mode]")).toBeVisible();
  await page.locator('[data-tab="cosmetics"]').click();
  await page.locator('[data-equip="achievement:flawless"]').click();
  await expect(page.locator("#shell-content .progress-profile")).toHaveClass(
    /has-frame/,
  );
  await page.reload();
  await page.waitForFunction(() =>
    ["home", "setup"].includes(window.__app?.screen),
  );
  await page.evaluate(() => __app.openProgress());
  await expect(page.locator("#shell-content .progress-profile")).toHaveClass(
    /has-frame/,
  );
  expect(
    await page.evaluate(() => __app.progressionStore().state.totals.matches),
  ).toBe(1);
  expect(errors).toEqual([]);
});
test("practice and abandoned matches do not award progress, results remain reachable in landscape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await ready(page, "landscape");
  await page.evaluate(() => __app.chooseMode("duel"));
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.finish(g.player.team, "Practice");
    g.celebrationRemaining = 0;
  });
  await expect(page.locator("#match-report")).toContainText("Practice match");
  expect(
    await page.evaluate(() => __app.progressionStore().state.totals.matches),
  ).toBe(0);
  await page.locator("[data-change]").click();
  await page.evaluate(() => __app.chooseMode("war"));
  await page.locator("#begin-btn").click();
  await page.evaluate(() => __app.battleExit());
  expect(
    await page.evaluate(() => __app.progressionStore().state.totals.matches),
  ).toBe(0);
});
test("account and report scrollers remain usable at narrow portrait and landscape sizes", async ({
  page,
}) => {
  await ready(page);
  for (const [width, height, orientation] of [
    [320, 568, "portrait"],
    [568, 320, "landscape"],
    [390, 844, "landscape"],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async (orientation) => {
      __app.settings.orientation = orientation;
      const { setOrientation } = await import("/src/orientation.js");
      setOrientation(orientation);
      await __app.openProgress("cosmetics");
    }, orientation);
    const last = page.locator("[data-equip]").last();
    await last.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(height);
    const bounds = await last.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(-1);
    expect(bounds.y).toBeGreaterThanOrEqual(-1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
  }
});
test("mastery milestone cosmetics have visible selectable effects, including the battle halo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await ready(page, "landscape");
  await page.evaluate(async () => {
    const store = __app.progressionStore();
    for (let i = 0; i < 23; i++)
      store.complete({
        id: crypto.randomUUID(),
        mode: "gauntlet",
        completed: true,
        practice: false,
        date: new Date(1763251200000 + i * 1000).toISOString(),
        result: "victory",
        duration: 300,
        startingForm: "ice",
        finalForm: "ice",
        forms: {
          ice: { seconds: 300, kills: 20, fusions: 3, bosses: 3, waves: 10 },
        },
        stats: {
          kills: 20,
          deaths: 0,
          damageDealt: 500,
          damageReceived: 100,
          healing: 20,
        },
        objectives: {
          fusions: 3,
          highestTier: 3,
          highestWave: 10,
          waves: 10,
          bosses: 3,
        },
      });
    await __app.openProgress("cosmetics");
  });
  for (const level of [5, 10, 15, 20])
    await page.locator(`[data-equip="mastery:ice:${level}"]`).click();
  await expect(page.locator("#shell-content .profile-badge")).toBeVisible();
  await expect(page.locator("#shell-content .progress-profile")).toHaveClass(
    /has-frame/,
  );
  await expect(page.locator("#shell-content .has-aura")).toBeVisible();
  await expect(page.locator("#shell-content .profile-orbit")).toBeVisible();
  await expect(page.locator("#shell-content .profile-title")).toHaveText(
    "Master of Ice",
  );
  await page
    .locator("#shell-content .progress-profile")
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/fusion-mastery-cosmetics.png" });
  await page.evaluate(() => __app.chooseMode("gridiron"));
  await page.locator("#begin-btn").click();
  expect(await page.evaluate(() => __arena.game.cosmeticAura)).toBe("gold");
  expect(await page.evaluate(() => __arena.game.player.maxHp)).toBe(120);
});
test("the Gridiron referee whistle remains audible with a full combat mixer", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-screen="play"]').click();
  const result = await page.evaluate(async () => {
    const { CombatSfx } = await import("/src/combat-sfx.js");
    const ctx = new AudioContext();
    await ctx.resume();
    const mixer = new CombatSfx(ctx, 0.6);
    let stopped = 0;
    for (let i = 0; i < 8; i++)
      mixer.voices.add({
        sfxKind: "impact",
        stop() {
          stopped++;
        },
      });
    const played = mixer.play("whistle");
    const result = {
      played,
      stopped,
      voices: mixer.voices.size,
      duration: mixer.buffers.get("whistle").duration,
    };
    mixer.stop();
    await mixer.ready;
    await ctx.close();
    return result;
  });
  expect(result.played).toBe(true);
  expect(result.stopped).toBe(1);
  expect(result.voices).toBe(8);
  expect(result.duration).toBeGreaterThan(0.4);
});
