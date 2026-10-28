import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, recipe, COMBOS } from "../src/combat.js";
import { characterPose, isRunning, CHARACTERS } from "../src/characters.js";
import { immersionFor } from "../src/battle-effects.js";

function arena(element = "gravity", enemy = "water") {
  const g = new Combat({ element, random: () => 0 });
  Object.assign(g.player, { x: 330, y: 340 });
  g.fighters[1] = makeFighter("enemy-0", enemy, 1, 430, 340);
  return g;
}
test("telekinesis pushes only the selected enemy along every swipe direction", () => {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, -1],
  ]) {
    const g = arena(),
      a = g.player,
      b = g.fighters[1];
    const ally = makeFighter("ally", "water", 0, 400, 300);
    g.fighters.push(ally);
    assert.equal(g.telekinesis(a, b, dx, dy), true);
    assert.equal(b.hp, 102);
    assert.equal(ally.hp, 120);
    assert.ok(Math.abs(b.knockX - (dx / Math.hypot(dx, dy)) * 520) < 1e-8);
    assert.ok(Math.abs(b.knockY - (dy / Math.hypot(dx, dy)) * 520) < 1e-8);
    assert.equal(a.abilityCd, 4.5);
    assert.equal(g.telekinesis(a, b, -dx, -dy), false);
    g.update(0.05, { x: 0, y: 0 }, false);
    if (dx) assert.equal(Math.sign(b.x - 430), Math.sign(dx));
    if (dy) assert.equal(Math.sign(b.y - 340), Math.sign(dy));
  }
});
test("invalid telekinesis gestures consume neither health nor cooldown", () => {
  for (const invalid of [
    "ally",
    "range",
    "hidden",
    "dimension",
    "dead",
    "zero",
    "nan",
    "form",
  ]) {
    const g = arena(),
      a = g.player,
      b = g.fighters[1];
    if (invalid === "ally") b.team = 0;
    if (invalid === "range") b.x = 731;
    if (invalid === "hidden") {
      b.element = "divine";
      b.parts = recipe("divine");
    }
    if (invalid === "dimension") b.dimension = { portal: 1 };
    if (invalid === "dead") b.alive = false;
    if (invalid === "form") g.switchForm(a, "earth");
    assert.equal(
      g.telekinesis(
        a,
        b,
        invalid === "zero" ? 0 : invalid === "nan" ? NaN : 1,
        0,
      ),
      false,
      invalid,
    );
    assert.equal(a.abilityCd, 0);
    assert.equal(b.hp, 120);
  }
});
test("Gravity remains usable through the inherited skill tab and its AI", () => {
  const g = arena(),
    a = g.player,
    b = g.fighters[1];
  g.applyFusion(a, ["light"], { burst: false });
  g.switchForm(a, "gravity");
  assert.ok(g.telekinesis(a, b, 0, 1));
  const h = arena("water", "gravity"),
    rival = h.fighters[1];
  rival.aiTimer = 0;
  h.ai(rival, 0.01);
  assert.ok(rival.abilityCd > 0);
});
test("reflection triggers a timed shield instead of a text event without changing the split", () => {
  const g = arena("water", "mirror"),
    a = g.player,
    b = g.fighters[1];
  g.damage(a, b, 20, true, false, "water");
  assert.equal(b.reflect, 0.65);
  assert.equal(b.hp, 111);
  assert.equal(a.hp, 112);
  assert.ok(!g.events.some((e) => e.text.includes("REFLECT")));
  for (let i = 0; i < 14; i++) g.update(0.05, { x: 0, y: 0 }, false);
  assert.equal(b.reflect, 0);
});
test("contested strikes enter a paired weapon clash and suppress normal swings", () => {
  const g = arena("dark", "water"),
    a = g.player,
    b = g.fighters[1];
  b.x = 385;
  a.fx = 1;
  a.fy = 0;
  b.fx = -1;
  b.fy = 0;
  g.strike(a);
  g.strike(b);
  for (let i = 0; i < 3; i++) g.update(0.04, { x: 0, y: 0 }, false);
  assert.equal(a.hp, 116.5);
  assert.equal(b.hp, 116.5);
  assert.ok(a.clash > 0 && b.clash > 0);
  assert.equal(a.clashPartner, b.id);
  assert.equal(b.clashPartner, a.id);
  assert.equal(a.swing, 0);
  assert.equal(b.swing, 0);
  assert.ok(characterPose(a).frame >= 3);
  assert.ok(characterPose(b).frame >= 3);
  assert.ok(!g.events.some((e) => e.text === "CLASH"));
  for (let i = 0; i < 7; i++) g.update(0.05, { x: 0, y: 0 }, false);
  assert.equal(a.clash, 0);
  assert.ok(characterPose(a).frame < 3);
});
test("all thirteen grounded designs run; flight, resting, walls and clashes suppress running", () => {
  assert.equal(CHARACTERS.length, 23);
  let grounded = 0;
  for (const e of [
    ...Object.keys(COMBOS).map((k) => COMBOS[k]),
    "water",
    "dark",
    "fire",
    "earth",
    "light",
    "air",
  ]) {
    const a = makeFighter("player", e, 0, 330, 340);
    a.vx = 150;
    a.fx = 1;
    a.fy = 0;
    a.movingTime = 0.01;
    const flying = a.parts.includes("air");
    assert.equal(isRunning(a), !flying);
    if (flying) {
      assert.equal(characterPose(a).runFrame, null);
      continue;
    }
    grounded++;
    assert.equal(characterPose(a).runFrame, 2);
    a.movingTime = 0.21;
    assert.equal(characterPose(a).runFrame, 3);
    a.movingTime = 0.11;
    assert.equal(
      characterPose(a).runFrame,
      ["earth", "mud"].includes(e) ? 2 : null,
    );
    a.clash = 0.2;
    a.clashFx = 1;
    a.clashFy = 0;
    assert.equal(characterPose(a).running, false);
    a.clash = 0;
    a.movingTime = 0;
    assert.equal(isRunning(a), false);
  }
  assert.equal(grounded, 13);
});
test("flood covers half of grounded bodies; sand covers feet, with flight and flood override respected", () => {
  const g = arena("light", "air"),
    a = g.player,
    b = g.fighters[1];
  const sand = { kind: "quicksand", x: a.x, y: a.y, r: 150, owner: b };
  g.hazards = [sand];
  assert.equal(immersionFor(g, a), 10);
  assert.equal(immersionFor(g, b), 0);
  g.hazards.push({ kind: "flood", x: a.x, y: a.y, r: 150, owner: b });
  assert.equal(immersionFor(g, a), 32);
  assert.equal(immersionFor(g, b), 0);
  a.x = 800;
  assert.equal(immersionFor(g, a), 0);
});
