import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  recipe,
  activeForm,
  hasPassive,
  distance,
} from "./combat-fixture.js";
const advance = (g, seconds, ai = false) => {
  for (let t = 0; t < seconds - 1e-8 && !g.finished; t += 0.02)
    g.update(0.02, { x: 0, y: 0 }, ai);
};
const game = (element = "demonic", mode = "duel") =>
  new Combat({ element, mode, random: () => 0.2 });

test("Death is a permanent magma-sized floor, single use across skill switching, demotion, revival and respawn", () => {
  const g = game("demonic", "tdm"),
    a = g.player;
  a.fx = 1;
  a.fy = 0;
  assert.equal(g.utility(a), true);
  const h = g.hazards[0];
  assert.equal(h.kind, "death");
  assert.equal(h.r, 66);
  assert.equal(h.life, Infinity);
  assert.equal(h.x, a.x + 70);
  assert.equal(g.tokens.length, 0);
  a.utilityCd = 0;
  assert.equal(g.utility(a), false);
  g.switchForm(a, "fire");
  g.switchForm(a, "demonic");
  assert.equal(g.utility(a), false);
  g.fell(a);
  g.respawn(a);
  assert.equal(g.utility(a), false);
  const fresh = game();
  assert.equal(fresh.utility(fresh.player), true);
});
test("Death demotes every level-three form alphabetically to a valid level two, then level one", () => {
  const expected = {
    demonic: "apparition",
    divine: "mirror",
    "multi-dimensional": "gravity",
    lightning: "cloud",
    invincible: "mirror",
  };
  for (const [element, lower] of Object.entries(expected)) {
    const g = game(element),
      a = g.player;
    assert.equal(g.demote(a), true);
    assert.equal(a.element, lower);
    assert.equal(a.parts.length, 2);
    assert.deepEqual(a.parts, recipe(lower));
    assert.equal(activeForm(a), lower);
    assert.equal(g.demote(a), true);
    assert.equal(a.element, [...recipe(lower)].sort()[0]);
    assert.equal(g.demote(a), false);
    assert.equal(a.hp, 120);
  }
});
test("Death hits flyers, allies and invisible Divine once per entry without reflection or resurrection", () => {
  const g = game(),
    a = g.player;
  g.utility(a);
  const h = g.hazards[0];
  const b = makeFighter("victim", "divine", a.team, h.x, h.y);
  g.fighters.push(b);
  const hp = a.hp;
  g.time = h.opensAt;
  g.updateHazards(0.01);
  assert.equal(b.element, "mirror");
  assert.equal(a.hp, hp);
  assert.equal(b.reflect, 0);
  g.updateHazards(0.01);
  assert.equal(b.element, "mirror");
  b.x = h.x + 100;
  g.updateHazards(0.01);
  b.x = h.x;
  g.updateHazards(0.01);
  assert.equal(b.element, "earth");
});
test("demotion strips removed abilities and passive effects without reviving absorbed souls", () => {
  const g = game("light", "team"),
    a = g.player,
    ally = g.fighters[2];
  g.fell(ally);
  a.x = ally.x;
  a.y = ally.y;
  assert.equal(g.touchTokens(a), true);
  assert.equal(a.element, "spirit");
  g.demote(a);
  assert.equal(a.element, "air");
  assert.equal(ally.alive, false);
  assert.equal(g.tokens.length, 0);
  assert.equal(hasPassive(a, "light"), false);
  assert.equal(g.startCharge(a, "light"), false);
  g.fell(a);
  const healer = makeFighter("healer", "spirit", 0, 400, 300);
  g.fighters.push(healer);
  // Removing the remaining absorbed soul cannot leave a nameless fighter.
  a.absorbed = [];
  g.rebuildFusion(a);
  assert.equal(a.element, "air");
});
test("Invincible movement is exactly fifteen percent slower and persists across skill tabs", () => {
  const g = game("invincible"),
    a = g.player;
  g.fighters[1].x = 850;
  for (const form of a.forms) {
    g.switchForm(a, form);
    a.x = 300;
    a.y = 300;
    g.move(a, 1, 0, 0.1);
    assert.ok(Math.abs(a.x - 312.75) < 1e-8);
  }
  const normal = game("earth");
  normal.player.x = 300;
  normal.move(normal.player, 1, 0, 0.1);
  assert.equal(normal.player.x, 315);
});
test("AI repeats a gesture at most three times while human controls remain unrestricted", () => {
  const g = game("earth"),
    a = g.fighters[1];
  a.aiControlled = true;
  for (let i = 0; i < 3; i++) {
    a.attackCd = 0;
    assert.equal(g.strike(a), true);
  }
  a.attackCd = 0;
  assert.equal(g.strike(a), false);
  assert.equal(a.aiNeedChange, true);
  a.aiControlled = false;
  assert.equal(g.strike(a), true);
});
test("stalled FFA Earth collects a compatible token instead of waiting outside Mud quicksand", () => {
  const g = game("light", "ffa");
  g.fighters = [
    g.player,
    makeFighter("earth", "earth", 1, 450, 350),
    makeFighter("mud", "mud", 2, 620, 350),
  ];
  const earth = g.fighters[1],
    mud = g.fighters[2];
  g.player.x = 200;
  g.player.y = 200;
  g.tokens.push({
    x: 400,
    y: 450,
    team: 3,
    owner: "fallen",
    parts: ["light"],
    souls: [{ owner: "fallen", parts: ["light"] }],
    portalCooldown: 0,
  });
  g.area(mud, 1, "quicksand", 85, Infinity);
  const h = g.hazards[0];
  h.x = mud.x;
  h.y = mud.y;
  let seed = 77;
  g.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  advance(g, 8, true);
  assert.equal(earth.element, "mirror");
  assert.equal(g.tokens.length, 0);
  assert.ok(distance(earth, { x: 450, y: 350 }) > 35);
});
test("AI can leave a harmful floor while changing tactics instead of becoming trapped by avoidance", () => {
  const g = game("earth"),
    a = g.fighters[1];
  g.area(g.player, 1, "quicksand", 85, 10);
  Object.assign(g.hazards[0], { x: a.x, y: a.y });
  const d = g.aiRoute(a, { x: 400, y: 450 });
  assert.ok(Math.hypot(d.x, d.y) > 0);
});
