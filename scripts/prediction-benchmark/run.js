import { chromium } from "@playwright/test";
import { createLobbyServer } from "../../server/index.js";
import { Combat } from "../../src/combat.js";
import { delayedLink } from "./link.js";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const results = [];
const conditions = [
  { rtt: 0 },
  { rtt: 40 },
  { rtt: 80 },
  { rtt: 150 },
  { rtt: 250 },
  { rtt: 150, jitter: 50 },
  { rtt: 80, dropEvery: 13, stallEvery: 17 },
];
const modes = process.env.PREDICTION_MATRIX
  ? ["tdm", "ffa", "war", "rush", "ctf", "gridiron", "turnpike", "zombies"]
  : ["ffa"];
try {
  for (const mode of modes)
    for (const condition of process.env.PREDICTION_MATRIX
      ? [{ rtt: 150 }]
      : conditions) {
      const service = createLobbyServer({ diagnostics: true });
      await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
      const link = await delayedLink(
        `ws://127.0.0.1:${service.server.address().port}`,
        condition,
      );
      const context = await browser.newContext({
        viewport: { width: 1000, height: 700 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      try {
        await page.route("**/app-config.json", (r) =>
          r.fulfill({ json: { multiplayerUrl: link.url } }),
        );
        await page.addInitScript((enabled) => {
          HTMLElement.prototype.requestFullscreen = undefined;
          localStorage.setItem(
            "elemental-settings",
            JSON.stringify({ orientation: "landscape", music: 0, sfx: 0 }),
          );
          window.__FUSION_PREDICTION__ = enabled;
        }, process.env.PREDICTION !== "0");
        await page.goto("http://127.0.0.1:5173");
        await page.waitForFunction(() => window.__app?.screen === "home");
        await page.evaluate((mode) => __app.openLobby(mode), mode);
        await page.waitForFunction(() => __app.lobby?.state);
        const room = [...service.rooms.values()][0];
        if (mode === "ffa") room.capacity = 2;
        room.preparedGame = new Combat({
          mode,
          mapId: mode === "ffa" ? "classic" : undefined,
          players: room.capacity,
          size: room.capacity / 2,
          element: "fire",
        });
        room.startBattle();
        // Controlled start away from opponents, retaining ordinary AI and movement.
        const p = room.game.player;
        const start = room.game.map?.nearest({ x: p.x + 70, y: p.y }, 24) || {
          x: 360,
          y: 300,
        };
        Object.assign(p, start);
        await page.waitForFunction(() => __app.lobby.state.phase === "battle");
        await page.waitForTimeout(700);
        await page.evaluate(() => {
          const renderer = __arena.renderer,
            draw = renderer.draw;
          window.__motionProbe = { samples: [], release: [], armed: false };
          renderer.draw = function (g, ...args) {
            const p = window.__motionProbe;
            if (
              p.armed &&
              (g.player.x - p.x) * p.dx + (g.player.y - p.y) * p.dy > 0.3
            ) {
              p.samples.push(performance.now() - p.at);
              p.armed = false;
            }
            p.last = { x: g.player.x, y: g.player.y };
            return draw.call(this, g, ...args);
          };
          addEventListener(
            "keydown",
            (e) => {
              if (["d", "a", "w", "s"].includes(e.key) && !e.repeat) {
                const p = __motionProbe;
                p.x = p.last?.x ?? __arena.game.player.x;
                p.y = p.last?.y ?? __arena.game.player.y;
                [p.dx, p.dy] = { d: [1, 0], a: [-1, 0], w: [0, -1], s: [0, 1] }[
                  e.key
                ];
                p.at = performance.now();
                p.armed = true;
              }
            },
            true,
          );
          __app.lobby.diagnostics.reset();
        });
        service.metrics.reset();
        for (const key of ["d", "a", "d", "a"]) {
          await page.keyboard.down(key);
          await page.waitForTimeout(450);
          await page.keyboard.up(key);
          await page.waitForTimeout(650);
        }
        await page.waitForTimeout(500);
        results.push({
          mode,
          condition,
          prediction: process.env.PREDICTION !== "0",
          ...(await page.evaluate(() => ({
            inputToDrawMs: __motionProbe.samples,
            diagnostics: __app.lobby.diagnostics.report(),
            phase: __app.lobby.state.phase,
          }))),
          server: service.metrics.report(),
          errors,
        });
        console.log(JSON.stringify(results.at(-1)));
      } finally {
        await context.close();
        await link.close();
        await service.close();
      }
    }
} finally {
  await browser.close();
}
await writeFile(
  process.env.BENCH_OUTPUT || "/tmp/prediction.json",
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2) + "\n",
);
