import test from "node:test";
import assert from "node:assert/strict";
import { Combat, canUseSkill } from "../src/combat.js";
import { updateGridironEvolution, updateGridiron } from "../src/event-modes.js";
test("A three-point deficit evolves the least-kill teammate and persists after respawns and a comeback", () => {
  for (const team of [0, 1]) {
    const g = new Combat({ mode: "gridiron", random: () => 0 });
    const members = g.fighters.filter((a) => a.team === team),
      lowest = members[2];
    members.forEach((a) => (a.kills = 4));
    lowest.kills = 1;
    members[0].deaths = 8;
    g.scores[1 - team] = 2;
    updateGridironEvolution(g);
    assert.equal(members.filter((a) => a.element === "invincible").length, 0);
    g.fell(lowest);
    g.scores[1 - team] = 3;
    updateGridironEvolution(g);
    assert.equal(lowest.element, "invincible");
    assert.equal(lowest.alive, false);
    assert.equal(members[0].element, "gravity");
    g.respawn(lowest);
    assert.equal(lowest.element, "invincible");
    assert.equal(lowest.spawn.element, "invincible");
    assert.ok(canUseSkill(lowest, "invincible", "ability"));
    members[1].kills = 0;
    g.scores[team] = 4;
    updateGridironEvolution(g);
    assert.equal(lowest.element, "invincible");
    g.scores[1 - team] = 8;
    updateGridironEvolution(g);
    assert.equal(members.filter((a) => a.element === "invincible").length, 1);
    assert.equal(g.gridInvincibleOwners[team], lowest.id);
  }
});
test("Invincible can upgrade the existing Gravity player; tied kill counts choose randomly once per team", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0.99 });
  g.scores = [0, 1];
  updateGridironEvolution(g);
  const owner = g.fighters.find((a) => a.id === g.gridGravityOwners[0]);
  g.fighters.filter((a) => a.team === 0).forEach((a) => (a.kills = 3));
  owner.kills = 0;
  g.scores = [0, 3];
  updateGridironEvolution(g);
  assert.equal(owner.element, "invincible");
  g.scores = [6, 3];
  updateGridironEvolution(g);
  assert.equal(g.gridInvincibleOwners[1], g.fighters[7].id);
  assert.equal(g.fighters[7].element, "invincible");
  assert.equal(owner.element, "invincible");
});
test("A touchdown that creates a three-point deficit applies Invincible before the restart", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0 });
  g.scores = [2, 0];
  g.fighters.filter((a) => a.team === 1).forEach((a) => (a.kills = 5));
  const a = g.fighters[6];
  a.kills = 1;
  Object.assign(g.ball, { carrier: null, x: 1550, y: 550 });
  updateGridiron(g);
  assert.deepEqual(g.scores, [3, 0]);
  assert.equal(a.element, "invincible");
  assert.equal(a.x, a.spawn.x);
  assert.equal(a.y, a.spawn.y);
  assert.equal(a.alive, true);
});
test("Invincible Gridiron AI uses Explosion without blasting nearby teammates", async () => {
  const { gridironAI } = await import("../src/event-modes.js");
  for (const allyNearby of [false, true]) {
    const g = new Combat({ mode: "gridiron", random: () => 0 });
    g.fighters.forEach((a) => (a.kills = 4));
    const a = g.fighters[1];
    a.kills = 0;
    g.scores = [0, 3];
    updateGridironEvolution(g);
    g.effects = [];
    g.fighters.forEach((b, i) => Object.assign(b, { x: 400 + i * 80, y: 850 }));
    Object.assign(a, { x: 900, y: 500 });
    Object.assign(g.fighters[4], { x: 990, y: 500 });
    if (allyNearby) Object.assign(g.fighters[2], { x: 900, y: 550 });
    gridironAI(g, a, 0.02);
    assert.equal(
      g.effects.some((e) => e.kind === "fusion" && e.r === 150),
      !allyNearby,
    );
  }
});
