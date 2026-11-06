import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
const cage = () => {
  const g = new Combat({ mode: "duel", element: "multi-dimensional" });
  Object.assign(g.player, { x: 400, y: 350, prisonHp: 65 });
  g.fighters = [g.player, makeFighter("enemy", "water", 1, 800, 350)];
  return g;
};
test("Multi-Dimensional leaves its cage only on successful teleport and the empty cage expires after its collapse", () => {
  const g = cage(),
    a = g.player;
  assert.equal(g.teleport(a, 420, 350), false);
  assert.ok(g.teleport(a, 560, 350));
  g.updateTeleport(a, 0.1);
  assert.equal(a.prisonHp, 65);
  assert.equal(a.x, 400);
  g.updateTeleport(a, 0.1);
  assert.equal(a.prisonHp, 0);
  assert.equal(a.x, 560);
  const e = g.effects.find((e) => e.kind === "empty-prison");
  assert.deepEqual({ x: e.x, y: e.y }, { x: 400, y: 350 });
  assert.equal(e.life, 2.65);
  for (let i = 0; i < 39; i++) g.update(0.05, { x: 0, y: 0 }, false);
  assert.ok(g.effects.includes(e));
  assert.ok(e.max - e.life < 2);
  for (let i = 0; i < 15; i++) g.update(0.05, { x: 0, y: 0 }, false);
  assert.ok(!g.effects.includes(e));
});
test("cancelled prison escape keeps the cage attached and creates no empty shell", () => {
  const g = cage(),
    a = g.player;
  assert.ok(g.teleport(a, 560, 350));
  a.knockX = 30;
  g.updateTeleport(a, 0.2);
  assert.equal(a.blink, null);
  assert.equal(a.prisonHp, 65);
  assert.equal(a.x, 400);
  assert.ok(!g.effects.some((e) => e.kind === "empty-prison"));
});
test("Multi-Dimensional AI teleports out, and breaking a cage during wind-up leaves no duplicate cage", () => {
  const g = cage(),
    a = g.player;
  g.ai(a, 0.05);
  assert.ok(a.blink);
  g.updateTeleport(a, 0.2);
  assert.equal(a.prisonHp, 0);
  const h = cage();
  assert.ok(h.teleport(h.player, 560, 350));
  h.player.prisonHp = 0;
  h.updateTeleport(h.player, 0.2);
  assert.ok(!h.effects.some((e) => e.kind === "empty-prison"));
});
