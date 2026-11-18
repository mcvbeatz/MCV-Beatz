import test from "node:test";
import assert from "node:assert/strict";
import { LobbyRoom } from "../src/lobby-room.js";
import { packGame, unpackGame } from "../src/multiplayer-protocol.js";
import { MULTIPLAYER_MODES, SOLO_MODES } from "../src/mode-catalog.js";
import { Combat } from "../src/combat.js";
import {
  advanceGridironCelebration,
  updateGridiron,
} from "../src/event-modes.js";
import { completedSnapshot } from "../src/match-statistics.js";
import {
  defaultElement,
  saveDefaultElement,
} from "../src/player-preferences.js";
import { WebSocket } from "ws";
import { createLobbyServer } from "../server/index.js";
test("captain order, AI replacement, captain-only settings and five-second synchronized start", () => {
  let now = 0;
  const r = new LobbyRoom("tdm", { now: () => now });
  r.join("one", "One");
  r.join("two", "Two");
  assert.equal(r.game.fighters.length, 8);
  assert.equal(r.captain, "one");
  r.command("two", { kind: "size", size: 4 });
  assert.equal(r.capacity, 8);
  r.command("one", { kind: "size", size: 8 });
  assert.equal(r.capacity, 8);
  r.command("two", { kind: "start" });
  assert.equal(r.phase, "lobby");
  r.command("one", { kind: "start" });
  assert.equal(r.deadline, 5000);
  now = 4999;
  r.tick(0.03);
  assert.equal(r.phase, "countdown");
  now = 5000;
  r.tick(0.03);
  assert.equal(r.phase, "battle");
  assert.notEqual(r.game.mapId, "classic");
  assert.notEqual(r.members.get("one").matchId, r.members.get("two").matchId);
  r.leave("one");
  assert.equal(r.captain, "two");
  assert.equal(r.game.player.id, r.members.get("two").actorId);
});
test("all multiplayer modes can start, share a graph snapshot, and preserve local participant statistics", () => {
  assert.deepEqual(SOLO_MODES, ["dungeon", "gauntlet"]);
  for (const mode of MULTIPLAYER_MODES) {
    const r = new LobbyRoom(mode);
    r.join("one", "One", "water");
    r.join("two", "Two", "dark");
    r.startBattle();
    for (let i = 0; i < 15; i++) r.tick(0.03);
    const copy = unpackGame(JSON.parse(JSON.stringify(packGame(r.game))));
    assert.equal(copy.mode, mode);
    assert.equal(copy.portals.game, copy);
    assert.equal(typeof copy.map?.move, copy.map ? "function" : "undefined");
    assert.ok(copy.sessionActors instanceof Map);
    assert.equal(
      copy.player,
      copy.fighters.find((a) => a.id === copy.player.id),
    );
    const second = copy.fighters.find(
      (a) => a.id === r.members.get("two").actorId,
    );
    assert.ok(
      copy.sessionActors.get(second.id).stats.forms[second.element]?.seconds >
        0,
      mode,
    );
  }
});
test("lobby rejects attacks and client coordinates, battle controls move only their sender", () => {
  const r = new LobbyRoom("ffa");
  r.join("one", "One");
  r.join("two", "Two");
  const hp = r.game.fighters.map((a) => a.hp);
  r.command("one", { kind: "strike" });
  assert.deepEqual(
    r.game.fighters.map((a) => a.hp),
    hp,
  );
  r.startBattle();
  const a = r.game.fighters[0],
    b = r.game.fighters[1];
  const ax = a.x,
    bx = b.x;
  r.command("two", { kind: "move", x: -1, y: 0 });
  r.tick(0.03);
  assert.equal(a.x, ax);
  assert.ok(b.x < bx);
  r.command("one", { kind: "teleport", args: ["bad", null] });
  assert.ok(Number.isFinite(a.x));
});
test("shared results deadline retains members in the lobby until the captain starts", () => {
  let now = 0;
  const r = new LobbyRoom("tdm", { now: () => now });
  r.join("one", "One");
  r.join("two", "Two");
  r.startBattle();
  const first = r.roundId;
  r.game.finish(0, "done");
  r.game.celebrationRemaining = 0;
  r.tick(0.03);
  assert.equal(r.phase, "results");
  assert.equal(r.deadline, 30000);
  now = 29999;
  r.tick(0.03);
  assert.equal(r.phase, "results");
  now = 30000;
  r.tick(0.03);
  assert.equal(r.phase, "lobby");
  assert.equal(r.members.size, 2);
  now = 60000;
  r.tick(0.03);
  assert.equal(r.phase, "lobby");
  r.command("two", { kind: "start" });
  assert.equal(r.phase, "lobby");
  assert.equal(r.members.get("two").ready, true);
  r.command("one", { kind: "start" });
  assert.equal(r.deadline, 65000);
  now = 65000;
  r.tick(0.03);
  assert.equal(r.phase, "battle");
  assert.notEqual(r.roundId, first);
});
test("Sunken Colosseum stays limited to four players, while the lobby can hold ten", () => {
  for (const mode of ["ffa", "tdm", "war", "boss", "rush", "roulette"]) {
    const g = new Combat({
      mode,
      size: 4,
      players: 8,
      mapId: "classic",
      random: () => 0,
    });
    assert.notEqual(g.mapId, "classic", mode);
  }
  assert.equal(
    new Combat({ mode: "ffa", players: 4, mapId: "classic" }).mapId,
    "classic",
  );
  const r = new LobbyRoom("war");
  r.join("one", "One");
  r.command("one", { kind: "size", size: 10 });
  assert.equal(r.game.mapId, "classic");
  assert.equal(r.game.fighters.length, 10);
});
test("only the scoring team poses; bots use independent celebration motions", () => {
  let seed = 0;
  const g = new Combat({
    mode: "gridiron",
    random: () => ((seed++ % 9) + 0.5) / 10,
  });
  g.ball.x = 1500;
  g.ball.y = 500;
  updateGridiron(g);
  assert.ok(g.fighters.filter((a) => a.team === 1).every((a) => !a.victory));
  const before = g.fighters.map((a) => [a.x, a.y]);
  advanceGridironCelebration(g, 0.9, { x: 0, y: 0 });
  assert.ok(g.fighters.filter((a) => a.team === 1).every((a) => !a.victory));
  const changes = g.fighters
    .slice(1)
    .map(
      (a, i) =>
        `${(a.x - before[i + 1][0]).toFixed(2)},${(a.y - before[i + 1][1]).toFixed(2)}`,
    );
  assert.ok(new Set(changes).size > 2);
});
test("default origin persists separately for guests and accounts; invalid origins are rejected", async () => {
  const values = new Map(),
    storage = {
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
    };
  await saveDefaultElement("water", { user: null }, storage);
  assert.equal(defaultElement(null, storage), "water");
  const account = {
    user: { id: "one", user_metadata: {} },
    require: () => ({ auth: { updateUser: async () => ({ error: null }) } }),
  };
  await saveDefaultElement("dark", account, storage);
  assert.equal(defaultElement(account.user, storage), "dark");
  assert.equal(defaultElement(null, storage), "water");
  await assert.rejects(saveDefaultElement("ice", account, storage));
});
test("real WebSocket clients join one room, replace AI seats and transfer captainship on leave", async () => {
  const server = createLobbyServer({
    verifyUser: async (token) => ({
      id: token,
      user_metadata: { username: token },
    }),
  });
  await new Promise((r) => server.server.listen(0, "127.0.0.1", r));
  const url = `ws://127.0.0.1:${server.server.address().port}`;
  const connect = (id) =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.on("error", reject);
      ws.on("open", () =>
        ws.send(JSON.stringify({ kind: "join", token: id, mode: "gridiron" })),
      );
      ws.once("message", (raw) => resolve({ ws, state: JSON.parse(raw) }));
    });
  try {
    const a = await connect("one"),
      b = await connect("two");
    assert.equal(a.state.roomId, b.state.roomId);
    assert.equal(b.state.members.length, 2);
    assert.equal(b.state.capacity, 8);
    a.ws.close();
    await new Promise((r) => a.ws.once("close", r));
    await new Promise((r) => setTimeout(r, 30));
    assert.equal([...server.rooms.values()][0].captain, "two");
    b.ws.close();
  } finally {
    await server.close();
  }
});

test("stale and explicitly released controls cancel movement and held skills", () => {
  let now = 1000;
  const r = new LobbyRoom("tdm", { now: () => now });
  r.join("one", "One", "earth");
  r.startBattle();
  const a = r.game.player;
  r.command("one", { kind: "move", x: 1, y: 0 });
  r.command("one", { kind: "utility", args: [true] });
  assert.ok(a.shield);
  now += 501;
  r.tick(0.03);
  assert.ok(!a.shield);
  assert.deepEqual(r.game.humanInputs.get(a.id), { x: 0, y: 0 });
  r.command("one", { kind: "move", x: 1, y: 0 });
  a.charging = true;
  r.command("one", { kind: "neutral" });
  assert.equal(a.charging, false);
  assert.deepEqual(r.members.get("one").input, { x: 0, y: 0 });
});

test("presentation interpolation never changes authoritative actor positions", async () => {
  const { samplePresentation, drawNetwork } =
    await import("../src/network-presentation.js");
  const g = new Combat();
  const a = g.player;
  g.presentationAt = 100;
  g.presentationFrom = new Map([
    [a.id, { x: a.x - 20, y: a.y, gaitDistance: 0, alive: a.alive }],
  ]);
  assert.equal(samplePresentation(g, 150).get(a.id).x, a.x - 10);
  const x = a.x;
  drawNetwork({ draw: () => {} }, g);
  assert.equal(a.x, x);
  assert.throws(() =>
    drawNetwork(
      {
        draw: () => {
          throw Error("paint");
        },
      },
      g,
    ),
  );
  assert.equal(a.x, x);
});

test("lobbies default to maximum capacity and forced forms cannot be overridden", async () => {
  const { lobbySizes, forcedLobbyElement } =
    await import("../src/multiplayer-protocol.js");
  for (const mode of MULTIPLAYER_MODES) {
    const r = new LobbyRoom(mode);
    r.join("captain", "Captain", "water");
    r.join("guest", "Guest", "dark");
    assert.equal(r.capacity, lobbySizes(mode).at(-1));
    const forced = forcedLobbyElement(mode);
    if (forced) {
      assert.ok(r.game.fighters.every((a) => a.element === forced));
      r.command("guest", { kind: "profile", element: "fire" });
      assert.equal(r.game.fighters[1].element, forced);
      assert.ok(r.snapshot().members.every((m) => m.elementLocked));
      r.startBattle();
      assert.ok(
        r.game.fighters
          .filter((a) => !a.echo && (mode !== "zombies" || a.team === 0))
          .every((a) => a.element === forced),
      );
    }
  }
});
test("non-captain START broadcasts readiness and readiness resets between rounds", () => {
  const r = new LobbyRoom("tdm");
  r.join("a", "A");
  r.join("b", "B");
  r.command("b", { kind: "start" });
  assert.equal(r.phase, "lobby");
  assert.equal(r.game.fighters[1].lobbyReady, true);
  const view = unpackGame(JSON.parse(JSON.stringify(r.snapshot().game)));
  assert.equal(view.fighters[1].lobbyReady, true);
  r.command("b", { kind: "profile", element: "water" });
  assert.equal(r.game.fighters[1].lobbyReady, false);
  r.command("b", { kind: "start" });
  r.createLobby();
  assert.ok(r.game.fighters.every((a) => !a.lobbyReady));
});
test("War shows assigned armies and only the current captain can change theirs", () => {
  const r = new LobbyRoom("war");
  for (let i = 0; i < 6; i++) r.join(String(i), "Player", "water");
  r.command("2", { kind: "profile", element: "fire" });
  assert.equal(r.game.fighters[2].element, "water");
  assert.notEqual(r.game.fighters[5].element, "water");
  for (let i = 0; i < 5; i++) r.leave(String(i));
  assert.equal(r.captain, "5");
  r.command("5", { kind: "profile", element: "dark" });
  assert.equal(r.game.fighters[5].element, "dark");
  const expected = r.game.fighters.map((a) => a.element);
  r.startBattle();
  assert.deepEqual(
    r.game.fighters.map((a) => a.element),
    expected,
  );
});
