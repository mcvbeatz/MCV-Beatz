import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, hasPassive } from "../src/combat.js";
const tick = (g, s, ai = false) => {
  for (let t = 0; t < s - 1e-8 && !g.finished; t += 0.02)
    g.update(0.02, { x: 0, y: 0 }, ai);
};
const clearWave = (g) => {
  for (const a of [...g.fighters])
    if (a.team === 1) g.fell(a, { killer: g.player });
  g.checkMatchEnd();
};
test("Fusion Rush only permits 3v3/4v4, has neutral visible shards, timed scoring and respawns", () => {
  for (const [size, count] of [
    [2, 6],
    [3, 6],
    [4, 8],
    [9, 8],
  ]) {
    const g = new Combat({
      mode: "rush",
      size,
      element: "light",
      random: () => 0.1,
    });
    assert.equal(g.fighters.length, count);
    assert.equal(g.timeLimit, 180);
    assert.equal(g.tokens.filter((t) => t.shard).length, 6);
    assert.equal(g.visibleTokens(1).length, 6);
  }
  const g = new Combat({ mode: "rush", element: "light" }),
    a = g.player,
    b = g.fighters[1];
  g.tokens = [
    {
      parts: ["air"],
      neutral: true,
      shard: true,
      souls: [],
      x: a.x,
      y: a.y,
      expiresAt: 99,
    },
  ];
  assert.ok(g.touchTokens(a));
  assert.equal(a.element, "spirit");
  assert.equal(g.scores[0], 3);
  assert.ok(a.nativeParts.includes("air"));
  assert.equal(a.absorbed.length, 0);
  g.tokens = [
    {
      parts: ["earth"],
      neutral: true,
      shard: true,
      souls: [],
      x: a.x,
      y: a.y,
      expiresAt: 99,
    },
  ];
  g.touchTokens(a);
  assert.equal(a.element, "divine");
  assert.equal(g.scores[0], 8);
  g.fell(b, { killer: a });
  assert.equal(g.scores[0], 9);
  g.fell(a);
  g.respawn(a);
  g.applyFusion(a, ["air"]);
  g.applyFusion(a, ["earth"]);
  assert.equal(g.scores[0], 9);
  for (const ally of g.fighters.filter((f) => f.team === 0)) g.fell(ally);
  assert.equal(g.checkMatchEnd(), false);
  g.time = 180;
  assert.ok(g.checkMatchEnd());
  assert.equal(g.result, "victory");
});
test("Fusion Rush rejects incompatible shards and replenishes neutral pickups for either team", () => {
  const g = new Combat({ mode: "rush", element: "fire", random: () => 0.5 }),
    a = g.player;
  g.tokens = [
    {
      parts: ["water"],
      neutral: true,
      shard: true,
      souls: [],
      x: a.x,
      y: a.y,
      expiresAt: 50,
    },
  ];
  assert.equal(g.touchTokens(a), false);
  assert.equal(g.tokens.length, 1);
  g.tokens = [];
  g.time = 7.99;
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.equal(g.tokens.length, 2);
  assert.ok(g.tokens.every((t) => t.neutral));
  const enemy = g.fighters[1];
  Object.assign(enemy, makeFighter(enemy.id, "earth", 1, 500, 350));
  g.tokens = [
    {
      parts: ["light"],
      neutral: true,
      shard: true,
      souls: [],
      x: enemy.x,
      y: enemy.y,
    },
  ];
  assert.ok(g.touchTokens(enemy));
  assert.equal(g.scores[1], 3);
});
test("Gauntlet progresses through choices and unlocks the final boss on tier III", () => {
  const g = new Combat({
    mode: "gauntlet",
    element: "light",
    random: () => 0.1,
  });
  assert.equal(g.wave, 1);
  assert.equal(g.player.parts.length, 1);
  clearWave(g);
  assert.equal(g.finished, false);
  assert.equal(g.intermission, true);
  const time = g.time;
  tick(g, 1);
  assert.equal(g.time, time);
  assert.ok(g.rewardChoices().some((c) => c.id === "shard:air"));
  assert.equal(g.chooseReward("invalid"), false);
  assert.ok(g.chooseReward("shard:air"));
  assert.equal(g.player.element, "spirit");
  assert.equal(g.wave, 2);
  assert.equal(g.intermission, false);
  clearWave(g);
  g.chooseReward("shard:earth");
  assert.equal(g.player.element, "divine");
  assert.equal(g.finalWave, true);
  assert.equal(g.fighters.filter((a) => a.team === 1).length, 1);
  assert.equal(g.fighters[1].element, "invincible");
  assert.equal(g.fighters[1].maxHp, 180);
  clearWave(g);
  assert.equal(g.finished, true);
  assert.equal(g.result, "victory");
});
test("Gauntlet healing and next-wave upgrades work; losing ends the run", () => {
  const g = new Combat({ mode: "gauntlet", element: "earth" });
  g.player.hp = 25;
  clearWave(g);
  g.chooseReward("heal");
  assert.equal(g.player.hp, 120);
  clearWave(g);
  g.chooseReward("upgrade");
  assert.equal(g.player.waveDamage, 1.25);
  assert.equal(g.player.waveSpeed, 1.15);
  const enemy = g.fighters[1];
  Object.assign(enemy, makeFighter(enemy.id, "dark", 1, 500, 350));
  const hp = enemy.hp;
  g.damage(g.player, enemy, 20);
  assert.equal(hp - enemy.hp, 25);
  clearWave(g);
  assert.equal(g.player.waveDamage, 1);
  assert.equal(g.player.waveSpeed, 1);
  g.chooseReward("heal");
  g.fell(g.player);
  g.checkMatchEnd();
  assert.equal(g.result, "defeat");
});
test("Team Gauntlet survives one ally death, restores them between waves, and loses on a full wipe", () => {
  const g = new Combat({ mode: "gauntlet-team", element: "water", size: 3 });
  assert.equal(g.fighters.filter((a) => a.team === 0).length, 3);
  g.fell(g.player);
  assert.equal(g.checkMatchEnd(), false);
  clearWave(g);
  assert.equal(g.player.alive, true);
  assert.equal(g.player.hp, 60);
  g.chooseReward("heal");
  assert.ok(
    g.fighters.filter((a) => a.team === 0).every((a) => a.hp === a.maxHp),
  );
  for (const a of g.fighters.filter((a) => a.team === 0)) g.fell(a);
  g.checkMatchEnd();
  assert.equal(g.result, "defeat");
});
test("Roulette warns five seconds early, transforms everyone independently, preserves health and removes old powers", () => {
  const g = new Combat({
    mode: "roulette",
    players: 8,
    element: "fire",
    random: () => 0.2,
  });
  assert.equal(g.fighters.length, 8);
  assert.equal(new Set(g.fighters.map((a) => a.team)).size, 8);
  assert.equal(g.fusionEnabled, false);
  g.player.hp = 57;
  g.player.kills = 2;
  g.player.boost = 8;
  g.player.shield = 1;
  g.player.charging = true;
  g.player.burst = 1;
  g.player.burstX = 0;
  g.player.burstY = 0;
  g.time = 19.98;
  g.update(0.01, { x: 0, y: 0 }, false);
  assert.equal(g.nextForms, null);
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.equal(Object.keys(g.nextForms).length, 8);
  const next = g.nextForms[g.player.id];
  assert.notEqual(next, "fire");
  g.fighters.forEach((a, i) => {
    a.x = 180 + i * 90;
    a.y = 350;
  }); // Keep the transformation check out of contact-burn range.
  g.time = 24.99;
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.equal(g.player.element, next);
  assert.equal(g.player.hp, 57);
  assert.equal(g.player.kills, 2);
  assert.equal(g.player.shield, 0);
  assert.equal(g.player.charging, false);
  assert.equal(g.player.boost, 0);
  assert.equal(g.player.burst, 0);
  assert.equal(g.nextForms, null);
  assert.equal(g.nextShuffleAt, 50);
  for (const a of g.fighters.slice(1)) g.fell(a);
  g.checkMatchEnd();
  assert.equal(g.result, "victory");
});
