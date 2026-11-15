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
  expect(result.clips).toHaveLength(15);
  for (const clip of result.clips) {
    expect(clip.played).toBe(true);
    expect(clip.correct).toBe(true);
    expect(clip.duration).toBeGreaterThan(1);
    expect(clip.duration).toBeLessThan(clip.kind === "laser" ? 1.5 : 12);
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

test("deciding a winner stops active battle effects and drains pending sounds during celebration", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0.2, sfx: 0.6, orientation: "landscape" }),
    ),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.evaluate(() => __app.chooseMode("tdm"));
  await page.locator("#begin-btn").click();
  const result = await page.evaluate(async () => {
    const s = __app.sound;
    await s.sfx.ready;
    const g = __arena.game;
    g.ai = () => {};
    g.update = () => {};
    g.audioEvents = [];
    s.sfx.stop();
    s.sfx.play("gravity");
    const before = s.sfx.voices.size;
    g.emitSound("laser", g.player);
    g.finish(g.player.team, "Team wins");
    s.combat(g, true);
    const after = s.sfx.voices.size;
    g.emitSound("flash", g.player);
    s.combat(g, true);
    return {
      before,
      after,
      late: s.sfx.voices.size,
      queue: g.audioEvents.length,
    };
  });
  expect(result).toEqual({ before: 1, after: 0, late: 0, queue: 0 });
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackId))
    .toBe("a-win-is-a-win");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
});

test("Every Ice and Abyssal icicle starts Ice Spike, including sustained firing", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.locator('[data-screen="play"]').click();
  const results = await page.evaluate(async () => {
    const { Combat } = await import("/src/combat.js");
    const { RECORDED_SFX } = await import("/src/combat-sfx.js");
    const sound = __app.sound;
    await sound.sfx.ready;
    const expected = await sound.context.decodeAudioData(
      await (await fetch(RECORDED_SFX.icicle)).arrayBuffer(),
    );
    const results = [];
    for (const element of ["ice", "abyssal"]) {
      sound.sfx.stop();
      sound.sfx.last.clear();
      const g = new Combat({ element, mode: "duel", mapId: "classic" });
      g.startCharge(g.player);
      g.updateIcicles(g.player, 0.1);
      sound.combat(g, true);
      const voice = [...sound.sfx.voices].find((v) => v.sfxKind === "icicle");
      let accepted = 1;
      const play = sound.sfx.play.bind(sound.sfx);
      sound.sfx.play = (kind, options) => {
        const result = play(kind, options);
        if (kind === "icicle" && result) accepted++;
        return result;
      };
      for (let i = 0; i < 40; i++) {
        g.updateIcicles(g.player, 0.1);
        sound.combat(g, true);
      }
      sound.sfx.play = play;
      results.push({
        element,
        accepted,
        projectiles: g.projectiles.length,
        played: !!voice,
        buffer: voice?.buffer === sound.sfx.buffers.get("icicle"),
        duration: voice?.buffer.duration,
        expected: expected.duration,
        voices: sound.sfx.voices.size,
      });
      sound.combat(g, false);
      results.at(-1).stopped = sound.sfx.voices.size;
    }
    return results;
  });
  for (const result of results) {
    expect(result.played).toBe(true);
    expect(result.buffer).toBe(true);
    expect(result.duration).toBe(result.expected);
    expect(result.duration).toBeGreaterThan(1.6);
    expect(result.projectiles).toBe(41);
    expect(result.accepted).toBe(result.projectiles);
    expect(result.voices).toBeLessThanOrEqual(32);
    expect(result.stopped).toBe(0);
  }
});

test("Simultaneous icicle casters never silence each other or compete with the normal effect slots", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.locator('[data-screen="play"]').click();
  const result = await page.evaluate(async () => {
    const { Combat, makeFighter } = await import("/src/combat.js");
    const sound = __app.sound;
    await sound.sfx.ready;
    sound.sfx.stop();
    sound.sfx.last.clear();
    for (const kind of [
      "fireball",
      "flash",
      "rock",
      "heal",
      "gravity",
      "flood",
      "lightning",
      "token",
    ])
      sound.sfx.play(kind);
    const g = new Combat({ element: "ice", mode: "duel", mapId: "classic" });
    g.fighters = [
      g.player,
      makeFighter("ally", "abyssal", 0, g.player.x + 25, g.player.y),
      makeFighter("enemy", "ice", 1, g.player.x + 80, g.player.y),
    ];
    for (const a of g.fighters) g.startCharge(a);
    let accepted = 0;
    const play = sound.sfx.play.bind(sound.sfx);
    sound.sfx.play = (kind, options) => {
      const result = play(kind, options);
      if (kind === "icicle" && result) accepted++;
      return result;
    };
    for (let frame = 0; frame < 20; frame++) {
      for (const a of g.fighters) g.updateIcicles(a, 0.1);
      sound.combat(g, true);
    }
    sound.sfx.play = play;
    const result = {
      accepted,
      projectiles: g.projectiles.length,
      regular: [...sound.sfx.voices].filter((v) => v.sfxKind !== "icicle")
        .length,
      ice: [...sound.sfx.voices].filter((v) => v.sfxKind === "icicle").length,
    };
    g.finished = true;
    sound.combat(g, true);
    result.stopped = sound.sfx.voices.size;
    return result;
  });
  expect(result.projectiles).toBe(60);
  expect(result.accepted).toBe(60);
  expect(result.regular).toBe(8);
  expect(result.ice).toBeLessThanOrEqual(32);
  expect(result.stopped).toBe(0);
});
