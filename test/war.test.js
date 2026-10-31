import test from "node:test";
import assert from "node:assert/strict";
import { Combat, ELEMENTS } from "../src/combat.js";
import { updateWar, WAR_HEAL } from "../src/war.js";

const game = (options = {}) =>
  new Combat({
    mode: "war",
    element: "earth",
    enemyElement: "air",
    mapId: "classic",
    ...options,
  });
for (const size of [3, 4, 5])
  test(`War ${size}v${size}: uniform opposing armies, safe spawns and matching respawns`, () => {
    for (const mapId of ["classic", "garden", "tower"]) {
      const g = game({ size, mapId });
      assert.equal(g.fighters.length, size * 2);
      for (const a of g.fighters) {
        assert.equal(a.element, a.team ? "air" : "earth");
        assert.ok(g.walkablePoint(a, 18));
      }
      assert.equal(g.timeLimit, 180);
      assert.equal(g.respawnDelay, 10);
      assert.equal(g.friendlyFire, true);
      const fallen = g.fighters.find((a) => a.team === 0 && a !== g.player),
        spawn = { ...fallen.spawn };
      g.fell(fallen, { killer: g.fighters[1] });
      assert.equal(g.scores[1], 1);
      g.time = fallen.respawnAt;
      g.respawn(fallen);
      assert.equal(fallen.element, "earth");
      assert.equal(fallen.x, spawn.x);
      assert.equal(fallen.y, spawn.y);
    }
  });
test("War random opposition always shares a different origin; only Water/Fire forces the volcano", () => {
  for (const element of Object.keys(ELEMENTS))
    for (const random of [0, 0.2, 0.4, 0.6, 0.8, 0.999]) {
      const g = new Combat({
        mode: "war",
        element,
        size: 5,
        random: () => random,
      });
      const rival = g.warElements[1];
      assert.notEqual(rival, element);
      assert.ok(
        g.fighters
          .filter((a) => a.team === 1)
          .every((a) => a.element === rival),
      );
      assert.equal(
        g.mapId === "volcano",
        [element, rival].includes("water") && [element, rival].includes("fire"),
      );
    }
  for (const [element, enemyElement] of [
    ["water", "fire"],
    ["fire", "water"],
  ]) {
    const g = game({ element, enemyElement, mapId: "tower", size: 5 });
    assert.equal(g.mapId, "volcano");
    assert.ok(g.fighters.every((a) => g.map.walkable(a, 18)));
    assert.ok(g.map.lineClear(g.warBases[0], g.warBases[1]));
  }
});
test("War drops spawn every ten seconds at both bases, except Light, and freeze during countdown", () => {
  const g = game({ countdown: true });
  for (let i = 0; i < 40; i++) g.update(0.05, undefined, false);
  assert.equal(g.time, 0);
  assert.equal(g.healthDrops.length, 0);
  g.countdown = 0;
  g.time = 9.9;
  updateWar(g, 0);
  assert.equal(g.healthDrops.length, 0);
  g.time = 10;
  updateWar(g, 0);
  assert.equal(g.healthDrops.length, 2);
  updateWar(g, 0);
  assert.equal(g.healthDrops.length, 2);
  g.time = 30;
  updateWar(g, 0);
  assert.equal(g.healthDrops.length, 6);
  for (const d of g.healthDrops) {
    assert.ok(
      Math.hypot(d.x - g.warBases[d.team].x, d.y - g.warBases[d.team].y) <= 31,
    );
    assert.ok(g.walkablePoint(d));
  }
  const light = game({ element: "light" });
  light.time = 20;
  updateWar(light, 0);
  assert.equal(light.healthDrops.length, 2);
  assert.ok(light.healthDrops.every((d) => d.team === 1));
});
test("Only an injured living teammate consumes a drop on contact, for fully charged Healing", () => {
  const g = game();
  g.time = 10;
  updateWar(g, 0);
  const drop = g.healthDrops.find((d) => d.team === 0),
    a = g.player,
    b = g.fighters[1];
  a.x = drop.x;
  a.y = drop.y;
  updateWar(g, 0);
  assert.ok(g.healthDrops.includes(drop), "full health preserves the drop");
  a.x += 80;
  a.hp = 30;
  b.x = drop.x;
  b.y = drop.y;
  b.hp = 30;
  updateWar(g, 0);
  assert.ok(g.healthDrops.includes(drop), "enemy cannot steal");
  a.x = drop.x;
  a.alive = false;
  updateWar(g, 0);
  assert.ok(g.healthDrops.includes(drop), "dead cannot consume");
  a.alive = true;
  updateWar(g, 0);
  assert.equal(a.hp, 30 + WAR_HEAL);
  assert.equal(b.hp, 30);
  assert.ok(!g.healthDrops.includes(drop));
  const healing = new Combat({
    mode: "duel",
    mapId: "classic",
    element: "light",
  });
  healing.player.hp = 30;
  healing.cast(healing.player, 2.6, "light");
  assert.equal(healing.player.hp, a.hp);
  g.healthDrops.push({ ...drop });
  a.hp = 115;
  updateWar(g, 0);
  assert.equal(a.hp, a.maxHp);
});
test("Volcanic heat drains Water exactly one HP per second, can fell it, and stops while dead or finished", () => {
  const g = game({ element: "water", enemyElement: "fire", size: 3 });
  const a = g.player,
    fire = g.fighters[1];
  a.shield = 1;
  a.dodge = 2;
  for (let i = 0; i < 20; i++) g.update(0.05, undefined, false);
  assert.ok(Math.abs(a.hp - 119) < 1e-7);
  assert.equal(fire.hp, 120);
  a.hp = 0.025;
  g.update(0.05, undefined, false);
  assert.equal(a.hp, 0);
  assert.equal(a.alive, false);
  assert.ok(a.respawnAt > g.time);
  g.update(0.05, undefined, false);
  assert.equal(a.hp, 0);
  const ally = g.fighters.find((b) => b !== a && b.team === 0),
    hp = ally.hp;
  g.finished = true;
  g.update(0.05, undefined, false);
  assert.equal(ally.hp, hp);
  const cool = game({ element: "water", enemyElement: "air" });
  updateWar(cool, 1);
  assert.equal(cool.player.hp, 120);
});
test("War ends on a full-team wipe or scores at three minutes, with ties drawing", () => {
  for (const scores of [
    [3, 1],
    [1, 3],
    [2, 2],
  ]) {
    const g = game();
    g.scores = scores;
    g.time = 180;
    g.update(0.05, undefined, false);
    assert.equal(g.finished, true);
    assert.equal(
      g.result,
      scores[0] === scores[1]
        ? "draw"
        : scores[0] > scores[1]
          ? "victory"
          : "defeat",
    );
  }
  const g = game();
  for (const a of g.fighters.filter((a) => a.team === 1))
    g.fell(a, { killer: g.player });
  g.checkMatchEnd();
  assert.equal(g.finished, true);
  assert.equal(g.result, "victory");
  assert.equal(g.scores[0], 3);
});
test("Injured War AI returns to an available friendly healing drop", () => {
  const g = game({ mapId: "garden" }),
    a = g.fighters.find((a) => a.team === 0 && a !== g.player);
  g.time = 10;
  updateWar(g, 0);
  const drop = g.healthDrops.find((d) => d.team === 0);
  a.hp = 30;
  a.x = 900;
  a.y = 680;
  const before = Math.hypot(a.x - drop.x, a.y - drop.y);
  for (let i = 0; i < 30; i++) g.ai(a, 0.05);
  assert.ok(Math.hypot(a.x - drop.x, a.y - drop.y) < before - 50);
});
