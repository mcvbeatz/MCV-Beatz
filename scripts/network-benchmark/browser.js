import { chromium } from "@playwright/test";
import { fork } from "node:child_process";
import { once } from "node:events";
import { WebSocket } from "ws";
import { writeFile } from "node:fs/promises";
const results = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  for (const transport of ["legacy", "delta"])
    for (const [name, mode, players] of [
      ["1v1", "ffa", 2],
      ["4v4", "tdm", 8],
      ["5v5", "war", 10],
      ["Zombies", "zombies", 8],
    ]) {
      const child = fork(new URL("./server.js", import.meta.url), {
        silent: true,
      });
      child.stderr.on("data", (b) => process.stderr.write(b));
      const next = () => once(child, "message").then(([m]) => m);
      const { port } = await next();
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      const page = await context.newPage();
      const sockets = [];
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      try {
        await page.route("**/app-config.json", (r) =>
          r.fulfill({ json: { multiplayerUrl: `ws://127.0.0.1:${port}` } }),
        );
        await page.addInitScript((transport) => {
          localStorage.setItem(
            "elemental-settings",
            JSON.stringify({ orientation: "landscape", music: 0, sfx: 0 }),
          );
          HTMLElement.prototype.requestFullscreen = undefined;
          if (transport === "legacy") {
            const send = WebSocket.prototype.send;
            WebSocket.prototype.send = function (data) {
              const m = JSON.parse(data);
              delete m.snapshotCodec;
              return send.call(this, JSON.stringify(m));
            };
          }
        }, transport);
        await page.goto("http://127.0.0.1:5173");
        await page.waitForFunction(() => window.__app?.screen === "home");
        await page.evaluate((mode) => __app.openLobby(mode), mode);
        await page.waitForFunction(() => __app.lobby?.state);
        for (let i = 1; i < players; i++) {
          const ws = new WebSocket(`ws://127.0.0.1:${port}`);
          await once(ws, "open");
          ws.send(
            JSON.stringify({
              kind: "join",
              mode,
              guest: true,
              snapshotCodec:
                transport === "delta" ? "json-delta-v1" : undefined,
              element: i % 2 ? "water" : "fire",
            }),
          );
          await once(ws, "message");
          sockets.push(ws);
        }
        child.send({ kind: "start", players });
        await next();
        await page.waitForFunction(() => __app.lobby.state.phase === "battle");
        await page.keyboard.down("d");
        await page.waitForTimeout(3000);
        await page.evaluate(() => __app.lobby.diagnostics.reset());
        await page.waitForTimeout(
          Number(process.env.BENCH_SECONDS || 10) * 1000,
        );
        const metrics = await page.evaluate(() => ({
          diagnostics: __app.lobby.diagnostics.report(),
          phase: __app.lobby.state.phase,
          fighters: __arena.game.fighters.length,
        }));
        results.push({
          name,
          transport,
          viewport: { width: 1280, height: 720 },
          ...metrics,
          errors,
        });
        console.log(JSON.stringify(results.at(-1)));
      } finally {
        await context.close();
        sockets.forEach((ws) => ws.terminate());
        child.send({ kind: "close" });
        await once(child, "exit");
      }
    }
} finally {
  await browser.close();
}
await writeFile(
  process.env.BENCH_OUTPUT || "/tmp/network-browser.json",
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2) + "\n",
);
