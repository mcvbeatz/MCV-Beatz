import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
const corruption = () => {
  const g = new Combat({ mode: "corruption", players: 8, random: () => 0 });
  g.time = 5;
  g.corruptionStarted = true;
  g.corrupt(g.player);
  return g;
};
test("seven Lights give a corrupted fighter seven full strikes of durability, with hit feedback", () => {
  const g = corruption(),
    dark = g.player,
    light = g.fighters[1];
  assert.equal(dark.hp, 7);
  assert.equal(dark.maxHp, 7);
  for (let n = 1; n <= 7; n++) {
    g.meleeDamage(light, dark, 14);
    assert.equal(dark.hp, 7 - n);
    assert.equal(dark.alive, n < 7);
    if (n < 7) assert.ok(dark.hitReact > 0);
  }
  assert.equal(dark.respawnAt, 15);
});
test("conversion lowers every Dark health cap without healing wounds and respawns use current count", () => {
  const g = corruption(),
    dark = g.player;
  g.meleeDamage(g.fighters[1], dark, 14);
  g.meleeDamage(g.fighters[1], dark, 14);
  assert.equal(dark.hp, 5);
  g.corrupt(g.fighters[1], dark);
  assert.equal(dark.maxHp, 6);
  assert.equal(dark.hp, 5);
  assert.equal(g.fighters[1].hp, 6);
  g.fell(dark);
  g.corrupt(g.fighters[2], g.fighters[1]);
  g.respawn(dark);
  assert.equal(dark.hp, 5);
  assert.equal(dark.maxHp, 5);
  assert.equal(dark.skillsDisabled, true);
  assert.equal(g.fighters[1].hp, 5);
});
test("full-health corrupted fighters retain full movement speed with hit-count health", () => {
  const g = corruption(),
    dark = g.player;
  Object.assign(dark, { x: 1024, y: 680 });
  g.move(dark, 1, 0, 0.05);
  assert.equal(dark.vx, 150);
  assert.equal(dark.x, 1031.5);
});
test("nonlethal simultaneous Light/Dark strikes convert Light and deduct exactly one hit", () => {
  const g = corruption(),
    dark = g.player,
    light = g.fighters[1];
  Object.assign(dark, { x: 1000, y: 680 });
  Object.assign(light, { x: 1040, y: 680, hp: 1 });
  for (const other of g.fighters.slice(2))
    Object.assign(other, { x: 850, y: 550 });
  g.strike(dark);
  g.strike(light);
  g.time += 0.12;
  g.resolveStrikes();
  assert.equal(dark.hp, 6);
  assert.equal(dark.maxHp, 6);
  assert.equal(dark.alive, true);
  assert.equal(light.element, "dark");
  assert.equal(light.hp, 6);
});
test("corrupted AI immediately pursues nearest Light and keeps striking past three attacks", () => {
  const g = corruption(),
    dark = g.player,
    near = g.fighters[2];
  Object.assign(dark, {
    x: 1050,
    y: 680,
    aiLastGesture: "strike",
    aiRepeat: 3,
    aiNeedChange: true,
    aiPlan: { x: 800, y: 550, until: 100 },
  });
  for (const b of g.fighters.slice(1)) Object.assign(b, { x: 800, y: 500 });
  Object.assign(near, { x: 970, y: 680 });
  g.ai(dark, 0.02);
  assert.ok(dark.vx < 0);
  assert.equal(dark.vy, 0);
  assert.equal(dark.aiPlan, null);
  Object.assign(near, { x: dark.x - 45, y: dark.y });
  for (let i = 0; i < 6; i++) {
    dark.attackCd = 0;
    g.ai(dark, 0.02);
  }
  assert.equal(g.pending.length, 6);
  assert.equal(dark.aiNeedChange, false);
  assert.equal(dark.charging, false);
});
test("AI boss hunts the closest healer first, retargets when felled, then hunts closest nonhealer", () => {
  const g = new Combat({
    mode: "boss",
    bossRole: "challenger",
    players: 5,
    random: () => 0.9,
    element: "water",
  });
  const boss = g.fighters.find((a) => a.element === "invincible");
  Object.assign(boss, { x: 500, y: 350, hp: 20 });
  const rivals = g.fighters.filter((a) => a !== boss);
  for (let i = 0; i < rivals.length; i++) {
    const element = i < 2 ? "light" : "water";
    Object.assign(
      rivals[i],
      makeFighter(rivals[i].id, element, 0, 200 + i * 50, 350),
    );
  }
  rivals[0].x = 200;
  rivals[1].x = 300;
  rivals[2].x = 550;
  rivals[3].x = 700;
  g.ai(boss, 0.02);
  assert.equal(boss.pursuitMemory.x, 300);
  assert.ok(boss.vx < 0);
  assert.equal(boss.shield, 0);
  g.fell(rivals[1]);
  g.ai(boss, 0.02);
  assert.equal(boss.pursuitMemory.x, 200);
  g.fell(rivals[0]);
  g.ai(boss, 0.02);
  assert.equal(boss.pursuitMemory.x, 550);
  assert.ok(boss.vx > 0);
  // With both targets in range, the boss faces the healer, not the closer water.
  Object.assign(rivals[0], { alive: true, hp: 120, x: boss.x - 50, y: boss.y });
  Object.assign(rivals[2], { x: boss.x + 20, y: boss.y });
  g.autoLock(boss);
  assert.equal(boss.lock, rivals[0].id);
  boss.aiLastGesture = "strike";
  boss.aiRepeat = 3;
  for (let i = 0; i < 5; i++) {
    boss.attackCd = 0;
    assert.ok(g.strike(boss));
  }
});
test("Domination allied attacks, statuses, contact passives and Death never hurt teammates", () => {
  const g = new Combat({ mode: "domination", size: 2, element: "light" }),
    a = g.player,
    ally = g.fighters[2];
  Object.assign(ally, { x: a.x + 20, y: a.y });
  assert.equal(g.friendlyFire, false);
  g.utility(a);
  assert.equal(ally.blind, 0);
  g.damage(a, ally, 999, true);
  g.meleeDamage(a, ally, 14);
  assert.equal(ally.hp, 120);
  Object.assign(a, makeFighter(a.id, "lightning", 0, 300, 300));
  Object.assign(ally, { x: 310, y: 300 });
  assert.equal(g.isShocked(ally), false);
  Object.assign(a, makeFighter(a.id, "mud", 0, 300, 300));
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.equal(ally.venom, 0);
  Object.assign(a, makeFighter(a.id, "demonic", 0, 300, 300));
  a.fx = 1;
  a.fy = 0;
  g.utility(a);
  const h = g.hazards.at(-1);
  Object.assign(ally, makeFighter(ally.id, "divine", 0, h.x, h.y));
  g.updateHazards(0.02);
  assert.equal(ally.element, "divine");
});
test("Domination AI attacks through a closer ally while friendly-fire modes still decline", () => {
  for (const mode of ["domination", "team"]) {
    const g = new Combat({ mode, size: 2, element: "earth" }),
      a = g.fighters[2],
      ally = g.player,
      enemy = g.fighters[1];
    Object.assign(a, makeFighter(a.id, "earth", 0, 500, 350));
    Object.assign(ally, { x: 510, y: 350 });
    Object.assign(enemy, { x: 550, y: 350 });
    g.autoLock(a);
    assert.equal(g.safeAttack(a, enemy), mode === "domination");
    g.ai(a, 0.02);
    assert.equal(
      g.pending.some((p) => p.who === a),
      mode === "domination",
    );
  }
});
