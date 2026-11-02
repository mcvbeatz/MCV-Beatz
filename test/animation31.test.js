import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
import { characterPose } from "../src/characters.js";
import { vogBloom } from "../src/battle-effects.js";
const arena = (element) => {
  const g = new Combat({ element });
  g.fighters = [g.player, makeFighter("rival", "water", 1, 450, 350)];
  Object.assign(g.player, { x: 350, y: 350, fx: 1, fy: 0 });
  return g;
};
test("successful active casts animate the elemental; failed casts and excluded movement skills do not", () => {
  for (const e of [
    "water",
    "fire",
    "dark",
    "smoke",
    "sun",
    "cloud",
    "gravity",
    "lightning",
    "demonic",
    "apparition",
    "sanctuary",
  ]) {
    const g = arena(e),
      a = g.player;
    assert.equal(g.cast(a, 1), true, e);
    assert.ok(a.castTime > 0, e);
    assert.equal(characterPose(a).casting, true, e);
  }
  for (const e of ["dark", "air", "apparition", "blaze", "lightning"]) {
    const g = arena(e);
    assert.equal(g.utility(g.player), true, e);
    assert.equal(g.player.castTime, 0, e);
  }
  const g = arena("dark");
  g.fighters = [g.player];
  assert.equal(g.cast(g.player, 1), false);
  assert.equal(g.player.castTime, 0);
});
test("casting works for inherited skills, shield activation and placed abilities, without looping on hold", () => {
  const g = arena("earth"),
    a = g.player;
  assert.equal(g.utility(a), true);
  a.castTime = 0.1;
  assert.equal(g.utility(a), true);
  assert.equal(a.castTime, 0.1);
  g.utility(a, false);
  assert.equal(a.castTime, 0.1);
  const t = arena("terraformer"),
    b = t.player;
  assert.equal(t.cast(b, 1), false);
  assert.equal(b.castTime, 0);
  assert.equal(t.placeChasm(b, 350, 450), true);
  assert.equal(characterPose(b).facing, 0);
  assert.ok(b.castTime > 0);
  const s = arena("divine"),
    c = s.player;
  assert.equal(s.utility(c, true, "spirit"), true);
  assert.equal(c.castTime, 0);
  assert.equal(s.portals.place(c, 650, 400), true);
  assert.ok(c.castTime > 0);
  c.castTime = 0;
  assert.equal(s.cast(c, 1, "light"), true);
  assert.ok(c.castTime > 0);
});
test("flight poses distinguish movement from stillness, while casting, dash, hit and death take priority", () => {
  for (const e of [
    "air",
    "spirit",
    "blaze",
    "cloud",
    "apparition",
    "demonic",
    "divine",
    "lightning",
    "phoenix",
    "terraformer",
  ]) {
    const a = makeFighter("flyer", e, 0, 400, 350);
    assert.equal(characterPose(a).flyingMoving, false);
    Object.assign(a, { movingTime: 0.2, vx: 150 });
    assert.equal(characterPose(a).flyingMoving, true, e);
    Object.assign(a, { castTime: 0.3, castFx: 1, castFy: 0 });
    assert.equal(characterPose(a).casting, true);
    assert.equal(characterPose(a).flyingMoving, false);
    a.burst = 0.2;
    assert.equal(characterPose(a).casting, false);
    a.burst = 0;
    a.hitReact = 0.2;
    assert.equal(characterPose(a).casting, false);
    a.alive = false;
    assert.equal(characterPose(a).flyingMoving, false);
  }
});
test("Vog blooms once based on creation time, independent of fire shortening its life", () => {
  const g = arena("smoke");
  g.time = 10;
  g.cast(g.player, 1);
  const h = g.hazards[0];
  assert.equal(h.createdAt, 10);
  assert.ok(vogBloom(h, 10).scale < 0.1);
  assert.ok(vogBloom(h, 10.2).scale > 0.5);
  assert.equal(vogBloom(h, 10.55).scale, 1);
  h.life /= 2;
  assert.equal(vogBloom(h, 11).scale, 1);
  assert.equal(vogBloom({ r: 100 }, 0).scale, 1);
});
