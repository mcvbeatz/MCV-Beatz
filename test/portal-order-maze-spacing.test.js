import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, distance } from "./combat-fixture.js";
import { mazeSpacingRoute } from "../src/maze-spacing.js";

for (const element of ["spirit", "divine"]) {
  test(`${element} closes its portals oldest first from the ability, then can create a new pair`, () => {
    const g = new Combat({ mode: "tdm", element });
    const a = g.player;
    g.fighters = [a];
    Object.assign(a, { x: 300, y: 500 });
    assert.ok(g.utility(a, true, "spirit"));
    assert.ok(g.portals.place(a, 450, 250));
    assert.ok(g.portals.place(a, 650, 250));
    const [first, second] = g.portals.owned(a);
    assert.equal(g.portals.willClose(a), true);
    assert.ok(g.utility(a, true, "spirit"));
    assert.deepEqual(g.portals.owned(a), [second]);
    assert.equal(g.portals.placing, null);
    g.utility(a, false, "spirit");
    assert.deepEqual(g.portals.owned(a), [second]);
    assert.ok(
      g.effects.some((e) => e.kind === "portal-close" && e.x === first.x),
    );
    assert.ok(g.utility(a, true, "spirit"));
    assert.equal(g.portals.owned(a).length, 0);
    assert.equal(g.portals.willClose(a), false);
    assert.ok(g.utility(a, true, "spirit"));
    assert.ok(g.portals.place(a, 450, 250));
    assert.ok(g.utility(a, true, "spirit"));
    assert.equal(
      g.portals.owned(a).length,
      1,
      "a lone newly placed portal remains open",
    );
    assert.ok(g.portals.place(a, 650, 250));
    a.alive = false;
    assert.equal(g.utility(a, true, "spirit"), false);
    assert.equal(g.portals.owned(a).length, 2);
  });
}

test("button closure preserves traveller rules and never closes another owner's portals", () => {
  const g = new Combat({ mode: "tdm", element: "divine" });
  const a = g.player;
  g.fighters = [a];
  Object.assign(a, { x: 300, y: 500 });
  g.utility(a, true, "spirit");
  g.portals.place(a, 450, 250);
  g.portals.place(a, 650, 250);
  const first = g.portals.owned(a)[0];
  const enemy = makeFighter("enemy", "spirit", 1, 700, 500);
  g.fighters.push(enemy);
  g.portals.begin(enemy);
  g.portals.place(enemy, 800, 250);
  enemy.transit = { entry: first.id, exit: g.portals.owned(a)[1].id };
  assert.ok(g.utility(a, true, "spirit"));
  assert.equal(enemy.alive, false);
  assert.equal(g.portals.owned(enemy).length, 1);
});

function maze(element = "light") {
  const g = new Combat({ mode: "corruption", players: 3 });
  const p = g.map.cells[80];
  const a = makeFighter(
    "follower",
    element,
    element === "dark" ? 1 : 0,
    p.x,
    p.y,
  );
  const peer = makeFighter("leader", element, a.team, p.x, p.y);
  const target = makeFighter(
    "target",
    element === "dark" ? "light" : "dark",
    1 - a.team,
    0,
    0,
  );
  Object.assign(target, g.map.cells[60]);
  g.fighters = [peer, a, target];
  return { g, a, peer, target };
}

test("touching Dark fighters choose a different connected route to the same Light", () => {
  const { g, a, peer, target } = maze("dark");
  const primary = g.map.path(peer, target);
  const route = mazeSpacingRoute(g, a, target, [target]);
  assert.ok(a.mazeSpacing, "an alternate route exists at the central junction");
  assert.notEqual(a.mazeSpacing.cells[0], primary[1]);
  assert.equal(a.mazeSpacing.cells.at(-1), g.map.cellAt(target));
  assert.equal(g.map.lineClear(a, route, 14), true);
  for (const [i, cell] of a.mazeSpacing.cells.entries()) {
    const previous = i ? a.mazeSpacing.cells[i - 1] : g.map.cellAt(a);
    assert.ok(
      g.map.graph[previous].has(cell) ||
        (g.map.portalCells.includes(previous) &&
          g.map.portalCells.includes(cell)),
    );
  }
  const reserved = [...a.mazeSpacing.cells];
  g.time = 0.1;
  mazeSpacingRoute(g, a, target, [target]);
  assert.deepEqual(
    a.mazeSpacing.cells,
    reserved,
    "route does not oscillate every frame",
  );
});

test("crowded Light takes another safe branch and changes course if a hunter intercepts it", () => {
  const { g, a, peer, target } = maze();
  const goal = g.map.cells[30];
  peer.mazeGoal = goal;
  const route = mazeSpacingRoute(g, a, goal, [target]);
  assert.ok(a.mazeSpacing);
  assert.notEqual(a.mazeSpacing.cells[0], g.map.path(peer, goal)[1]);
  assert.ok(g.map.lineClear(a, route, 14));
  const unsafe = a.mazeSpacing.cells[0];
  Object.assign(target, g.map.cells[unsafe]);
  g.time = 0.1;
  const stopped = mazeSpacingRoute(g, a, goal, [target]);
  assert.deepEqual(
    stopped,
    a,
    "do not continue into the abandoned unsafe route",
  );
  assert.equal(a.mazeGoal, null);
  assert.equal(
    a.mazeSpacing,
    null,
    "abandon the reserved route when a hunter cuts it off",
  );
});

test("single-corridor spacing separates overlapping fighters without crossing walls or moving toward hunters", () => {
  const { g, a, peer, target } = maze();
  a.mazeSpacingRetry = 10; // Exercise the local-lane fallback independently of branch planning.
  Object.assign(target, { x: a.x - 120, y: a.y });
  const goal = { x: a.x + 80, y: a.y };
  peer.mazeGoal = goal;
  const route = mazeSpacingRoute(g, a, goal, [target]);
  assert.ok(
    Math.abs(route.y - a.y) > 10,
    "choose a different lane, even from exact overlap",
  );
  assert.ok(distance(route, target) >= distance(a, target));
  assert.ok(g.map.walkable(route, 14));
  assert.ok(g.map.lineClear(a, route, 14));
  const leaderRoute = mazeSpacingRoute(g, peer, goal, [target]);
  assert.deepEqual(leaderRoute, goal, "the leader keeps its course");
});

test("AI separates initially stacked Light and Dark fighters while staying on the maze floor", () => {
  for (const element of ["light", "dark"]) {
    const { g, a, peer } = maze(element);
    for (let i = 0; i < 80; i++) {
      g.time += 0.02;
      g.aiMazeCorruption(peer, 0.02);
      g.aiMazeCorruption(a, 0.02);
      assert.ok(g.map.walkable(a));
      assert.ok(g.map.walkable(peer));
    }
    assert.ok(
      distance(a, peer) > 40,
      `${element} spacing: ${distance(a, peer)}`,
    );
  }
});

test("a crowd reserves distinct first corridors instead of all followers taking the same detour", () => {
  const { g, a, peer, target } = maze("dark");
  const third = makeFighter("third", "dark", a.team, a.x, a.y);
  g.fighters = [peer, a, third, target];
  const leader = g.map.route(peer, target);
  const second = mazeSpacingRoute(g, a, target, [target]);
  const last = mazeSpacingRoute(g, third, target, [target]);
  assert.notDeepEqual(last, leader);
  assert.notDeepEqual(last, second);
  assert.ok(g.map.lineClear(third, last, 14));
  if (third.mazeSpacing)
    assert.notEqual(third.mazeSpacing.cells[0], a.mazeSpacing.cells[0]);
});
