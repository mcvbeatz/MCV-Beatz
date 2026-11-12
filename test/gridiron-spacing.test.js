import test from "node:test";
import assert from "node:assert/strict";
import { Combat, distance } from "../src/combat.js";
import { createEvergreenMap } from "../src/event-maps.js";
import { createCorruptionMap } from "../src/corruption-map.js";
const tick = (g, seconds) => {
  for (let i = 0; i < seconds * 50 && !g.finished; i++) g.update(0.02);
};
test("the three marked evergreen areas open in drawing, collision and navigation", () => {
  const old = createCorruptionMap({ portals: false, layoutSeed: 881923 });
  const map = createEvergreenMap();
  for (const [from, to] of [
    [41, 57],
    [60, 76],
    [63, 79],
    [48, 64],
  ]) {
    const a = map.cells[from],
      b = map.cells[to];
    assert.equal(old.lineClear(a, b, 14), false);
    assert.equal(map.lineClear(a, b, 14), true);
    assert.ok(map.walkable({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 14));
    assert.deepEqual(map.path(from, to), [from, to]);
  }
  assert.equal(old.walls.length - map.walls.length, 4);
  assert.ok(map.walls.some((w) => w.kind === "arc" && w.r === map.radius));
  assert.deepEqual(
    createCorruptionMap().walls,
    createCorruptionMap({ openings: [] }).walls,
  );
});
test("Gridiron attacks allow a closer ally behind the attacker but still protect allies in the swing", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0.99 });
  const a = g.fighters[1],
    ally = g.player,
    b = g.fighters[4];
  for (const f of g.fighters) Object.assign(f, { x: 1500, y: 800 });
  Object.assign(a, { x: 900, y: 550, fx: 1, fy: 0 });
  Object.assign(b, { x: 950, y: 550 });
  Object.assign(ally, { x: 880, y: 550 });
  assert.equal(g.safeAttack(a, b), true);
  ally.x = 925;
  assert.equal(g.safeAttack(a, b), false);
  // Friendly fire remains enabled; only the AI decides whether to take a swing.
  const hp = ally.hp;
  g.damage(a, ally, 10);
  assert.ok(ally.hp < hp);
});
test("Gridiron prioritizes an opposing carrier over a closer opponent in striking range", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0.99 }),
    a = g.player;
  Object.assign(a, { x: 900, y: 550 });
  Object.assign(g.fighters[4], { x: 920, y: 550 });
  Object.assign(g.fighters[5], { x: 950, y: 550 });
  g.ball.carrier = g.fighters[5].id;
  g.autoLock(a);
  assert.equal(a.lock, g.fighters[5].id);
});
test("overlapping Gridiron teams spread out and both attack instead of entering a stalemate", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0.99 });
  g.player.id = "bot"; // Exercise the same AI on all eight fighters.
  for (const a of g.fighters) Object.assign(a, { x: 900, y: 550 });
  g.ball.carrier = g.player.id;
  const hits = [0, 0],
    original = g.damage.bind(g);
  g.damage = (a, b, ...args) => {
    const before = b.hp + (b.shield ? b.shieldHp : 0);
    const result = original(a, b, ...args);
    if (a.team !== b.team && b.hp + (b.shield ? b.shieldHp : 0) < before)
      hits[a.team]++;
    return result;
  };
  tick(g, 10);
  assert.ok(hits[0] > 3, `team 0 hits: ${hits[0]}`);
  assert.ok(hits[1] > 3, `team 1 hits: ${hits[1]}`);
  const living = g.fighters.filter((a) => a.alive);
  for (let i = 0; i < living.length; i++)
    for (const b of living.slice(i + 1))
      assert.ok(
        distance(living[i], b) > 25,
        "living fighters should not remain stacked",
      );
  assert.ok(g.fighters.some((a) => a.hp < 120 || a.deaths > 0));
});
test("an Earth defender repositions and keeps attacking after three strikes", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0.99 });
  const a = g.fighters[4],
    carrier = g.player;
  g.fighters = [carrier, a];
  Object.assign(a, { x: 900, y: 550 });
  Object.assign(carrier, { x: 950, y: 550, hp: 10000, maxHp: 10000 });
  g.ball.carrier = carrier.id;
  tick(g, 10);
  assert.ok(carrier.hp < 10000 - 14 * 0.75 * 5, `remaining hp: ${carrier.hp}`);
});
