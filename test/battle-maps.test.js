import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, distance, inWorld } from "../src/combat.js";
import { createBattleMap, BATTLE_MAP_IDS } from "../src/battle-maps.js";
import { nextWave } from "../src/advanced-modes.js";
import { MODES } from "../src/mode-catalog.js";

const modes = [
  "duel",
  "fused",
  "fused3",
  "team",
  "ctf",
  "tdm",
  "ffa",
  "boss",
  "domination",
  "rush",
  "roulette",
  "gauntlet",
  "gauntlet-team",
];
const tick = (g, seconds, ai = false) => {
  for (let t = 0; t < seconds && !g.finished; t += 0.02)
    g.update(0.02, { x: 0, y: 0 }, ai);
};
test("new matches shuffle all three maps and survival always retains the maze", () => {
  for (const mode of modes)
    for (const [random, kind] of [
      [() => 0, "classic"],
      [() => 0.4, "garden"],
      [() => 0.99, "tower"],
    ])
      assert.equal(new Combat({ mode, random }).mapId, kind);
  assert.equal(
    new Combat({ mode: "corruption", mapId: "tower" }).map.kind,
    "corruption",
  );
  assert.equal(MODES.corruption.name, "Survive the Night");
});
for (const mapId of BATTLE_MAP_IDS) {
  test(`${mapId}: connected floor, maze-sized area, safe spawns and high-speed edge collision`, () => {
    const m = createBattleMap(mapId);
    assert.equal(m.width, 2048);
    assert.equal(m.height, 1360);
    let area = 0;
    for (let x = 0; x < 2048; x += 8)
      for (let y = 0; y < 1360; y += 8) if (m.walkable({ x, y }, 0)) area += 64;
    assert.ok(Math.abs(area / (Math.PI * 608 ** 2) - 1) < 0.07, `area ${area}`);
    const points = [
      ...m.nodes,
      ...m.capturePoints,
      ...m.flagHomes,
      ...m.shardSpots,
    ];
    for (let n = 2; n <= 8; n++)
      for (let i = 0; i < n; i++) points.push(m.spawn(i, n));
    for (const p of points) {
      assert.ok(m.walkable(p));
      const a = { ...p },
        goal = m.nodes.at(-1);
      for (let i = 0; i < 300 && distance(a, goal) > 2; i++) {
        const w = m.route(a, goal),
          d = distance(a, w);
        assert.ok(
          d > 0,
          `stuck route ${JSON.stringify(a)} -> ${JSON.stringify(goal)}`,
        );
        const f = Math.min(1, 12 / d);
        m.move(a, a.x + (w.x - a.x) * f, a.y + (w.y - a.y) * f);
        assert.ok(m.walkable(a));
      }
      assert.ok(
        distance(a, goal) <= 2.01,
        `route never arrived from ${JSON.stringify(p)}`,
      );
      for (const goal of [
        { x: -200, y: -200 },
        { x: 2200, y: 1500 },
        { x: p.x, y: -500 },
      ]) {
        const a = { ...p };
        m.move(a, goal.x, goal.y);
        assert.ok(m.walkable(a));
      }
    }
  });
  test(`${mapId}: every mode has reachable spawns, objectives, shards and wave resets`, () => {
    for (const mode of modes) {
      const g = new Combat({
        mode,
        mapId,
        size: 4,
        players: 8,
        random: () => 0.4,
      });
      for (const a of g.fighters) {
        assert.ok(g.map.walkable(a), `${mode} ${a.id}`);
        assert.ok(g.map.walkable(a.spawn));
      }
      for (const flag of g.flags) {
        assert.ok(g.map.walkable(flag, 60));
        assert.ok(g.map.walkable(flag.home, 60));
      }
      for (const token of g.tokens) assert.ok(g.map.walkable(token));
      if (g.respawnDelay) {
        g.fell(g.player);
        g.respawn(g.player);
        assert.ok(g.map.walkable(g.player));
      }
      if (mode.startsWith("gauntlet")) {
        nextWave(g);
        assert.ok(g.fighters.every((a) => g.map.walkable(a)));
      }
      tick(g, 18, true);
      assert.ok(
        g.fighters.filter(inWorld).every((a) => g.map.walkable(a)),
        `${mode} AI left floor`,
      );
      assert.ok(
        g.tokens.filter(inWorld).every((a) => g.map.walkable(a)),
        `${mode} unreachable token`,
      );
    }
  });
  test(`${mapId}: AI walks around concave edges to reach distant enemies`, () => {
    const g = new Combat({ mode: "boss", mapId, random: () => 0 });
    const a = g.player,
      b = g.fighters[1];
    const start = mapId === "garden" ? { x: 500, y: 400 } : { x: 760, y: 250 };
    const goal = mapId === "garden" ? { x: 800, y: 180 } : { x: 1780, y: 800 };
    Object.assign(a, start, { element: "invincible" });
    Object.assign(b, goal);
    g.fighters = [a, b];
    assert.equal(g.map.lineClear(a, b), false);
    for (let i = 0; i < 1500 && distance(a, b) > 50; i++) g.aiPursuit(a, 0.02);
    assert.ok(distance(a, b) < 60, `remaining distance ${distance(a, b)}`);
    assert.ok(g.map.walkable(a));
  });
  test(`${mapId}: teleport, Chasm, portals, revival, Rebirth and summons respect the floor`, () => {
    const g = new Combat({
        mode: "fused3",
        mapId,
        element: "multi-dimensional",
      }),
      a = g.player;
    const center =
      mapId === "garden" ? { x: 1024, y: 680 } : { x: 760, y: 680 };
    Object.assign(a, center);
    assert.equal(g.teleport(a, 10, 10), false);
    const edge = mapId === "garden" ? { x: 500, y: 380 } : { x: 1250, y: 500 };
    const farFloor =
      mapId === "garden" ? { x: 750, y: 100 } : { x: 1500, y: 650 };
    Object.assign(a, edge);
    assert.ok(g.map.walkable(a));
    assert.ok(g.map.walkable(farFloor));
    assert.equal(
      g.teleport(a, farFloor.x, farFloor.y),
      false,
      "range-limited endpoint must not fall in the void",
    );
    assert.equal(a.blink, null);
    Object.assign(a, center);
    assert.equal(g.teleport(a, center.x + 170, center.y), true);
    tick(g, 0.21);
    assert.ok(g.map.walkable(a));
    const t = makeFighter("terra", "terraformer", 0, center.x, center.y);
    assert.equal(g.placeChasm(t, 10, 10), false);
    assert.equal(g.placeChasm(t, center.x + 100, center.y), true);
    const spirit = makeFighter("spirit", "spirit", 0, center.x, center.y);
    g.fighters = [spirit];
    g.player = spirit;
    g.portals.begin(spirit);
    assert.equal(g.portals.place(spirit, 10, 10), false);
    assert.ok(g.portals.place(spirit, center.x + 100, center.y));
    const exit = g.map.nearest({ x: 1900, y: 680 }, 30);
    assert.ok(g.portals.place(spirit, exit.x, exit.y));
    g.time = 1;
    const entry = g.portals.portals[0];
    Object.assign(spirit, { x: entry.x, y: entry.y });
    assert.ok(g.portals.enter(spirit, { x: entry.x - 30, y: entry.y }));
    g.portals.tick(spirit, 0.2);
    assert.ok(g.map.walkable(spirit));
    assert.ok(distance(spirit, exit) < 60);
    for (const element of ["phoenix", "apparition", "demonic"]) {
      const h = new Combat({ mode: "fused3", element, mapId });
      Object.assign(h.player, h.map.nearest({ x: 2000, y: 680 }, 14));
      if (element === "phoenix") h.fell(h.player);
      else h.cast(h.player, 1, element);
      assert.ok(
        h.fighters.every((a) => h.map.walkable(a)),
        element,
      );
    }
    const fallen = makeFighter("fallen", "earth", 0, center.x, center.y);
    g.fighters.push(fallen);
    g.fell(fallen);
    assert.ok(g.revive(spirit, 1));
    assert.ok(g.map.walkable(fallen));
  });
  test(`${mapId}: CTF captures and Domination capture timers work at map objectives`, () => {
    const g = new Combat({ mode: "ctf", mapId }),
      a = g.player;
    Object.assign(a, g.flags[1].home);
    g.updateFlags();
    assert.equal(g.flags[1].carrier, a.id);
    Object.assign(a, g.flags[0].home);
    g.updateFlags();
    assert.equal(g.scores[0], 1);
    const d = new Combat({ mode: "domination", mapId });
    d.fighters = [d.player];
    Object.assign(d.player, d.flags[2]);
    // Keep player team distinct from the target objective's owner.
    d.player.team = 0;
    tick(d, 11);
    assert.equal(d.flags[2].team, 0);
  });
}
