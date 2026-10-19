import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  recipe,
  combination,
  hasPassive,
  skillsFor,
  visibility,
  distance,
} from "../src/combat.js";
function arena(element = "light", rival = "earth") {
  const g = new Combat({ element, random: () => 0 });
  Object.assign(g.player, { x: 300, y: 300, fx: 1, fy: 0 });
  g.fighters[1] = makeFighter("enemy-0", rival, 1, 550, 300);
  return g;
}
function advance(g, s, input = { x: 0, y: 0 }, ai = false) {
  for (let t = 0; t < s - 1e-8; t += 0.01) g.update(0.01, input, ai);
}
test("all four new recipes fuse from touching allied tokens and retain their source skills", () => {
  for (const [base, token, expected] of [
    ["cloud", "light", "lightning"],
    ["spirit", "water", "lightning"],
    ["sun", "earth", "invincible"],
    ["mirror", "fire", "invincible"],
  ]) {
    assert.equal(combination(recipe(base), recipe(token)), expected);
    const g = arena(base),
      a = g.player;
    const ally = makeFighter("ally", token, 0, a.x, a.y);
    g.fighters.push(ally);
    g.fell(ally);
    assert.ok(g.touchTokens(a));
    assert.equal(a.element, expected);
    assert.ok(a.forms.includes(base) && a.forms.includes(token));
    assert.ok(hasPassive(a, expected));
    assert.equal(g.tokens.length, 0);
  }
});
test("Lightning strikes hit immediately without charging and respect range and cooldown", () => {
  const g = arena("lightning", "water"),
    a = g.player,
    b = g.fighters[1];
  assert.ok(g.startCharge(a));
  assert.equal(a.charging, false);
  assert.equal(a.charge, 0);
  assert.equal(b.hp, 81); // 26 base × hierarchy advantage 1.5.
  assert.equal(a.abilityCd, 4.5);
  assert.equal(g.projectiles.length, 0);
  assert.ok(g.effects.some((e) => e.kind === "lightning"));
  assert.equal(g.startCharge(a), false);
  assert.equal(b.hp, 81);
  g.releaseCharge(a);
  assert.equal(b.hp, 81);
  a.abilityCd = 0;
  b.x = 800;
  assert.equal(g.startCharge(a), false);
  assert.equal(a.abilityCd, 0);
});
test("Lightning chooses the nearest visible rival, cannot target concealed Divine, and doubles in flood", () => {
  const g = arena("lightning", "divine"),
    a = g.player,
    b = g.fighters[1];
  b.x = 350;
  assert.equal(g.startCharge(a), false);
  const other = makeFighter("visible", "earth", 1, 500, 300);
  g.fighters.push(other);
  g.hazards.push({ kind: "flood", x: 500, y: 300, r: 80, life: 5, owner: a });
  assert.ok(g.startCharge(a));
  assert.equal(other.hp, 81); // 52 × hard skin .75.
  assert.equal(b.hp, 120);
});
test("Shock stops walking, inertia, knockback and dashes only during contact; attacks still work", () => {
  const g = arena("blaze", "lightning"),
    a = g.player,
    b = g.fighters[1];
  b.x = 325;
  a.vx = 200;
  a.knockX = 500;
  a.burst = 0.3;
  g.move(a, 1, 0, 0.05);
  assert.equal(a.x, 300);
  assert.equal(a.vx, 0);
  assert.equal(a.burst, 0);
  assert.equal(g.utility(a), false);
  assert.ok(g.strike(a));
  advance(g, 0.15);
  assert.ok(b.hp < 120);
  b.x = 450;
  g.move(a, 1, 0, 0.05);
  assert.ok(a.x > 300);
});
test("Shock is inherited, affects allies, blocks teleport, and respects Divine immunity", () => {
  const g = arena("multi-dimensional", "lightning"),
    a = g.player,
    b = g.fighters[1];
  b.x = 325;
  b.team = 0;
  g.switchForm(b, "water");
  assert.ok(g.isShocked(a));
  assert.equal(g.teleport(a, 600, 400), false);
  b.x = 450;
  assert.ok(g.teleport(a, 600, 400));
  const divine = arena("divine", "lightning");
  divine.fighters[1].x = 325;
  assert.equal(divine.isShocked(divine.player), false);
  divine.move(divine.player, 1, 0, 0.05);
  assert.ok(divine.player.x > 300);
});
test("Invincible doubles melee and inherited ability damage without doubling reflected damage again", () => {
  const g = arena("invincible", "water"),
    a = g.player,
    b = g.fighters[1];
  b.x = 350;
  g.strike(a);
  advance(g, 0.15);
  assert.equal(b.hp, 92);
  b.hp = 120;
  g.switchForm(a, "fire");
  g.damage(a, b, 22, true);
  assert.equal(b.hp, 76);
  g.damage(b, a, 14);
  assert.equal(a.hp, 109.5); // Still takes melee damage, with hard skin.
  assert.deepEqual(skillsFor("invincible"), [null, null]);
  const mirror = makeFighter("mirror", "mirror", 1, 500, 400);
  g.fighters.push(mirror);
  const hp = a.hp;
  g.damage(a, mirror, 10, true);
  assert.equal(a.hp, hp - 15);
  assert.equal(mirror.hp, 120); // 10×2×.75, not doubled twice.
});
test("burn ends immediately on separation while Mud venom persists for five seconds", () => {
  const fire = arena("fire", "light"),
    b = fire.fighters[1];
  b.x = 320;
  advance(fire, 0.2);
  assert.ok(b.hp < 120);
  assert.equal(b.burn, 1);
  b.x = 550;
  const health = b.hp;
  advance(fire, 0.3);
  assert.equal(b.hp, health);
  assert.equal(b.burn, 0);
  const mud = arena("mud", "air"),
    victim = mud.fighters[1];
  victim.x = 320;
  advance(mud, 0.1);
  assert.ok(victim.venom > 0);
  victim.x = 550;
  const poisoned = victim.hp;
  advance(mud, 1);
  assert.ok(victim.hp < poisoned);
  assert.ok(victim.venom > 0);
  advance(mud, 4.1);
  const after = victim.hp;
  advance(mud, 0.2);
  assert.equal(victim.hp, after);
});
test("Divine damage gives a 150ms ten-percent glimpse without overriding action visibility", () => {
  const g = arena("water", "divine"),
    a = g.player,
    b = g.fighters[1];
  assert.equal(visibility(b), 0);
  g.damage(a, b, 14);
  assert.equal(visibility(b), 0.1);
  advance(g, 0.14);
  assert.equal(visibility(b), 0.1);
  advance(g, 0.02);
  assert.equal(visibility(b), 0);
  b.reveal = 0.4;
  g.damage(a, b, 14);
  assert.equal(visibility(b), 0.3);
  assert.ok(!g.events.some((e) => /^\d+$/.test(e.text))); // No lingering damage label exposes the position.
});
test("Light retreats while supporting but strikes throughout melee range, with healing first", () => {
  const g = arena("earth", "light"),
    a = g.fighters[1];
  a.x = 355;
  const before = distance(a, g.player);
  g.ai(a, 0.01);
  assert.ok(distance(a, g.player) > before);
  assert.ok(g.pending.some((p) => p.who === a));
  const heal = arena("earth", "light"),
    h = heal.fighters[1];
  h.x = 355;
  h.hp = 60;
  heal.ai(h, 0.01);
  assert.ok(h.charging);
  assert.equal(heal.pending.length, 0);
});
test("idle AI probes random remembered spaces, can hit hidden Divine, and never tracks hidden live coordinates", () => {
  const g = arena("divine", "earth"),
    a = g.fighters[1];
  a.x = 350;
  a.lastSeen = { x: 300, y: 300, until: 0, divine: true };
  a.abilityCd = 999;
  a.utilityCd = 999;
  let seed = 42;
  g.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.ai(a, 0.01);
  assert.ok(a.searchSpot);
  assert.ok(distance(a.searchSpot, a.lastSeen) <= 65);
  const remembered = { ...a.lastSeen };
  g.player.x = 800;
  const spots = new Set();
  for (let i = 0; i < 500; i++) {
    g.update(0.01, { x: 0, y: 0 }, true);
    if (a.searchSpot) spots.add(`${a.searchSpot.x},${a.searchSpot.y}`);
  }
  assert.deepEqual(a.lastSeen, remembered);
  assert.ok(spots.size > 1);
  // A deliberate remembered-space swing must resolve even with no visible target.
  a.x = 350;
  g.player.x = 300;
  a.fx = -1;
  a.fy = 0;
  a.attackCd = 0;
  g.pending = [];
  g.strike(a, { x: 300, y: 300 });
  advance(g, 0.15);
  assert.ok(g.player.hp < 120);
});
test("search swings still refuse to hit closer teammates and support takes priority over searching", () => {
  const g = arena("divine", "earth"),
    a = g.fighters[1];
  a.x = 350;
  a.lastSeen = { x: 300, y: 300, until: 0, divine: true };
  const ally = makeFighter("ally", "air", 1, 330, 300);
  g.fighters.push(ally);
  assert.equal(g.safeAttack(a, { x: 300, y: 300 }), false);
  const heal = arena("divine", "light"),
    h = heal.fighters[1];
  h.x = 350;
  h.hp = 40;
  h.lastSeen = { x: 300, y: 300, until: 0, divine: true };
  heal.ai(h, 0.01);
  assert.ok(h.charging);
  assert.equal(heal.pending.length, 0);
});
test("Multi-Dimensional has no Rift and teleport needs neither a skill activation nor cooldown", () => {
  const g = arena("multi-dimensional"),
    a = g.player;
  assert.deepEqual(skillsFor(a.element), [null, null]);
  assert.equal(g.startCharge(a), false);
  assert.equal(g.cast(a, 1), false);
  assert.ok(g.teleport(a, 500, 400));
  assert.ok(g.teleport(a, 300, 300));
  assert.equal(g.projectiles.length, 0);
  assert.equal(a.abilityCd, 0);
});
