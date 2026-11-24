import { test, expect } from "@playwright/test";
import { createLobbyServer } from "../../server/index.js";
import { Combat } from "../../src/combat.js";
import { delayedLink } from "../../scripts/prediction-benchmark/link.js";
let service, link;
test.beforeAll(async () => {
  service = createLobbyServer();
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  link = await delayedLink(`ws://127.0.0.1:${service.server.address().port}`, {
    rtt: 150,
    jitter: 15,
  });
});
test.afterAll(async () => {
  await link.close();
  await service.close();
});
async function open(page, mode, portrait = false, enabled = true, query = "") {
  await page.route("**/app-config.json", (r) =>
    r.fulfill({ json: { multiplayerUrl: link.url } }),
  );
  await page.addInitScript(
    ({ portrait, enabled }) => {
      HTMLElement.prototype.requestFullscreen = undefined;
      window.__FUSION_PREDICTION__ = enabled;
      localStorage.setItem(
        "elemental-settings",
        JSON.stringify({
          orientation: portrait ? "portrait" : "landscape",
          music: 0,
          sfx: 0,
        }),
      );
    },
    { portrait, enabled },
  );
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__app?.screen === "home");
  await page.evaluate((mode) => __app.openLobby(mode), mode);
  await page.waitForFunction(() => __app.lobby?.state);
}
for (const mode of [
  "tdm",
  "ffa",
  "war",
  "rush",
  "ctf",
  "gridiron",
  "turnpike",
  "zombies",
])
  test(`${mode}: two predicted humans, portrait touch, authority and remote synchronization at 150 ms RTT`, async ({
    browser,
  }) => {
    const c1 = await browser.newContext({
        viewport: { width: 1000, height: 700 },
      }),
      c2 = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      });
    const a = await c1.newPage(),
      b = await c2.newPage();
    const errors = [];
    for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
    try {
      await open(a, mode);
      await open(b, mode, true);
      const room = service.rooms.get(
        await a.evaluate(() => __app.lobby.state.roomId),
      );
      // Reproducible roster/map/AI: the immediate ordinary-movement assertion
      // must not randomly start during a knockback or another unsafe effect.
      let seed = 641;
      room.preparedGame = new Combat({
        mode,
        element: "fire",
        players: room.capacity,
        size: room.capacity / 2,
        random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32),
      });
      room.startBattle();
      await Promise.all(
        [a, b].map((p) =>
          p.waitForFunction(
            () =>
              __app.lobby.state.phase === "battle" &&
              __app.lobby.prediction.state,
          ),
        ),
      );
      await a.waitForTimeout(400);
      const actor = room.game.player;
      const dirs = [
        ["d", 1, 0],
        ["a", -1, 0],
        ["s", 0, 1],
        ["w", 0, -1],
      ];
      const [key, dx, dy] =
        dirs.find(
          ([, x, y]) =>
            !room.game.map ||
            room.game.map.lineClear(
              actor,
              { x: actor.x + x * 60, y: actor.y + y * 60 },
              13,
            ),
        ) || dirs[0];
      await a.evaluate(() => {
        const draw = __arena.renderer.draw;
        window.__presented = null;
        __arena.renderer.draw = function (g, ...args) {
          __presented = {
            x: g.player.x,
            y: g.player.y,
            authoritativeX: __arena.game.player.x,
            authoritativeY: __arena.game.player.y,
          };
          return draw.call(this, g, ...args);
        };
      });
      await a.waitForFunction(() => __app.lobby.prediction.presentation());
      const before = await a.evaluate(() => __app.lobby.prediction.presentation());
      expect(before).not.toBeNull();
      await a.keyboard.down(key);
      await a.waitForTimeout(65);
      const immediate = await a.evaluate(() => __presented);
      expect(
        Math.hypot(immediate.x - before.x, immediate.y - before.y),
      ).toBeGreaterThan(0.15);
      await a.waitForTimeout(200);
      await a.keyboard.up(key);
      const joy = b.locator("#joystick");
      const box = await joy.boundingBox();
      await joy.dispatchEvent("pointerdown", {
        pointerId: 77,
        pointerType: "touch",
        buttons: 1,
        clientX: box.x + box.width * 0.7,
        clientY: box.y + box.height * 0.5,
      });
      await b.waitForTimeout(180);
      await joy.dispatchEvent("pointerup", {
        pointerId: 77,
        pointerType: "touch",
        buttons: 0,
      });
      await a.waitForTimeout(900);
      expect(await a.evaluate(() => __app.lobby.prediction.enabled)).toBe(true);
      expect(
        [...room.members.values()].every((m) => m.movementAck[0] > 0),
      ).toBe(true);
      expect(await b.evaluate(() => __arena.stick.pointer)).toBe(null);
      expect(
        await a.evaluate(() => __app.lobby.prediction.history.length),
      ).toBeLessThan(96);
      const remote = await b.evaluate((id) => {
        const p = __arena.game.fighters.find((a) => a.id === id);
        return { x: p.x, y: p.y };
      }, actor.id);
      expect(Math.hypot(remote.x - actor.x, remote.y - actor.y)).toBeLessThan(
        35,
      );
      expect(errors).toEqual([]);
    } finally {
      await c1.close();
      await c2.close();
    }
  });
test("new and legacy movement clients share a room; disabling prediction and rejoining fall back safely", async ({
  browser,
}) => {
  const c1 = await browser.newContext(),
    c2 = await browser.newContext();
  const a = await c1.newPage(),
    b = await c2.newPage();
  try {
    await open(a, "ffa");
    await open(b, "ffa", false, false);
    expect(await a.evaluate(() => __app.lobby.prediction.enabled)).toBe(true);
    expect(await b.evaluate(() => __app.lobby.prediction.enabled)).toBe(false);
    expect(await a.evaluate(() => __app.lobby.state.roomId)).toBe(
      await b.evaluate(() => __app.lobby.state.roomId),
    );
    await a.evaluate(() => __app.lobby.close());
    await a.reload();
    await a.waitForFunction(() => __app?.screen === "home");
    await a.evaluate(() => __app.openLobby("ffa"));
    await a.waitForFunction(() => __app.lobby?.prediction.state);
    expect(
      await a.evaluate(() => __app.lobby.prediction.history.length),
    ).toBeLessThan(10);
  } finally {
    await c1.close();
    await c2.close();
  }
});

test("developer URL comparison controls negotiation and shows diagnostics without a settings change", async ({ page }) => {
  await open(page, "ffa", false, true, "?netdebug=1&prediction=0");
  await expect(page.locator("#network-debug")).toContainText("Prediction OFF");
  expect(await page.evaluate(() => __app.lobby.prediction.enabled)).toBe(false);
  await open(page, "ffa", false, true, "?netdebug=1");
  await expect(page.locator("#network-debug")).toContainText("Prediction ON");
  await open(page, "ffa");
  await expect(page.locator("#network-debug")).toHaveCount(0);
});

test("authoritative knockback, teleport, death and form changes reset local presentation under delayed delivery", async ({ page }) => {
  await open(page, "ffa");
  const room = service.rooms.get(await page.evaluate(() => __app.lobby.state.roomId));
  room.preparedGame = new Combat({ mode: "ffa", players: 4, element: "fire", mapId: "classic", random: () => 0.2 });
  room.startBattle();
  await page.waitForFunction(() => __app.lobby.state.phase === "battle" && __app.lobby.prediction.presentation());
  const actor = room.game.player;
  actor.knockX = 160;
  await page.waitForFunction(() => __arena.game.player.knockX > 10 && __app.lobby.prediction.presentation() === null);
  actor.knockX = actor.knockY = 0;
  actor.x = 400;
  actor.y = 300;
  actor.teleportArrival = 0.6;
  await page.waitForFunction(() => __arena.game.player.teleportArrival > 0 && __app.lobby.prediction.presentation() === null);
  expect(await page.evaluate(() => __app.lobby.prediction.state.x)).toBe(400);
  actor.alive = false;
  actor.ghost = false;
  await page.waitForFunction(() => !__arena.game.player.alive && __app.lobby.prediction.presentation() === null);
  actor.alive = true;
  actor.hp = actor.maxHp;
  actor.teleportArrival = 0;
  actor.element = "air";
  actor.parts = ["air"];
  actor.vx = actor.vy = 0;
  await page.waitForFunction(() => __app.lobby.prediction.state?.element === "air" && __app.lobby.prediction.presentation());
  expect(await page.evaluate(() => __app.lobby.prediction.history.length)).toBeLessThan(12);
  expect(await page.evaluate(() => __app.lobby.prediction.state.hp === __arena.game.player.hp)).toBe(true);
});
