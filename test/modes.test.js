import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "../src/combat.js";
const advance = (g, seconds, ai = false) => {
  for (let t = 0; t < seconds - 1e-8 && !g.finished; t += 0.01)
    g.update(0.01, { x: 0, y: 0 }, ai);
};
const match = (mode, options = {}) =>
  new Combat({ mode, element: "light", random: () => 0.3, ...options });
const at = (a, point) => Object.assign(a, { x: point.x, y: point.y });

test("CTF uses origin teams, forbids every fusion path and never drops tokens", () => {
  const g = match("ctf", { size: 4, element: "divine" });
  assert.equal(g.fighters.length, 8);
  assert.equal(g.player.element, "fire");
  assert.equal(g.applyFusion(g.player, ["earth"]), false);
  g.fell(g.fighters[2]);
  assert.equal(g.tokens.length, 0);
  assert.equal(g.fighters[2].respawnAt, 10);
});
test("CTF carries, drops, returns and requires the home flag to capture; first three wins", () => {
  const g = match("ctf"),
    a = g.player,
    enemy = g.fighters[1];
  // Keep everyone except the runners away from either base.
  for (const b of g.fighters.slice(2)) at(b, { x: 500, y: 480 });
  at(a, g.flags[1]);
  at(enemy, g.flags[0]);
  g.updateFlags();
  assert.equal(g.flags[1].carrier, a.id);
  assert.equal(g.flags[0].carrier, enemy.id);
  at(a, g.flags[0].home);
  g.updateFlags();
  assert.equal(g.scores[0], 0);
  at(enemy, { x: 400, y: 250 });
  g.fell(enemy);
  assert.equal(g.flags[0].dropped, true);
  assert.equal(g.flags[0].carrier, null);
  at(a, g.flags[0]);
  g.updateFlags();
  assert.equal(g.flags[0].dropped, false);
  at(a, g.flags[0].home);
  g.updateFlags();
  assert.deepEqual(g.scores, [1, 0]);
  for (let i = 0; i < 2; i++) {
    at(a, g.flags[1]);
    g.updateFlags();
    at(a, g.flags[0].home);
    g.updateFlags();
  }
  g.checkMatchEnd();
  assert.equal(g.result, "victory");
  assert.deepEqual(g.scores, [3, 0]);
});
test("CTF continues through full-team deaths and respawns exactly after ten seconds", () => {
  const g = match("ctf");
  for (const a of g.fighters) g.fell(a);
  advance(g, 9.99);
  assert.equal(g.finished, false);
  assert.ok(g.fighters.every((a) => !a.alive));
  advance(g, 0.02);
  assert.ok(g.fighters.every((a) => a.alive));
  assert.equal(g.tokens.length, 0);
});
test("CTF bots have attacking, defending and carrier-interception objectives", () => {
  const g = match("ctf");
  const attacker = g.fighters[1],
    defender = g.fighters[3];
  assert.equal(g.flagObjective(attacker), g.flags[0]);
  assert.ok(g.flagObjective(defender).x > 700);
  g.flags[1].carrier = g.player.id;
  assert.equal(g.flagObjective(attacker), g.player);
  assert.equal(g.flagObjective(defender), g.player);
  g.flags[1].carrier = null;
  for (const a of g.fighters) {
    a.maxHp = a.hp = 100000;
  }
  advance(g, 20, true);
  assert.ok(
    g.scores[1] > 0 || g.flags[0].carrier,
    "attacking bot reaches and steals the enemy flag",
  );
});
test("TDM credits enemy kills, not friendly fire or echo deaths, and credits minions to their summoner", () => {
  const g = match("tdm"),
    a = g.player,
    enemy = g.fighters[1],
    ally = g.fighters[2];
  g.damage(a, enemy, 1000);
  assert.deepEqual(g.scores, [1, 0]);
  g.damage(a, ally, 1000);
  assert.deepEqual(g.scores, [1, 0]);
  const echo = makeFighter("echo", "fire", 0, 400, 300);
  echo.echo = true;
  echo.summoner = a.id;
  g.fighters.push(echo);
  g.damage(g.fighters[3], echo, 1000);
  assert.deepEqual(g.scores, [1, 0]);
  echo.alive = true;
  g.damage(echo, g.fighters[3], 1000);
  assert.deepEqual(g.scores, [2, 0]);
  assert.equal(a.kills, 2);
});
test("TDM teammate respawn preserves acquired fusion; own respawn clears fusion and statuses", () => {
  const g = match("tdm"),
    a = g.player,
    ally = g.fighters[2];
  g.fell(ally);
  at(a, ally);
  assert.equal(g.touchTokens(a), true);
  assert.equal(a.element, "spirit");
  advance(g, 10.01);
  assert.equal(ally.alive, true);
  assert.equal(a.element, "spirit");
  assert.equal(a.absorbed.length, 1);
  g.fell(a);
  advance(g, 9.99);
  assert.equal(a.alive, false);
  advance(g, 0.02);
  assert.equal(g.player, a);
  assert.equal(a.alive, true);
  assert.equal(a.element, "light");
  assert.deepEqual(a.parts, ["light"]);
  assert.deepEqual(a.absorbed, []);
  assert.equal(a.respawnAt, undefined);
  assert.equal(a.lost, false);
  assert.deepEqual([a.x, a.y], [a.spawn.x, a.spawn.y]);
});
test("TDM revival resets the fallen fighter without taking fusion from the bearer", () => {
  const g = match("tdm"),
    a = g.player,
    ally = g.fighters[2];
  g.fell(ally);
  at(a, ally);
  g.touchTokens(a);
  assert.equal(g.revive(a), true);
  assert.equal(a.element, "spirit");
  assert.equal(ally.alive, true);
  assert.equal(ally.element, "air");
  assert.equal(ally.respawnAt, undefined);
});
test("TDM a team wipe loses immediately even with a score lead and nearly completed respawn", () => {
  const g = match("tdm");
  g.scores = [20, 0];
  g.fell(g.player);
  advance(g, 9.99);
  g.fell(g.fighters[2]);
  advance(g, 0.02);
  assert.equal(g.finished, true);
  assert.equal(g.result, "defeat");
  assert.equal(g.player.alive, false);
});
test("TDM simultaneous wipes draw; timeout chooses highest score or a tie", () => {
  const wipe = match("tdm");
  for (const a of wipe.fighters) wipe.fell(a);
  wipe.checkMatchEnd();
  assert.equal(wipe.result, "draw");
  for (const [scores, result] of [
    [[2, 1], "victory"],
    [[1, 2], "defeat"],
    [[2, 2], "draw"],
  ]) {
    const g = match("tdm");
    g.scores = scores;
    g.time = 179.99;
    advance(g, 0.02);
    assert.equal(g.result, result);
    assert.equal(g.finishReason, "Time expired");
  }
});
test("FFA supports two through eight independent teams and clamps invalid sizes", () => {
  for (const count of [2, 3, 4, 5, 6, 7, 8, 99, 1]) {
    const g = match("ffa", { players: count });
    const expected = Math.max(2, Math.min(8, count));
    assert.equal(g.fighters.length, expected);
    assert.equal(new Set(g.fighters.map((a) => a.team)).size, expected);
    assert.equal(g.enemies(g.player).length, expected - 1);
  }
});
test("FFA exposes enemy tokens, fuses only compatible ones, and finishes on last real survivor", () => {
  const g = match("ffa", { players: 3 });
  const b = g.fighters[1];
  Object.assign(b, makeFighter(b.id, "earth", b.team, b.x, b.y));
  g.fell(b);
  at(g.player, b);
  assert.equal(g.visibleTokens().length, 1);
  assert.equal(g.touchTokens(g.player), true);
  assert.equal(g.player.element, "mirror");
  const c = g.fighters[2];
  Object.assign(c, makeFighter(c.id, "water", c.team, c.x, c.y));
  g.fell(c);
  at(g.player, c);
  assert.equal(g.touchTokens(g.player), false);
  const echo = makeFighter("echo", "fire", c.team, 500, 300);
  echo.echo = true;
  g.fighters.push(echo);
  g.checkMatchEnd();
  assert.equal(g.result, "victory");
});
test("FFA player death does not end the match while two rivals remain", () => {
  const g = match("ffa", { players: 3 });
  g.fell(g.player);
  g.checkMatchEnd();
  assert.equal(g.finished, false);
  g.fell(g.fighters[1]);
  g.checkMatchEnd();
  assert.equal(g.result, "defeat");
});

test("TDM portal closure credits its owner and dimensional deaths still respawn", () => {
  const g = match("tdm", { element: "spirit" });
  const enemy = g.fighters[1];
  assert.equal(g.portals.begin(g.player), true);
  assert.ok(g.portals.place(g.player, 450, 300));
  const portal = g.portals.portals[0];
  enemy.dimension = { portal: portal.id, dx: 1, dy: 0, age: 1 };
  assert.equal(g.portals.close(g.player, portal.id), true);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.lost, true);
  assert.deepEqual(g.scores, [1, 0]);
  advance(g, 10.01);
  assert.equal(enemy.alive, true);
  assert.equal(enemy.lost, false);
});
