import { test, expect } from "@playwright/test";
test("Corruption locks selection to Light, supports eight fighters, hides Dark skills and reports both winners", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="corruption"]').click();
  await expect(page.locator("[data-element]")).toHaveCount(1);
  await expect(page.locator("#friendly-fire-state")).toHaveText("OFF");
  await page.locator("#ffa-count").selectOption("8");
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.time = 5;
    g.corruptionStarted = true;
    g.corrupt(g.player);
  });
  await expect(page.locator("#hud-name")).toHaveText("DARK");
  await expect(page.locator("#charge-btn")).toBeHidden();
  await expect(page.locator("#utility-btn")).toBeHidden();
  await expect(page.locator("#passive-note")).toContainText("Strike a Light");
  await expect(page.locator("#objective-score")).toContainText("7 LIGHT");
  await expect(page.locator("#health-label")).toHaveText("7 / 7 HITS");
  await page.evaluate(() => {
    const g = __arena.game;
    g.meleeDamage(g.fighters[1], g.player, 14);
    g.meleeDamage(g.fighters[1], g.player, 14);
    g.corrupt(g.fighters[1], g.player);
  });
  await expect(page.locator("#health-label")).toHaveText("5 / 6 HITS");
  await expect(page.locator("#objective-score")).toContainText("6 LIGHT");
  await page.evaluate(() => {
    const g = __arena.game;
    g.time = 120;
    g.checkMatchEnd();
  });
  await expect(page.locator("#overlay-text")).toContainText("Light survival:");
  await expect(page.locator("#overlay-text")).toContainText("Dark infections:");
});
test("Boss setup permits either role and seven challengers with scaled HP", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="boss"]').click();
  await expect(page.locator('[data-element="invincible"]')).toBeVisible();
  await page.locator("#boss-role").selectOption("challenger");
  await expect(page.locator("[data-element]")).toHaveCount(6);
  await page.locator("#boss-role").selectOption("boss");
  await page.locator("#boss-count").selectOption("7");
  await page.locator("#begin-btn").click();
  await page.evaluate(() => (__arena.game.update = () => {}));
  await expect(page.locator("#health-label")).toHaveText("840 / 840 HP");
  await expect(page.locator("#objective-score")).toHaveText(
    "BOSS 840 HP · 7 CHALLENGERS",
  );
  await expect(page.locator("#round-mode")).toContainText("BOSS");
});
test("Domination exposes team sizes, capture progress and flag-control scoring", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="domination"]').click();
  await expect(page.locator("#team-sizes")).toBeVisible();
  await expect(page.locator("#friendly-fire-state")).toHaveText("OFF");
  await page.locator('[data-size="4"]').click();
  await page.locator("#begin-btn").click();
  const state = await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.scores = [0, 0];
    const f = g.flags[2];
    g.player.x = f.x;
    g.player.y = f.y;
    g.updateDomination(5);
    return {
      flags: g.flags.length,
      progress: f.progress,
      count: g.fighters.length,
    };
  });
  expect(state).toEqual({ flags: 4, progress: 5, count: 8 });
  await expect(page.locator("#objective-score")).toHaveText(
    "10 – 10 FLAG-SECONDS",
  );
  await page.evaluate(() => {
    const g = __arena.game;
    g.time = 180;
    g.scores = [300, 200];
    g.checkMatchEnd();
  });
  await expect(page.locator("#overlay-text")).toContainText(
    "Flag-control time decided the match · 300 – 200",
  );
});
test("Lightning HUD counts down a three-second recharge", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-mode="fused3"]').click();
  await page.locator('[data-element="lightning"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    Object.assign(g.fighters[1], { x: g.player.x + 100, y: g.player.y });
    g.fighters[1].parts = ["water"];
    g.startCharge(g.player);
  });
  await expect(page.locator("#ability-status")).toHaveText("3.0s");
});

for (const mode of ["corruption", "boss", "domination"]) {
  test(`${mode} scores and controls fit a phone in portrait fallback and landscape`, async ({
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
    await page.locator(`[data-mode="${mode}"]`).click();
    await page.locator("#begin-btn").click();
    await page.evaluate(() => {
      __arena.game.update = () => {};
    });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      for (const selector of [
        "#objective-score",
        "#attack-btn",
        "#joystick",
        "#skill-switcher",
      ]) {
        const target = page.locator(selector);
        await expect(target).toBeVisible();
        const box = await target.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.y).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }
    }
    await page.screenshot({ path: `/tmp/v10-${mode}-phone.png` });
    await context.close();
  });
}
