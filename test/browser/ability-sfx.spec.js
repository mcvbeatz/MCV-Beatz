import { test, expect } from "@playwright/test";
test("all uploaded effects decode and play through the SFX mixer", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("body").click();
  const result = await page.evaluate(async () => {
    const { CombatSfx, RECORDED_SFX } = await import("/src/combat-sfx.js");
    const ctx = new AudioContext();
    await ctx.resume();
    const s = new CombatSfx(ctx, 0.6);
    const ready = await s.ready;
    const clips = Object.keys(RECORDED_SFX).map((kind) => {
      const buffer = s.buffers.get(kind);
      s.stop();
      const played = s.play(kind);
      const voice = [...s.voices].at(-1);
      return {
        kind,
        duration: buffer.duration,
        played,
        correct: voice.buffer === buffer,
      };
    });
    const duplicate = s.play(clips.at(-1).kind);
    const count = s.voices.size;
    s.volume(0);
    const mutedAt = ctx.currentTime;
    while (ctx.currentTime - mutedAt < 0.25)
      await new Promise((r) => setTimeout(r, 25));
    const muted = s.gain.gain.value;
    s.stop();
    const loadErrors = s.loadErrors;
    await ctx.close();
    return { ready, clips, duplicate, count, muted, loadErrors };
  });
  expect(result.ready).toBe(true);
  expect(result.loadErrors).toEqual([]);
  expect(result.clips).toHaveLength(14);
  for (const clip of result.clips) {
    expect(clip.played).toBe(true);
    expect(clip.correct).toBe(true);
    expect(clip.duration).toBeGreaterThan(1);
    expect(clip.duration).toBeLessThan(12);
  }
  expect(result.duplicate).toBe(false);
  expect(result.count).toBe(1);
  expect(result.muted).toBeLessThan(0.001);
  expect(errors).toEqual([]);
});
test("live ability events reach the recorded mixer and pause clears playing effects", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0, sfx: 0.6, orientation: "landscape" }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.evaluate(() => __app.chooseMode("tdm"));
  await page.locator('[data-element="fire"]').click();
  await page.locator("#begin-btn").click();
  const result = await page.evaluate(async () => {
    const s = __app.sound;
    await s.sfx.ready;
    const g = __arena.game;
    g.countdown = 0;
    g.ai = () => {};
    g.update = () => {};
    s.sfx.stop();
    g.audioEvents = [];
    g.cast(g.player, 1);
    s.combat(g, true);
    const played = [...s.sfx.voices].map((v) => ({
      kind: v.sfxKind,
      duration: v.buffer.duration,
    }));
    s.combat(g, false);
    return { played, stopped: s.sfx.voices.size };
  });
  expect(result.played).toEqual([
    { kind: "fireball", duration: expect.any(Number) },
  ]);
  expect(result.played[0].duration).toBeGreaterThan(2);
  expect(result.stopped).toBe(0);
});
