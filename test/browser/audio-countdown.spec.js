import { test, expect } from "@playwright/test";
import { installLobbyService } from "./local-lobby-service.js";
const route = installLobbyService(test);
async function ready(page, orientation = "landscape") {
  await route(page);
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0.2, sfx: 0.5, orientation }),
    );
  }, orientation);
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
async function begin(page, mode) {
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.update = () => {};
  });
  await expect
    .poll(() => page.evaluate(() => __app.sound.track?.currentTime || 0))
    .toBeGreaterThan(0.05);
}
for (const mode of ["turnpike", "dungeon"]) {
  test(`${mode} retains its recording across every outcome and result page`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await ready(page);
    for (const result of ["victory", "defeat", "draw"]) {
      await begin(page, mode);
      const id = await page.evaluate(() => __app.sound.trackId);
      expect(
        mode === "dungeon" ? ["taking-it-back"] : ["kuuler", "obey"],
      ).toContain(id);
      await page.evaluate((result) => {
        window.resultTrack = __app.sound.track;
        __app.sound.track.currentTime = 10;
        const g = __arena.game;
        g.finish(
          result === "draw"
            ? null
            : result === "victory"
              ? g.player.team
              : 1 - g.player.team,
          "Test outcome",
        );
        g.celebrationRemaining = 0;
      }, result);
      await expect(page.locator("#game-overlay .report-next")).toBeVisible();
      for (let i = 0; i < 2; i++)
        await page.locator("#game-overlay .report-next").click();
      expect(await page.evaluate(() => __app.sound.trackId)).toBe(id);
      expect(
        await page.evaluate(() => __app.sound.track === window.resultTrack),
      ).toBe(true);
      expect(await page.evaluate(() => __app.sound.scene)).toBe(mode);
      await expect
        .poll(() => page.evaluate(() => __app.sound.track.currentTime))
        .toBeGreaterThan(10);
      if (mode === "turnpike") {
        await page.evaluate(() => {
          const t = __app.sound.track;
          t.currentTime = t.duration - 0.1;
        });
        await expect
          .poll(() => page.evaluate(() => __app.sound.trackId))
          .not.toBe(id);
        expect(["kuuler", "obey"]).toContain(
          await page.evaluate(() => __app.sound.trackId),
        );
        await expect
          .poll(() => page.evaluate(() => __app.sound.track.paused))
          .toBe(false);
      } else {
        expect(await page.evaluate(() => __app.sound.track.loop)).toBe(true);
        await page.evaluate(() => {
          const t = __app.sound.track;
          t.currentTime = t.duration - 0.1;
        });
        await expect
          .poll(() => page.evaluate(() => __app.sound.track.currentTime))
          .toBeLessThan(2);
      }
      await page.locator("#leave-btn").click();
      await expect
        .poll(() => page.evaluate(() => __app.sound.scene))
        .toBe("menu");
    }
  });
}

test("Cancel plays once for menu Back, dialog X, battle Leave and results Back, and honors mute", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    await Promise.all([__app.sound.menuSfx.ready, __app.sound.cancelSfx.ready]);
    window.clickCounts = { selection: 0, cancel: 0 };
    for (const [key, sfx] of [
      ["selection", __app.sound.menuSfx],
      ["cancel", __app.sound.cancelSfx],
    ]) {
      const play = sfx.play.bind(sfx);
      sfx.play = () => {
        clickCounts[key]++;
        return play();
      };
    }
  });
  await page.locator('[data-screen="settings"]').click();
  await page.locator("#shell-back").click();
  expect(await page.evaluate(() => clickCounts)).toEqual({
    selection: 1,
    cancel: 1,
  });
  await page.evaluate(() => __app.chooseMode("ffa"));
  await page.locator("#setup-how").click();
  await page.locator("#slides-close").click();
  expect(await page.evaluate(() => clickCounts.cancel)).toBe(2);
  await page.locator("#begin-btn").click();
  await page.locator("#leave-btn").click();
  expect(await page.evaluate(() => clickCounts.cancel)).toBe(3);
  await begin(page, "ffa");
  await page.evaluate(() => {
    const g = __arena.game;
    g.finish(g.player.team, "done");
    g.celebrationRemaining = 0;
  });
  await page.locator("#game-overlay .report-next").click();
  const before = await page.evaluate(() => ({ ...clickCounts }));
  await page.locator("#game-overlay [data-previous]").click();
  expect(await page.evaluate(() => clickCounts)).toEqual({
    selection: before.selection,
    cancel: before.cancel + 1,
  });
  const buffer = await page.evaluate(async () => {
    const { CANCEL_URL } = await import("/src/menu-sfx.js");
    const c = __app.sound.context;
    const expected = await c.decodeAudioData(
      await (await fetch(CANCEL_URL)).arrayBuffer(),
    );
    const actual = __app.sound.cancelSfx.buffer;
    return {
      expected: expected.length,
      actual: actual.length,
      same: expected
        .getChannelData(0)
        .every((v, i) => v === actual.getChannelData(0)[i]),
    };
  });
  expect(buffer.actual).toBe(buffer.expected);
  expect(buffer.same).toBe(true);
  await page.evaluate(() => __app.sound.volume("sfx", 0));
  await page.locator("#leave-btn").click();
  expect(await page.evaluate(() => __app.sound.cancelSfx.voices.size)).toBe(0);
  expect(await page.evaluate(() => clickCounts.cancel)).toBe(before.cancel + 1);
});

for (const orientation of ["portrait", "landscape"]) {
  test(`Flash leaves the HUD and touch controls above the whiteout in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      orientation === "portrait"
        ? { width: 390, height: 844 }
        : { width: 1000, height: 700 },
    );
    await ready(page, orientation);
    await begin(page, "ffa");
    await page.evaluate(() => {
      __arena.game.countdown = 0;
      __arena.game.player.whiteout = 3;
    });
    await expect(page.locator("#flash-whiteout")).toHaveCSS("opacity", "1");
    const layers = await page.evaluate(() => {
      const flash = document.querySelector("#flash-whiteout"),
        hud = document.querySelector(".game-hud"),
        controls = document.querySelector(".battle-controls");
      return {
        parent: flash.parentElement.id,
        hudParent: hud.parentElement.id,
        controlsParent: controls.parentElement.id,
        flash: +getComputedStyle(flash).zIndex,
        hud: +getComputedStyle(hud).zIndex,
        controls: +getComputedStyle(controls).zIndex,
      };
    });
    expect(layers.parent).toBe("game-wrap");
    expect(layers.hudParent).toBe(layers.parent);
    expect(layers.controlsParent).toBe(layers.parent);
    expect(layers.hud).toBeGreaterThan(layers.flash);
    expect(layers.controls).toBeGreaterThan(layers.flash);
    await expect(page.locator("#health-label")).toBeVisible();
    await expect(page.locator("#attack-btn")).toBeVisible();
    await page.screenshot({ path: `/tmp/flash-hud-${orientation}.png` });
  });
}

for (const mode of ["gridiron", "turnpike"]) {
  test(`${mode} shows both clients 5-second lobby then 3-second field countdown without restarting music`, async ({
    browser,
  }) => {
    test.setTimeout(45000);
    const first = await browser.newContext({
      viewport: { width: 1000, height: 700 },
    });
    const second = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    try {
      const a = await first.newPage(),
        b = await second.newPage();
      await ready(a);
      await ready(b, "portrait");
      for (const p of [a, b]) {
        await p.evaluate((mode) => __app.openLobby(mode), mode);
        await p.waitForFunction(() => __app.lobby?.state);
      }
      expect(await a.evaluate(() => __app.lobby.state.roomId)).toBe(
        await b.evaluate(() => __app.lobby.state.roomId),
      );
      await a.locator("#lobby-controls [data-start]").click();
      for (const p of [a, b])
        await expect(p.locator("#lobby-countdown")).toBeVisible();
      await a.waitForFunction(() => __app.lobby.state.phase === "countdown");
      const track = await a.evaluate(() => __app.sound.trackId);
      await a.waitForFunction(() => __app.lobby.state.phase === "battle");
      for (const p of [a, b]) {
        await expect(p.locator("#battle-countdown")).toHaveText("3");
        expect(await p.evaluate(() => __arena.game.time)).toBe(0);
      }
      const pos = await a.evaluate(() => ({
        x: __arena.game.player.x,
        y: __arena.game.player.y,
      }));
      await a.keyboard.down("d");
      for (const label of ["2", "1"]) {
        for (const p of [a, b])
          await expect(p.locator("#battle-countdown")).toHaveText(label);
        expect(
          await a.evaluate(() => ({
            x: __arena.game.player.x,
            y: __arena.game.player.y,
          })),
        ).toEqual(pos);
        expect(await a.evaluate(() => __arena.game.time)).toBe(0);
      }
      for (const p of [a, b])
        await expect(p.locator("#battle-countdown")).toHaveText("Go!");
      await expect
        .poll(() => a.evaluate(() => __arena.game.time))
        .toBeGreaterThan(0);
      await a.keyboard.up("d");
      expect(await a.evaluate(() => __app.sound.trackId)).toBe(track);
      await expect
        .poll(() => a.evaluate(() => __app.sound.track.currentTime))
        .toBeGreaterThan(7);
    } finally {
      await first.close();
      await second.close();
    }
  });
}
