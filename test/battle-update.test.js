import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  visibility,
  viewerVisibility,
  canUseSkill,
  skillsFor,
} from "../src/combat.js";
import { nextWave, updateAdvanced } from "../src/advanced-modes.js";
const tick = (g, s) => {
  for (let t = 0; t < s; t += 0.02) g.update(0.02, { x: 0, y: 0 }, false);
};
test("Corruption requires two hits, self healing restores resistance, and Flash is unavailable", () => {
  const g = new Combat({ mode: "corruption", players: 4 }),
    [a, b, c] = g.fighters;
  g.corrupt(a);
  g.corruptionStarted = true;
  g.meleeDamage(a, b, 99);
  assert.equal(b.hp, 1);
  assert.equal(b.element, "light");
  c.hp = 1;
  assert.equal(g.healingTarget(b), b);
  g.cast(b, 1, "light");
  assert.equal(b.hp, 2);
  assert.equal(c.hp, 1);
  assert.equal(canUseSkill(b, "light", "utility"), false);
  assert.equal(g.utility(b), false);
  g.meleeDamage(a, b, 99);
  assert.equal(b.element, "light");
  g.meleeDamage(a, b, 99);
  assert.equal(b.element, "dark");
  assert.equal(a.infections, 1);
});
test("Light support AI heals itself after a corruption strike", () => {
  const g = new Combat({ mode: "corruption", players: 4 }),
    [a, b] = g.fighters;
  g.corrupt(a);
  g.corruptionStarted = true;
  g.meleeDamage(a, b, 14);
  g.aiCorruption(b, 0.02);
  assert.equal(b.charging, true);
  b.charge = 0.3;
  g.aiCorruption(b, 0.02);
  assert.equal(b.hp, 2);
});
test("Gauntlet enemy health is halved at every wave and for solo and team bosses", () => {
  for (const [mode, size] of [
    ["gauntlet", 1],
    ["gauntlet-team", 4],
  ]) {
    const g = new Combat({ mode, size, element: "light" });
    assert.ok(
      g.fighters.filter((a) => a.team === 1).every((a) => a.maxHp === 60),
    );
    nextWave(g);
    assert.ok(
      g.fighters.filter((a) => a.team === 1).every((a) => a.maxHp === 69),
    );
    g.applyFusion(g.player, ["air"]);
    g.applyFusion(g.player, ["earth"]);
    nextWave(g);
    assert.equal(
      g.fighters.find((a) => a.team === 1).maxHp,
      Math.max(180, size * 120),
    );
  }
});
test("Roulette respawns after ten seconds and transformations preserve pending respawns", () => {
  const g = new Combat({ mode: "roulette", players: 4, random: () => 0.4 }),
    a = g.player;
  g.time = 19;
  g.fell(a, { killer: g.fighters[1] });
  assert.equal(a.respawnAt, 29);
  g.time = 20;
  updateAdvanced(g);
  const next = g.nextForms[a.id];
  assert.ok(next);
  g.time = 25;
  updateAdvanced(g);
  assert.equal(a.alive, false);
  assert.equal(a.respawnAt, 29);
  assert.equal(a.spawn.element, next);
  tick(g, 3.9);
  assert.equal(a.alive, false);
  tick(g, 0.2);
  assert.equal(a.alive, true);
  assert.equal(a.element, next);
  assert.equal(a.deaths, 1);
});
test("Roulette ends for a sole standing player, otherwise kills decide at three minutes", () => {
  const g = new Combat({ mode: "roulette", players: 4 });
  g.fell(g.fighters[1]);
  assert.equal(g.checkMatchEnd(), false);
  g.fell(g.fighters[2]);
  g.fell(g.fighters[3]);
  assert.equal(g.checkMatchEnd(), true);
  assert.equal(g.result, "victory");
  const timed = new Combat({ mode: "roulette", players: 4 });
  timed.player.kills = 4;
  timed.fighters[2].kills = 3;
  timed.time = 180;
  assert.equal(timed.checkMatchEnd(), true);
  assert.equal(timed.result, "victory");
  const tie = new Combat({ mode: "roulette" });
  tie.time = 180;
  tie.checkMatchEnd();
  assert.equal(tie.result, "draw");
});
test("Divine is visible only to its owner while concealed; enemy targeting remains unchanged", () => {
  const a = makeFighter("player", "divine", 0, 300, 300),
    b = makeFighter("enemy", "fire", 1, 340, 300);
  assert.equal(visibility(a), 0);
  assert.equal(viewerVisibility(a, a), 0.25);
  assert.equal(viewerVisibility(a, b), 0);
  a.hurtReveal = 0.1;
  assert.equal(viewerVisibility(a, a), 0.25);
  assert.equal(viewerVisibility(a, b), 0.1);
});
test("Tailwind boosts living teammates from the Lightning or inherited Air tab", () => {
  for (const form of ["lightning", "air"]) {
    const g = new Combat({ element: "lightning", mode: "team", size: 3 });
    const a = g.player;
    const ally = g.fighters.find((b) => b !== a && b.team === a.team),
      dead = g.fighters.filter((b) => b !== a && b.team === a.team)[1];
    g.fell(dead);
    assert.equal(skillsFor("lightning")[1], "Tailwind");
    assert.equal(g.utility(a, true, form), true);
    assert.equal(a.boost, 2);
    assert.equal(ally.boost, 2);
    assert.equal(dead.boost, 0);
    assert.ok(
      g.fighters.filter((b) => b.team !== a.team).every((b) => b.boost === 0),
    );
    assert.equal(a.utilityCd, 7);
  }
});
test("All surviving winners celebrate for exactly four seconds without advancing combat", () => {
  const g = new Combat({ mode: "team", size: 3 });
  const fallen = g.fighters.find((a) => a.id !== "player" && a.team === 0);
  g.fell(fallen);
  g.player.shield = 1;
  g.player.dimension = { portal: 1 };
  g.finish(0, "test");
  assert.equal(g.player.shield, 0);
  assert.equal(g.player.dimension, null);
  assert.equal(g.celebrationRemaining, 4);
  assert.ok(
    g.fighters.filter((a) => a.alive && a.team === 0).every((a) => a.victory),
  );
  assert.equal(fallen.victory, false);
  assert.ok(g.fighters.filter((a) => a.team === 1).every((a) => !a.victory));
  g.update(0.04);
  assert.equal(g.time, 0);
  g.advanceCelebration(3.99);
  assert.ok(g.celebrationRemaining > 0);
  g.advanceCelebration(0.02);
  assert.equal(g.celebrationRemaining, 0);
});
