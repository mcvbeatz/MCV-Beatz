import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "../src/combat.js";
import { checkWarChasms, updateWar } from "../src/war.js";
import { deathPose } from "../src/characters.js";
const game = (element = "earth", enemyElement = "air") =>
  new Combat({
    mode: "war",
    element,
    enemyElement,
    size: 3,
    mapId: "garden",
    random: () => 0.4,
  });

test("Air versus Earth or Fire always uses Skybreak Keep in either team order", () => {
  for (const rival of ["earth", "fire"])
    for (const pair of [
      ["air", rival],
      [rival, "air"],
    ]) {
      const g = game(...pair);
      assert.equal(g.mapId, "skykeep");
      assert.equal(g.map.chasms.length, 8);
      for (const a of g.fighters) {
        assert.ok(g.map.walkable(a, 18));
        assert.ok(
          g.map.chasms.every(
            (h) => Math.hypot(a.x - h.x, a.y - h.y) > h.r + 100,
          ),
        );
      }
      g.time = 7;
      updateWar(g, 0);
      assert.equal(g.healthDrops.length, 2);
    }
  assert.equal(game("air", "water").mapId, "garden");
  assert.equal(game("water", "fire").mapId, "volcano");
  assert.equal(game("light", "dark").mapId, "temple");
});
test("field chasms kill grounded bodies at the edge and during swept movement, but never flyers", () => {
  const g = game();
  const h = g.map.chasms[0],
    a = g.player;
  Object.assign(a, { x: h.x + h.r + 11, y: h.y });
  assert.equal(checkWarChasms(g, a), false);
  a.x--;
  assert.equal(checkWarChasms(g, a), true);
  assert.equal(a.hp, 0);
  const d = g.fallenAnimations[0];
  assert.equal(d.terrain.kind, "chasm");
  assert.equal(d.terrain.x, h.x);
  assert.equal(a.respawnAt, 10);
  g.time = 10;
  g.respawn(a);
  assert.equal(a.alive, true);
  Object.assign(a, { x: h.x - 120, y: h.y, burst: 0.2, burstX: 1, burstY: 0 });
  g.move(a, 1, 0, 0.4);
  assert.equal(a.alive, false, "dash cannot skip over a hole");
  for (const e of ["air", "blaze", "terraformer", "phoenix"]) {
    const flyer = makeFighter("flyer", e, 1, h.x, h.y);
    assert.equal(checkWarChasms(g, flyer), false);
    assert.equal(flyer.alive, true);
  }
});
test("countdown and out-of-world fighters cannot fall; landing grounded on a hole can", () => {
  const g = game();
  Object.assign(g.player, { x: g.map.chasms[0].x, y: g.map.chasms[0].y });
  g.countdown = 4;
  assert.equal(checkWarChasms(g, g.player), false);
  g.countdown = 0;
  g.player.dimension = {};
  assert.equal(checkWarChasms(g, g.player), false);
  g.player.dimension = null;
  updateWar(g, 0);
  assert.equal(g.player.alive, false);
});
test("AI sees field holes as dangerous only when grounded and can navigate around them", () => {
  const g = game(),
    a = g.player,
    h = g.map.chasms[0];
  g.fighters = [a];
  Object.assign(a, { x: h.x - 170, y: h.y });
  const goal = { x: h.x + 170, y: h.y };
  assert.equal(g.mobilitySafe(a, h), false);
  for (let i = 0; i < 250 && Math.hypot(a.x - goal.x, a.y - goal.y) > 20; i++) {
    const route = g.aiRoute(a, goal);
    g.move(a, route.x, route.y, 0.05);
    assert.equal(a.alive, true);
  }
  assert.ok(
    Math.hypot(a.x - goal.x, a.y - goal.y) < 25,
    "grounded AI gets past the opening",
  );
  a.parts = ["air"];
  assert.equal(g.mobilitySafe(a, h), true);
});
test("ability chasms and lethal quicksand preserve their own death terrain, without changing normal deaths", () => {
  for (const kind of ["chasm", "quicksand"]) {
    const g = new Combat({
      mode: "tdm",
      element: "fire",
      mapId: "classic",
      size: 2,
    });
    g.ai = () => {};
    const a = g.player,
      b = g.fighters.find((f) => f.team !== a.team);
    a.hp = 0.01;
    g.hazards = [
      {
        kind,
        x: a.x,
        y: a.y,
        r: 85,
        owner: b,
        element: "mud",
        power: 2,
        life: 5,
        opensAt: 0,
        tick: 0,
      },
    ];
    g.updateHazards(0.05);
    assert.equal(a.alive, false);
    const d = g.fallenAnimations[0];
    assert.equal(d.terrain.kind, kind);
    const early = deathPose(d);
    d.elapsed = 0.9;
    const late = deathPose(d);
    assert.ok(late.y > early.y);
    assert.equal(late.opacity, 1);
    if (kind === "chasm") assert.ok(late.scale < early.scale);
    else assert.equal(late.scale, 1);
    g.hazards = [];
    assert.equal(d.terrain.kind, kind, "animation outlives its source hazard");
  }
  const g = game();
  g.fell(g.player);
  assert.equal(g.fallenAnimations[0].terrain, null);
});

test("injured grounded War AI navigates around rooftop holes to reach healing", () => {
  const g = game(),
    a = g.fighters.find((f) => f.team === 0 && f !== g.player);
  g.fighters = [a];
  g.time = 7;
  updateWar(g, 0);
  Object.assign(a, { x: 980, y: 650, hp: 30 });
  const drop = g.healthDrops[0];
  for (let i = 0; i < 500 && Math.hypot(a.x - drop.x, a.y - drop.y) > 25; i++) {
    g.ai(a, 0.05);
    assert.equal(a.alive, true, "recovery does not walk through the chasm");
  }
  assert.ok(Math.hypot(a.x - drop.x, a.y - drop.y) <= 25);
  updateWar(g, 0);
  assert.ok(a.hp > 30);
});
