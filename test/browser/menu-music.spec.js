import { test, expect } from "@playwright/test";
async function ready(page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0.4, sfx: 0, orientation: "landscape" }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.locator('[data-screen="play"]').click();
  await expect
    .poll(() => page.evaluate(() => !!__app.sound.menuSource))
    .toBe(true);
}
test("Solace loops at the audio-buffer boundary, with no added silent samples or playback restart", async ({
  page,
}) => {
  await ready(page);
  const rendered = await page.evaluate(async () => {
    const s = __app.sound,
      b = s.menuBuffer;
    const offline = new OfflineAudioContext(
      b.numberOfChannels,
      2048,
      b.sampleRate,
    );
    const source = offline.createBufferSource();
    source.buffer = b;
    source.loop = s.menuSource.loop;
    source.loopEnd = s.menuSource.loopEnd;
    source.connect(offline.destination);
    source.start(0, (b.length - 1024) / b.sampleRate);
    const output = await offline.startRendering();
    let error = 0;
    for (let channel = 0; channel < b.numberOfChannels; channel++) {
      const input = b.getChannelData(channel),
        actual = output.getChannelData(channel);
      for (let i = 0; i < 2048; i++)
        error = Math.max(
          error,
          Math.abs(actual[i] - input[(b.length - 1024 + i) % b.length]),
        );
    }
    s.stopMenu();
    s.menuOffset = b.duration - 0.15;
    s.sync();
    window.loopingSource = s.menuSource;
    return {
      duration: b.duration,
      loop: s.menuSource.loop,
      rate: s.menuSource.playbackRate.value,
      error,
      ambient: s.ambient.gain.value,
    };
  });
  expect(rendered.duration).toBeGreaterThan(117);
  expect(rendered.duration).toBeLessThan(118);
  expect(rendered.loop).toBe(true);
  expect(rendered.rate).toBe(1);
  expect(rendered.ambient).toBe(0);
  expect(rendered.error).toBeLessThan(0.0001);
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(() => __app.sound.menuSource === window.loopingSource),
  ).toBe(true);
  const position = await page.evaluate(() => __app.sound.menuPosition());
  expect(position).toBeGreaterThan(0);
  expect(position).toBeLessThan(2);
});
test("menu navigation preserves the song; music volume, hiding, and battle transitions control it independently", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.evaluate(
    () => (window.originalMenuSource = __app.sound.menuSource),
  );
  for (const screen of ["settings", "elements", "team-battles", "home"]) {
    await page.evaluate((screen) => __app.show(screen), screen);
    expect(
      await page.evaluate(
        () => __app.sound.menuSource === window.originalMenuSource,
      ),
    ).toBe(true);
  }
  await page.evaluate(() => __app.show("settings"));
  await page.locator("#music-volume").fill("65");
  await expect
    .poll(() => page.evaluate(() => __app.sound.music.gain.value))
    .toBeCloseTo(0.65, 2);
  expect(await page.evaluate(() => __app.settings.sfx)).toBe(0);
  await page.locator("#music-volume").fill("0");
  expect(await page.evaluate(() => __app.sound.menuSource)).toBeNull();
  const frozen = await page.evaluate(() => __app.sound.menuPosition());
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => __app.sound.menuPosition())).toBe(frozen);
  await page.locator("#music-volume").fill("40");
  await expect
    .poll(() => page.evaluate(() => __app.sound.menuPosition()))
    .toBeGreaterThan(frozen);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await page.evaluate(() => __app.sound.menuSource)).toBeNull();
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => !!__app.sound.menuSource))
    .toBe(true);
  for (const mode of ["duel", "corruption"]) {
    await page.evaluate((mode) => __app.chooseMode(mode), mode);
    expect(await page.evaluate(() => !!__app.sound.menuSource)).toBe(true);
    await page.locator("#begin-btn").click();
    expect(await page.evaluate(() => __app.sound.menuSource)).toBeNull();
    if (mode === "corruption")
      await expect
        .poll(() => page.evaluate(() => __app.sound.track.currentTime))
        .toBeGreaterThan(0.1);
    else
      expect(await page.evaluate(() => __app.sound.ambient.gain.value)).toBe(1);
    await page.locator("#leave-btn").click();
    await expect
      .poll(() => page.evaluate(() => !!__app.sound.menuSource))
      .toBe(true);
    if (mode === "corruption")
      expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  }
  expect(errors).toEqual([]);
});
