import { test, expect } from "@playwright/test";
async function ready(page, options = {}) {
  await page.addInitScript((o) => {
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({
        orientation: o.orientation || "landscape",
        music: 0,
        sfx: 0.6,
      }),
    );
    if (o.fallback) document.startViewTransition = undefined;
  }, options);
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
test("HD menus retain labels and destinations, dissolve on navigation, and sound exactly once per button activation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator(".home-menu small")).toHaveCount(0);
  await expect(page.locator(".home-menu strong")).toHaveText([
    "Play",
    "Practice",
    "Leaderboard",
    "My Account",
    "Settings",
  ]);
  const size = await page.evaluate(async () => {
    const img = new Image();
    img.src = "menu/fusion-throwdown-hd.webp";
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  });
  expect(size.w).toBeGreaterThan(1280);
  expect(size.h).toBeGreaterThan(720);
  await page.evaluate(() => {
    window.menuClicks = 0;
    window.dissolves = 0;
    const click = __app.sound.menuClick.bind(__app.sound);
    __app.sound.menuClick = () => {
      menuClicks++;
      click();
    };
    const transition = document.startViewTransition.bind(document);
    document.startViewTransition = (update) => {
      dissolves++;
      return transition(update);
    };
  });
  await page.locator('[data-screen="settings"]').click();
  await expect(page.locator("#orientation-setting")).toBeVisible();
  expect(await page.evaluate(() => menuClicks)).toBe(1);
  expect(await page.evaluate(() => dissolves)).toBe(1);
  expect(await page.evaluate(() => !!__app.sound.menuSfx)).toBe(true);
  await page.locator("#shell-back").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".home-menu")).toBeVisible();
  expect(await page.evaluate(() => menuClicks)).toBe(2);
  await page.evaluate(() => __app.sound.volume("sfx", 0));
  expect(await page.evaluate(() => __app.sound.menuSfx.level)).toBe(0);
  await page.locator('[data-screen="play"]').click();
  await expect(page.locator("#quick-match")).toBeVisible();
  expect(await page.evaluate(() => __app.sound.menuSfx.voices.size)).toBe(0);
  await page.evaluate(() => {
    __app.show("settings");
    return __app.show("account");
  });
  await expect(page.locator("#shell-title")).toHaveText("MY ACCOUNT");
  await page.waitForTimeout(300);
  await expect(page.locator("#shell-title")).toHaveText("MY ACCOUNT");
  expect(errors).toEqual([]);
});
for (const variant of ["fallback", "reduced"])
  test(`${variant} navigation stays usable on portrait phones`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (variant === "reduced")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page, {
      orientation: "portrait",
      fallback: variant === "fallback",
    });
    await page.locator('[data-screen="practice"]').click();
    await expect(page.locator('[data-launch="duel"]')).toBeVisible();
    await page.locator('[data-launch="duel"]').click();
    await expect(page.locator("#setup-mode-title")).toHaveText("Duel");
    await page.locator("#begin-btn").click();
    await expect(page.locator("#leave-btn")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.getElementById("app").getAnimations().length,
      ),
    ).toBe(0);
  });
test("Selection recording plays unchanged, limits rapid clicks, and honors mute", async ({
  page,
}) => {
  await ready(page);
  await page.locator('[data-screen="settings"]').click();
  const result = await page.evaluate(async () => {
    const { SELECTION_URL } = await import("/src/menu-sfx.js");
    const sfx = __app.sound.menuSfx,
      context = __app.sound.context;
    const loaded = await sfx.ready;
    const expected = await context.decodeAudioData(
      await (await fetch(SELECTION_URL)).arrayBuffer(),
    );
    let error = 0;
    for (let c = 0; c < expected.numberOfChannels; c++) {
      const a = expected.getChannelData(c),
        b = sfx.buffer.getChannelData(c);
      for (let i = 0; i < a.length; i++)
        error = Math.max(error, Math.abs(a[i] - b[i]));
    }
    sfx.stop();
    for (let i = 0; i < 20; i++) sfx.play();
    const voices = sfx.voices.size;
    const unchanged = [...sfx.voices].every(
      (v) =>
        v.buffer === sfx.buffer &&
        v.playbackRate.value === 1 &&
        v.detune.value === 0,
    );
    const selectionGain = sfx.output.gain.value;
    __app.sound.volume("sfx", 0);
    return {
      loaded,
      selectionGain,
      error,
      unchanged,
      voices,
      muted: sfx.voices.size,
      duration: expected.duration,
      silent: sfx.play() === false,
    };
  });
  expect(result.loaded).toBe(true);
  expect(result.selectionGain).toBeCloseTo(0.6 * 0.35 * 0.8, 4);
  expect(result.error).toBe(0);
  expect(result.unchanged).toBe(true);
  expect(result.duration).toBeGreaterThan(2.8);
  expect(result.duration).toBeLessThan(3);
  expect(result.voices).toBe(4);
  expect(result.muted).toBe(0);
  expect(result.silent).toBe(true);
});
