import test from "node:test";
import assert from "node:assert/strict";
import { Combat } from "../src/combat.js";
import {
  passGridiron,
  lateralTargets,
  updateGridiron,
} from "../src/event-modes.js";
function setup(team = 0) {
  const g = new Combat({ mode: "gridiron" });
  const a = g.fighters.find((a) => a.team === team),
    allies = g.fighters.filter((b) => b.team === team && b !== a);
  g.fighters.forEach((b, i) => Object.assign(b, { x: 500 + i * 85, y: 800 }));
  Object.assign(a, { x: 900, y: 500 });
  const direction = team === 0 ? 1 : -1;
  Object.assign(allies[0], { x: 900, y: 650 });
  Object.assign(allies[1], { x: 900 - direction * 250, y: 500 });
  Object.assign(allies[2], { x: 900 + direction * 150, y: 500 });
  g.ball.carrier = a.id;
  return { g, a, allies };
}
function fly(g) {
  for (let i = 0; i < 100 && g.ball.pass; i++) {
    g.time += 0.02;
    updateGridiron(g);
  }
}
test("Pass chooses the furthest eligible sideways/backward teammate for either team", () => {
  for (const team of [0, 1]) {
    const { g, a, allies } = setup(team);
    assert.equal(lateralTargets(g, a).length, 2);
    assert.ok(passGridiron(g, a));
    assert.equal(g.ball.pass.target, allies[1].id);
    assert.equal(g.ball.carrier, null);
    fly(g);
    assert.equal(g.ball.carrier, allies[1].id);
  }
});
test("A specific teammate can receive a sideways pass; forward, enemy, shielded and dead targets are rejected", () => {
  const { g, a, allies } = setup();
  assert.equal(passGridiron(g, a, allies[2]), false);
  assert.equal(passGridiron(g, a, g.fighters[5]), false);
  allies[0].shield = 1;
  assert.equal(passGridiron(g, a, allies[0]), false);
  allies[0].shield = 0;
  allies[0].alive = false;
  assert.equal(passGridiron(g, a, allies[0]), false);
  allies[0].alive = true;
  assert.ok(passGridiron(g, a, allies[0]));
  fly(g);
  assert.equal(g.ball.carrier, allies[0].id);
});
test("A lateral can be intercepted and a missed catch leaves a loose ball", () => {
  const { g, a, allies } = setup();
  const defender = g.fighters[5];
  Object.assign(defender, { x: 780, y: 500 });
  passGridiron(g, a, allies[1]);
  fly(g);
  assert.equal(g.ball.carrier, defender.id);
  const next = setup();
  passGridiron(next.g, next.a, next.allies[0]);
  next.allies[0].y = 780;
  fly(next.g);
  assert.equal(next.g.ball.carrier, null);
  assert.equal(next.g.ball.pass, null);
  assert.equal(next.g.ball.y, 650);
});
test("Pass requires active possession and cannot start during countdown, imprisonment or after the match", () => {
  const { g, a } = setup();
  g.countdown = 2;
  assert.equal(passGridiron(g, a), false);
  g.countdown = 0;
  a.prisonHp = 10;
  assert.equal(passGridiron(g, a), false);
  a.prisonHp = 0;
  g.ball.carrier = null;
  assert.equal(passGridiron(g, a), false);
  g.ball.carrier = a.id;
  g.finished = true;
  assert.equal(passGridiron(g, a), false);
});
