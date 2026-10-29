import { test, expect } from "@playwright/test";
async function ready(page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0.25, sfx: 0, orientation: "landscape" }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
async function begin(page, mode) {
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.countdown = 0;
    __arena.game.ai = () => {};
    __arena.game.update = () => {};
  });
}
test("No Escape plays once at reduced tempo only for Corruption, uses music gain, and pauses with the battle and app visibility", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  expect(await page.evaluate(() => __app.sound.track)).toBeNull();
  await begin(page, "corruption");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track?.currentTime || 0))
    .toBeGreaterThan(0.2);
  const state = await page.evaluate(() => ({
    src: __app.sound.track.src,
    duration: __app.sound.track.duration,
    loop: __app.sound.track.loop,
    rate: __app.sound.track.playbackRate,
    pitch: __app.sound.track.preservesPitch,
    ambient: __app.sound.ambient.gain.value,
    gain: __app.sound.music.gain.value,
    sfx: __app.settings.sfx,
  }));
  expect(state.src).toContain("no-escape");
  expect(state.duration).toBeGreaterThan(116);
  expect(state.duration).toBeLessThan(118);
  expect(state.loop).toBe(false);
  expect(state.duration / state.rate).toBeCloseTo(120, 4);
  expect(state.rate).toBeCloseTo(0.9754, 3);
  expect(state.pitch).toBe(true);
  expect(state.ambient).toBe(0);
  expect(state.gain).toBe(0.25);
  expect(state.sfx).toBe(0);
  await page.locator("#pause-btn").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(true);
  const paused = await page.evaluate(() => __app.sound.track.currentTime);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => __app.sound.track.currentTime)).toBe(paused);
  await page.locator("#overlay-play").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeGreaterThan(paused + 0.1);
  await page.evaluate(() => __app.sound.volume("music", 0));
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(true);
  await page.evaluate(() => __app.sound.volume("music", 0.6));
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => __app.sound.music.gain.value))
    .toBeCloseTo(0.6, 2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // Returning to the app preserves the game's automatic pause until Resume.
  await expect(page.locator("#overlay-title")).toHaveText("Battle paused.");
  expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  await page.locator("#overlay-play").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
  await page.locator("#leave-btn").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(true);
  expect(await page.evaluate(() => __app.sound.ambient.gain.value)).toBe(1);
  await page.locator("#resume-btn").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
  await page.evaluate(() => __arena.game.finish(0, "Test end"));
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(true);
  expect(errors).toEqual([]);
});
test("new Corruption battles restart the song, other modes keep ambient music, and the Settings slider controls the track", async ({
  page,
}) => {
  await ready(page);
  await begin(page, "corruption");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track?.readyState || 0))
    .toBeGreaterThan(1);
  await page.evaluate(() => {
    __app.sound.track.currentTime = 45;
  });
  await page.locator("#leave-btn").click();
  await page.evaluate(() => __app.show("settings"));
  await page.locator("#music-volume").fill("35");
  expect(await page.evaluate(() => __app.settings.music)).toBe(0.35);
  await begin(page, "corruption");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
  expect(await page.evaluate(() => __app.sound.track.currentTime)).toBeLessThan(
    5,
  );
  await page.locator("#leave-btn").click();
  await begin(page, "duel");
  expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  expect(await page.evaluate(() => __app.sound.ambient.gain.value)).toBe(1);
});

test("Corruption music waits for Go and never restarts after its natural end", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => __app.chooseMode("corruption"));
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.ai = () => {};
    __arena.game.update = () => {};
    __arena.game.countdown = 3;
  });
  await expect
    .poll(() =>
      page.evaluate(() => __app.sound.primed && !__app.sound.playPending),
    )
    .toBe(true);
  expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  expect(await page.evaluate(() => __app.sound.track.currentTime)).toBe(0);
  await page.evaluate(() => {
    __arena.game.countdown = 1;
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeGreaterThan(0.1);
  await page.evaluate(() => {
    const t = __app.sound.track;
    t.currentTime = t.duration - 0.15;
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackEnded))
    .toBe(true);
  await page.locator("#attack-btn").click(); // A gesture must not replay a completed track.
  expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  expect(
    await page.evaluate(() => __app.sound.track.currentTime),
  ).toBeGreaterThan(116);
  await page.locator("#leave-btn").click();
  await begin(page, "corruption");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
  expect(await page.evaluate(() => __app.sound.track.currentTime)).toBeLessThan(
    5,
  );
});
