import { test, expect } from "@playwright/test";
async function ready(page, orientation = "portrait") {
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation, music: 0, sfx: 0.6 }),
    );
  }, orientation);
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
async function finish(page, mode) {
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.countdown = 0;
    g.time = 120;
    if (g.mode === "ffa")
      g.fell(
        g.fighters.find((a) => a !== g.player),
        { killer: g.player },
      );
    g.finish(g.player.team, "Session scoreboard test");
    g.celebrationRemaining = 0;
  });
  await expect(page.locator("#match-report")).toHaveAttribute(
    "data-stage",
    "0",
  );
}
test("all modes show only their specified columns and every participant, with no mastery clutter on page one", async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const modes = await page.evaluate(async () =>
    Object.keys((await import("/src/session-results.js")).SESSION_COLUMNS),
  );
  for (const mode of modes) {
    await finish(page, mode);
    const expected = await page.evaluate(async () => ({
      columns: (await import("/src/session-results.js")).SESSION_COLUMNS[
        __arena.game.mode
      ].map((c) => c[1]),
      players: __arena.game.progressReport.match.players.length,
    }));
    await expect(page.locator(".session-scoreboard thead th")).toHaveText([
      "Player",
      ...expected.columns,
    ]);
    await expect(page.locator(".session-scoreboard tbody tr")).toHaveCount(
      expected.players,
    );
    await expect(page.locator(".report-mastery")).toHaveCount(0);
    await expect(page.locator(".results-trophy")).toHaveCount(0);
    if (mode === "dungeon") {
      await expect(page.locator(".session-scoreboard tbody")).toContainText(
        "0 / 15",
      );
      await expect(page.locator(".session-scoreboard tbody")).toContainText(
        "0 / 3",
      );
    }
  }
});
test("Next plays Selection once, mastery animates from empty with artwork, and trophy page preserves rewards without replaying writes", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await finish(page, "ffa");
  await page.evaluate(() => {
    window.selectionCalls = 0;
    const click = __app.sound.menuClick.bind(__app.sound);
    __app.sound.menuClick = () => {
      selectionCalls++;
      click();
    };
  });
  const initial = await page.evaluate(
    () => __app.progressionStore().state.totals.matches,
  );
  await page.screenshot({ path: "/tmp/session-scoreboard-portrait.png" });
  await page.locator("[data-next]").click();
  await expect(page.locator("#match-report")).toHaveAttribute(
    "data-stage",
    "1",
  );
  await expect(page.locator(".xp-result .character-portrait")).toHaveCount(1);
  const early = await page
    .locator("[data-xp-target]")
    .evaluate((e) => ({ value: e.value, target: Number(e.dataset.xpTarget) }));
  expect(early.value).toBeLessThan(early.target);
  await expect
    .poll(() => page.locator("[data-xp-target]").evaluate((e) => e.value))
    .toBe(early.target);
  expect(await page.evaluate(() => selectionCalls)).toBe(1);
  await page.screenshot({ path: "/tmp/session-mastery-portrait.png" });
  await page.locator("[data-next]").click();
  await expect(page.locator(".results-trophy")).toBeVisible();
  await expect(page.locator(".report-honors")).toContainText("personal bests");
  await expect(page.locator(".new-best").first()).toContainText(
    "NEW PERSONAL BEST",
  );
  expect(await page.evaluate(() => selectionCalls)).toBe(2);
  await expect(page.locator("#overlay-play")).toBeVisible();
  await page.screenshot({ path: "/tmp/session-trophy-portrait.png" });
  await page.evaluate(() => {
    __app.tick(__arena.game);
    __app.showResults(__arena.game);
  });
  expect(
    await page.evaluate(() => __app.progressionStore().state.totals.matches),
  ).toBe(initial);
  await page.locator("[data-records]").click();
  await expect(page.locator("#self-stats-panel")).toBeVisible();
  await expect(page.locator("#self-stats-panel")).toContainText(
    "Damage received",
  );
  expect(errors).toEqual([]);
});
test("My Account lists Stats second in full-width vertical navigation, and self stats work without a backend", async ({
  page,
}) => {
  await page.route("**/app-config.json", (r) =>
    r.fulfill({
      json: { supabaseUrl: "", supabasePublishableKey: "", introVideo: "" },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.evaluate(() => __app.openProgress());
  await expect(page.locator(".progress-tabs button")).toHaveText([
    "Overview",
    "Stats",
    "Elemental Mastery",
    "Achievements",
    "Cosmetics",
  ]);
  const boxes = await page.locator(".progress-tabs button").evaluateAll((es) =>
    es.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].h);
    expect(boxes[i].x).toBe(boxes[0].x);
    expect(boxes[i].w).toBe(boxes[0].w);
  }
  await page.evaluate(() => __app.show("leaderboard"));
  await page.locator("#self-stats-btn").click();
  await expect(page.locator("#self-stats-panel")).toBeVisible();
  await page.locator("select[data-mode]").selectOption("zombies");
  await expect(page.locator("#self-stats-panel")).toContainText(
    "Fire enemies defeated",
  );
});
test("three result pages scroll on small portrait, landscape and rotated screens", async ({
  page,
}) => {
  await ready(page);
  for (const [width, height, orientation] of [
    [320, 568, "portrait"],
    [568, 320, "landscape"],
    [390, 844, "landscape"],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async (o) => {
      __app.settings.orientation = o;
      (await import("/src/orientation.js")).setOrientation(o);
    }, orientation);
    await finish(page, "gridiron");
    for (let stage = 0; stage < 3; stage++) {
      const button = page.locator(
        stage === 2 ? "#overlay-play" : "[data-next]",
      );
      await button.scrollIntoViewIfNeeded();
      const r = await button.boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(-1);
      expect(r.y).toBeGreaterThanOrEqual(-1);
      expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
      expect(r.y + r.height).toBeLessThanOrEqual(height + 1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      if (stage < 2) await button.click();
    }
  }
});
for (const mode of ["duel", "fused", "fused3", "team"])
  test(`${mode} finishes without a stats or results screen`, async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate((mode) => __app.chooseMode(mode), mode);
    await page.locator("#begin-btn").click();
    await page.evaluate(() => {
      const g = __arena.game;
      g.finish(g.player.team, "Practice complete");
      g.celebrationRemaining = 0;
    });
    await page.waitForFunction(() => __app.screen === "setup");
    await expect(page.locator("#match-report")).toHaveCount(0);
    expect(
      await page.evaluate(() => __app.progressionStore().state.totals.matches),
    ).toBe(0);
  });
