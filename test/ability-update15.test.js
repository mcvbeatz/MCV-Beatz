import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  extraSkillsFor,
  visibility,
  canUseSkill,
} from "../src/combat.js";
import { PLAY_MODES, PRACTICE_LIST } from "../src/mode-catalog.js";
function arena(element = "dark", enemy = "water") {
  const g = new Combat({ element, random: () => 0.2 });
  Object.assign(g.player, { x: 300, y: 300, fx: 1, fy: 0 });
  g.fighters[1] = makeFighter("enemy", enemy, 1, 350, 300);
  return g;
}
function advance(g, seconds) {
  for (let i = 0; i < Math.round(seconds / 0.01); i++)
    g.update(0.01, { x: 0, y: 0 }, false);
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("Sabotage affects only the closest enemy, cancels a current charge without damage, blindness or a second cancellation", () => {
  const g = arena(),
    [a, b] = g.fighters;
  const far = makeFighter("far", "fire", 1, 400, 300);
  g.fighters.push(far);
  g.startCharge(b);
  b.charge = 1.5;
  a.lock = far.id;
  assert.equal(g.cast(a, 2.6), true);
  assert.equal(b.charging, false);
  assert.equal(b.charge, 0);
  assert.equal(b.blind, 0);
  assert.equal(b.hp, 120);
  assert.equal(far.hp, 120);
  assert.equal(b.sabotaged, false);
  assert.equal(g.startCharge(b), true);
});
test("Sabotage waits through cooldown and cancels exactly one valid ability attempt", () => {
  const g = arena(),
    [a, b] = g.fighters;
  g.cast(a, 1);
  b.abilityCd = 2;
  assert.equal(g.startCharge(b), false);
  assert.equal(b.sabotaged, true);
  b.abilityCd = 0;
  assert.equal(g.startCharge(b), false);
  assert.equal(b.sabotaged, false);
  assert.equal(g.projectiles.length, 0);
  assert.equal(g.startCharge(b), true);
});
test("Sabotage cancels utilities, instant lightning, swipe telekinesis and teleport without reflecting", () => {
  for (const form of ["earth", "lightning", "gravity", "multi-dimensional"]) {
    const g = arena("dark", form),
      [a, b] = g.fighters;
    g.cast(a, 1);
    const attempt = () =>
      form === "earth"
        ? g.utility(b)
        : form === "multi-dimensional"
          ? g.teleport(b, 500, 400)
          : form === "gravity"
            ? g.telekinesis(b, a, -1, 0)
            : g.startCharge(b);
    assert.equal(attempt(), false, form);
    assert.equal(b.sabotaged, false, form);
    assert.equal(b.hp, 120);
    assert.equal(a.hp, 120);
    assert.equal(b.reflect, 0);
    assert.ok(attempt(), form);
  }
});
test("Blindness is separately selectable, removes lock but not vision or health, and wears off", () => {
  const g = arena(),
    [a, b] = g.fighters;
  assert.equal(canUseSkill(a, "blindness", "ability"), true);
  assert.equal(extraSkillsFor("dark")[0].name, "Blindness");
  g.autoLock(b);
  assert.equal(b.lock, a.id);
  g.startCharge(a, "blindness");
  assert.equal(b.blind, 3);
  assert.equal(b.whiteout, 0);
  assert.equal(b.hp, 120);
  g.autoLock(b);
  assert.equal(b.lock, null);
  assert.ok(g.enemies(b).includes(a));
  advance(g, 3.05);
  g.autoLock(b);
  assert.equal(b.lock, a.id);
});
test("Vog is tap activated, reduced smoke radius, harmless, and conceals from all non-Dark skill sets", () => {
  const g = arena("smoke", "mirror"),
    [a, b] = g.fighters;
  assert.ok(g.startCharge(a));
  assert.equal(a.charging, false);
  assert.equal(a.abilityCd, 7);
  const h = g.hazards[0];
  near(h.r * h.r, ((500 * 500) / 3) * 0.6 ** 2);
  assert.equal(h.life, 8);
  assert.equal(g.canSee(b, a), false);
  assert.equal(g.canSee(a, b), true);
  g.switchForm(a, "fire");
  assert.equal(g.canSee(a, b), true);
  g.autoLock(b);
  assert.equal(b.lock, null);
  g.updateHazards(0.01);
  assert.equal(b.hp, 120);
  assert.equal(b.blind, 0);
  assert.equal(b.reflect, 0);
  h.life = 0;
  assert.equal(g.canSee(b, a), true);
});
test("Flash has a distinct three-second timer without applying target-lock Blindness", () => {
  const g = arena("light", "water"),
    [a, b] = g.fighters;
  g.utility(a);
  assert.equal(b.whiteout, 3);
  assert.equal(b.blind, 0);
  advance(g, 1);
  near(b.whiteout, 2);
  advance(g, 2.01);
  assert.equal(b.whiteout, 0);
});
test("every Play mode freezes on 3/2/1, unlocks on Go, while Practice skips countdown", () => {
  for (const mode of PLAY_MODES) {
    const g = new Combat({ mode, countdown: true, random: () => 0.2 });
    const a = g.player,
      x = a.x;
    const positions = g.fighters.map((b) => [b.x, b.y, b.hp]);
    assert.equal(g.countdownLabel, "3", mode);
    assert.equal(g.strike(a), false);
    assert.equal(g.startCharge(a), false);
    assert.equal(g.utility(a), false);
    g.move(a, 1, 0, 0.05);
    assert.equal(a.x, x);
    for (let i = 0; i < 290; i++) g.update(0.01, { x: 1, y: 0 });
    assert.equal(g.time, 0);
    assert.deepEqual(
      g.fighters.map((b) => [b.x, b.y, b.hp]),
      positions,
    );
    for (let i = 0; i < 15; i++) g.update(0.01, { x: 1, y: 0 }, false);
    assert.equal(g.countdownLabel, "Go!");
    assert.equal(g.countingDown, false);
    assert.ok(g.time > 0);
    assert.ok(g.strike(a));
  }
  for (const mode of PRACTICE_LIST)
    assert.equal(new Combat({ mode, countdown: true }).countdown, 0);
});
test("Lightning reaches 450 and Invincible takes full increased damage without Reflect or hard skin", () => {
  const g = arena("lightning", "invincible"),
    [a, b] = g.fighters;
  b.x = 745;
  assert.ok(g.startCharge(a));
  near(b.hp, 87.5);
  assert.equal(a.hp, 120);
  assert.equal(b.reflect, 0);
  a.abilityCd = 0;
  b.x = 751;
  assert.equal(g.startCharge(a), false);
});
test("Flood lightning strikes caster, allies, concealed Divine and flyers regardless of friendly-fire settings", () => {
  const g = arena("lightning", "divine"),
    [a, b] = g.fighters;
  g.friendlyFire = false;
  const ally = makeFighter("ally", "air", a.team, 850, 550);
  g.fighters.push(ally);
  g.hazards.push({ kind: "flood", x: 850, y: 550, r: 10, life: 5, owner: a });
  assert.equal(visibility(b), 0);
  assert.ok(g.startCharge(a));
  near(a.hp, 73.2);
  near(b.hp, 96.6);
  near(ally.hp, 68);
  assert.ok(b.reflect > 0);
});
test("Speed burst, telekinesis, contact burn and venom bypass Reflect; other projectiles still reflect", () => {
  const dash = arena("blaze", "mirror");
  const [a, b] = dash.fighters;
  dash.utility(a);
  dash.updateBurst(a, { x: 300, y: 300 }, 0.01); // Move across the opponent.
  a.x = 360;
  dash.updateBurst(a, { x: 300, y: 300 }, 0.01);
  assert.equal(b.reflect, 0);
  assert.equal(a.hp, 120);
  near(b.hp, 103.5);
  const gravity = arena("gravity", "mirror");
  gravity.telekinesis(gravity.player, gravity.fighters[1], 1, 0);
  near(gravity.fighters[1].hp, 106.5);
  assert.equal(gravity.player.hp, 120);
  assert.equal(gravity.fighters[1].reflect, 0);
  const fire = arena("fire", "mirror");
  fire.fighters[1].x = 325;
  advance(fire, 0.1);
  assert.equal(fire.player.hp, 120);
  assert.equal(fire.fighters[1].reflect, 0);
  const mud = arena("mud", "mirror");
  mud.fighters[1].venom = 5;
  mud.fighters[1].venomSource = mud.player;
  advance(mud, 0.1);
  assert.equal(mud.player.hp, 120);
  assert.equal(mud.fighters[1].reflect, 0);
  mud.damage(mud.player, mud.fighters[1], 20, true, false, "water");
  assert.ok(mud.fighters[1].reflect > 0);
});
test("Mud exposes Hydro pump and Rock shield without switching its fused tab", () => {
  const g = arena("mud");
  const a = g.player;
  assert.deepEqual(
    extraSkillsFor("mud").map((s) => s.name),
    ["Hydro pump", "Rock shield"],
  );
  assert.ok(g.startCharge(a, "water"));
  g.releaseCharge(a);
  assert.equal(g.projectiles[0].kind, "water");
  assert.ok(g.utility(a, true, "earth"));
  assert.equal(a.shield, 1);
  assert.equal(a.element, "mud");
});
test("charging scales both echo types health, while their count and lifetime stay fixed", () => {
  for (const [form, base, count] of [
    ["apparition", 1, 1],
    ["demonic", 8, 3],
  ]) {
    for (const charge of [0, 0.9, 1.8]) {
      const g = arena(form);
      g.startCharge(g.player);
      g.player.charge = charge;
      g.releaseCharge(g.player);
      const echoes = g.fighters.filter((a) => a.echo);
      assert.equal(echoes.length, count);
      for (const a of echoes) {
        near(a.hp, base + (32 * charge) / 1.8);
        assert.equal(a.maxHp, a.hp);
        assert.equal(a.life, 9);
      }
    }
  }
});
test("Tornado deals 15 percent more damage to flying opponents", () => {
  const g = arena("cloud", "air");
  g.cast(g.player, 1);
  const p = g.projectiles[0];
  p.x = 350;
  p.y = 300;
  p.dx = p.dy = 0;
  g.updateProjectiles(0.01);
  near(g.fighters[1].hp, 120 - 25 * 1.15);
});
