import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, VOG_RADIUS, distance } from "./combat-fixture.js";
const clearWave = (g) => {
  for (const a of g.fighters.filter((a) => a.team === 1))
    g.fell(a, { killer: g.player });
  g.checkMatchEnd();
};
for (const mode of ["gauntlet", "gauntlet-team"]) {
  test(`${mode}: the latest selected advantage applies only at seven seconds`, () => {
    const g = new Combat({ mode, element: "light", size: 3 });
    clearWave(g);
    const t = g.time;
    assert.equal(g.rewardRemaining, 7);
    g.player.hp = 35;
    assert.equal(g.chooseReward("heal"), true);
    g.update(3, { x: 1, y: 0 }, false);
    assert.equal(g.player.hp, 35);
    assert.equal(g.time, t);
    assert.equal(g.wave, 1);
    assert.equal(g.rewardRemaining, 4);
    assert.equal(g.chooseReward("shard:air"), true);
    assert.equal(g.chooseReward("nonsense"), false);
    g.update(3.999, { x: 0, y: 0 }, false);
    assert.equal(g.player.element, "light");
    g.update(0.001, { x: 0, y: 0 }, false);
    assert.equal(g.player.element, "spirit");
    assert.equal(g.player.hp, 65); // The normal shard-fusion bonus heals 30 HP, not a full heal.
    assert.equal(g.wave, 2);
    assert.equal(g.intermission, false);
    assert.equal(g.chooseReward("heal"), false);
    assert.equal(g.rewardSelection, null);
  });
  test(`${mode}: no selection chooses first option once, even with a delayed frame`, () => {
    const g = new Combat({ mode, element: "water", size: 3 });
    clearWave(g);
    const first = g.rewardChoices()[0];
    assert.ok(first.id.startsWith("shard:"));
    g.update(7.2, { x: 0, y: 0 }, false);
    assert.equal(g.wave, 2);
    assert.ok(g.player.parts.includes(first.id.slice(6)));
    assert.equal(g.intermission, false);
    clearWave(g);
    assert.equal(g.rewardRemaining, 7);
    assert.equal(g.rewardSelection, null);
    g.chooseReward("upgrade");
    g.update(7, { x: 0, y: 0 }, false);
    assert.equal(g.wave, 3);
    assert.equal(g.player.waveDamage, 1.25);
  });
}
test("Roulette survives a full wipe and repeated respawns, then a dead kill leader wins at 180 seconds", () => {
  const g = new Combat({ mode: "roulette", players: 4, random: () => 0.4 });
  g.ai = () => {};
  for (let cycle = 0; cycle < 4; cycle++) {
    for (const a of g.fighters) g.fell(a, { lost: true });
    assert.equal(g.checkMatchEnd(), false);
    const due = g.time + 10;
    g.time = due - 0.02;
    g.update(0.03, { x: 0, y: 0 }, false);
    assert.ok(g.fighters.every((a) => a.alive));
    assert.equal(g.finished, false);
  }
  g.player.kills = 6;
  g.fighters[1].kills = 5;
  g.time = 179;
  g.fell(g.player);
  g.time = 179.99;
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.equal(g.finished, true);
  assert.equal(g.result, "victory");
  assert.equal(g.player.alive, false);
  assert.equal(g.player.deaths, 5);
});
function smokeArena(element = "water", x = 450, y = 350) {
  const g = new Combat({ mode: "duel", element: "smoke", random: () => 0 });
  const a = makeFighter("bot", element, 1, x, y);
  g.player.x = 820;
  g.player.y = 500;
  g.fighters = [g.player, a];
  g.hazards = [{ kind: "vog", owner: g.player, x, y, r: VOG_RADIUS, life: 8 }];
  return { g, a };
}
test("Vog's new diameter is 80 percent of version 0.16", () => {
  assert.ok(
    Math.abs(VOG_RADIUS * 2 - (500 / Math.sqrt(3)) * 0.6 * 2 * 0.8) < 1e-8,
  );
});
for (const [x, y] of [
  [450, 350],
  [137, 177],
  [887, 558],
]) {
  test(`non-Dark AI fights its way out of Vog at ${x},${y}`, () => {
    const { g, a } = smokeArena("water", x, y);
    let attacks = 0;
    const strike = g.strike.bind(g);
    g.strike = (...args) => {
      const used = strike(...args);
      if (args[0] === a && used) attacks++;
      return used;
    };
    for (let i = 0; i < 160; i++) g.update(0.02, { x: 0, y: 0 }, true);
    assert.ok(
      distance(a, g.hazards[0]) > VOG_RADIUS,
      `${a.x},${a.y} failed to escape`,
    );
    assert.ok(attacks > 0);
    assert.ok(a.x >= 135 && a.x <= 889 && a.y >= 175 && a.y <= 560);
  });
}
test("smoke-aware Dark origins, fused Dark forms and Aurora allies keep normal tactics", () => {
  for (const element of ["dark", "smoke", "terraformer", "sanctuary"]) {
    const { g, a } = smokeArena(element);
    assert.equal(g.aiEscapeVog(a, 0.02), false);
  }
  const { g, a } = smokeArena("water");
  g.fighters.push(makeFighter("guardian", "sanctuary", 1, 800, 400));
  assert.equal(g.aiEscapeVog(a, 0.02), false);
});
test("Vog escape avoids hidden-position tracking and refuses blind swings through allies", () => {
  const { g, a } = smokeArena("light");
  const hidden = makeFighter("hidden", "divine", 0, 460, 350);
  g.fighters.push(hidden);
  g.aiEscapeVog(a, 0.02);
  assert.equal(a.lock, null);
  const ally = makeFighter(
    "ally",
    "water",
    1,
    a.x + a.fx * 20,
    a.y + a.fy * 20,
  );
  g.fighters.push(ally);
  a.attackCd = 0;
  g.aiEscapeVog(a, 0.02);
  assert.equal(a.attackCd, 0);
});
