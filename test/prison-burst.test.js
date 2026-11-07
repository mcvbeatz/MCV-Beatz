import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
function cage(element = "blaze") {
  const g = new Combat({ mode: "duel", element });
  Object.assign(g.player, { x: 400, y: 350, fx: 1, fy: 0, prisonHp: 65 });
  g.fighters = [g.player, makeFighter("enemy", "water", 1, 420, 350)];
  return g;
}
test("trapped Speed burst damages the cage once, holds position and cannot hit nearby fighters through it", () => {
  for (const element of ["blaze", "phoenix", "demonic"]) {
    const g = cage(element),
      a = g.player,
      enemy = g.fighters[1];
    assert.ok(g.utility(a, true, "blaze"));
    assert.equal(a.prisonHp, 43);
    assert.equal(a.burst, 0.3);
    for (let i = 0; i < 4; i++) assert.ok(g.utility(a, true, "blaze"));
    assert.equal(a.prisonHp, 43);
    g.move(a, 1, 0, 0.1);
    assert.equal(a.x, 400);
    assert.equal(a.burst, 0.3);
    g.updateBurst(a, { x: 400, y: 350 }, 0.1);
    assert.ok(a.burst > 0 && a.burst < 0.3);
    assert.equal(enemy.hp, 120);
    assert.equal(a.hp, 120);
    assert.ok(!g.effects.some((e) => e.kind === "flame-trail"));
    g.updateBurst(a, a, 0.3);
    assert.ok(g.utility(a, true, "blaze"));
    assert.equal(a.prisonHp, 21);
    g.updateBurst(a, a, 0.3);
    assert.ok(g.utility(a, true, "blaze"));
    assert.equal(a.prisonHp, 0);
    g.move(a, 1, 0, 0.05);
    assert.ok(a.x > 400);
  }
});
test("Shock and Sabotage cannot damage a prison with an unavailable burst", () => {
  const g = cage(),
    a = g.player;
  g.fighters.push(makeFighter("shock", "lightning", 1, 401, 350));
  assert.equal(g.utility(a, true, "blaze"), false);
  assert.equal(a.prisonHp, 65);
  g.fighters.pop();
  a.sabotaged = true;
  assert.equal(g.utility(a, true, "blaze"), false);
  assert.equal(a.prisonHp, 65);
  assert.equal(a.burst, 0);
});
test("AI can break its cage with timed bursts without waiting for a new cooldown", () => {
  const g = cage("demonic"),
    a = g.player;
  for (let i = 0; i < 3; i++) {
    g.ai(a, 0.05);
    assert.equal(a.prisonHp, Math.max(0, 65 - 22 * (i + 1)));
    g.updateBurst(a, { x: a.x, y: a.y }, 0.3);
  }
  assert.equal(a.prisonHp, 0);
});
