import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  canHit,
  multiplier,
  combination,
} from "../src/combat.js";
const duel = () => {
  const g = new Combat({ element: "light", random: () => 0.5 });
  const [a, b] = g.fighters;
  a.x = 400;
  a.y = 300;
  b.x = 450;
  b.y = 300;
  a.fx = 1;
  b.fx = -1;
  a.fy = b.fy = 0;
  return g;
};
const advance = (g, s) => {
  for (let t = 0; t < s; t += 0.01) g.update(0.01, { x: 0, y: 0 }, false);
};
test("melee hits only within range and facing direction", () => {
  const g = duel(),
    [a, b] = g.fighters;
  assert.ok(canHit(a, b));
  a.fx = -1;
  assert.equal(canHit(a, b), false);
  a.fx = 1;
  b.x = 500;
  assert.equal(canHit(a, b), false);
  b.x = 450;
  g.strike(a);
  advance(g, 0.15);
  assert.equal(b.hp, 106);
});
test("contested mutual strikes deal quarter damage to both", () => {
  const g = duel(),
    [a, b] = g.fighters;
  g.strike(a);
  advance(g, 0.04);
  g.strike(b);
  advance(g, 0.15);
  assert.equal(a.hp, 116.5);
  assert.equal(b.hp, 116.5);
  assert.equal(g.pending.length, 0);
});
test("strikes outside clash window resolve at full damage", () => {
  const g = duel(),
    [a, b] = g.fighters;
  g.strike(a);
  advance(g, 0.15);
  g.strike(b);
  advance(g, 0.15);
  assert.equal(a.hp, 106);
  assert.equal(b.hp, 106);
});
test("friendly fire damages teammates", () => {
  const g = duel();
  const ally = makeFighter("ally", "water", 0, 440, 300);
  g.fighters.push(ally);
  g.strike(g.player);
  advance(g, 0.15);
  assert.equal(ally.hp, 106);
});
test("target lock permits strafing and faces rival in range", () => {
  const g = duel(),
    [a, b] = g.fighters;
  g.toggleLock(a);
  g.move(a, 0, 1, 0.1);
  assert.equal(a.x, 400);
  assert.ok(a.y > 300);
  assert.ok(a.fx > 0.9);
  assert.ok(a.fy < 0);
  assert.equal(a.lock, b.id);
});
test("low health slows movement; flight has inertia", () => {
  const g = duel();
  const healthy = makeFighter("a", "water", 0, 300, 300),
    hurt = makeFighter("b", "water", 0, 300, 300),
    air = makeFighter("c", "air", 0, 300, 300);
  hurt.hp = 10;
  g.move(healthy, 1, 0, 0.1);
  g.move(hurt, 1, 0, 0.1);
  assert.ok(healthy.x > hurt.x);
  for (let i = 0; i < 20; i++) g.move(air, 1, 0, 0.05);
  g.move(air, -1, 0, 0.05);
  assert.ok(air.vx > 0);
});
test("hits interrupt charge growth without deleting stored charge", () => {
  const g = duel(),
    [a, b] = g.fighters;
  g.startCharge(b);
  advance(g, 0.6);
  const charged = b.charge;
  g.damage(a, b, 14);
  assert.ok(b.charging);
  advance(g, 0.1);
  assert.equal(b.charge, charged);
  advance(g, 0.4);
  assert.ok(b.charge > charged);
});
test("longer charge strengthens abilities and enforces cooldown", () => {
  const g = duel(),
    [a, b] = g.fighters;
  g.startCharge(b);
  advance(g, 1.81);
  g.releaseCharge(b);
  assert.ok(g.projectiles[0].damage > 50);
  assert.equal(b.abilityCd, 4.5);
  assert.equal(g.startCharge(b), false);
});
test("same-element ability resistance and hierarchy are independent", () => {
  assert.equal(multiplier("water", "water"), 0.5);
  assert.equal(multiplier("water", "water", false), 1);
  assert.equal(multiplier("water", "fire"), 1.5);
  assert.equal(multiplier("fire", "earth"), 1.5);
});
test("fallen ally token fuses once, retains passives, and cycles forms", () => {
  const g = duel(),
    [a, b] = g.fighters;
  const ally = makeFighter("ally", "air", 0, 410, 310);
  g.fighters.push(ally);
  g.damage(b, ally, 1000);
  assert.equal(g.tokens.length, 1);
  assert.ok(g.fuse(a));
  assert.equal(a.element, "spirit");
  assert.equal(g.tokens.length, 0);
  assert.ok(g.flying(a));
  g.switchForm(a);
  assert.equal(a.element, "light");
  assert.ok(g.flying(a));
  assert.equal(g.fuse(a), false);
});
test("enemy and incompatible tokens cannot be fused", () => {
  const g = duel();
  g.tokens.push({ x: 400, y: 300, team: 1, parts: ["air"] });
  assert.equal(g.fuse(g.player), false);
  assert.equal(combination(["light"], ["water"]), null);
});
test("level three fusion merges compatible origins only", () => {
  const g = duel();
  g.applyFusion(g.player, ["air"]);
  assert.ok(g.applyFusion(g.player, ["earth"]));
  assert.equal(g.player.element, "divine");
  assert.equal(g.player.parts.length, 3);
  assert.equal(g.applyFusion(g.player, ["earth"]), false);
});
test("earth shield absorbs damage and breaks; water clears magma", () => {
  const g = new Combat({ element: "earth" });
  const [a, b] = g.fighters;
  g.utility(a);
  g.damage(b, a, 20);
  assert.equal(a.hp, 120);
  assert.equal(a.shieldHp, 50);
  g.damage(b, a, 100);
  assert.equal(a.shield, 0);
  assert.equal(a.hp, 95);
  g.hazards.push({
    kind: "magma",
    owner: a,
    x: b.x,
    y: b.y,
    r: 60,
    life: Infinity,
    tick: 0,
    power: 1,
  });
  advance(g, 0.02);
  assert.equal(g.hazards.length, 0);
});
test("all formats construct the correct teams and finish on elimination", () => {
  for (const n of [2, 3, 4]) {
    const g = new Combat({ mode: "team", size: n });
    assert.equal(g.fighters.length, n * 2);
  }
  const g = new Combat({ mode: "fused" });
  assert.equal(g.player.parts.length, 2);
  g.damage(g.player, g.fighters[1], 10000);
  advance(g, 0.02);
  assert.equal(g.result, "victory");
});
test("shield release starts cooldown and cannot reset its hold budget", () => {
  const g = new Combat({ element: "earth" });
  g.utility(g.player);
  advance(g, 1);
  g.utility(g.player, false);
  assert.equal(g.player.shield, 0);
  assert.equal(g.player.utilityCd, 5);
  g.utility(g.player);
  assert.equal(g.player.shield, 0);
});
test("all selectable elements complete simulated AI matches without invalid state", () => {
  for (const element of ["light", "dark", "water", "air", "earth", "fire"]) {
    const g = new Combat({ element, mode: "team", size: 4, random: () => 0.4 });
    for (let i = 0; i < 6000 && !g.finished; i++) {
      g.ai(g.player, 0.05);
      g.update(0.05);
    }
    assert.ok(g.finished, `${element} match did not finish`);
    assert.ok(
      g.fighters.every(
        (a) =>
          Number.isFinite(a.hp) && Number.isFinite(a.x) && Number.isFinite(a.y),
      ),
    );
  }
});
