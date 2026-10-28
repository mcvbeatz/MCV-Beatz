import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  VOG_RADIUS,
  FLASH_RADIUS,
  FLOOD_WATER_SPEED,
  quicksandImmune,
} from "../src/combat.js";
import { immersionFor } from "../src/battle-effects.js";
import { TEAM_MODES } from "../src/mode-catalog.js";
const arena = (element = "water") => {
  const g = new Combat({ element, random: () => 0.2 });
  g.player.x = 400;
  g.player.y = 350;
  g.fighters[1] = makeFighter("enemy", "light", 1, 820, 500);
  return g;
};
const flood = (g) => ({
  kind: "flood",
  owner: g.fighters[1],
  x: 400,
  y: 350,
  r: 90,
  life: 8,
  tick: 0,
  power: 1,
  element: "cloud",
});
test("Water gains 25% movement in live Flood, ignores its slow, and retains other slowing effects", () => {
  const g = arena(),
    a = g.player;
  g.hazards = [flood(g), flood(g)];
  g.updateHazards(0.01);
  assert.equal(a.slow, 0);
  assert.equal(g.mobilitySafe(a, { x: 430, y: 350 }), true);
  g.move(a, 1, 0, 0.01);
  assert.equal(a.vx, 150 * FLOOD_WATER_SPEED);
  a.slow = 0.5;
  g.move(a, 1, 0, 0.01);
  assert.equal(a.vx, 150 * FLOOD_WATER_SPEED * 0.48);
  a.slow = 0;
  a.x = 650;
  g.move(a, 1, 0, 0.01);
  assert.equal(a.vx, 150);
  a.x = 400;
  g.hazards.forEach((h) => (h.life = 0));
  g.move(a, 1, 0, 0.01);
  assert.equal(a.vx, 150);
});
test("Water's Flood affinity survives fusion and skill switching, including allied Flood", () => {
  for (const element of ["mud", "cloud", "spirit", "lightning", "sanctuary"]) {
    const g = arena(element),
      a = g.player;
    if (!a.parts.includes("water")) continue;
    g.friendlyFire = false;
    const h = flood(g);
    h.owner = a;
    g.hazards = [h];
    g.switchForm(
      a,
      a.forms.find((f) => f !== "water"),
    );
    g.updateHazards(0.01);
    assert.equal(a.slow, 0, element);
    g.move(a, 1, 0, 0.01);
    const expected = 150 * 1.25 * (g.flying(a) ? 1.28 * 0.04 : 1);
    assert.ok(Math.abs(a.vx - expected) < 1e-8, element);
  }
  const g = arena("dark");
  g.hazards = [flood(g)];
  g.updateHazards(0.01);
  assert.equal(g.player.slow, 0.4);
});
test("Earth origins and every Earth fusion ignore quicksand damage, slow and foot burial", () => {
  for (const element of [
    "earth",
    "mud",
    "mirror",
    "gravity",
    "divine",
    "multi-dimensional",
    "invincible",
    "terraformer",
    "sanctuary",
  ]) {
    const g = arena(element),
      a = g.player;
    g.hazards = [{ ...flood(g), kind: "quicksand", element: "mud" }];
    assert.equal(quicksandImmune(a), true, element);
    g.updateHazards(0.01);
    assert.equal(a.hp, 120, element);
    assert.equal(a.slow, 0, element);
    assert.equal(immersionFor(g, a), 0, element);
  }
  const g = arena("light");
  g.hazards = [{ ...flood(g), kind: "quicksand", element: "mud" }];
  g.updateHazards(0.01);
  assert.ok(g.player.hp < 120);
  assert.ok(g.player.slow > 0);
  assert.equal(immersionFor(g, g.player), 10);
});
test("Fire entering Vog halves remaining duration once; casting around Fire and standing or re-entry do not repeatedly thin it", () => {
  const g = arena("smoke"),
    a = g.player;
  a.fx = 1;
  a.fy = 0;
  const fire = makeFighter("fire", "fire", 1, 800, 350);
  g.fighters.push(fire);
  g.startCharge(a);
  const h = g.hazards[0];
  g.updateHazards(0);
  assert.equal(h.life, 8); // Smoke's Fire origin is already inside at cast time.
  fire.x = h.x;
  fire.y = h.y;
  g.updateHazards(0);
  assert.equal(h.life, 4);
  g.updateHazards(0.5);
  assert.equal(h.life, 3.5);
  fire.x = 800;
  g.updateHazards(0);
  fire.x = h.x;
  g.updateHazards(0);
  assert.equal(h.life, 3.5);
  const second = makeFighter("sun", "sun", 0, h.x, h.y);
  g.fighters.push(second);
  g.updateHazards(0);
  assert.equal(h.life, 1.75);
  assert.equal(h.r, VOG_RADIUS);
});
test("Flash uses 85% of Vog radius in every direction and respects mode friendly fire and existing immunity", () => {
  assert.equal(FLASH_RADIUS, VOG_RADIUS * 0.85);
  for (const friendly of [true, false]) {
    const g = arena("light"),
      a = g.player;
    g.friendlyFire = friendly;
    const targets = [
      makeFighter("inside", "water", 1, a.x - FLASH_RADIUS, a.y),
      makeFighter("outside", "water", 1, a.x + FLASH_RADIUS + 0.01, a.y),
      makeFighter("ally", "water", 0, a.x, a.y + 100),
      makeFighter("immune", "divine", 2, a.x, a.y - 100),
      makeFighter("aurora", "sanctuary", 3, a.x + 10, a.y),
      makeFighter("protected", "dark", 3, a.x + 30, a.y),
    ];
    g.fighters = [a, ...targets];
    g.utility(a);
    assert.deepEqual(
      targets.map((b) => b.whiteout),
      [3, 0, friendly ? 3 : 0, 0, 0, 0],
    );
    assert.equal(a.whiteout, 0);
    assert.equal(g.effects.find((e) => e.kind === "ring").r, FLASH_RADIUS);
  }
});
test("Team Battles use the requested order", () => {
  assert.deepEqual(TEAM_MODES, [
    "tdm",
    "rush",
    "boss",
    "domination",
    "gauntlet-team",
    "ctf",
  ]);
});
