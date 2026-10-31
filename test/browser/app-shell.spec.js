import { test, expect } from "@playwright/test";
const ready = async (page) => {
  await page.goto("/");
  await expect(page.locator('[data-screen="play"]')).toBeVisible();
};
async function fits(page, selector) {
  for (const e of await page.locator(selector).all()) {
    if (
      !(await e.isVisible()) ||
      (await e.evaluate((el) => !!el.closest(".mode-scroll,.element-library")))
    )
      continue;
    const r = await e.boundingBox(),
      v = page.viewportSize();
    expect(r.x, selector).toBeGreaterThanOrEqual(-1);
    expect(r.y, selector).toBeGreaterThanOrEqual(-1);
    expect(r.x + r.width, selector).toBeLessThanOrEqual(v.width + 1);
    expect(r.y + r.height, selector).toBeLessThanOrEqual(v.height + 1);
  }
}
test("app menus, account, settings and scrollable mode lists fit phones without page scrolling", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await ready(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    for (const screen of [
      "home",
      "play",
      "practice",
      "tutorial",
      "settings",
      "account",
      "leaderboard",
    ]) {
      await page.evaluate((s) => __app.show(s), screen);
      await fits(
        page,
        "#shell-content button,#shell-content input,#shell-content select,.shell-header button",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBe(viewport.height);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(viewport.width);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => __app.show("play"));
  const modes = [];
  for (const category of ["team-battles", "solo-battles"]) {
    await page.evaluate((s) => __app.show(s), category);
    modes.push(
      ...(await page
        .locator("[data-launch]")
        .evaluateAll((es) => es.map((e) => e.dataset.launch))),
    );
  }
  expect(modes).toEqual([
    "tdm",
    "war",
    "rush",
    "boss",
    "domination",
    "gauntlet-team",
    "ctf",
    "ffa",
    "roulette",
    "gauntlet",
    "corruption",
  ]);
  await context.close();
});
test("each Play mode has an accessible swipeable slideshow and Random opens a valid setup", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-screen="play"]').click();
  await page.locator('[data-screen="team-battles"]').click();
  await page.locator('[data-help="boss"]').click();
  await expect(page.locator("#slides-dialog")).toBeVisible();
  await expect(page.locator("#slide-count")).toHaveText("1 / 3");
  await page.locator("#slide-next").click();
  await expect(page.locator("#slide-title")).toHaveText("Break their support");
  await page
    .locator("#slide-card")
    .dispatchEvent("pointerdown", { clientX: 250, clientY: 250 });
  await page
    .locator("#slide-card")
    .dispatchEvent("pointerup", { clientX: 140, clientY: 250 });
  await expect(page.locator("#slide-count")).toHaveText("3 / 3");
  await page.locator("#slides-close").click();
  await page.locator("#shell-back").click();
  await page.locator("#quick-match").click();
  await expect(page.locator("#begin-btn")).toBeVisible();
  expect(
    await page.evaluate(() =>
      ["duel", "fused", "fused3", "team"].includes(__arena.game.mode),
    ),
  ).toBe(false);
});
test("Gauntlet reward selection advances waves and tier III starts the final boss", async ({
  page,
}) => {
  test.setTimeout(60000); // Two real seven-second selection windows plus initial asset loading.
  await page.goto("/?mode=gauntlet");
  await page.locator('[data-element="light"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.ai = () => {};
    for (const a of [...g.fighters])
      if (a.team === 1) g.fell(a, { killer: g.player });
    g.checkMatchEnd();
  });
  await expect(page.locator("#wave-reward")).toBeVisible();
  await expect(page.locator("#attack-btn")).toBeDisabled();
  await page.getByRole("button", { name: "Air shard", exact: false }).click();
  await expect(page.locator("#objective-score")).toHaveText("WAVE 2", {
    timeout: 8500,
  });
  await page.evaluate(() => {
    const g = __arena.game;
    for (const a of [...g.fighters])
      if (a.team === 1) g.fell(a, { killer: g.player });
    g.checkMatchEnd();
  });
  await page.getByRole("button", { name: "Earth shard", exact: false }).click();
  await expect(page.locator("#objective-score")).toHaveText("FINAL BOSS", {
    timeout: 8500,
  });
});
test("Roulette shows the five-second preview then changes form without healing", async ({
  page,
}) => {
  await page.goto("/?mode=roulette");
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.ai = () => {};
    g.countdown = 0; // This fixture jumps directly to the round’s 20-second preview.
    g.player.hp = 57;
    g.time = 19.99;
    g.update(0.02, { x: 0, y: 0 }, false);
    g.update = () => {};
  });
  await expect(page.locator("#objective-score")).toContainText("NEXT:");
  const next = await page.evaluate(() => __arena.game.nextForms.player);
  await page.evaluate(async () => {
    const g = __arena.game;
    const { updateAdvanced } = await import("/src/advanced-modes.js");
    g.time = 25;
    updateAdvanced(g);
  });
  await expect(page.locator("#hud-name")).toHaveText(next.toUpperCase());
  await expect(page.locator("#health-label")).toHaveText("57 / 120 HP");
});
test("portrait orientation stays upright, preserves touch movement and fits all fused controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(
    () => (HTMLElement.prototype.requestFullscreen = undefined),
  );
  await ready(page);
  await page.locator('[data-screen="settings"]').click();
  await page.locator("#orientation-setting").selectOption("portrait");
  await page.locator("#sfx-volume").fill("35");
  await page.locator("#music-volume").fill("10");
  await page.reload();
  await expect(page.locator('[data-screen="play"]')).toBeVisible();
  expect(await page.evaluate(() => __app.settings)).toEqual({
    sfx: 0.35,
    music: 0.1,
    orientation: "portrait",
    charging: "hold",
  });
  await page.evaluate(() => __app.chooseMode("fused3"));
  await page.locator('[data-element="demonic"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => (__arena.game.ai = () => {}));
  expect(
    await page
      .locator("#arena-panel")
      .evaluate((e) => getComputedStyle(e).transform),
  ).toBe("none");
  await fits(page, "#joystick,#attack-btn,.ability:not([hidden]),.form-button");
  const start = await page.evaluate(() => __arena.game.player.x);
  const r = await page.locator("#joystick").boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width - 5, r.y + r.height / 2);
  await page.waitForTimeout(250);
  await page.mouse.up();
  expect(await page.evaluate(() => __arena.game.player.x)).toBeGreaterThan(
    start,
  );
  await page.screenshot({ path: "/tmp/v12-portrait-controls.png" });
  await context.close();
});
test("configured logo video precedes Home and supports completion and autoplay fallback", async ({
  page,
}) => {
  await page.route("**/app-config.json", (route) =>
    route.fulfill({ json: { introVideo: "intro.mp4" } }),
  );
  await page.route("**/intro.mp4", (route) =>
    route.fulfill({ status: 200, contentType: "video/mp4", body: "" }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      configurable: true,
      set(value) {
        this.dataset.source = value;
      },
      get() {
        return this.dataset.source;
      },
    });
    HTMLMediaElement.prototype.play = function () {
      return Promise.reject(new Error("gesture required"));
    };
  });
  await page.goto("/");
  await expect(page.locator("#intro-screen")).toBeVisible();
  await expect(page.locator("#intro-play")).toBeVisible();
  await expect(page.locator('[data-screen="play"]')).toHaveCount(0);
  await page.locator("#logo-video").dispatchEvent("ended");
  await expect(page.locator('[data-screen="play"]')).toBeVisible();
  await expect(page.locator("#intro-screen")).toBeHidden();
});
test("guest and unconfigured account views never show invented stats or usable sign-in", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-screen="account"]').click();
  await expect(
    page.locator("#account-form button[type=submit]"),
  ).toBeDisabled();
  await expect(page.locator("#shell-content")).toContainText(
    "Accounts are not connected",
  );
  await page.locator("#account-to-signup").click();
  await expect(page.locator('[name="username"]')).toBeVisible();
  await page.locator("#account-to-reset").click();
  await expect(page.locator('[name="password"]')).toHaveCount(0);
  await page.locator("#shell-back").click();
  await page.locator('[data-screen="leaderboard"]').click();
  await expect(page.locator("#leader-message")).toContainText("not connected");
  await expect(page.locator("#leader-table tr")).toHaveCount(0);
  await page.evaluate(() => __app.chooseMode("duel"));
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.fell(g.fighters[1], { killer: g.player });
    g.checkMatchEnd();
  });
  await expect(page.locator("#save-status")).toHaveText(
    "Practice · no stats saved.",
  );
});
