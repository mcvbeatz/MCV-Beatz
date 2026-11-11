import test from "node:test";
import assert from "node:assert/strict";
import { Combat, canUseSkill } from "./combat-fixture.js";
function night(count = 1) {
  const g = new Combat({ mode: "corruption", random: () => 0 });
  g.corruptionStarted = true;
  for (let i = 0; i < count; i++) {
    g.time = 5 + i;
    g.corrupt(g.fighters[i]);
  }
  return g;
}
test("Survive the Night always starts exactly eight Lights regardless of requested count", () => {
  for (const players of [undefined, 1, 2, 4, 7, 8, 20, NaN]) {
    const g = new Combat({ mode: "corruption", players });
    assert.equal(g.fighters.length, 8);
    assert.ok(g.fighters.every((a) => a.element === "light" && a.hp === 2));
  }
});
test("the last three survivors gain one Rebirth, which prevents conversion and restores half health", () => {
  const g = night(4);
  assert.ok(g.fighters.every((a) => !a.nightRebirth));
  g.corrupt(g.fighters[4]);
  const hunter = g.player,
    last = g.fighters[5];
  assert.ok(g.fighters.slice(5).every((a) => a.nightRebirth));
  last.hp = 1;
  g.meleeDamage(hunter, last, 1);
  assert.equal(last.team, 0);
  assert.equal(last.hp, 1);
  assert.equal(hunter.infections, 0);
  assert.ok(g.rebirthUsed.has(last.id));
  assert.ok(g.effects.some((e) => e.kind === "rebirth"));
  assert.equal(last.respawnAt, undefined);
  g.meleeDamage(hunter, last, 1);
  assert.equal(last.element, "dark");
  assert.equal(hunter.infections, 1);
});
test("the final Light evolves to Spirit without losing health or its unspent Rebirth", () => {
  const g = night(6),
    a = g.fighters[7];
  a.hp = 1;
  g.corrupt(g.fighters[6]);
  assert.equal(a.element, "spirit");
  assert.equal(a.team, 0);
  assert.equal(a.hp, 1);
  assert.equal(a.maxHp, 2);
  assert.equal(a.nightRebirth, true);
  assert.equal(canUseSkill(a, "spirit", "ability"), true);
  assert.equal(canUseSkill(a, "light", "ability"), true);
  assert.equal(canUseSkill(a, "spirit", "utility"), false);
  assert.equal(g.checkMatchEnd(), false);
  g.time = 120;
  g.checkMatchEnd();
  assert.deepEqual(g.winners.light, [a.id]);
});
test("Spirit restores the oldest eligible Dark, living or awaiting respawn, skipping Smoke", () => {
  for (const dead of [false, true]) {
    const g = night(7),
      spirit = g.fighters[7];
    const oldest = g.player,
      next = g.fighters[1];
    g.nightForm(oldest, "smoke", 1);
    if (dead) g.fell(next);
    assert.equal(g.revivalTarget(spirit), next);
    assert.ok(g.revive(spirit));
    assert.equal(oldest.element, "smoke");
    assert.equal(next.element, "light");
    assert.equal(next.team, 0);
    assert.equal(next.hp, 2);
    assert.equal(next.alive, true);
    assert.equal(next.respawnAt, undefined);
    assert.equal(next.infectedAt, undefined);
    assert.equal(next.skillsDisabled, false);
    assert.equal(next.nightRebirth, true);
    assert.equal(
      g.player.maxHp,
      2,
      "hunter health includes Spirit and restored Light",
    );
    assert.ok(g.audioEvents.some((e) => e.kind === "revival"));
    assert.equal(g.revivalTarget(spirit), g.fighters[2]);
  }
});
test("rescues preserve spent Rebirth and cumulative conversions, with new conversion order", () => {
  const g = night(7),
    spirit = g.fighters[7],
    oldest = g.player;
  oldest.infections = 2;
  g.rebirthUsed.add(oldest.id);
  assert.ok(g.revive(spirit));
  assert.equal(g.rebirthUsed.has(oldest.id), true);
  g.corrupt(oldest, g.fighters[1]);
  assert.equal(oldest.element, "dark");
  assert.equal(oldest.infections, 2);
  assert.notEqual(g.revivalTarget(spirit), oldest);
});
test("three conversions evolve Dark to Smoke with Vog, Flamethrower and Shadow step, persisting on respawn", () => {
  const g = night(),
    hunter = g.player;
  for (const a of g.fighters.slice(1, 4)) {
    g.meleeDamage(hunter, a, 1);
    g.meleeDamage(hunter, a, 1);
  }
  assert.equal(hunter.infections, 3);
  assert.equal(hunter.element, "smoke");
  assert.equal(hunter.maxHp, 4);
  assert.equal(hunter.skillsDisabled, false);
  for (const [form, kind] of [
    ["smoke", "ability"],
    ["fire", "ability"],
    ["dark", "utility"],
  ])
    assert.ok(canUseSkill(hunter, form, kind));
  assert.ok(g.startCharge(hunter, "smoke"));
  assert.ok(g.hazards.some((h) => h.kind === "vog"));
  g.fell(hunter);
  const order = hunter.infectionOrder;
  g.respawn(hunter);
  assert.equal(hunter.element, "smoke");
  assert.equal(hunter.infections, 3);
  assert.equal(hunter.infectionOrder, order);
  assert.equal(hunter.hp, 4);
  assert.equal(hunter.skillsDisabled, false);
});
test("Smoke ability damage respects survivor Rebirth then converts instead of scheduling Light respawn", () => {
  const g = night(5),
    hunter = g.player,
    survivor = g.fighters[5];
  g.nightForm(hunter, "smoke", 1);
  g.damage(hunter, survivor, 30, true, false, "fire");
  assert.equal(survivor.team, 0);
  assert.equal(survivor.hp, 1);
  g.damage(hunter, survivor, 30, true, false, "fire");
  assert.equal(survivor.team, 1);
  assert.equal(survivor.alive, true);
  assert.equal(survivor.respawnAt, undefined);
  assert.equal(hunter.infections, 1);
});
test("portals are unavailable through placement, utility and traversal in this mode", () => {
  const g = night(7),
    a = g.fighters[7];
  assert.equal(g.utility(a, true, "spirit"), false);
  assert.equal(g.portals.begin(a), false);
  assert.equal(g.portals.activate(a), false);
  g.portals.placing = a.id;
  assert.equal(g.portals.place(a, 1024, 680), false);
  g.portals.portals.push({
    id: "injected",
    owner: "maze",
    x: a.x,
    y: a.y,
    r: 25,
    opensAt: 0,
  });
  assert.equal(g.portals.enter(a, a), false);
});
test("Spirit AI uses Revival and Smoke AI uses its normal abilities while navigating", () => {
  const g = night(7),
    spirit = g.fighters[7],
    oldest = g.player;
  g.aiMazeCorruption(spirit, 0.02);
  assert.equal(spirit.chargeForm, "spirit");
  spirit.charge = 0.5;
  g.aiMazeCorruption(spirit, 0.02);
  assert.equal(oldest.element, "light");
  const smoke = g.fighters[1];
  g.nightForm(smoke, "smoke", 1);
  Object.assign(smoke, { x: 1024, y: 680 });
  Object.assign(oldest, { x: 1090, y: 680 });
  g.aiMazeCorruption(smoke, 0.02);
  assert.ok(g.hazards.some((h) => h.owner === smoke && h.kind === "vog"));
  smoke.abilityCd = 0;
  g.aiMazeCorruption(smoke, 0.02);
  assert.equal(smoke.chargeForm, "fire");
});
