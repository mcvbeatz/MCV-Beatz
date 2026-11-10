import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
import {
  clearAllyHealth,
  minimapFighters,
  teamMapColor,
  ALLY_MAP_COLOR,
  ENEMY_MAP_COLOR,
} from "../src/battle-awareness.js";
function arena() {
  const g = new Combat({ mode: "tdm", element: "divine", random: () => 0 });
  Object.assign(g.player, { x: 300, y: 350 });
  return g;
}
function gate(g, owner, x = 450, y = 250) {
  assert.ok(g.portals.begin(owner));
  assert.ok(g.portals.place(owner, x, y));
  return g.portals.owned(owner).at(-1);
}
test("allied Divine health remains clear on any skill tab without exposing enemies or off-field fighters", () => {
  const g = arena(),
    a = makeFighter("ally", "divine", g.player.team, 500, 300);
  assert.equal(clearAllyHealth(a, g.player), true);
  g.switchForm(a, "earth");
  assert.equal(clearAllyHealth(a, g.player), true);
  a.team = 1;
  assert.equal(clearAllyHealth(a, g.player), false);
  a.team = 0;
  a.alive = false;
  assert.equal(clearAllyHealth(a, g.player), false);
  a.alive = true;
  a.dimension = { portal: "p" };
  assert.equal(clearAllyHealth(a, g.player), false);
  assert.equal(clearAllyHealth(g.player, g.player), false);
});
test("minimap includes living allies and visible enemies in viewer-relative green/orange, including nonzero teams", () => {
  const g = arena();
  g.player.team = 3;
  const ally = makeFighter("ally", "divine", 3, 500, 300),
    enemy = makeFighter("enemy", "water", 8, 600, 300),
    hidden = makeFighter("hidden", "divine", 8, 700, 300),
    dead = makeFighter("dead", "light", 3, 500, 400),
    transit = makeFighter("transit", "water", 8, 500, 500);
  dead.alive = false;
  transit.transit = { entry: "p", exit: "q" };
  g.fighters = [g.player, ally, enemy, hidden, dead, transit];
  assert.deepEqual(
    minimapFighters(g).map((a) => a.id),
    ["ally", "enemy", "player"],
  );
  assert.equal(teamMapColor(3, g.player), ALLY_MAP_COLOR);
  assert.equal(teamMapColor(8, g.player), ENEMY_MAP_COLOR);
  hidden.reveal = 0.4;
  assert.ok(minimapFighters(g).includes(hidden));
});
test("minimap does not expose unvisited dungeon enemies", () => {
  const g = arena();
  g.mode = "dungeon";
  g.map = { kind: "dungeon", dungeonStage: 0 };
  const hidden = makeFighter("locked", "earth", 1, 500, 300);
  hidden.dungeonSection = 2;
  g.fighters.push(hidden);
  assert.equal(minimapFighters(g).includes(hidden), false);
  g.map.dungeonStage = 2;
  assert.equal(minimapFighters(g).includes(hidden), true);
});
test("Divine can tap-close allied and enemy portals from inherited skill tabs; ordinary fighters cannot", () => {
  for (const team of [0, 1]) {
    const g = arena(),
      owner = makeFighter("owner", "spirit", team, 700, 500);
    g.fighters.push(owner);
    const p = gate(g, owner);
    const q = gate(g, owner, 650, 250);
    const ordinary = makeFighter("ordinary", "spirit", 0, 300, 400);
    assert.equal(g.portals.close(ordinary, p.id), false);
    g.switchForm(g.player, "earth");
    assert.equal(g.portals.closeAt(g.player, p.x + 35, p.y), true);
    assert.deepEqual(
      g.portals.owned(owner).map((p) => p.id),
      [q.id],
    );
    assert.equal(g.player.reveal, 0.45);
    assert.ok(g.effects.some((e) => e.kind === "portal-close"));
  }
});
test("closing another player’s portal preserves crossing deaths and credits Divine; fixed portals and felled challengers are protected", () => {
  const g = arena(),
    owner = makeFighter("owner", "spirit", 1, 700, 500);
  g.fighters.push(owner);
  const p = gate(g, owner);
  const victim = g.fighters.find((a) => a.team === 1 && a !== owner);
  victim.transit = { entry: p.id, exit: "other" };
  assert.ok(g.portals.close(g.player, p.id));
  assert.equal(victim.alive, false);
  assert.equal(g.player.kills, 1);
  const q = gate(g, owner, 650, 250);
  g.player.alive = false;
  assert.equal(g.portals.close(g.player, q.id), false);
  g.player.alive = true;
  q.environment = true;
  assert.equal(g.portals.close(g.player, q.id), false);
  assert.equal(g.portals.closeAt(g.player, 100, 100), false);
});
