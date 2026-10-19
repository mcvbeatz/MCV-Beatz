import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  skillsFor,
  LEVEL_THREE,
  visibility,
  distance,
} from "../src/combat.js";
import { fighterColor } from "../src/render.js";
const advance = (g, s, input = { x: 0, y: 0 }, ai = false) => {
  for (let t = 0; t < s - 1e-8; t += 0.01) g.update(0.01, input, ai);
};
function arena(element = "blaze", enemy = "light") {
  const g = new Combat({ element, random: () => 0 });
  Object.assign(g.player, { x: 300, y: 300, fx: 1, fy: 0 });
  g.fighters[1] = makeFighter("enemy-0", enemy, 1, 700, 300);
  return g;
}
test("Blaze and Smoke expose only their requested fused skill; Gravity is purple everywhere", () => {
  assert.deepEqual(skillsFor("blaze"), [null, "Speed burst"]);
  assert.deepEqual(skillsFor("smoke"), ["Vog", null]);
  assert.equal(fighterColor({ parts: ["earth", "dark"] }), "#9254ce");
  const g = arena();
  assert.equal(g.startCharge(g.player), false);
  assert.equal(g.cast(g.player, 1), false);
  assert.equal(g.projectiles.length, 0);
});
test("level III mode accepts every third-tier fusion and randomizes within its own tier", () => {
  assert.deepEqual(
    new Set(LEVEL_THREE),
    new Set([
      "demonic",
      "divine",
      "multi-dimensional",
      "lightning",
      "invincible",
    ]),
  );
  for (const element of LEVEL_THREE)
    for (let i = 0; i < LEVEL_THREE.length; i++) {
      const g = new Combat({
        mode: "fused3",
        element,
        random: () => i / LEVEL_THREE.length,
      });
      assert.equal(g.player.element, element);
      assert.equal(g.fighters[1].element, LEVEL_THREE[i]);
      assert.equal(g.player.parts.length, 3);
    }
  assert.ok(
    LEVEL_THREE.includes(
      new Combat({ mode: "fused3", element: "fire" }).player.element,
    ),
  );
});
test("Speed burst hits enemies AND allies once, stops burning after contact, and immediately repeats", () => {
  const g = arena(),
    a = g.player,
    b = g.fighters[1];
  b.x = 380;
  const ally = makeFighter("ally", "earth", 0, 430, 300);
  g.fighters.push(ally);
  a.utilityCd = 6; // Origin cooldown cannot block this zero-cooldown fused skill.
  assert.ok(g.utility(a));
  advance(g, 0.3);
  assert.ok(a.x >= 490 && a.x <= 496);
  assert.ok(b.hp < 98 && b.hp > 95);
  assert.ok(ally.hp < 104 && ally.hp > 101);
  assert.equal(b.burn, 0);
  assert.equal(ally.burn, 0);
  assert.ok(g.effects.some((e) => e.kind === "flame-trail"));
  assert.equal(a.burst, 0);
  const health = b.hp;
  advance(g, 0.5);
  assert.equal(b.hp, health);
  assert.ok(g.utility(a));
  assert.equal(a.burst, 0.3);
});
test("burst impact still hurts burn-immune Fire and Water, without applying burn", () => {
  for (const element of ["fire", "water"]) {
    const g = arena("blaze", element),
      b = g.fighters[1];
    b.x = 380;
    g.utility(g.player);
    advance(g, 0.3);
    assert.equal(b.hp, 98);
    assert.equal(b.burn, 0);
  }
  const g = arena("blaze", "divine");
  g.fighters[1].x = 380;
  g.utility(g.player);
  advance(g, 0.3);
  assert.equal(g.fighters[1].burn, 0); // Inherited Reflect may return impact damage.
});
test("burst sweep cannot skip a fighter between frames or burn through an intact rock shield", () => {
  const g = arena("blaze", "earth"),
    a = g.player,
    b = g.fighters[1];
  b.x = 345;
  g.utility(b);
  g.utility(a);
  g.update(0.05, { x: 0, y: 0 }, false);
  assert.ok(b.shieldHp < 65);
  assert.equal(b.hp, 120);
  assert.equal(b.burn, 0);
});
test("Healing chooses the lowest absolute HP living teammate, including self, at release", () => {
  const g = arena("light"),
    a = g.player;
  a.hp = 80;
  g.fighters[1].hp = 1;
  const low = makeFighter("low", "earth", 0, 800, 500);
  low.hp = 20;
  const other = makeFighter("other", "air", 0, 330, 300);
  other.hp = 40;
  other.maxHp = 240;
  const dead = makeFighter("dead", "fire", 0, 310, 300);
  dead.alive = false;
  dead.hp = 0;
  g.fighters.push(low, other, dead);
  g.cast(a, 1);
  assert.equal(low.hp, 43);
  assert.equal(a.hp, 80);
  assert.equal(other.hp, 40);
  g.cast(a, 1);
  assert.equal(other.hp, 63);
  a.hp = 5;
  g.cast(a, 1);
  assert.equal(a.hp, 28);
  assert.equal(g.fighters[1].hp, 1);
  assert.equal(dead.hp, 0);
});
test("Divine is hidden at rest, pulses at 10% each second of continuous motion, and resets on stopping", () => {
  const g = arena("divine"),
    a = g.player;
  assert.equal(visibility(a), 0);
  advance(g, 0.99, { x: 1, y: 0 });
  assert.equal(visibility(a), 0);
  advance(g, 0.04, { x: 1, y: 0 });
  assert.equal(visibility(a), 0.1);
  advance(g, 0.2, { x: 1, y: 0 });
  assert.equal(visibility(a), 0);
  advance(g, 0.79, { x: 1, y: 0 });
  assert.equal(visibility(a), 0.1);
  advance(g, 0.01);
  assert.equal(visibility(a), 0);
  advance(g, 0.3, { x: -1, y: 0 });
  assert.equal(visibility(a), 0);
});
test("Divine attacks, held abilities and inherited skills reveal only 30%, then disappear", () => {
  const g = arena("divine"),
    a = g.player;
  g.strike(a);
  assert.equal(visibility(a), 0.3);
  advance(g, 0.5);
  assert.equal(visibility(a), 0);
  g.startCharge(a);
  assert.equal(visibility(a), 0.3);
  advance(g, 0.6);
  assert.equal(visibility(a), 0.3);
  g.releaseCharge(a);
  assert.equal(visibility(a), 0.3);
  advance(g, 0.5);
  assert.equal(visibility(a), 0);
  g.switchForm(a, "earth");
  g.utility(a);
  assert.equal(visibility(a), 0.3);
  g.utility(a, false);
  advance(g, 0.5);
  assert.equal(visibility(a), 0);
});
test("hidden Divine cannot be locked or tracked by AI but can still be physically hit", () => {
  const g = arena("water", "divine"),
    a = g.player,
    b = g.fighters[1];
  b.x = 350;
  g.autoLock(a);
  assert.equal(a.lock, null);
  g.ai(a, 0.01);
  assert.equal(a.charging, false);
  assert.equal(g.pending.length, 0);
  b.reveal = 0.3;
  g.autoLock(a);
  assert.equal(a.lock, b.id);
  g.ai(a, 0.01);
  const seen = { ...a.lastSeen };
  b.reveal = 0;
  b.x = 800;
  g.ai(a, 0.01);
  assert.equal(a.lastSeen.x, seen.x);
  b.x = 350;
  a.aiControlled = false;
  g.strike(a);
  advance(g, 0.15);
  assert.ok(b.hp < 120);
  assert.equal(visibility(b), 0.1);
});
test("Fire closes to contact-burn distance while equal-health Light creates space", () => {
  const fire = arena("water", "fire"),
    f = fire.fighters[1];
  f.x = 400;
  const before = distance(f, fire.player);
  fire.ai(f, 0.05);
  assert.ok(distance(f, fire.player) < before);
  const light = arena("fire", "light"),
    l = light.fighters[1];
  l.x = 400;
  const gap = distance(l, light.player);
  light.ai(l, 0.05);
  assert.ok(distance(l, light.player) > gap);
  assert.ok(light.player.blind > 0);
});
test("Light prioritizes healing its wounded teammate and attacks when it has a health advantage", () => {
  const g = arena("fire", "light"),
    a = g.fighters[1];
  a.x = 500;
  const ally = makeFighter("patient", "earth", 1, 600, 400);
  ally.hp = 20;
  g.fighters.push(ally);
  g.ai(a, 0.01);
  assert.ok(a.charging);
  advance(g, 0.5, { x: 0, y: 0 }, true);
  assert.ok(ally.hp > 20);
  const duel = arena("fire", "light"),
    l = duel.fighters[1];
  l.x = 350;
  duel.player.hp = 60;
  duel.ai(l, 0.01);
  assert.ok(duel.pending.some((p) => p.who === l));
});
test("AI declines melee and ranged attacks near a closer ally and repositions", () => {
  const g = arena("water", "fire"),
    a = g.fighters[1];
  a.x = 355;
  const ally = makeFighter("ally", "earth", 1, 340, 300);
  g.fighters.push(ally);
  g.ai(a, 0.05);
  assert.equal(g.pending.length, 0);
  assert.equal(a.charging, false);
  assert.ok(Math.abs(a.y - 300) > 0);
  assert.equal(g.safeAttack(a, g.player, "ability", "fire"), false);
  // A farther ally behind the target is also unsafe for a piercing beam.
  ally.x = 220;
  a.fx = -1;
  a.fy = 0;
  assert.equal(g.safeAttack(a, g.player, "ability", "sun"), false);
});
test("AI cancels a wind-up if an ally walks into the strike before impact", () => {
  const g = arena("water", "earth"),
    a = g.fighters[1];
  a.x = 350;
  g.ai(a, 0);
  assert.ok(g.pending.length);
  const ally = makeFighter("ally", "air", 1, 330, 300);
  g.fighters.push(ally);
  advance(g, 0.15);
  assert.equal(ally.hp, 120);
  assert.equal(g.player.hp, 120);
});
test("AI protects endangered teammates and steps away from damaging floor effects", () => {
  const g = arena("water", "earth"),
    a = g.fighters[1];
  a.x = 500;
  const endangered = makeFighter("ally", "water", 1, 620, 310);
  endangered.hp = 20;
  const threat = makeFighter("threat", "fire", 0, 610, 300);
  g.fighters.push(endangered, threat);
  g.ai(a, 0.01);
  assert.equal(a.lastSeen.x, threat.x);
  g.hazards.push({
    x: a.x + 5,
    y: a.y,
    kind: "magma",
    r: 66,
    owner: g.player,
    life: 10,
  });
  const before = a.x;
  g.ai(a, 0.05);
  assert.ok(a.x < before);
});

test("Fire actually reaches passive burn range instead of stopping at its edge", () => {
  const g = arena("light", "fire"),
    a = g.fighters[1];
  a.x = 400;
  a.attackCd = a.abilityCd = a.utilityCd = 999;
  advance(g, 2, { x: 0, y: 0 }, true);
  assert.ok(distance(a, g.player) < 30);
  assert.ok(g.player.hp < 120);
});
