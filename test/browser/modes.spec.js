import { test, expect } from "@playwright/test";

test("CTF can be selected, shows flags and scores, drops on death and respawns without tokens", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="ctf"]').click();
  await expect(page.locator("#team-sizes")).toBeVisible();
  await page.locator('[data-size="3"]').click();
  await page.locator("#begin-btn").click();
  await expect(page.locator("#round-mode")).toContainText("CAPTURE THE FLAG");
  await expect(page.locator("#objective-score")).toHaveText(
    "0 – 0 FLAGS · FIRST TO 3",
  );
  const state = await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.player.x = g.flags[1].x;
    g.player.y = g.flags[1].y;
    g.updateFlags();
    const carried = g.flags[1].carrier;
    g.player.x = g.flags[0].home.x;
    g.player.y = g.flags[0].home.y;
    g.updateFlags();
    g.fell(g.player);
    return {
      count: g.fighters.length,
      carried,
      tokens: g.tokens.length,
      flags: g.flags.length,
    };
  });
  expect(state).toEqual({ count: 6, carried: "player", tokens: 0, flags: 2 });
  await expect(page.locator("#objective-score")).toContainText("1 – 0");
  await expect(page.locator("#health-label")).toHaveText("RESPAWN 10s");
  await expect(page.locator("#game-overlay")).toBeHidden();
  await page.evaluate(() => __arena.game.respawn(__arena.game.player));
  await expect(page.locator("#health-label")).toHaveText("120 / 120 HP");
});

test("deathmatch shows remaining time, kills, and an explicit timeout result", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="tdm"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.damage(g.player, g.fighters[1], 10000);
    g.time = 60;
  });
  await expect(page.locator("#timer")).toHaveText("02:00");
  await expect(page.locator("#objective-score")).toHaveText("1 – 0 KILLS");
  await page.evaluate(() => {
    const g = __arena.game;
    g.time = 180;
    g.checkMatchEnd();
  });
  await expect(page.locator("#game-overlay")).toBeVisible();
  await expect(page.locator("#overlay-text")).toContainText(
    "Time expired · 1 – 0",
  );
  await expect(page.locator("#overlay-title")).toHaveText(
    "The arena is yours.",
  );
});

test("eight-player free for all exposes enemy tokens and counts every rival", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="ffa"]').click();
  await expect(page.locator("#team-sizes")).toBeHidden();
  await page.locator("#ffa-count").selectOption("8");
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.update = () => {};
  });
  await expect(page.locator("#enemy-count")).toHaveText("07");
  await expect(page.locator("#objective-score")).toHaveText("8 STANDING");
  const state = await page.evaluate(() => {
    const g = __arena.game;
    g.fell(g.fighters[1]);
    return {
      teams: new Set(g.fighters.map((a) => a.team)).size,
      tokens: g.visibleTokens().length,
      finished: g.finished,
    };
  });
  expect(state).toEqual({ teams: 8, tokens: 1, finished: false });
  await expect(page.locator("#objective-score")).toHaveText("7 STANDING");
});

test("phone landscape keeps mode score and touch controls within the screen", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
  });
  await page.goto("/");
  await page.locator('[data-mode="ctf"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.update = () => {};
  });
  for (const selector of [
    "#objective-score",
    "#attack-btn",
    "#joystick",
    "#charge-btn",
  ]) {
    const target = page.locator(selector);
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
    expect(box.y + box.height).toBeLessThanOrEqual(845);
  }
  // In the iOS fallback, portrait coordinates are rotated by 90 degrees.
  const score = await page.locator("#objective-score").boundingBox();
  const tabs = await page.locator("#skill-switcher").boundingBox();
  expect(score.x).toBeGreaterThanOrEqual(tabs.x + tabs.width);
  await page.screenshot({ path: "/tmp/v09-mobile-ctf.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  const landscapeScore = await page.locator("#objective-score").boundingBox();
  const landscapeTabs = await page.locator("#skill-switcher").boundingBox();
  expect(landscapeScore.y + landscapeScore.height).toBeLessThanOrEqual(
    landscapeTabs.y,
  );
  await page.screenshot({ path: "/tmp/v09-landscape-ctf.png" });
  await context.close();
});
