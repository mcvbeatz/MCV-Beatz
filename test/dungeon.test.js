import test from "node:test";
import assert from "node:assert/strict";
import { Combat } from "../src/combat.js";
import { updateDungeon, dungeonAI } from "../src/dungeon.js";
import { updateRespawnCamera } from "../src/camera.js";
import { PLAY_MODES, SOLO_MODES } from "../src/mode-catalog.js";
const game = () =>
  new Combat({ mode: "dungeon", element: "fire", random: () => 0.42 });
const boss = (g, role) => g.fighters.find((a) => a.dungeonRole === role);
function defeat(g, role) {
  g.fell(boss(g, role), { killer: g.player });
  g.checkMatchEnd();
}
test("Dungeon starts a solo exploration run with three monster species and ordered bosses", () => {
  const g = game();
  assert.ok(PLAY_MODES.includes("dungeon"));
  assert.ok(SOLO_MODES.includes("dungeon"));
  assert.equal(g.map.kind, "dungeon");
  assert.equal(g.fighters.filter((a) => a.team === 0).length, 1);
  assert.deepEqual(
    new Set(g.fighters.filter((a) => a.monsterKind).map((a) => a.monsterKind)),
    new Set(["alligator", "snake", "wolf"]),
  );
  assert.deepEqual(
    g.fighters.filter((a) => a.dungeonRole).map((a) => a.element),
    ["water", "apparition", "terraformer"],
  );
  assert.equal(g.timeLimit, null);
  assert.equal(g.respawnDelay, null);
  for (const a of g.fighters.filter((a) => !a.dungeonSection))
    assert.ok(g.map.walkable(a), a.id);
});
test("sealed wings reject movement, teleport destinations and damage until their requirements are met", () => {
  const g = game(),
    final = boss(g, "final"),
    apparition = boss(g, "apparition");
  assert.equal(g.map.walkable(final), false);
  assert.equal(g.map.walkable(apparition), false);
  assert.equal(g.damage(g.player, final, 1000, true), 0);
  assert.equal(g.damage(g.player, apparition, 1000, true), 0);
  const before = { x: final.x, y: final.y };
  dungeonAI(g, final, 0.05);
  assert.deepEqual({ x: final.x, y: final.y }, before);
  defeat(g, "water");
  assert.equal(g.map.dungeonStage, 0);
  assert.ok(g.dungeon.reward);
  assert.equal(g.finished, false);
  const time = g.time;
  g.update(0.05, { x: 1, y: 0 });
  assert.equal(g.time, time);
  assert.equal(g.chooseReward("shard:fire"), false);
  assert.ok(g.chooseReward("shard:air"));
  assert.equal(g.map.dungeonStage, 1);
  assert.ok(g.map.walkable(apparition));
  assert.equal(g.map.walkable(final), false);
  const token = g.tokens[0];
  assert.deepEqual(token.parts, ["air"]);
  Object.assign(g.player, { x: token.x, y: token.y });
  g.touchTokens(g.player);
  assert.equal(g.player.parts.length, 2);
  defeat(g, "apparition");
  assert.ok(g.dungeon.key);
  assert.ok(!g.dungeon.hasKey);
  assert.equal(g.map.walkable(final), false);
  const choice = g.rewardChoices()[0];
  assert.ok(choice);
  assert.ok(g.chooseReward(choice.id));
  const second = g.tokens[0];
  Object.assign(g.player, { x: second.x, y: second.y });
  g.touchTokens(g.player);
  assert.equal(g.player.parts.length, 3);
  Object.assign(g.player, { x: g.dungeon.key.x, y: g.dungeon.key.y });
  updateDungeon(g);
  assert.ok(g.dungeon.hasKey);
  Object.assign(g.player, { x: 1850, y: 735 });
  updateDungeon(g);
  assert.ok(g.dungeon.doorOpen);
  assert.ok(g.map.walkable(final));
  assert.equal(g.dungeon.hasKey, false);
  defeat(g, "final");
  assert.equal(g.finished, true);
  assert.equal(g.result, "victory");
});
test("monsters drop health, never elemental tokens, and pickups require physical contact", () => {
  const g = game(),
    a = g.fighters.find((a) => a.monsterKind);
  g.fell(a);
  assert.equal(g.healthDrops.length, 1);
  assert.equal(g.tokens.length, 0);
  g.player.hp = 50;
  updateDungeon(g);
  assert.equal(g.player.hp, 50);
  Object.assign(g.player, { x: a.x, y: a.y });
  updateDungeon(g);
  assert.equal(g.player.hp, 82);
  assert.equal(g.healthDrops.length, 0);
  g.healthDrops.push({ x: a.x, y: a.y, heal: 32 });
  g.player.hp = g.player.maxHp;
  updateDungeon(g);
  assert.equal(g.healthDrops.length, 1);
});
test("Dungeon ends on player defeat; enemies cannot steal selected neutral rewards", () => {
  const g = game();
  defeat(g, "water");
  g.chooseReward("shard:air");
  const a = g.fighters.find((a) => a.monsterKind);
  Object.assign(a, g.tokens[0]);
  assert.equal(g.touchTokens(a), false);
  assert.equal(g.tokens.length, 1);
  g.fell(g.player);
  g.checkMatchEnd();
  assert.equal(g.result, "defeat");
  assert.equal(g.finished, true);
});
test("Team Waves spectators can pan after being felled and reset when revived", () => {
  const g = new Combat({ mode: "gauntlet-team", element: "water", size: 3 });
  const start = { x: g.player.x, y: g.player.y };
  g.fell(g.player);
  updateRespawnCamera(g, 0.5, { x: 1, y: 0 });
  assert.ok(g.spectatorFocus.x > start.x);
  assert.deepEqual({ x: g.player.x, y: g.player.y }, start);
  for (const enemy of g.fighters.filter((a) => a.team === 1)) g.fell(enemy);
  g.checkMatchEnd();
  assert.ok(g.intermission);
  assert.ok(g.player.alive);
  assert.equal(g.spectatorFocus, null);
});
test("Dungeon paths connect every accessible room and the unlocked final chamber", () => {
  const g = game();
  g.map.dungeonStage = 2;
  for (const target of g.map.rooms.map((r) => ({
    x: r.x + r.w / 2,
    y: r.y + r.h / 2,
  }))) {
    const a = { ...g.map.entry };
    for (
      let i = 0;
      i < 1300 && Math.hypot(a.x - target.x, a.y - target.y) > 25;
      i++
    ) {
      const p = g.map.route(a, target);
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d < 0.01) break;
      g.map.move(
        a,
        a.x + ((p.x - a.x) / d) * Math.min(10, d),
        a.y + ((p.y - a.y) / d) * Math.min(10, d),
      );
    }
    assert.ok(
      Math.hypot(a.x - target.x, a.y - target.y) < 25,
      JSON.stringify({ target, a }),
    );
  }
});

test("Dungeon monsters pursue, bite, break stone prisons and leave a pickup after combat", () => {
  const g = new Combat({
    mode: "dungeon",
    element: "water",
    random: () => 0.42,
  });
  const a = g.fighters.find((a) => a.monsterKind);
  g.fighters = [g.player, a];
  Object.assign(g.player, { x: a.x + 150, y: a.y });
  const start = a.x;
  for (let i = 0; i < 180; i++) g.update(1 / 30);
  assert.ok(a.x > start + 50);
  assert.ok(g.player.hp < g.player.maxHp);
  assert.ok(g.player.alive);
  a.prisonHp = 65;
  a.attackCd = 0;
  g.ai(a, 0.05);
  assert.equal(a.prisonHp, 51);
  g.damage(g.player, a, 1000, false);
  assert.equal(a.alive, false);
  assert.equal(g.healthDrops.length, 1);
  assert.equal(g.tokens.length, 0);
});
