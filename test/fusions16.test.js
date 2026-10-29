import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  recipe,
  combination,
  LEVEL_THREE,
  VOG_RADIUS,
  BURST_HIT_RANGE,
  CHASM_RADIUS,
  extraSkillsFor,
} from "./combat-fixture.js";
import { updateAdvanced } from "../src/advanced-modes.js";
import { immersionFor } from "../src/battle-effects.js";
function arena(element = "terraformer", enemy = "water", mode = "duel") {
  const g = new Combat({ element, mode, random: () => 0 });
  g.player = makeFighter("player", element, 0, 300, 350);
  g.fighters = [g.player, makeFighter("enemy", enemy, 1, 450, 350)];
  return g;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function advance(g, s, AI = false) {
  for (let i = 0; i < Math.round(s / 0.01); i++)
    g.update(0.01, { x: 0, y: 0 }, AI);
}
function support(g) {
  const s = makeFighter("support", "sanctuary", g.player.team, 800, 500);
  g.fighters.push(s);
  return s;
}
test("three new level-III recipes and all constituent fusion routes work", () => {
  for (const e of ["phoenix", "terraformer", "sanctuary"]) {
    assert.ok(LEVEL_THREE.includes(e));
    const parts = recipe(e);
    assert.equal(parts.length, 3);
    for (let i = 0; i < 3; i++) {
      const pair = parts.filter((_, j) => i !== j);
      assert.equal(combination(pair, [parts[i]]), e);
    }
  }
  assert.equal(LEVEL_THREE.length, 8);
});
test("Vog retains cumulative reductions and dash hit width stays 30 percent wider", () => {
  near(VOG_RADIUS, (500 / Math.sqrt(3)) * 0.6 * 0.8);
  near(BURST_HIT_RANGE, 36.4);
  const g = arena("blaze", "water");
  const a = g.player,
    b = g.fighters[1];
  b.x = 350;
  b.y = 385;
  const far = makeFighter("far", "water", 1, 350, 387);
  g.fighters.push(far);
  g.utility(a);
  a.x = 400;
  g.updateBurst(a, { x: 300, y: 350 }, 0.01);
  assert.equal(b.hp, 98);
  assert.equal(far.hp, 120);
  g.updateBurst(a, { x: 300, y: 350 }, 0.01);
  assert.equal(b.hp, 98);
});
test("Phoenix revives once, credits the fall, drops flags but no token, and retains fusion", () => {
  const g = arena("phoenix", "water", "tdm"),
    a = g.player,
    b = g.fighters[1];
  a.spawn = { element: "phoenix", x: 300, y: 350 };
  g.flags = [{ carrier: a.id, x: 0, y: 0, team: 1 }];
  g.damage(b, a, 200);
  assert.equal(a.alive, true);
  assert.equal(a.hp, 60);
  assert.equal(a.element, "phoenix");
  assert.equal(a.deaths, 1);
  assert.equal(b.kills, 1);
  assert.equal(g.flags[0].carrier, null);
  assert.equal(g.tokens.length, 0);
  assert.equal(a.respawnAt, undefined);
  assert.equal(g.checkMatchEnd(), false);
  g.damage(b, a, 200);
  assert.equal(a.alive, false);
  assert.equal(g.tokens.length, 1);
  assert.equal(a.deaths, 2);
  g.respawn(a);
  g.damage(b, a, 200);
  assert.equal(a.alive, false);
  assert.ok(g.rebirthUsed.has(a.id));
});
test("Rebirth can recover the first dimensional loss but cannot be reset by transformations", () => {
  const g = arena("phoenix"),
    a = g.player;
  g.fell(a, { lost: true });
  assert.equal(a.alive, true);
  assert.equal(a.lost, false);
  assert.equal(a.dimension, null);
  Object.assign(a, makeFighter(a.id, "phoenix", 0, 300, 350));
  g.fell(a, { lost: true });
  assert.equal(a.alive, false);
  assert.equal(a.lost, true);
});
test("Phoenix exposes Laser beam and Speed burst directly and Rebirth never has an activation button", () => {
  const g = arena("phoenix");
  assert.deepEqual(
    extraSkillsFor("phoenix").map((s) => s.name),
    ["Laser beam", "Speed burst"],
  );
  assert.ok(g.startCharge(g.player, "sun"));
  g.releaseCharge(g.player);
  assert.equal(g.projectiles[0].kind, "laser");
  assert.ok(g.utility(g.player, true, "blaze"));
});
test("Chasm warns for a full second, kills grounded enemies and spares flyers", () => {
  const g = arena();
  const a = g.player,
    b = g.fighters[1];
  const flyer = makeFighter("flyer", "air", 1, 450, 350);
  g.fighters.push(flyer);
  assert.ok(g.placeChasm(a, 450, 350));
  assert.equal(g.hazards[0].r, CHASM_RADIUS);
  assert.ok(CHASM_RADIUS < 66);
  assert.equal(a.charging, false);
  g.time = 0.99;
  g.updateHazards(0.01);
  assert.equal(b.alive, true);
  g.time = 1;
  g.updateHazards(0.01);
  assert.equal(b.alive, false);
  assert.equal(flyer.alive, true);
  assert.equal(a.kills, 1);
});
test("Chasm rejects invalid placements and respects cooldown, opening duration and friendly-fire mode", () => {
  const g = arena(),
    a = g.player;
  for (const [x, y] of [
    [NaN, 300],
    [901, 350],
    [850, 350],
    [400, 100],
  ])
    assert.equal(g.placeChasm(a, x, y), false);
  assert.equal(a.abilityCd, 0);
  assert.equal(g.hazards.length, 0);
  assert.ok(g.placeChasm(a, 450, 350));
  assert.equal(a.abilityCd, 8);
  assert.equal(g.placeChasm(a, 500, 350), false);
  g.fighters[1].team = 0;
  g.friendlyFire = false;
  g.time = 1;
  g.updateHazards(0.01);
  assert.equal(g.fighters[1].alive, true);
  g.hazards[0].life = 0.01;
  g.updateHazards(0.02);
  assert.equal(g.hazards.length, 0);
});
test("Stone Prison chooses nearest enemy, stops movement and is broken by five ordinary strikes", () => {
  const g = arena();
  const a = g.player,
    b = g.fighters[1];
  g.fighters.push(makeFighter("far", "fire", 1, 500, 350));
  assert.ok(g.utility(a));
  assert.equal(b.prisonHp, 65);
  assert.equal(g.fighters[2].prisonHp, 0);
  b.knockX = 500;
  g.move(b, 1, 1, 0.1);
  assert.equal(b.x, 450);
  assert.equal(b.y, 350);
  assert.equal(b.knockX, 0);
  for (let i = 0; i < 4; i++) {
    b.attackCd = 0;
    assert.ok(g.strike(b));
  }
  assert.equal(b.prisonHp, 9);
  assert.equal(b.hp, 120);
  assert.equal(g.pending.length, 0);
  b.attackCd = 0;
  g.strike(b);
  assert.equal(b.prisonHp, 0);
  g.move(b, 1, 0, 0.1);
  assert.ok(b.x > 450);
});
test("Prison blocks dashes, teleport and portal transport, while AI including bosses attacks its cage", () => {
  for (const form of ["blaze", "multi-dimensional", "invincible"]) {
    const g = arena("terraformer", form),
      b = g.fighters[1];
    g.utility(g.player);
    b.aiControlled = true;
    assert.equal(g.teleport(b, 600, 350), false);
    if (form === "blaze") assert.equal(g.utility(b), false);
    g.portals.portals = [
      { id: "p", x: 450, y: 350, r: 24, opensAt: 0, owner: "player" },
    ];
    assert.equal(g.portals.enter(b, b), false);
    g.mode = "boss";
    for (let i = 0; i < 6; i++) {
      b.attackCd = 0;
      g.ai(b, 0.1);
    }
    assert.equal(b.prisonHp, 0);
  }
});
test("Life spring is permanent, heals allies and enemies without over-healing, and cannot be placed twice after respawn", () => {
  const g = arena("sanctuary"),
    a = g.player,
    b = g.fighters[1];
  a.spawn = { element: "sanctuary", x: 300, y: 350 };
  b.x = 330;
  a.hp = 80;
  b.hp = 100;
  assert.ok(g.startCharge(a));
  assert.equal(a.charging, false);
  assert.equal(g.hazards[0].life, Infinity);
  g.updateHazards(0.5);
  assert.equal(a.hp, 84);
  assert.equal(b.hp, 104);
  g.updateHazards(20);
  assert.equal(a.hp, 120);
  assert.equal(b.hp, 120);
  g.fell(a);
  assert.equal(g.hazards.length, 1);
  g.respawn(a);
  assert.equal(g.startCharge(a), false);
});
test("Aurora follows living teammates across skill tabs and protects the bearer too", () => {
  const g = arena("fire");
  const s = support(g);
  g.switchForm(s, "water");
  assert.ok(g.auroraProtected(s));
  assert.ok(g.auroraProtected(g.player));
  assert.equal(g.auroraProtected(g.fighters[1]), false);
  s.alive = false;
  assert.equal(g.auroraProtected(g.player), false);
  s.alive = true;
  s.dimension = { portal: "x" };
  assert.equal(g.auroraProtected(g.player), false);
});
test("Aurora blocks venom/contact burn and clears existing flash, blindness and sabotage", () => {
  const g = arena("air", "fire"),
    a = g.player,
    b = g.fighters[1];
  support(g);
  b.x = 325;
  Object.assign(a, {
    blind: 2,
    whiteout: 3,
    sabotaged: true,
    venom: 5,
    venomSource: b,
  });
  advance(g, 0.1);
  assert.equal(a.hp, 120);
  assert.equal(a.burn, 0);
  assert.equal(a.venom, 0);
  assert.equal(a.blind, 0);
  assert.equal(a.whiteout, 0);
  assert.equal(a.sabotaged, false);
  // Gaining Aurora removes a pending sabotage even before the next update tick.
  a.sabotaged = true;
  assert.equal(g.utility(a, true, "air"), true);
  Object.assign(b, makeFighter(b.id, "mud", 1, 325, 350));
  advance(g, 0.1);
  assert.equal(a.venom, 0);
});
test("Aurora blocks direct Flash, Sabotage and Blindness and lets players see through Vog", () => {
  const g = arena("water", "dark"),
    a = g.player,
    b = g.fighters[1];
  support(g);
  g.cast(b, 1, "dark");
  assert.equal(a.sabotaged, false);
  g.startCharge(b, "blindness");
  assert.equal(a.blind, 0);
  Object.assign(b, makeFighter(b.id, "light", 1, 450, 350));
  g.utility(b);
  assert.equal(a.whiteout, 0);
  g.hazards.push({ kind: "vog", owner: b, x: b.x, y: b.y, r: 170, life: 8 });
  assert.ok(g.canSee(a, b));
  g.fighters[2].alive = false;
  assert.equal(g.canSee(a, b), false);
});
test("Aurora blocks Heatwave, gravity, Flood immersion/damage and Death but not Magma or Chasm", () => {
  for (const kind of ["heatwave", "gravity", "flood", "death"]) {
    const g = arena("blaze", "demonic"),
      a = g.player,
      b = g.fighters[1];
    support(g);
    g.hazards = [
      {
        kind,
        owner: b,
        element: "demonic",
        x: a.x,
        y: a.y,
        r: 100,
        life: 8,
        tick: 0,
        power: 1,
      },
    ];
    g.updateHazards(0.1);
    assert.equal(a.hp, 120, kind);
    assert.equal(a.slow, 0, kind);
    assert.equal(a.element, "blaze", kind);
    assert.equal(immersionFor(g, a), 0);
  }
  const g = arena("earth", "terraformer"),
    a = g.player,
    b = g.fighters[1];
  support(g);
  g.hazards = [
    {
      kind: "magma",
      owner: b,
      element: "fire",
      x: a.x,
      y: a.y,
      r: 66,
      life: 8,
      tick: 0,
      power: 1,
    },
  ];
  g.updateHazards(0.1);
  assert.ok(a.hp < 120);
  g.hazards = [
    {
      kind: "chasm",
      owner: b,
      element: "terraformer",
      x: a.x,
      y: a.y,
      r: 56,
      life: 8,
      opensAt: 0,
    },
  ];
  g.updateHazards(0.1);
  assert.equal(a.alive, false);
});
test("Life spring/Rebirth charges stay spent through Roulette and Prison is not cleansed by the shuffle", () => {
  const g = arena("sanctuary", "water", "roulette"),
    a = g.player;
  g.startCharge(a);
  g.rebirthUsed.add(a.id);
  a.prisonHp = 40;
  g.nextForms = { player: "phoenix", enemy: "water" };
  g.time = 25;
  g.nextShuffleAt = 25;
  updateAdvanced(g);
  assert.equal(a.element, "phoenix");
  assert.equal(a.prisonHp, 40);
  g.fell(a);
  assert.equal(a.alive, false);
  g.nextForms = { player: "sanctuary", enemy: "water" };
  g.time = 50;
  g.nextShuffleAt = 50;
  updateAdvanced(g);
  a.alive = true;
  a.abilityCd = 0;
  assert.equal(g.startCharge(a), false);
});
test("new fusion AI uses its signature skills and attacks to escape a prison", () => {
  const g = arena("fire", "terraformer"),
    a = g.player,
    b = g.fighters[1];
  a.x = 430;
  b.x = 500;
  g.ai(b, 0.1);
  assert.ok(g.hazards.some((h) => h.kind === "chasm"));
  assert.equal(a.prisonHp, 65);
  const s = arena("fire", "sanctuary");
  s.fighters[1].hp = 80;
  s.ai(s.fighters[1], 0.1);
  assert.ok(s.hazards.some((h) => h.kind === "spring"));
});
