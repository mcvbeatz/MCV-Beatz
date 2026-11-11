import test from "node:test";
import assert from "node:assert/strict";
import { Combat, distance } from "./combat-fixture.js";
import { createCorruptionMap } from "../src/corruption-map.js";
function movable(g, a) {
  assert.ok(g.map.walkable(a, 16), "restored body has clearance from walls");
  const start = { x: a.x, y: a.y };
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    Object.assign(a, start);
    g.move(a, Math.cos(angle), Math.sin(angle), 0.05);
    if (distance(a, start) > 2) return;
  }
  assert.fail("restored fighter must be able to leave the recovery point");
}
function wallPoints(map) {
  return map.walls.map((w) =>
    w.kind === "line"
      ? { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 }
      : {
          x: map.cx + Math.cos((w.start + w.end) / 2) * w.r,
          y: map.cy + Math.sin((w.start + w.end) / 2) * w.r,
        },
  );
}
test("maze recovery keeps safe locations and repairs every wall midpoint, edge and invalid coordinate", () => {
  const map = createCorruptionMap({ portals: false });
  for (const p of map.cells) assert.deepEqual(map.nearest(p, 16), p);
  for (const p of [
    ...wallPoints(map),
    { x: 0, y: 0 },
    { x: map.cx + map.radius + 1000, y: map.cy },
    { x: NaN, y: Infinity },
  ]) {
    const recovered = map.nearest(p, 16);
    assert.ok(map.walkable(recovered, 16));
    assert.ok(map.cells.some((c) => map.path(recovered, c).length));
  }
});
test("Rebirth preserves a safe maze location that the old arena clamp moved into a wall", () => {
  const g = new Combat({ mode: "corruption" });
  for (const a of g.fighters.slice(0, 5)) g.corrupt(a);
  const a = g.fighters[5];
  const point = g.map.cells.find(
    (p) =>
      !g.map.walkable({
        x: Math.max(135, Math.min(889, p.x)),
        y: Math.max(175, Math.min(560, p.y)),
      }),
  );
  assert.ok(point, "exercise the original invalid clamping case");
  Object.assign(a, point, { hp: 1 });
  g.meleeDamage(g.player, a, 1);
  assert.ok(g.rebirthUsed.has(a.id));
  assert.equal(a.team, 0);
  assert.equal(a.hp, 1);
  assert.deepEqual({ x: a.x, y: a.y }, point);
  movable(g, a);
});
test("Spirit restores living and felled Dark fighters from walls onto movable maze floor", () => {
  for (const dead of [false, true]) {
    const g = new Combat({ mode: "corruption" });
    for (const a of g.fighters.slice(0, 7)) g.corrupt(a);
    const spirit = g.fighters[7],
      oldest = g.player;
    Object.assign(oldest, wallPoints(g.map)[0]);
    if (dead) g.fell(oldest);
    assert.equal(g.map.walkable(oldest), false);
    assert.ok(g.revive(spirit));
    assert.equal(oldest.element, "light");
    assert.equal(oldest.alive, true);
    assert.equal(oldest.hp, 2);
    assert.equal(oldest.respawnAt, undefined);
    movable(g, oldest);
  }
});
test("Dark and Smoke respawns repair unsafe saved spawn points and remain mobile", () => {
  for (const element of ["dark", "smoke"]) {
    const g = new Combat({ mode: "corruption" });
    g.corrupt(g.player);
    if (element === "smoke") g.nightForm(g.player, "smoke", 1);
    const a = g.player;
    Object.assign(a.spawn, wallPoints(g.map).at(-1));
    g.fell(a);
    g.respawn(a);
    assert.equal(a.element, element);
    movable(g, a);
  }
});
