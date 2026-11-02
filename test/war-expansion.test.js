import test from "node:test";
import assert from "node:assert/strict";
import { Combat, combination, makeFighter } from "./combat-fixture.js";
import { canSeeWarTrap, updateWar } from "../src/war.js";

const war = (options = {}) =>
  new Combat({
    mode: "war",
    element: "earth",
    enemyElement: "air",
    random: () => 0,
    ...options,
  });
test("Magma from Fire and fused Fire tabs expires after fifteen seconds", () => {
  for (const element of ["fire", "blaze", "demonic", "phoenix"]) {
    const g = new Combat({ mode: "fused3" });
    const a = makeFighter("player", element, 0, 400, 350);
    g.fighters = [a];
    g.player = a;
    assert.ok(g.utility(a, true, "fire"));
    assert.equal(g.hazards[0].kind, "magma");
    assert.equal(g.hazards[0].life, 15);
    for (let i = 0; i < 299; i++) g.updateHazards(0.05);
    assert.equal(g.hazards.length, 1);
    g.updateHazards(0.051);
    assert.equal(g.hazards.length, 0);
  }
});
test("War survives single-team and simultaneous wipes, respawns everyone and ends only on time", () => {
  const g = war();
  for (const a of g.fighters) g.fell(a);
  assert.equal(g.checkMatchEnd(), false);
  g.time = 10;
  g.update(0.01, undefined, false);
  assert.ok(g.fighters.every((a) => a.alive));
  for (const a of g.fighters.filter((a) => a.team === 1))
    g.fell(a, { killer: g.player });
  assert.equal(g.checkMatchEnd(), false);
  g.time = 180;
  assert.equal(g.checkMatchEnd(), true);
  assert.equal(g.result, "victory");
});
test("two consecutive War deaths award a team-only compatible base token; kill resets and respawn removes fusion", () => {
  const g = war(),
    a = g.player,
    enemy = g.fighters.find((b) => b.team !== a.team);
  const die = () => {
    a.x = 600;
    a.y = 300;
    g.fell(a, { killer: enemy });
    g.respawn(a);
  };
  die();
  assert.equal(g.warDeathStreaks[a.id], 1);
  assert.equal(g.tokens.filter((t) => t.warBonus).length, 0);
  die();
  let bonus = g.tokens.find((t) => t.warBonus);
  assert.ok(bonus);
  assert.ok(combination([a.spawn.element], bonus.parts));
  assert.ok(
    Math.hypot(bonus.x - g.warBases[0].x, bonus.y - g.warBases[0].y) < 100,
  );
  Object.assign(enemy, { x: bonus.x, y: bonus.y });
  assert.equal(g.visibleTokens(enemy.team).includes(bonus), false);
  assert.equal(g.touchTokens(enemy), false);
  Object.assign(a, { x: bonus.x, y: bonus.y });
  assert.ok(g.touchTokens(a));
  assert.equal(a.parts.length, 2);
  die();
  assert.equal(a.element, "earth");
  assert.deepEqual(a.parts, ["earth"]);
  assert.equal(
    g.tokens.filter((t) => t.warBonus).length,
    0,
    "third death does not award another pair yet",
  );
  g.fell(enemy, { killer: a });
  assert.equal(g.warDeathStreaks[a.id], 0);
  g.respawn(enemy);
  die();
  assert.equal(g.tokens.filter((t) => t.warBonus && t.team === 0).length, 0);
  die();
  assert.equal(g.tokens.filter((t) => t.warBonus && t.team === 0).length, 1);
});
test("Light/Dark War forces the temple in both army orders with safe bases", () => {
  for (const [element, enemyElement] of [
    ["light", "dark"],
    ["dark", "light"],
  ]) {
    const g = war({ element, enemyElement, mapId: "garden", size: 5 });
    assert.equal(g.mapId, "temple");
    assert.ok(g.fighters.every((a) => g.map.walkable(a, 24)));
    assert.ok(g.spikeTraps.every((t) => g.map.walkable(t, 34)));
    assert.ok(
      g.fighters.every((a) =>
        g.spikeTraps.every((t) => Math.hypot(t.x - a.x, t.y - a.y) > 60),
      ),
    );
  }
});
test("trap discovery is personal, persists through respawn, and controls AI knowledge", () => {
  const g = war({ element: "light", enemyElement: "dark" });
  const a = g.player,
    ally = g.fighters.find((b) => b !== a && b.team === a.team),
    dark = g.fighters.find((b) => b.team !== a.team),
    trap = g.spikeTraps[0];
  assert.equal(canSeeWarTrap(g, a, trap), false);
  assert.equal(canSeeWarTrap(g, dark, trap), true);
  assert.equal(g.aiHazards(a).includes(trap), false);
  assert.equal(g.mobilitySafe(a, trap), true);
  assert.equal(g.mobilitySafe(dark, trap), false);
  assert.equal(g.aiHazards(dark).includes(trap), true);
  Object.assign(a, { x: trap.x, y: trap.y });
  updateWar(g, 0);
  assert.equal(a.hp, 102);
  assert.equal(canSeeWarTrap(g, a, trap), true);
  assert.equal(canSeeWarTrap(g, ally, trap), false);
  assert.equal(g.aiHazards(a).includes(trap), true);
  updateWar(g, 0);
  assert.equal(a.hp, 102, "not frame-rate-dependent damage");
  g.time = 1;
  updateWar(g, 0);
  assert.equal(a.hp, 84);
  g.fell(a);
  g.respawn(a);
  assert.equal(canSeeWarTrap(g, a, trap), true);
  Object.assign(dark, { x: trap.x, y: trap.y });
  updateWar(g, 0);
  assert.equal(dark.hp, 102, "Dark sees traps but is not immune");
});
test("spike traps catch dash crossings, can fell fighters and ignore teleport paths", () => {
  const g = war({ element: "dark", enemyElement: "light" });
  const a = g.player,
    t = g.spikeTraps[0];
  a.x = t.x - 40;
  a.y = t.y;
  updateWar(g, 0);
  a.x = t.x + 40;
  updateWar(g, 0);
  assert.equal(a.hp, 102);
  g.time = 2;
  a.hp = 10;
  a.x = t.x;
  updateWar(g, 0);
  assert.equal(a.alive, false);
  assert.ok(a.respawnAt > g.time);
  g.respawn(a);
  a.x = t.x - 100;
  a.y = t.y;
  updateWar(g, 0);
  a.x = t.x + 100;
  updateWar(g, 0);
  assert.equal(a.hp, 120);
});
