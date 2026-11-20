import { test, expect } from "@playwright/test";
import { installLobbyService } from "./local-lobby-service.js";
const route = installLobbyService(test);
async function open(page) {
  await route(page);
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation: "landscape", music: 0, sfx: 0 }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.evaluate(() => __app.openLobby("ffa"));
  await page.waitForFunction(() => __app.lobby?.state);
}
test("two rendered clients recover dropped, duplicate and delayed frames without losing shared state", async ({
  browser,
}) => {
  const first = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const second = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const a = await first.newPage(),
    b = await second.newPage();
  const errors = [];
  a.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  try {
    await open(a);
    await open(b);
    await expect
      .poll(() => a.evaluate(() => __app.lobby.state.members.length))
      .toBe(2);
    expect(await a.evaluate(() => __app.lobby.state.roomId)).toBe(
      await b.evaluate(() => __app.lobby.state.roomId),
    );
    await b.evaluate(() => {
      const ws = __app.lobby.socket,
        receive = ws.onmessage;
      let n = 0;
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.kind === "snapshot") {
          n++;
          if (n === 2) return; // dropped application frame
          if (n === 4) {
            setTimeout(() => receive(event), 350);
            return;
          } // arrives after newer state
          if (n === 9) receive(event); // duplicate must not replay
        }
        receive(event);
      };
    });
    const before = await b.evaluate(() => __arena.game.fighters[0].x);
    await a.keyboard.down("d");
    await a.waitForTimeout(500);
    await a.keyboard.up("d");
    await expect
      .poll(() => b.evaluate(() => __app.lobby.diagnostics.resyncs))
      .toBeGreaterThan(0);
    await expect
      .poll(() => b.evaluate(() => __arena.game.fighters[0].x))
      .toBeGreaterThan(before);
    await expect
      .poll(() => b.evaluate(() => performance.now() - __app.lobby.receivedAt))
      .toBeLessThan(250);
    await b.evaluate(() => __app.lobby.diagnostics.reset());
    await b.waitForTimeout(1500);
    const stats = await b.evaluate(() => __app.lobby.diagnostics.report());
    expect(stats.renderFps).toBeGreaterThan(10);
    expect(stats.snapshotsPerSecond).toBeGreaterThan(5);
    expect(stats.receivedJsonBytes).toBeGreaterThan(0);
    expect(stats.timings.receiveMs.mean).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  } finally {
    await first.close();
    await second.close();
  }
});
