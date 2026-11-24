import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "../src/combat.js";
import { integrateMovement } from "../src/movement-physics.js";
import {
  MovementPrediction,
  predictionSafe,
  PREDICTION_LIMITS,
  PRESENTATION_FIELDS,
} from "../src/movement-prediction.js";
import { enableMovement } from "../src/movement-ack.js";
import { LobbyRoom } from "../src/lobby-room.js";
import {
  drawNetwork,
  samplePresentation,
} from "../src/network-presentation.js";
function setup(element = "fire", mode = "ffa", mapId = "classic") {
  const g = new Combat({ mode, element, mapId, players: 2, size: 1 });
  g.countdown = 0;
  g.fighters = g.fighters.filter((a) => a === g.player);
  g.player.x = 350;
  g.player.y = 300;
  const p = new MovementPrediction();
  p.enabled = true;
  p.reconcile(g, [0, 0, 1, 0], "round", 0);
  return { g, a: g.player, p };
}
test("shared movement matches authority for flight, health, boosts, slow, shields, charging, flood and racing", () => {
  for (const element of ["fire", "air", "water", "invincible"])
    for (const modifier of [
      {},
      { hp: 20 },
      { boost: 1 },
      { slow: 1 },
      { shield: true },
      { charging: true },
      { dodge: 4 },
      { waveSpeed: 1.2 },
      { ghost: true, alive: false },
    ]) {
      const { g, a } = setup(element);
      Object.assign(a, modifier);
      g.hazards = [{ kind: "flood", life: 5, x: a.x, y: a.y, r: 100 }];
      const copy = { ...a };
      integrateMovement(g, copy, 0.7, -0.4, 1 / 30);
      g.move(a, 0.7, -0.4, 1 / 30);
      for (const k of PRESENTATION_FIELDS)
        assert.equal(
          copy[k],
          a[k],
          `${element} ${JSON.stringify(modifier)} ${k}`,
        );
    }
  for (const mode of [
    "turnpike",
    "ctf",
    "tdm",
    "war",
    "rush",
    "gridiron",
    "zombies",
  ]) {
    const g = new Combat({ mode, element: "air", players: 8, size: 4 });
    g.countdown = 0;
    const a = g.player,
      copy = { ...a };
    integrateMovement(g, copy, 1, 1, 1 / 30);
    g.move(a, 1, 1, 1 / 30);
    assert.equal(copy.x, a.x);
    assert.equal(copy.y, a.y);
  }
});
test("sequenced intentions are acknowledged only after a server step; invalid speeds/positions cannot be submitted", () => {
  const r = new LobbyRoom("ffa", { now: () => 1000 });
  r.join("u", "U", "fire", {});
  const m = r.members.get("u");
  enableMovement(m);
  r.command("u", {
    kind: "move",
    seq: 1,
    x: 9,
    y: 0,
    dt: 50,
    xPosition: 99999,
    hp: 999,
  });
  assert.deepEqual(m.movementAck, [0, 0, 0, 0]);
  const a = r.game.fighters[0],
    x = a.x;
  r.tick(1 / 30);
  assert.ok(a.x - x <= 150 / 30 + 0.001);
  assert.equal(a.hp, 120);
  assert.equal(m.movementAck[0], 1);
  const first = m.movementAck[1];
  r.tick(1 / 30);
  assert.ok(m.movementAck[1] > first);
  for (const seq of [1, 0, -1, NaN, Infinity, 1.5])
    r.command("u", { kind: "move", seq, x: -1, y: 0 });
  assert.equal(m.input.x, 1);
  r.command("u", { kind: "move", seq: 2, x: Infinity, y: 0 });
  assert.equal(m.moveState.seq, 1);
  r.command("u", { kind: "move", seq: 3, x: 0, y: 0 });
  assert.equal(m.movementAck[0], 1);
  r.tick(1 / 30);
  assert.equal(m.movementAck[0], 3);
  assert.ok(!("moveState" in r.snapshot().members[0]));
});
test("replay retains only unapplied duration and never replays an acknowledgment twice", () => {
  const { g, a, p } = setup();
  p.setInput(1, 0);
  const c = p.command();
  p.advance(0.03, 30);
  p.advance(0.03, 60);
  a.x += 150 * 0.03;
  p.reconcile(g, [c.seq, 0.03, 2, 0], "round", 60);
  assert.ok(Math.abs(p.state.x - 359) < 1e-6);
  const x = p.state.x;
  p.reconcile(g, [c.seq, 0.03, 2, 0], "round", 65);
  assert.equal(p.state.x, x);
  a.x += 150 * 0.03;
  p.reconcile(g, [c.seq, 0.06, 3, 0], "round", 70);
  assert.ok(Math.abs(p.state.x - a.x) < 1e-6);
  p.setInput(0, 0);
  const stop = p.command();
  p.advance(0.02, 90);
  p.reconcile(g, [stop.seq, 0.02, 4, 0], "round", 100);
  for (let i = 0; i < 20; i++) p.advance(0.016, 101 + i * 16);
  assert.ok(Math.abs(p.state.x - a.x) < 1e-6);
  assert.equal(p.state.vx, 0);
});
test("history and stale extrapolation are bounded; recovery discards old movement", () => {
  const { g, p } = setup();
  for (let i = 0; i < 1000; i++) {
    p.setInput(i % 2, 0);
    p.command();
    p.advance(0.016, i * 16);
  }
  assert.ok(p.history.length <= PREDICTION_LIMITS.maxHistory);
  assert.equal(p.presentation(), null);
  p.reconcile(g, [10000, 0, 3, 0], "round", 17000);
  assert.ok(p.history.length <= 1);
});
test("knockback, speed-burst dashes, portals, prison, shock and hazardous transitions remain authoritative", () => {
  for (const patch of [
    { knockX: 120 },
    { burst: 1 },
    { blink: {} },
    { prisonHp: 40 },
    { teleportArrival: 0.3 },
    { dimension: true },
    { transit: {} },
    { alive: false },
  ]) {
    const { g, a, p } = setup();
    p.setInput(1, 0);
    p.command();
    p.advance(0.02, 20);
    Object.assign(a, patch);
    a.x += 100;
    assert.equal(predictionSafe(g, a), false);
    p.reconcile(g, [1, 0.02, 2, 0], "round", 30);
    assert.equal(p.presentation(), null);
    assert.equal(p.state.x, a.x);
  }
  for (const kind of ["chasm", "quicksand"]) {
    const { g, a } = setup();
    g.hazards = [{ kind, x: a.x, y: a.y, r: 60 }];
    assert.equal(predictionSafe(g, a), false);
    a.parts = ["air"];
    assert.equal(predictionSafe(g, a), true);
  }
  const { g, a } = setup();
  const enemy = makeFighter("enemy", "lightning", 1, a.x + 10, a.y);
  g.fighters.push(enemy);
  assert.equal(predictionSafe(g, a), false);
});
test("form/ghost/respawn transitions snap and walls do not permit smoothed crossings", () => {
  const { g, a, p } = setup();
  p.setInput(1, 0);
  p.command();
  p.advance(0.03, 30);
  a.x += 120;
  a.element = "air";
  a.parts = ["air"];
  p.reconcile(g, [1, 0.03, 2, 0], "round", 40);
  assert.equal(p.presentation().x, a.x);
  assert.equal(p.offset.x, 0);
  const maze = new Combat({ mode: "ctf", players: 8 });
  maze.countdown = 0;
  const copy = { ...maze.player };
  for (let i = 0; i < 120; i++) integrateMovement(maze, copy, 1, 0, 1 / 30);
  assert.ok(maze.map.walkable(copy));
});
test("predicted draw and camera use the same position and leave authoritative animation fields untouched even on failure", () => {
  const { g, a, p } = setup();
  g.localPrediction = p;
  p.setInput(1, 0);
  p.command();
  p.advance(0.03, 30);
  const original = PRESENTATION_FIELDS.map((k) => a[k]);
  const visual = p.presentation();
  assert.throws(() =>
    drawNetwork(
      {
        draw: (game) => {
          assert.notEqual(game.player, a);
          assert.equal(a.x, original[0]);
          assert.equal(game.player.x, visual.x);
          assert.equal(game.player.fx, 1);
          throw Error("paint");
        },
      },
      g,
    ),
  );
  assert.deepEqual(
    PRESENTATION_FIELDS.map((k) => a[k]),
    original,
  );
  assert.equal(samplePresentation(g).get(a.id).x, visual.x);
});

test("small corrections settle without feeding offsets into physics; wall-crossing and large corrections snap", () => {
  const { g, a, p } = setup();
  p.setInput(0, 0);
  const command = p.command();
  a.x += 4;
  p.reconcile(g, [command.seq, 0, 2, 0], "round", 0);
  assert.equal(p.state.x, a.x);
  assert.equal(p.presentation().x, a.x - 4);
  let error = 4;
  for (let i = 1; i <= 25; i++) {
    p.advance(0.016, i * 16);
    const next = Math.abs(p.presentation().x - a.x);
    assert.ok(next <= error);
    assert.equal(p.state.x, a.x);
    error = next;
  }
  assert.ok(error < 0.02);
  a.x += 100;
  p.reconcile(g, [command.seq, 0.4, 3, 0], "round", 400);
  assert.equal(p.presentation().x, a.x);
  g.map = { lineClear: () => false };
  a.x += 3;
  p.reconcile(g, [command.seq, 0.4, 4, 0], "round", 410);
  assert.equal(p.presentation().x, a.x);
});

test("portal approach and neutral epochs discard speculative travel without affecting authority", () => {
  const { g, a, p } = setup();
  p.setInput(1, 0);
  const command = p.command();
  p.advance(0.03, 30);
  const originalX = a.x;
  g.portals.portals.push({ x: a.x + 20, y: a.y, r: 21 });
  assert.equal(predictionSafe(g, a), false);
  p.reconcile(g, [command.seq, 0, 2, 0], "round", 40);
  assert.equal(p.presentation(), null);
  assert.equal(a.x, originalX);
  g.portals.portals.length = 0;
  p.reconcile(g, [command.seq, 0, 3, 0], "round", 50);
  p.setInput(1, 0);
  p.command();
  p.advance(0.03, 80);
  p.reconcile(g, [command.seq, 0, 4, 1], "round", 90);
  assert.equal(p.history.length, 0);
  assert.equal(p.presentation().x, a.x);
  assert.equal(p.offset.x, 0);
});
