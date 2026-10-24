import { test, expect } from "@playwright/test";
async function ready(page, orientation = "landscape", charging = "hold") {
  await page.addInitScript(
    ({ orientation, charging }) => {
      localStorage.setItem(
        "elemental-settings",
        JSON.stringify({ orientation, charging }),
      );
      HTMLElement.prototype.requestFullscreen = undefined;
    },
    { orientation, charging },
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
async function fight(page, mode, element) {
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator(`[data-element="${element}"]`).click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.ai = () => {};
    __arena.game.fighters
      .filter((a) => a !== __arena.game.player)
      .forEach((a) => {
        a.x = 820;
        a.y = 480;
      });
  });
}
async function fits(page, selector) {
  for (const el of await page.locator(selector).all()) {
    if (!(await el.isVisible())) continue;
    const r = await el.boundingBox(),
      v = page.viewportSize();
    expect(r.x, selector).toBeGreaterThanOrEqual(-1);
    expect(r.y, selector).toBeGreaterThanOrEqual(-1);
    expect(r.x + r.width, selector).toBeLessThanOrEqual(v.width + 1);
    expect(r.y + r.height, selector).toBeLessThanOrEqual(v.height + 1);
  }
}
test("both orientation preferences apply to every screen and screenshot guide in both phone positions", async ({
  browser,
}) => {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await c.newPage();
  await ready(page);
  for (const orientation of ["landscape", "portrait"]) {
    await page.evaluate(() => __app.show("settings"));
    await page.locator("#orientation-setting").selectOption(orientation);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 320, height: 568 },
      { width: 568, height: 320 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page
            .locator("#orientation-root")
            .evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight })),
        )
        .toEqual({
          w:
            orientation === "landscape"
              ? Math.max(viewport.width, viewport.height)
              : Math.min(viewport.width, viewport.height),
          h:
            orientation === "landscape"
              ? Math.min(viewport.width, viewport.height)
              : Math.max(viewport.width, viewport.height),
        });
      for (const screen of [
        "home",
        "play",
        "practice",
        "tutorial",
        "settings",
        "account",
        "leaderboard",
      ]) {
        await page.evaluate((screen) => __app.show(screen), screen);
        await fits(
          page,
          "#shell-content button,#shell-content input,#shell-content select,.shell-header button",
        );
      }
      await page.evaluate(() => __app.chooseMode("fused3"));
      await fits(page, "#begin-btn,.setup-app-heading button,#change-mode-btn");
      await page.locator("#setup-how").click();
      await expect
        .poll(() =>
          page
            .locator("#slide-screenshot")
            .evaluate((i) => i.complete && i.naturalWidth > 0),
        )
        .toBe(true);
      await fits(
        page,
        "#slides-dialog,#slide-screenshot,#slide-body,#slide-next,#slides-close",
      );
      await page.locator("#slides-close").click();
      await page.locator('[data-element="demonic"]').click();
      await page.locator("#begin-btn").click();
      await page.evaluate(() => (__arena.game.ai = () => {}));
      await fits(
        page,
        "#joystick,#attack-btn,.ability:not([hidden]),.form-button,#leave-btn",
      );
      const transform = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--app-rotation")
          .trim(),
      );
      const r = await page.locator("#joystick").boundingBox();
      const x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      const before = await page.evaluate(() => __arena.game.player.x);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(
        transform === "0deg" ? x + 30 : x,
        transform === "90deg" ? y + 30 : transform === "-90deg" ? y - 30 : y,
      );
      await page.waitForTimeout(120);
      await page.mouse.up();
      expect(await page.evaluate(() => __arena.game.player.x)).toBeGreaterThan(
        before,
      );
      await page.locator("#leave-btn").click();
    }
  }
  expect(
    await page.locator("meta[name=viewport]").getAttribute("content"),
  ).toContain("user-scalable=no");
  await c.close();
});
test("tap charging persists through release and casts on the next tap; shield and instant skills keep their behavior", async ({
  page,
}) => {
  await ready(page, "landscape", "tap");
  await fight(page, "duel", "water");
  await page.locator("#charge-btn").click();
  expect(await page.evaluate(() => __arena.game.player.charging)).toBe(true);
  await expect(page.locator("#ability-status")).toHaveText("Tap to release");
  await page.waitForTimeout(200);
  await page.locator("#charge-btn").click();
  expect(await page.evaluate(() => __arena.game.player.charging)).toBe(false);
  expect(
    await page.evaluate(() => __arena.game.player.abilityCd),
  ).toBeGreaterThan(0);
  await page.locator("#leave-btn").click();
  await fight(page, "fused", "mirror");
  await page.evaluate(() => (__arena.game.player.hp = 40));
  await page.locator("#extra-skill-1").click();
  expect(await page.evaluate(() => __arena.game.player.charging)).toBe(true);
  await page.locator("#extra-skill-1").click();
  expect(await page.evaluate(() => __arena.game.player.hp)).toBeGreaterThan(40);
  await page.locator("#extra-skill-0").hover();
  await page.mouse.down();
  expect(await page.evaluate(() => __arena.game.player.shield)).toBe(1);
  await page.mouse.up();
  expect(await page.evaluate(() => __arena.game.player.shield)).toBe(0);
  await page.locator("#leave-btn").click();
  await fight(page, "fused3", "lightning");
  await page.evaluate(() =>
    Object.assign(__arena.game.fighters[1], {
      x: __arena.game.player.x + 90,
      y: __arena.game.player.y,
    }),
  );
  await page.locator("#charge-btn").click();
  expect(await page.evaluate(() => __arena.game.player.charging)).toBe(false);
  expect(
    await page.evaluate(() => __arena.game.player.abilityCd),
  ).toBeGreaterThan(0);
  await expect(page.locator("#utility-name")).toHaveText("Tailwind");
});
test("winners pose for four real seconds before results and Leave immediately returns Home", async ({
  page,
}) => {
  await ready(page);
  await fight(page, "team", "light");
  await page.evaluate(() => {
    const g = __arena.game;
    g.finish(g.player.team, "Victory timing");
  });
  await expect(page.locator("#leave-btn")).toHaveText("Leave →");
  await expect(page.locator("#leave-btn")).toHaveClass(/match-leave/);
  await expect(page.locator("#game-overlay")).toBeHidden();
  await page.waitForTimeout(3100);
  await expect(page.locator("#game-overlay")).toBeHidden();
  await expect(page.locator("#game-overlay")).toBeVisible({ timeout: 1800 });
  await expect(page.locator("#overlay-text")).toContainText("Victory timing");
  await page.locator("#leave-btn").click();
  expect(await page.evaluate(() => __app.screen)).toBe("home");
});
test("all twenty victory poses are populated and distinct, and every guide loads a real screenshot", async ({
  page,
}) => {
  await ready(page);
  const art = await page.evaluate(async () => {
    const { charactersReady, drawCharacter, CHARACTERS } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    return CHARACTERS.map((element) => {
      const c = document.createElement("canvas");
      c.width = c.height = 120;
      const ctx = c.getContext("2d");
      ctx.translate(60, 100);
      const a = makeFighter("player", element, 0, 0, 0);
      a.victory = true;
      drawCharacter(ctx, a, 0);
      return {
        data: c.toDataURL(),
        pixels: ctx
          .getImageData(0, 0, 120, 120)
          .data.filter((v, i) => i % 4 === 3 && v > 0).length,
      };
    });
  });
  expect(art).toHaveLength(20);
  expect(new Set(art.map((a) => a.data)).size).toBe(20);
  expect(art.every((a) => a.pixels > 300)).toBe(true);
  const guides = await page.evaluate(async () =>
    Object.keys((await import("/src/mode-catalog.js")).MODES),
  );
  for (const mode of guides) {
    await page.evaluate((mode) => __app.modeGuide(mode), mode);
    await expect
      .poll(() =>
        page
          .locator("#slide-screenshot")
          .evaluate((i) => i.complete && i.naturalWidth > 0),
      )
      .toBe(true);
    await page.locator("#slides-close").click();
  }
  for (const element of [
    "water",
    "dark",
    "fire",
    "air",
    "earth",
    "light",
    "mud",
    "spirit",
    "mirror",
    "sun",
    "blaze",
    "cloud",
    "smoke",
    "gravity",
    "apparition",
    "demonic",
    "divine",
    "multi-dimensional",
    "lightning",
    "invincible",
  ]) {
    await page.evaluate((e) => __app.elementSlides(e), element);
    await expect
      .poll(() =>
        page
          .locator("#slide-screenshot")
          .evaluate((i) => i.complete && i.naturalWidth > 0),
      )
      .toBe(true);
    await page.locator("#slides-close").click();
  }
});
