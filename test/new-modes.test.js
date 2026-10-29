import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, canUseSkill } from "./combat-fixture.js";
const advance = (g, seconds, ai = false) => {
  for (let t = 0; t < seconds - 1e-8 && !g.finished; t += 0.02)
    g.update(0.02, { x: 0, y: 0 }, ai);
};
const corruption = (players = 4) =>
  new Combat({ mode: "corruption", players, random: () => 0 });

test("Corruption starts with up to eight Lights and seeds exactly one random Dark after five seconds", () => {
  const g = corruption(20);
  assert.equal(g.fighters.length, 8);
  assert.ok(g.fighters.every((a) => a.element === "light" && a.team === 0));
  advance(g, 4.98);
  assert.equal(g.finished, false);
  assert.ok(g.fighters.every((a) => a.element === "light"));
  advance(g, 0.04);
  assert.equal(g.fighters.filter((a) => a.element === "dark").length, 1);
  assert.equal(g.player.element, "dark");
  assert.equal(canUseSkill(g.player, "dark", "utility"), false);
  assert.equal(g.utility(g.player), false);
  assert.equal(g.startCharge(g.player), false);
  assert.equal(g.timeLimit, 120);
});
test("Corruption converts in two hits, scores infections, respawns Dark without skills or tokens", () => {
  const g = corruption(),
    [dark, light, hunter] = g.fighters;
  g.time = 5;
  g.corruptionStarted = true;
  g.corrupt(dark);
  g.time = 12;
  g.meleeDamage(dark, light, 0.01);
  assert.equal(light.element, "light");
  assert.equal(light.hp, 1);
  g.meleeDamage(dark, light, 0.01);
  assert.equal(light.element, "dark");
  assert.equal(light.infectedAt, 12);
  assert.equal(dark.infections, 1);
  g.meleeDamage(hunter, light, 0.01);
  assert.equal(light.alive, true);
  g.meleeDamage(hunter, light, 0.01);
  assert.equal(light.alive, false);
  assert.equal(light.respawnAt, 22);
  assert.equal(g.tokens.length, 0);
  advance(g, 10.02);
  assert.ok(light.alive);
  assert.equal(light.element, "dark");
  assert.equal(light.skillsDisabled, true);
  assert.equal(light.infectedAt, 12);
  assert.equal(g.finished, false);
});
test("Corruption disables friendly strikes, damage and Flash, and cancels pre-conversion attacks", () => {
  const g = corruption(),
    [a, b, c] = g.fighters;
  Object.assign(a, { x: 300, y: 300 });
  Object.assign(b, { x: 340, y: 300 });
  g.strike(b);
  g.utility(a);
  assert.equal(b.blind, 0);
  g.meleeDamage(a, b, 999);
  g.damage(a, b, 999, true);
  assert.equal(b.hp, b.maxHp);
  g.corrupt(c);
  g.corrupt(b, c);
  assert.equal(
    g.pending.some((p) => p.who === b),
    false,
  );
  g.meleeDamage(c, b, 999);
  assert.equal(c.infections, 1);
});
test("Corruption reports tied Light survivors and independent Dark infection winners at timeout", () => {
  const g = corruption(),
    [a, b, c, d] = g.fighters;
  g.time = 5;
  g.corruptionStarted = true;
  g.corrupt(a);
  g.time = 20;
  g.corrupt(b, a);
  g.time = 120;
  assert.ok(g.checkMatchEnd());
  assert.deepEqual(g.winners.light, [c.id, d.id]);
  assert.deepEqual(g.winners.dark, [a.id]);
  assert.equal(g.result, "victory");
  assert.match(g.finishReason, /Dark infections: You \(1\)/);
});
test("Corruption ends when the last Light converts and ignores all-Dark respawn wipes", () => {
  const g = corruption(3),
    [a, b, c] = g.fighters;
  g.time = 5;
  g.corruptionStarted = true;
  g.corrupt(a);
  g.fell(a);
  assert.equal(g.checkMatchEnd(), false);
  g.respawn(a);
  g.time = 10;
  g.corrupt(b, a);
  g.time = 20;
  g.corrupt(c, b);
  assert.ok(g.checkMatchEnd());
  assert.deepEqual(g.winners.light, [c.id]);
  assert.deepEqual(g.winners.dark, [a.id, b.id]);
});
test("Boss randomly assigns either role among four to eight players, with combined HP and last-team standing", () => {
  for (const bossRole of ["boss", "challenger"])
    for (const challengers of [3, 7]) {
      const g = new Combat({
        mode: "boss",
        players: challengers + 1,
        element: "water",
        random: () => (bossRole === "boss" ? 0 : 0.9),
      });
      const boss = g.fighters.find((a) => a.element === "invincible"),
        rivals = g.fighters.filter((a) => a !== boss);
      assert.equal(g.fighters.length, challengers + 1);
      assert.equal(
        boss.maxHp,
        rivals.reduce((sum, a) => sum + a.maxHp, 0),
      );
      assert.equal(
        g.player.element,
        bossRole === "boss" ? "invincible" : "water",
      );
      assert.ok(rivals.every((a) => a.parts.length === 1));
      const hp = rivals[1].hp;
      g.damage(rivals[0], rivals[1], 999);
      assert.equal(rivals[1].hp, hp);
      g.fell(boss, { killer: rivals[0] });
      assert.equal(g.tokens.length, 0);
      assert.equal(boss.respawnAt, undefined);
      assert.ok(g.checkMatchEnd());
      assert.equal(g.result, bossRole === "boss" ? "defeat" : "victory");
    }
});
test("Boss allied water projectiles neither hurt nor push challengers", () => {
  const g = new Combat({
    mode: "boss",
    element: "water",
    random: () => 0.9,
  });
  const a = g.player,
    b = g.fighters[2];
  Object.assign(a, { x: 300, y: 300, fx: 1, fy: 0 });
  Object.assign(b, { x: 345, y: 300 });
  g.projectile(a, 1, { kind: "water" });
  g.updateProjectiles(0.02);
  assert.equal(b.hp, b.maxHp);
  assert.equal(b.knockX, 0);
});
const domination = () => {
  const g = new Combat({ mode: "domination", size: 4, random: () => 0 });
  g.fighters.forEach((a, i) => Object.assign(a, { x: 500, y: 350 }));
  return g;
};
test("Domination has four flags, scores flag-seconds, and captures in 10 / 5 / 2.5 / 1.25 seconds", () => {
  for (let count = 1; count <= 4; count++) {
    const g = domination(),
      flag = g.flags[2],
      allies = g.fighters.filter((a) => a.team === 0).slice(0, count);
    for (const a of allies) Object.assign(a, { x: flag.x, y: flag.y });
    const seconds = 10 / 2 ** (count - 1);
    for (let i = 0; i < Math.round(seconds / 0.025) - 1; i++)
      g.updateDomination(0.025);
    assert.equal(flag.team, 1);
    g.updateDomination(0.025);
    assert.equal(flag.team, 0);
    assert.ok(Math.abs(g.scores[0] - seconds * 2) < 1e-7);
    const before = [...g.scores];
    g.updateDomination(1);
    assert.ok(Math.abs(g.scores[0] - before[0] - 3) < 1e-9);
    assert.ok(Math.abs(g.scores[1] - before[1] - 1) < 1e-9);
  }
});
test("Domination defenders contest; abandoned progress drains; ghosts and echoes cannot capture", () => {
  const g = domination(),
    flag = g.flags[2],
    attacker = g.player,
    defender = g.fighters[1];
  Object.assign(attacker, { x: flag.x, y: flag.y });
  g.updateDomination(3);
  assert.equal(flag.progress, 3);
  Object.assign(defender, { x: flag.x, y: flag.y });
  g.updateDomination(2);
  assert.equal(flag.progress, 3);
  assert.equal(flag.contested, true);
  attacker.x = 500;
  g.updateDomination(1);
  assert.equal(flag.progress, 2);
  defender.x = 500;
  attacker.x = flag.x;
  attacker.echo = true;
  g.updateDomination(2);
  assert.equal(flag.progress, 0);
  attacker.echo = false;
  attacker.alive = false;
  attacker.ghost = true;
  g.updateDomination(10);
  assert.equal(flag.team, 1);
});
test("Domination respawns through team wipes and ends on timed flag-control score", () => {
  const g = domination();
  for (const a of g.fighters.filter((a) => a.team === 0)) g.fell(a);
  assert.equal(g.checkMatchEnd(), false);
  advance(g, 10.02);
  assert.ok(g.player.alive);
  g.scores = [250, 251];
  g.time = 180;
  assert.ok(g.checkMatchEnd());
  assert.equal(g.result, "defeat");
  const tied = domination();
  tied.time = 180;
  assert.ok(tied.checkMatchEnd());
  assert.equal(tied.result, "draw");
});
test("Domination AI completes a capture instead of treating it as stalled combat", () => {
  const g = domination(),
    a = g.fighters[2],
    flag = g.flags[2];
  Object.assign(a, { x: flag.x, y: flag.y });
  for (let t = 0; t < 10.1; t += 0.02) {
    g.time += 0.02;
    g.ai(a, 0.02);
    g.updateDomination(0.02);
  }
  assert.equal(flag.team, 0);
});
test("AI direct telekinesis is limited to three repeated gestures", () => {
  const g = new Combat({ element: "gravity" }),
    a = g.player,
    b = g.fighters[1];
  a.aiControlled = true;
  Object.assign(b, { x: a.x + 80, y: a.y });
  for (let i = 0; i < 3; i++) {
    a.abilityCd = 0;
    assert.ok(g.telekinesis(a, b, 1, 0));
  }
  a.abilityCd = 0;
  assert.equal(g.telekinesis(a, b, 1, 0), false);
  assert.equal(a.aiNeedChange, true);
});

test("simultaneous Corruption strikes convert Light and fell Dark regardless of fighter order", () => {
  for (const darkIndex of [0, 1]) {
    const g = corruption(3),
      dark = g.fighters[darkIndex],
      light = g.fighters[1 - darkIndex];
    g.time = 5;
    g.corruptionStarted = true;
    g.corrupt(dark);
    Object.assign(dark, { x: 1000, y: 680, hp: 1 });
    Object.assign(light, { x: 1040, y: 680, hp: 1 });
    g.strike(g.fighters[0]);
    g.strike(g.fighters[1]);
    g.time += 0.12;
    g.resolveStrikes();
    assert.equal(dark.alive, false);
    assert.equal(light.element, "dark");
    assert.equal(light.alive, true);
    assert.equal(dark.infections, 1);
    assert.equal(g.pending.length, 0);
  }
});
