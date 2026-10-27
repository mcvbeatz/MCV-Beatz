import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, hasPassive, distance } from "../src/combat.js";
import { createCorruptionMap } from "../src/corruption-map.js";
import { cameraView } from "../src/camera.js";
const tick = (g, s, AI = false) => {
  for (let t = 0; t < s - 1e-8 && !g.finished; t += 0.02)
    g.update(0.02, { x: 0, y: 0 }, AI);
};
test("Corruption has four times the world area, a connected circular maze and safe spawns", () => {
  const m = createCorruptionMap();
  assert.equal(m.width * m.height, 4 * 1024 * 680);
  assert.ok(Math.abs((Math.PI * m.radius ** 2) / (754 * 385) - 4) < 0.01);
  assert.equal(m.cells.length, 81);
  for (let i = 0; i < m.cells.length; i++) {
    assert.ok(m.walkable(m.cells[i]));
    assert.ok(m.path(i, 80, false).length);
    for (const j of m.graph[i])
      assert.ok(m.lineClear(m.cells[i], m.cells[j], 14), `${i}->${j}`);
  }
  for (let n = 2; n <= 8; n++)
    for (let i = 0; i < n; i++) assert.ok(m.walkable(m.spawn(i, n)));
  const normal = new Combat({ mode: "duel" });
  assert.equal(normal.map, null);
});
test("maze walls stop movement and attacks, including high-speed steps", () => {
  const g = new Combat({ mode: "corruption", players: 3 }),
    m = g.map;
  const wall = m.walls.find((w) => w.kind === "line");
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const length = distance(wall.a, wall.b),
    nx = -(wall.b.y - wall.a.y) / length,
    ny = (wall.b.x - wall.a.x) / length;
  const a = g.player,
    b = g.fighters[1];
  Object.assign(a, {
    x: mid.x + nx * 24,
    y: mid.y + ny * 24,
    fx: -nx,
    fy: -ny,
  });
  Object.assign(b, { x: mid.x - nx * 24, y: mid.y - ny * 24 });
  g.corrupt(b);
  assert.ok(m.walkable(a));
  assert.ok(m.walkable(b));
  assert.equal(m.lineClear(a, b), false);
  const hp = b.hp;
  g.strike(a);
  g.time += 0.12;
  g.resolveStrikes();
  assert.equal(b.hp, hp);
  m.move(a, b.x, b.y);
  assert.ok(m.walkable(a));
  assert.ok(distance(a, b) > 30);
  assert.equal(g.autoLock(a), undefined);
  assert.equal(a.lock, null);
});
test("fixed maze portals transport every fighter, have safe exits and avoid immediate ping-pong", () => {
  const g = new Combat({ mode: "corruption", players: 4 }),
    a = g.player;
  const [entry, exit] = g.portals.portals;
  assert.equal(g.portals.portals.length, 2);
  assert.ok(entry.environment);
  Object.assign(a, { x: entry.x, y: entry.y });
  assert.equal(g.portals.enter(a, { x: entry.x - 30, y: entry.y }), true);
  assert.ok(a.transit);
  g.portals.tick(a, 0.19);
  assert.equal(a.transit, null);
  assert.ok(distance(a, exit) < 50);
  assert.ok(g.map.walkable(a));
  assert.equal(g.portals.enter(a, a), false);
  assert.equal(g.portals.close(a, entry.id), false);
  assert.equal(
    g.map.path(g.map.portalCells[0], g.map.portalCells[1]).length,
    2,
  );
});
test("Corruption navigation advances through corridors and its simulation never leaves the floor", () => {
  const g = new Combat({ mode: "corruption", players: 8, random: () => 0.5 });
  const before = g.fighters.map((a) => ({ x: a.x, y: a.y }));
  tick(g, 18, true);
  assert.ok(g.fighters.every((a) => g.map.walkable(a)));
  assert.ok(
    g.fighters.filter((a, i) => distance(a, before[i]) > 60).length >= 4,
  );
  assert.ok(g.fighters.some((a) => a.element === "dark"));
  assert.equal(g.finished, false);
});
test("maze camera follows the player in both orientations and clamps at map edges", () => {
  const map = createCorruptionMap();
  for (const [w, h, portrait] of [
    [844, 350, false],
    [320, 275, true],
  ]) {
    const a = cameraView(w, h, {
      map,
      portrait,
      screenWidth: 844,
      screenHeight: 390,
      focus: { x: 1024, y: 680 },
    });
    const b = cameraView(w, h, {
      map,
      portrait,
      screenWidth: 844,
      screenHeight: 390,
      focus: { x: 1024, y: 850 },
    });
    assert.ok(b.ty < a.ty);
    assert.ok(a.scale >= 0.6);
    const p = { x: map.bounds.left, y: map.bounds.top };
    const edge = cameraView(w, h, { map, portrait, focus: p });
    assert.ok(Math.abs(p.x * edge.scale + edge.tx) < 1e-6);
    assert.ok(Math.abs(p.y * edge.scale + edge.ty) < 1e-6);
  }
});
test("FFA uses ten-second respawns but a sole survivor wins before pending respawns", () => {
  const g = new Combat({ mode: "ffa", players: 4, random: () => 0.2 });
  assert.equal(g.timeLimit, 180);
  assert.equal(g.respawnDelay, 10);
  g.fell(g.player);
  assert.equal(g.player.respawnAt, 10);
  tick(g, 9.98);
  assert.equal(g.player.alive, false);
  tick(g, 0.04);
  assert.equal(g.player.alive, true);
  for (const a of g.fighters.slice(1)) g.fell(a);
  assert.equal(g.checkMatchEnd(), true);
  assert.equal(g.result, "victory");
});
test("FFA full wipes can respawn, and timeout chooses the kill leader even while felled", () => {
  const g = new Combat({ mode: "ffa", players: 3 });
  for (const a of g.fighters) g.fell(a);
  assert.equal(g.checkMatchEnd(), false);
  tick(g, 10.02);
  assert.ok(g.fighters.every((a) => a.alive));
  g.time = 179;
  g.player.kills = 8;
  g.fell(g.player);
  g.time = 180;
  g.checkMatchEnd();
  assert.equal(g.result, "victory");
  const tie = new Combat({ mode: "ffa", players: 3 });
  tie.time = 180;
  tie.checkMatchEnd();
  assert.equal(tie.result, "draw");
});
test("Death cannot demote during its half-second opening and still fires once per entry", () => {
  const g = new Combat({ mode: "duel", element: "demonic" });
  g.utility(g.player);
  const h = g.hazards[0],
    b = g.fighters[1];
  Object.assign(b, makeFighter(b.id, "divine", 1, h.x, h.y));
  assert.equal(h.opensAt, 0.5);
  g.time = 0.499;
  g.updateHazards(0.01);
  assert.equal(b.element, "divine");
  g.time = 0.5;
  g.updateHazards(0.01);
  assert.equal(b.element, "mirror");
  g.updateHazards(1);
  assert.equal(b.element, "mirror");
});
test("Sanctuary venomous contact persists after separation and tints only actual poison damage", () => {
  const g = new Combat({ mode: "duel", element: "sanctuary" }),
    a = g.player,
    b = g.fighters[1];
  Object.assign(b, makeFighter(b.id, "air", 1, a.x + 20, a.y));
  assert.equal(hasPassive(a, "mud"), true);
  g.switchForm(a, "light");
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.ok(b.venom > 0);
  b.x += 200;
  const hp = b.hp;
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.ok(b.hp < hp);
  assert.ok(b.venomTint > 0);
  const poisoned = b.hp;
  const guardian = makeFighter("guardian", "sanctuary", 1, 800, 400);
  g.fighters.push(guardian);
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.equal(b.hp, poisoned);
  assert.equal(b.venom, 0);
  assert.equal(b.venomTint, 0);
});

test("Light maze AI regains defensive actions after repositioning out of its three-action limit", () => {
  const g = new Combat({ mode: "corruption", players: 3 });
  const a = g.fighters[1];
  Object.assign(a, {
    x: 1024,
    y: 680,
    aiNeedChange: true,
    aiLastGesture: "strike",
    aiRepeat: 3,
    mazeActionOrigin: { x: 970, y: 680 },
  });
  g.corrupt(g.player);
  g.aiMazeCorruption(a, 0.01);
  assert.equal(a.aiNeedChange, false);
  assert.equal(a.aiLastGesture, "reposition");
  assert.equal(g.aiGesture(a, "strike"), true);
});
