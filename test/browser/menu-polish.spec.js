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
test("String click is high pitched, has a short reverberant tail, and limits overlapping voices", async ({
  page,
}) => {
  await ready(page);
  const rendered = await page.evaluate(async () => {
    const { MenuClickSfx, menuStringBuffer } = await import("/src/menu-sfx.js");
    const context = new OfflineAudioContext(2, 48000, 48000);
    const string = menuStringBuffer(context).getChannelData(0);
    // The dominant autocorrelation peak is a high-register string period.
    let best = -Infinity,
      lag = 0;
    for (let n = 20; n < 60; n++) {
      let score = 0;
      for (let i = 240; i < 2400; i++) score += string[i] * string[i + n];
      if (score > best) {
        best = score;
        lag = n;
      }
    }
    const sfx = new MenuClickSfx(context, 1);
    sfx.play();
    const audio = await context.startRendering(),
      data = audio.getChannelData(0);
    const rms = (start, end) =>
      Math.sqrt(
        data.slice(start * 48000, end * 48000).reduce((s, v) => s + v * v, 0) /
          ((end - start) * 48000),
      );
    const burst = new MenuClickSfx(new AudioContext(), 0.6);
    for (let i = 0; i < 20; i++) burst.play();
    const voices = burst.voices.size;
    burst.volume(0);
    return {
      pitch: 48000 / lag,
      attack: rms(0.005, 0.06),
      tail: rms(0.2, 0.3),
      late: rms(0.6, 0.9),
      peak: data.reduce((m, v) => Math.max(m, Math.abs(v)), 0),
      voices,
      muted: burst.voices.size,
    };
  });
  expect(rendered.pitch).toBeGreaterThan(1000);
  expect(rendered.pitch).toBeLessThan(2000);
  expect(rendered.attack).toBeGreaterThan(0.001);
  expect(rendered.tail).toBeGreaterThan(0.000001);
  expect(rendered.tail).toBeLessThan(rendered.attack);
  expect(rendered.late).toBe(0);
  expect(rendered.peak).toBeLessThan(0.3);
  expect(rendered.voices).toBeLessThanOrEqual(4);
  expect(rendered.muted).toBe(0);
});
