import { test, expect } from "@playwright/test";
import { PLAY_MODES } from "../../src/mode-catalog.js";
const pool = ["watch-and-learn", "kennebeccebennek", "none-other", "sick"];
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
async function start(page, mode = "duel") {
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.update = () => {};
    __arena.game.ai = () => {};
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.track?.currentTime || 0))
    .toBeGreaterThan(0.05);
}
test("new battles shuffle all four songs, resuming preserves selection, and natural ending advances", async ({
  page,
}) => {
  await ready(page);
  const selected = [];
  for (let i = 0; i < 4; i++) {
    await start(page, i % 2 ? "tdm" : "duel");
    const state = await page.evaluate(() => ({
      id: __app.sound.trackId,
      rate: __app.sound.track.playbackRate,
      menu: !!__app.sound.menuSource,
    }));
    selected.push(state.id);
    expect(state.rate).toBe(1);
    expect(state.menu).toBe(false);
    await page.locator("#leave-btn").click();
    await page.locator("#resume-btn").click();
    expect(await page.evaluate(() => __app.sound.trackId)).toBe(state.id);
    if (i < 3) await page.locator("#leave-btn").click();
  }
  expect([...new Set(selected)].sort()).toEqual([...pool].sort());
  const old = await page.evaluate(() => __app.sound.trackId);
  await page.evaluate(() => {
    const t = __app.sound.track;
    t.currentTime = t.duration - 0.15;
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackId))
    .not.toBe(old);
  expect(pool).toContain(await page.evaluate(() => __app.sound.trackId));
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
});
test("Ember Caldera plays only no smoke, and team victory replaces it even if the player is felled", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => __app.chooseMode("war"));
  await page.locator('[data-element="water"]').click();
  await page.evaluate(() => (Math.random = () => 0.999));
  await expect
    .poll(() => page.evaluate(() => __app.sound.warMapPreload?.readyState || 0))
    .toBeGreaterThan(1);
  expect(await page.evaluate(() => __app.sound.warMapPreload.paused)).toBe(
    true,
  );
  await page.locator("#begin-btn").click();
  await expect(page.locator("#battle-countdown")).toHaveText("3");
  await page.evaluate(() => {
    __arena.game.update = () => {};
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackId))
    .toBe("no-smoke");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeGreaterThan(0.1);
  expect(await page.evaluate(() => __app.sound.track.loop)).toBe(true);
  await page.evaluate(() => {
    const t = __app.sound.track;
    t.currentTime = t.duration - 0.12;
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeLessThan(3);
  expect(await page.evaluate(() => __app.sound.trackId)).toBe("no-smoke");
  await page.evaluate(() => {
    window.authorizedTrack = __app.sound.track;
    const g = __arena.game;
    g.fell(g.player);
    g.finish(g.player.team, "Team wins");
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackId))
    .toBe("a-win-is-a-win");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeGreaterThan(0.1);
  expect(
    await page.evaluate(() => __app.sound.track === window.authorizedTrack),
  ).toBe(true);
  expect(await page.evaluate(() => __app.sound.track.loop)).toBe(false);
  await page.evaluate(() => {
    const t = __app.sound.track;
    t.currentTime = t.duration - 0.12;
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackEnded))
    .toBe(true);
  await page.mouse.click(10, 10);
  expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  await page.locator("#leave-btn").click();
  await expect
    .poll(() => page.evaluate(() => !!__app.sound.menuSource))
    .toBe(true);
});
test("team defeat plays Downcast once, respects volume and visibility, and draws play neither outcome", async ({
  page,
}) => {
  await ready(page);
  await start(page, "tdm");
  await page.evaluate(() => __arena.game.finish(1, "Team loses"));
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackId))
    .toBe("downcast");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeGreaterThan(0.1);
  expect(await page.evaluate(() => __app.sound.track.loop)).toBe(false);
  await page.evaluate(() => __app.sound.volume("music", 0));
  expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  await page.evaluate(() => __app.sound.volume("music", 0.6));
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
  await page.locator("#leave-btn").click();
  await start(page, "duel");
  await page.evaluate(() => __arena.game.finish(null, "Tie"));
  await expect.poll(() => page.evaluate(() => __app.sound.scene)).toBe("draw");
  expect(await page.evaluate(() => __app.sound.track.paused)).toBe(true);
  expect(pool).toContain(await page.evaluate(() => __app.sound.trackId));
});

for (const mode of PLAY_MODES) {
  test(`${mode} preloads its song and starts it on the opening 3`, async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate((mode) => __app.chooseMode(mode), mode);
    if (mode === "war") await page.locator('[data-element="dark"]').click();
    await expect
      .poll(() => page.evaluate(() => __app.sound.track?.readyState || 0))
      .toBeGreaterThan(1);
    const prepared = await page.evaluate(() => ({
      id: __app.sound.trackId,
      paused: __app.sound.track.paused,
      time: __app.sound.track.currentTime,
    }));
    expect(prepared.paused).toBe(true);
    expect(prepared.time).toBe(0);
    await page.locator("#begin-btn").click();
    await expect(page.locator("#battle-countdown")).toHaveText("3");
    await expect
      .poll(() => page.evaluate(() => __app.sound.track.currentTime))
      .toBeGreaterThan(0.1);
    const opening = await page.evaluate(() => ({
      id: __app.sound.trackId,
      rate: __app.sound.track.playbackRate,
      countdown: __arena.game.countdownLabel,
      time: __arena.game.time,
      song: __app.sound.track.currentTime,
      duration: __app.sound.track.duration,
    }));
    expect(opening.id).toBe(prepared.id);
    expect(opening.countdown).toBe("3");
    expect(opening.time).toBe(0);
    expect(opening.rate).toBe(1);
    if (mode === "war") {
      expect(opening.id).toBe("dont-let-up");
      expect(opening.duration).toBeCloseTo(183.192, 2);
    }
    // Crossing Go must continue the same recording, not restart it.
    await page.evaluate(() => {
      __arena.game.countdown = 0.5;
      __arena.game.update = () => {};
    });
    await expect
      .poll(() => page.evaluate(() => __app.sound.track.currentTime))
      .toBeGreaterThan(opening.song + 0.1);
    expect(await page.evaluate(() => __app.sound.trackId)).toBe(opening.id);
  });
}

test("War pauses, resumes and restarts Don't Let Up, then uses the team outcome song", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => __app.chooseMode("war"));
  await page.locator('[data-element="dark"]').click();
  await page.locator("#begin-btn").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeGreaterThan(0.1);
  await page.locator("#pause-btn").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(true);
  await page.evaluate(() => {
    __app.sound.track.currentTime = 40;
  });
  await page.locator("#overlay-play").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeGreaterThan(40);
  await page.locator("#leave-btn").click();
  await page.locator("#begin-btn").click();
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.currentTime))
    .toBeGreaterThan(0.1);
  expect(await page.evaluate(() => __app.sound.track.currentTime)).toBeLessThan(
    2,
  );
  expect(await page.evaluate(() => __app.sound.trackId)).toBe("dont-let-up");
  expect(await page.evaluate(() => __app.sound.track.loop)).toBe(false);
  await page.evaluate(() => __arena.game.finish(1, "Team loses"));
  await expect
    .poll(() => page.evaluate(() => __app.sound.trackId))
    .toBe("downcast");
  await expect
    .poll(() => page.evaluate(() => __app.sound.track.paused))
    .toBe(false);
});
