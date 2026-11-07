import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
import { updateWar } from "../src/war.js";
import { updateDungeon } from "../src/dungeon.js";
function duel(element) {
  const g = new Combat({ mode: "duel", element });
  Object.assign(g.player, { x: 400, y: 300, fx: 1, fy: 0 });
  g.fighters = [g.player, makeFighter("enemy", "water", 1, 470, 300)];
  return g;
}
const sounds = (g) => g.audioEvents.splice(0).map((e) => e.kind);
test("projectile and area abilities emit Fireball once per successful use, including borrowed skills", () => {
  for (const element of ["fire", "water", "air", "cloud", "smoke"]) {
    const g = duel(element);
    assert.equal(g.cast(g.player, 1), true, element);
    assert.deepEqual(sounds(g), ["fireball"]);
  }
  const g = duel("smoke");
  assert.ok(g.cast(g.player, 1, "fire"));
  assert.deepEqual(sounds(g), ["fireball"]);
  g.countdown = 4;
  assert.equal(g.cast(g.player, 1, "fire"), false);
  assert.deepEqual(sounds(g), []);
});
test("Flash and portal placement sound on success; invalid placement stays silent", () => {
  const g = duel("light");
  g.utility(g.player);
  assert.deepEqual(sounds(g), ["flash"]);
  g.utility(g.player);
  assert.deepEqual(sounds(g), []);
  const p = duel("spirit");
  p.portals.begin(p.player);
  assert.equal(p.portals.place(p.player, 400, 300), false);
  assert.deepEqual(sounds(p), []);
  assert.ok(p.portals.place(p.player, 620, 350));
  assert.deepEqual(sounds(p), ["flash"]);
});
test("Rock formation plays once for new shields, prisons and placed chasms", () => {
  const g = duel("earth");
  g.utility(g.player);
  g.utility(g.player);
  assert.deepEqual(sounds(g), ["rock-shield"]);
  g.utility(g.player, false);
  assert.deepEqual(sounds(g), []);
  const t = duel("terraformer");
  assert.ok(t.utility(t.player));
  assert.deepEqual(sounds(t), ["rock"]);
  assert.ok(t.placeChasm(t.player, 550, 350));
  assert.deepEqual(sounds(t), ["rock"]);
  assert.equal(t.placeChasm(t.player, 550, 350), false);
  assert.deepEqual(sounds(t), []);
});
test("Lightning sounds once per strike cast, not per flooded target or failed targeting", () => {
  const g = duel("lightning");
  g.fighters[1].x = 900;
  assert.equal(g.cast(g.player, 1), false);
  assert.deepEqual(sounds(g), []);
  g.fighters[1].x = 470;
  g.hazards.push({
    kind: "flood",
    life: 3,
    x: 400,
    y: 300,
    r: 100,
    owner: g.player,
  });
  assert.ok(g.cast(g.player, 1));
  assert.deepEqual(sounds(g), ["lightning"]);
});
test("healing sounds only with restored health; continuous springs space their cues", () => {
  const g = duel("light");
  g.cast(g.player, 1);
  assert.deepEqual(sounds(g), []);
  g.player.hp = 50;
  g.cast(g.player, 1);
  assert.deepEqual(sounds(g), ["heal"]);
  const s = duel("sanctuary");
  s.player.hp = 50;
  s.cast(s.player, 1);
  sounds(s);
  for (let i = 0; i < 20; i++) {
    s.time = i * 0.05;
    s.updateHazards(0.05);
  }
  assert.deepEqual(sounds(s), ["heal"]);
  s.time = 2.7;
  s.updateHazards(0.05);
  assert.deepEqual(sounds(s), ["heal"]);
});
test("War and Dungeon health pickups emit Heal only when collected", () => {
  const w = new Combat({ mode: "war", element: "fire" });
  w.player.hp = 50;
  w.healthDrops = [{ x: w.player.x, y: w.player.y, team: w.player.team }];
  updateWar(w, 0.05);
  assert.ok(sounds(w).includes("heal"));
  const d = new Combat({ mode: "dungeon", element: "water" });
  d.player.hp = 50;
  d.healthDrops = [{ x: d.player.x, y: d.player.y, heal: 32 }];
  updateDungeon(d);
  assert.deepEqual(sounds(d), ["heal"]);
});
test("revival recording is exclusive to a successful revival, while token drops emit Felled cue", () => {
  const g = duel("spirit");
  assert.equal(g.revive(g.player), false);
  assert.deepEqual(sounds(g), []);
  const ally = makeFighter("ally", "water", 0, 430, 300);
  g.fighters.push(ally);
  g.fell(ally);
  assert.deepEqual(sounds(g), ["token"]);
  assert.ok(g.revive(g.player));
  assert.deepEqual(sounds(g), ["revival"]);
});

test("Death, Gravity x2, Flood, Life spring and Laser Beam play once on activation", () => {
  for (const [form, kind, method] of [
    ["demonic", "death", "utility"],
    ["gravity", "gravity", "utility"],
    ["cloud", "flood", "utility"],
    ["sanctuary", "spring", "cast"],
    ["sun", "laser", "cast"],
  ]) {
    const g = duel(form);
    assert.ok(g[method](g.player, 1));
    assert.deepEqual(sounds(g), [kind]);
    if (method === "utility" || form === "sanctuary") {
      assert.equal(g[method](g.player, 1), false);
      assert.deepEqual(sounds(g), []);
    }
  }
  const g = duel("lightning");
  assert.ok(g.utility(g.player, true, "cloud"));
  assert.deepEqual(sounds(g), ["flood"]);
});
test("Radiance uses the new Heal cue only for allies whose health increases", () => {
  const g = duel("divine");
  g.player.hp = 50;
  const ally = makeFighter("ally", "water", 0, 430, 300);
  ally.hp = 50;
  g.fighters.push(ally);
  assert.ok(g.cast(g.player, 1));
  assert.deepEqual(sounds(g), ["heal", "heal"]);
});
