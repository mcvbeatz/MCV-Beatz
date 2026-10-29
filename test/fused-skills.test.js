import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  activeForm,
  skillsFor,
  extraSkillsFor,
  TELEKINESIS_RANGE,
} from "./combat-fixture.js";
import { characterPose } from "../src/characters.js";
function arena(element) {
  const g = new Combat({ element, random: () => 0 });
  Object.assign(g.player, { x: 330, y: 340 });
  g.fighters[1] = makeFighter("enemy", "water", 1, 500, 340);
  return g;
}
function charge(g, form) {
  assert.equal(g.startCharge(g.player, form), true);
  g.player.charge = 0.5;
  g.releaseCharge(g.player);
}
test("each requested fused shortcut executes without changing its selected tab or identity", () => {
  const expected = {
    spirit: ["Healing"],
    divine: ["Revival", "Portals"],
    sun: ["Healing"],
    demonic: ["Speed burst", "Sonic boom"],
    mirror: ["Rock shield", "Healing"],
    smoke: ["Shadow step", "Flamethrower"],
    gravity: ["Rock shield"],
    apparition: ["Sonic boom"],
    "multi-dimensional": ["Healing", "Shadow step"],
    lightning: ["Healing"],
  };
  for (const [element, names] of Object.entries(expected)) {
    assert.deepEqual(
      extraSkillsFor(element).map((s) => s.name),
      names,
    );
    for (const skill of extraSkillsFor(element)) {
      const g = arena(element),
        a = g.player;
      const ally = makeFighter("ally", "water", 0, 350, 400);
      ally.hp = 20;
      g.fighters.push(ally);
      if (skill.name === "Revival") g.fell(ally);
      if (skill.kind === "ability") charge(g, skill.form);
      else assert.equal(g.utility(a, true, skill.form), true);
      assert.equal(activeForm(a), element);
      assert.equal(a.element, element);
      if (skill.name === "Healing") assert.ok(ally.hp > 20);
      if (skill.name === "Revival") assert.ok(ally.alive);
      if (skill.name === "Rock shield") {
        assert.equal(a.shield, 1);
        g.utility(a, false, skill.form);
        assert.equal(a.shield, 0);
      }
      if (skill.name === "Speed burst") assert.ok(a.burst > 0);
      if (skill.name === "Shadow step") assert.ok(a.dodge > 0);
      if (skill.name === "Portals") assert.equal(g.portals.placing, a.id);
      if (skill.name === "Gust") assert.ok(a.boost > 0);
      if (skill.name === "Sonic boom") {
        assert.equal(g.waves.length, 1);
        assert.equal(g.waves[0].element, "air");
      }
      if (skill.name === "Flamethrower") {
        assert.equal(g.projectiles[0].kind, "flame");
        assert.equal(g.projectiles[0].element, "fire");
      }
    }
  }
});
test("Radiance heals every living teammate including Divine; enemies and fallen allies stay unchanged", () => {
  const g = arena("divine"),
    a = g.player;
  a.hp = 30;
  const near = makeFighter("near", "earth", 0, 350, 340),
    far = makeFighter("far", "light", 0, 850, 500),
    dead = makeFighter("dead", "water", 0, 500, 500);
  near.hp = 40;
  far.hp = 110;
  g.fighters.push(near, far, dead);
  g.fell(dead);
  g.cast(a, 1);
  assert.equal(a.hp, 53);
  assert.equal(near.hp, 63);
  assert.equal(far.hp, 120);
  assert.equal(dead.alive, false);
  assert.equal(g.fighters[1].hp, 120);
});
test("Divine revival chooses the closest fallen ally and does not spend cooldown without a valid target", () => {
  const g = arena("divine"),
    a = g.player;
  assert.equal(g.startCharge(a, "spirit"), false);
  assert.equal(a.abilityCd, 0);
  const near = makeFighter("near", "earth", 0, 360, 340),
    far = makeFighter("far", "water", 0, 700, 400);
  g.fighters.push(near, far);
  g.fell(near);
  g.fell(far);
  charge(g, "spirit");
  assert.ok(near.alive);
  assert.equal(far.alive, false);
  assert.equal(activeForm(a), "divine");
});
test("Earth has no Rock burst, still holds its shield, and unrelated fighters cannot borrow fused shortcuts", () => {
  const g = arena("earth");
  assert.deepEqual(skillsFor("earth"), [null, "Rock shield"]);
  assert.equal(g.startCharge(g.player), false);
  assert.equal(g.cast(g.player, 1), false);
  assert.equal(g.projectiles.length, 0);
  assert.ok(g.utility(g.player));
  const water = arena("water");
  assert.equal(water.startCharge(water.player, "spirit"), false);
  assert.equal(water.utility(water.player, true, "blaze"), false);
});
test("added cast abilities respect cooldowns and retain their charge source until release", () => {
  const g = arena("demonic"),
    a = g.player;
  assert.ok(g.startCharge(a, "air"));
  assert.equal(g.startCharge(a, "demonic"), false);
  g.releaseCharge(a);
  assert.equal(g.waves.length, 1);
  assert.equal(g.startCharge(a, "demonic"), false);
  assert.ok(g.utility(a, true, "blaze"));
  assert.equal(a.utilityCd, 0);
});
test("telekinesis reaches 400 units, pushes away on button use, and moves twice the old distance", () => {
  const g = arena("gravity"),
    a = g.player,
    b = g.fighters[1];
  b.x = a.x + TELEKINESIS_RANGE;
  a.fx = -1;
  assert.ok(g.startCharge(a));
  assert.equal(b.knockX, 520);
  assert.equal(a.charging, false);
  a.abilityCd = 0;
  b.x = a.x + 401;
  b.knockX = 0;
  assert.equal(g.startCharge(a), false);
  assert.equal(a.abilityCd, 0);
  b.x = a.x - 100;
  assert.ok(g.startCharge(a));
  assert.equal(b.knockX, -520);
  const h = arena("gravity"),
    f = h.fighters[1];
  f.knockX = 260;
  h.move(f, 0, 0, 0.05);
  const oldDistance = f.x - 500;
  b.x = 500;
  b.knockX = 520;
  g.move(b, 0, 0, 0.05);
  assert.ok(Math.abs(b.x - 500 - oldDistance * 2) < 1e-8);
});
test("telekinesis button selects the nearest visible opponent rather than an ally or hidden Divine", () => {
  const g = arena("gravity"),
    a = g.player;
  const ally = makeFighter("ally", "water", 0, 350, 340),
    hidden = makeFighter("hidden", "divine", 1, 355, 340),
    near = makeFighter("near", "air", 1, 400, 340);
  g.fighters.push(ally, hidden, near);
  assert.ok(g.startCharge(a));
  assert.equal(near.knockX, 520);
  assert.equal(ally.hp, 120);
  assert.equal(hidden.hp, 120);
  assert.equal(g.fighters[1].hp, 120);
});
test("fragile doppelgangers pursue and damage opponents instead of retreating at low HP", () => {
  for (const element of ["apparition", "demonic"]) {
    const g = arena(element),
      a = g.player;
    g.cast(a, 1);
    a.x = 150;
    a.y = 175;
    const echo = g.fighters.find((f) => f.echo),
      enemy = g.fighters[1];
    enemy.x = 600;
    const start = Math.hypot(echo.x - enemy.x, echo.y - enemy.y);
    for (let i = 0; i < 100; i++) {
      g.time += 0.04;
      g.ai(echo, 0.04);
      echo.attackCd = Math.max(0, echo.attackCd - 0.04);
      g.resolveStrikes();
    }
    assert.ok(Math.hypot(echo.x - enemy.x, echo.y - enemy.y) < start);
    assert.ok(enemy.hp < 120, element);
  }
});
test("hit recoil replaces idle/running only and damage never creates floating numeric text", () => {
  const g = arena("water"),
    a = g.player,
    b = g.fighters[1];
  b.movingTime = 1;
  b.vx = 150;
  g.damage(a, b, 5);
  assert.equal(b.hitReact, 0.24);
  assert.equal(characterPose(b).reacting, true);
  assert.equal(characterPose(b).running, false);
  assert.ok(!g.events.some((e) => /^\d+$/.test(e.text)));
  for (const state of [
    { swing: 0.2 },
    { clash: 0.2 },
    { charging: true },
    { shield: 1 },
    { burst: 0.2 },
    { blink: { remaining: 0.2 } },
    { reveal: 0.2 },
  ]) {
    const target = makeFighter("test", "water", 1, 450, 340);
    Object.assign(target, state);
    g.damage(a, target, 5);
    assert.equal(target.hitReact, 0, JSON.stringify(state));
  }
  b.swing = 0.2;
  assert.equal(characterPose(b).reacting, false);
  b.swing = 0;
  for (let i = 0; i < 6; i++) g.update(0.05, { x: 0, y: 0 }, false);
  assert.equal(b.hitReact, 0);
});
