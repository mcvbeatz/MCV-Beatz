import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, distance } from "./combat-fixture.js";
import { ctfWaypoint } from "../src/ctf-ai.js";

const carrierGame = (element = "earth", attackerElement = "air") => {
  const g = new Combat({ mode: "ctf", element, random: () => 0.3 });
  const a = g.player;
  Object.assign(a, g.map.cells[80]);
  const b = makeFighter("attacker", attackerElement, 1, a.x + 40, a.y);
  g.fighters = [a, b];
  g.flags[1].carrier = a.id;
  return { g, a, b };
};
test("CTF Rock Shield absorbs hits, survives an exact break, then the next hit drops the flag", () => {
  const { g, a, b } = carrierGame();
  a.shield = 1;
  a.shieldHp = 15;
  assert.equal(g.damage(b, a, 4, true, false, "air"), 0);
  assert.equal(a.shieldHp, 12);
  assert.equal(a.hp, a.maxHp);
  assert.equal(g.flags[1].carrier, a.id);
  assert.equal(g.damage(b, a, 16, true, false, "air"), 0);
  assert.equal(a.shield, 0);
  assert.equal(a.alive, true);
  assert.equal(g.flags[1].carrier, a.id);
  g.damage(b, a, 1);
  assert.equal(a.alive, false);
  assert.equal(g.flags[1].dropped, true);
});
test("CTF shield overflow detonates immediately and never shields ordinary carriers", () => {
  for (const ability of [false, true]) {
    const { g, a, b } = carrierGame();
    a.shield = 1;
    a.shieldHp = 1;
    g.damage(b, a, 30, ability, false, "air");
    assert.equal(a.alive, false);
    assert.equal(g.flags[1].carrier, null);
    assert.equal(g.effects.filter((e) => e.kind === "fusion").length, 1);
  }
});
test("CTF Shadow Step dodges one hit without dropping the flag; next or expired hit detonates", () => {
  for (const ability of [false, true]) {
    const { g, a, b } = carrierGame("dark");
    assert.equal(g.utility(a), true);
    assert.ok(a.dodge > 0);
    g.damage(b, a, 10, ability);
    assert.equal(a.dodge, 0);
    assert.equal(a.hp, a.maxHp);
    assert.equal(g.flags[1].carrier, a.id);
    g.damage(b, a, 1, ability);
    assert.equal(a.alive, false);
  }
  const { g, a, b } = carrierGame("dark");
  a.dodge = 0;
  g.damage(b, a, 1);
  assert.equal(a.alive, false);
});
test("Light still pierces Shadow Step and self-damage does not trigger carrier detonation", () => {
  const { g, a, b } = carrierGame("dark", "light");
  a.dodge = 4;
  g.damage(b, a, 1);
  assert.equal(a.alive, false);
  const self = carrierGame();
  self.g.damage(self.a, self.a, 1);
  assert.equal(self.a.alive, true);
  assert.equal(self.g.flags[1].carrier, self.a.id);
});

function squadGame(team) {
  const g = new Combat({ mode: "ctf", random: () => 0.3 });
  const goal = g.flags[1 - team];
  const crew = Array.from({ length: 4 }, (_, i) =>
    makeFighter(`crew-${i}`, "earth", team, goal.x - 100, goal.y),
  );
  const guard = makeFighter("guard", "dark", 1 - team, goal.x, goal.y);
  g.fighters = [...crew, guard];
  return { g, goal, crew, guard };
}
test("Both teams assign a runner, pressure weak defenders, and exploit an exposed flag", () => {
  for (const team of [0, 1]) {
    const { g, goal, crew, guard } = squadGame(team);
    const weak = makeFighter("weak", "air", 1 - team, goal.x + 20, goal.y);
    weak.hp = 10;
    g.fighters.push(weak);
    assert.equal(g.flagObjective(crew[0]), goal);
    assert.equal(crew[0].ctfRole, "steal");
    assert.equal(g.flagObjective(crew[1]), weak);
    assert.equal(crew[1].ctfTarget, weak.id);
    assert.equal(crew[1].ctfRole, "assault");
    const home = g.flagObjective(crew[3]);
    assert.ok(distance(home, g.flags[team].home) < 100);
    guard.x += 400;
    weak.x += 400;
    assert.equal(g.flagObjective(crew[1]), goal);
    assert.equal(crew[1].ctfTarget, null);
    assert.equal(crew[1].ctfRole, "steal");
  }
});
test("Attackers actually strike defenders without a distant friendly suppressing melee", () => {
  for (const team of [0, 1]) {
    const { g, crew, guard, goal } = squadGame(team),
      a = crew[1];
    Object.assign(a, g.map.nearest({ x: goal.x - 35, y: goal.y }));
    Object.assign(guard, { x: a.x + 30, y: a.y });
    Object.assign(crew[0], { x: a.x - 20, y: a.y });
    crew[2].x = a.x - 180;
    crew[3].x = g.flags[team].home.x;
    a.aiTimer = 0;
    g.ai(a, 0.02);
    assert.equal(a.ctfTarget, guard.id);
    assert.ok(a.swing > 0);
  }
});
test("Escorts screen threats and return/interception objectives override flag raids", () => {
  const { g, crew, guard, goal } = squadGame(0);
  goal.carrier = crew[0].id;
  assert.equal(g.flagObjective(crew[0]), g.flags[0].home);
  assert.equal(g.flagObjective(crew[1]), guard);
  assert.equal(crew[1].ctfRole, "escort");
  g.flags[0].carrier = guard.id;
  assert.equal(g.flagObjective(crew[1]), guard);
  assert.equal(crew[1].ctfRole, "recover");
});
test("CTF approaches vary between attempts and stay committed between frames", () => {
  for (const team of [0, 1]) {
    const g = new Combat({ mode: "ctf", random: () => 0.3 });
    const a = g.fighters.find((b) => b.team === team);
    g.fighters = [a];
    Object.assign(a, g.flags[team].home);
    const goal = g.flagObjective(a),
      plans = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      a.ctfRoute = null;
      ctfWaypoint(g, a, goal);
      const plan = a.ctfRoute;
      plans.push(plan.cells.join(","));
      ctfWaypoint(g, a, goal);
      assert.equal(a.ctfRoute, plan);
      for (let i = 1; i < plan.cells.length; i++)
        assert.ok(g.map.graph[plan.cells[i - 1]].has(plan.cells[i]));
    }
    assert.ok(
      new Set(plans).size > 1,
      `team ${team} uses alternate connected corridors`,
    );
  }
});
test("Both teams navigate the chosen corridors, steal, and return to score", () => {
  for (const team of [0, 1]) {
    let seed = 19;
    const g = new Combat({
      mode: "ctf",
      random: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
    });
    const a = g.fighters.find((b) => b.team === team);
    g.fighters = [a];
    for (let i = 0; i < 9000 && g.scores[team] === 0; i++) {
      g.time += 0.02;
      g.ai(a, 0.02);
      g.updateFlags();
      assert.ok(g.map.walkable(a), "route never crosses tree walls");
    }
    assert.equal(g.scores[team], 1);
  }
});
