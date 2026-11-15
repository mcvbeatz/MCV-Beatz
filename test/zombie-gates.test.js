import test from "node:test";
import assert from "node:assert/strict";
import { Combat } from "../src/combat.js";
import { spawnZombie, beginZombiesFrame } from "../src/zombies.js";
import {
  pullZombieGate,
  updateZombieGates,
  zombieSpawnBlocked,
  zombieRoomAt,
} from "../src/zombie-gates.js";
import { MODES, TEAM_MODES, PLAY_MODES } from "../src/mode-catalog.js";
const game = () =>
  new Combat({ mode: "zombies", players: 4, random: () => 0.15 });
const pull = (g, i) => {
  const s = g.zombieGates[i];
  Object.assign(g.player, { x: s.x, y: s.y + 40 });
  assert.ok(pullZombieGate(g, g.player, s));
  return s;
};
test("All six Zombies rooms have reachable reusable switches, including start and boss", () => {
  const g = game();
  assert.equal(g.zombieGates.length, g.map.rooms.length);
  for (const s of g.zombieGates) {
    assert.ok(g.map.walkable(s, 24));
    assert.equal(zombieRoomAt(g, s), s.room);
    assert.ok(g.map.route(g.player, s));
  }
  assert.equal(pullZombieGate(g, g.player, g.zombieGates[4]), false);
  const s = pull(g, 0);
  assert.equal(s.state, "locked");
  assert.equal(s.blastAt, 60);
  assert.equal(s.unlockAt, 120);
  assert.equal(pullZombieGate(g, g.player, s), false);
});
test("Boss-room lock suppresses early batches without banking extra spawns", () => {
  const g = game();
  pull(g, 4);
  for (let i = 0; i < 100; i++) assert.equal(spawnZombie(g), null);
  beginZombiesFrame(g, 15);
  assert.equal(g.zombies.spawned, 0);
  assert.equal(g.zombies.credit, 0);
  g.time = 60;
  updateZombieGates(g);
  g.time = 67;
  updateZombieGates(g);
  beginZombiesFrame(g, 5);
  assert.equal(g.zombies.spawned, 1);
});
test("After spreading across the dungeon, neither direct nor fallback spawn slots enter any locked room", () => {
  const g = game();
  g.zombies.rate = 100;
  for (const room of [0, 2, 4]) pull(g, room);
  for (let i = 0; i < 300; i++) {
    const a = spawnZombie(g);
    assert.ok(a);
    assert.ok(g.map.walkable(a));
    assert.equal([0, 2, 4].includes(zombieRoomAt(g, a)), false);
  }
  g.time = 60;
  updateZombieGates(g);
  for (let i = 0; i < 60; i++) assert.equal(spawnZombie(g), null);
  g.time = 67;
  for (let i = 0; i < 60; i++) assert.ok(spawnZombie(g));
});
test("Blast clears Fire in every room, corridors and portals, with seven seconds of global spawn suppression", () => {
  const g = game();
  const enemies = g.map.rooms.map((r) => {
    const a = spawnZombie(g);
    Object.assign(a, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
    return a;
  });
  const corridor = spawnZombie(g),
    hidden = spawnZombie(g);
  const edge = g.zombieEdges.find((p) => zombieRoomAt(g, p) < 0);
  assert.ok(edge);
  Object.assign(corridor, edge);
  hidden.transit = {};
  enemies.push(corridor, hidden);
  const gate = pull(g, 4),
    hp = g.player.hp;
  g.time = 59.999;
  updateZombieGates(g);
  assert.ok(enemies.every((a) => a.alive));
  g.time = 60;
  beginZombiesFrame(g, 0);
  assert.ok(enemies.every((a) => !a.alive));
  assert.ok(g.fighters.filter((a) => a.team === 0).every((a) => a.alive));
  assert.equal(g.player.hp, hp);
  assert.equal(gate.state, "overheated");
  assert.equal(g.zombies.kills, enemies.length);
  assert.equal(g.player.kills, enemies.length);
  assert.equal(g.healthDrops.length, enemies.length);
  updateZombieGates(g);
  assert.equal(g.zombies.kills, enemies.length);
  // Both spawn stages, every room and corridor are held, with no banked waves.
  for (const rate of [1, 50, 100]) {
    g.zombies.rate = rate;
    for (const time of [60, 63, 66.999]) {
      g.time = time;
      beginZombiesFrame(g, 5);
      for (const p of g.zombieEdges) assert.ok(zombieSpawnBlocked(g, p));
      assert.equal(spawnZombie(g), null);
      assert.equal(g.zombies.credit, 0);
    }
  }
  g.time = 67;
  updateZombieGates(g);
  assert.equal(gate.state, "overheated");
  assert.equal(zombieSpawnBlocked(g, gate), false);
  assert.ok(spawnZombie(g));
  assert.equal(pullZombieGate(g, g.player, gate), false);
  g.time = 119.999;
  updateZombieGates(g);
  assert.equal(pullZombieGate(g, g.player, gate), false);
  g.time = 120;
  updateZombieGates(g);
  assert.equal(gate.state, "ready");
  assert.ok(pullZombieGate(g, g.player, gate));
  assert.equal(gate.blastAt, 180);
  assert.equal(gate.unlockAt, 240);
});
test("Overlapping blasts extend the global escape window and retain separate switch cooldowns", () => {
  const g = game(),
    first = pull(g, 0);
  g.time = 5;
  const second = pull(g, 1);
  g.time = 60;
  beginZombiesFrame(g, 0);
  assert.equal(g.zombieSpawnResumeAt, 67);
  g.time = 65;
  beginZombiesFrame(g, 5);
  assert.equal(g.zombieSpawnResumeAt, 72);
  assert.equal(first.unlockAt, 120);
  assert.equal(second.unlockAt, 125);
  g.time = 67;
  assert.equal(spawnZombie(g), null);
  // A fresh room remains usable during the escape window.
  const third = pull(g, 2);
  assert.equal(third.blastAt, 127);
  g.time = 72;
  assert.ok(spawnZombie(g));
  g.time = 120;
  updateZombieGates(g);
  assert.equal(first.state, "ready");
  assert.equal(second.state, "overheated");
});
test("Switches cannot be extended, remotely pulled or activated while felled, paused by countdown, or off-field", () => {
  const g = game(),
    s = g.zombieGates[0];
  Object.assign(g.player, s);
  for (const status of [
    { alive: false },
    { transit: {} },
    { prisonHp: 10 },
    { blink: {} },
    { stagger: 1 },
  ]) {
    const backup = {};
    for (const k of Object.keys(status)) backup[k] = g.player[k];
    Object.assign(g.player, status);
    assert.equal(pullZombieGate(g, g.player, s), false);
    Object.assign(g.player, backup);
  }
  g.countdown = 4;
  assert.equal(pullZombieGate(g, g.player, s), false);
  g.countdown = 0;
  assert.ok(pullZombieGate(g, g.player, s));
  g.time = 20;
  assert.equal(pullZombieGate(g, g.player, s), false);
  assert.equal(s.blastAt, 60);
});
test("Independent room timers keep gates nonblocking and respect finished matches", () => {
  const g = game(),
    shapes = JSON.stringify(g.map.shapes);
  pull(g, 0);
  g.time = 10;
  pull(g, 1);
  g.time = 60;
  updateZombieGates(g);
  assert.equal(g.zombieGates[0].state, "overheated");
  assert.equal(g.zombieGates[1].state, "locked");
  assert.equal(JSON.stringify(g.map.shapes), shapes);
  g.finished = true;
  Object.assign(g.player, g.zombieGates[2]);
  assert.equal(pullZombieGate(g, g.player, g.zombieGates[2]), false);
});
test("Domination is absent from mode selection and legacy constructors safely fall back", () => {
  assert.equal(MODES.domination, undefined);
  assert.equal(TEAM_MODES.includes("domination"), false);
  assert.equal(PLAY_MODES.includes("domination"), false);
  const g = new Combat({ mode: "domination" });
  assert.equal(g.mode, "duel");
  assert.deepEqual(g.flags, []);
});
