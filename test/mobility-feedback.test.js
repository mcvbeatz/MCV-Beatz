import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  recipe,
  inWorld,
  activeForm,
} from "../src/combat.js";
import { immersionFor } from "../src/battle-effects.js";
import { characterPose } from "../src/characters.js";
function arena(element = "earth", enemy = "spirit") {
  const g = new Combat({ element, random: () => 0 });
  g.fighters[1] = makeFighter("enemy", enemy, 1, 750, 340);
  return g;
}
function hazard(g, kind, b, owner = g.player) {
  return {
    owner,
    kind,
    element: kind === "quicksand" ? "mud" : kind === "flood" ? "cloud" : "fire",
    x: b.x,
    y: b.y,
    r: 70,
    power: 1,
    life: 8,
    tick: 0,
  };
}
test("Mud ignores allied and hostile quicksand damage, slowing and foot immersion across skill tabs", () => {
  for (const team of [0, 1]) {
    const g = arena("earth", "mud"),
      b = g.fighters[1];
    b.team = team;
    g.switchForm(b, "water");
    g.hazards = [hazard(g, "quicksand", b)];
    g.updateHazards(0.01);
    assert.equal(b.hp, 120);
    assert.equal(b.slow, 0);
    assert.equal(immersionFor(g, b), 0);
    b.element = "light";
    b.parts = ["light"];
    g.hazards[0].tick = 0;
    g.updateHazards(0.01);
    assert.ok(b.hp < 120);
    assert.ok(b.slow > 0);
    assert.equal(immersionFor(g, b), 10);
  }
});
test("quicksand, gravity, flood, heatwave and magma never trigger Reflect or reduce damage to its retained share", () => {
  for (const kind of ["quicksand", "gravity", "flood", "heatwave", "magma"]) {
    const g = arena("air", kind === "flood" ? "invincible" : "mirror"),
      a = g.player,
      b = g.fighters[1];
    g.hazards = [hazard(g, kind, b)];
    g.updateHazards(0.01);
    assert.equal(a.hp, 120, kind);
    assert.equal(b.reflect, 0, kind);
    const damage =
      kind === "gravity"
        ? 0
        : kind === "flood"
          ? 22.5
          : kind === "quicksand"
            ? 0
            : 2.25;
    assert.equal(b.hp, 120 - damage, kind);
  }
  const g = arena("air", "mirror"),
    a = g.player,
    b = g.fighters[1];
  g.hazards = [hazard(g, "vog", b)];
  g.updateHazards(0.01);
  assert.equal(a.hp, 120);
  assert.equal(b.hp, 120);
  assert.equal(b.reflect, 0);
  g.damage(a, b, 20, true, false, "air");
  assert.ok(b.reflect > 0);
});
test("summoning flashes new echo bodies and dropping a token starts its shine without status text", () => {
  const g = arena("demonic", "earth");
  g.cast(g.player, 1);
  const echoes = g.fighters.filter((a) => a.echo);
  assert.equal(echoes.length, 3);
  assert.ok(echoes.every((a) => a.spawnFlash === 0.65));
  assert.deepEqual(g.events, []);
  const ally = makeFighter("ally", "light", 0, 400, 400);
  g.fighters.push(ally);
  g.time = 2;
  g.fell(ally);
  assert.equal(g.visibleTokens()[0].bornAt, 2);
  assert.deepEqual(g.events, []);
  g.fell(g.fighters[1]);
  assert.equal(g.visibleTokens().length, 1);
});
test("healing, dodging, guard and failed casts produce semantic visual cues rather than floating labels", () => {
  const g = arena("light", "dark"),
    a = g.player,
    b = g.fighters[1];
  a.hp = 50;
  g.cast(a, 1);
  assert.ok(g.effects.some((e) => e.cue === "heal"));
  const spirit = makeFighter("spirit", "spirit", 0, 500, 300);
  g.fighters.push(spirit);
  assert.equal(g.startCharge(spirit), false);
  assert.ok(g.effects.some((e) => e.cue === "unavailable"));
  g.utility(b);
  assert.ok(g.effects.some((e) => e.cue === "dodge"));
  assert.deepEqual(g.events, []);
});
test("Earth and Mud keep a quadruped frame throughout each running direction and return to idle when stopped", () => {
  for (const e of ["earth", "mud"])
    for (const [fx, fy, base] of [
      [0, 1, 0],
      [1, 0, 2],
      [0, -1, 4],
    ]) {
      const a = makeFighter("a", e, 0, 400, 340);
      Object.assign(a, { fx, fy, vx: 150 });
      for (let i = 0; i < 4; i++) {
        a.movingTime = 0.01 + i * 0.1;
        assert.equal(characterPose(a).runFrame, base + (i < 2 ? 0 : 1));
      }
      a.vx = 0;
      a.movingTime = 0;
      assert.equal(characterPose(a).runFrame, null);
    }
});
test("Spirit and Divine AI create a valid pair, wait through opening, and actually travel without stealing player placement", () => {
  for (const element of ["spirit", "divine"]) {
    const g = arena("spirit", element),
      a = g.fighters[1];
    g.portals.begin(g.player);
    g.update(0.04);
    const pair = g.portals.owned(a);
    assert.equal(pair.length, 2, element);
    assert.equal(g.portals.placing, "player");
    assert.ok(pair.every((p) => !g.portals.active(p)));
    assert.ok(
      pair.every((p) =>
        g.fighters.every((f) => Math.hypot(f.x - p.x, f.y - p.y) >= 39),
      ),
    );
    let crossing = false;
    for (let i = 0; i < 45; i++) {
      g.update(0.04);
      if (a.transit) crossing = true;
    }
    assert.ok(crossing, element);
    assert.ok(a.x < 500, element);
    assert.ok(inWorld(a));
    assert.equal(g.portals.placing, "player");
  }
});
test("AI does not close a portal containing a traveller while planning a new route", () => {
  const g = arena("earth", "divine"),
    a = g.fighters[1];
  a.aiControlled = true;
  g.portals.place(a, 680, 450, { autonomous: true });
  g.portals.place(a, 450, 450, { autonomous: true });
  const ally = makeFighter("ally", "water", 1, 680, 450);
  g.fighters.push(ally);
  ally.dimension = {
    portal: g.portals.owned(a)[0].id,
    depth: 30,
    dx: 1,
    dy: 0,
    age: 0,
  };
  const ids = g.portals.owned(a).map((p) => p.id);
  g.ai(a, 0.04);
  assert.deepEqual(
    g.portals.owned(a).map((p) => p.id),
    ids,
  );
  assert.ok(ally.alive);
});
test("Multi-Dimensional AI teleports to approach and retreat, retaining range and vulnerable preparation", () => {
  for (const retreat of [false, true]) {
    const g = arena("earth", "multi-dimensional"),
      a = g.fighters[1];
    if (retreat) {
      a.x = 410;
      a.hp = 30;
    }
    const before = a.x;
    g.ai(a, 0.04);
    assert.ok(a.blink);
    assert.equal(a.x, before);
    assert.ok(Math.hypot(a.blink.x - a.x, a.blink.y - a.y) <= 180.00001);
    assert.ok(retreat ? a.blink.x > before : a.blink.x < before);
    g.damage(g.player, a, 8);
    assert.ok(a.hp < (retreat ? 30 : 120));
    for (let i = 0; i < 6; i++) g.update(0.04);
    assert.notEqual(a.x, before);
  }
});
test("mobility AI avoids dangerous destinations and never targets an invisible Divine live position", () => {
  const g = arena("divine", "multi-dimensional"),
    a = g.fighters[1];
  g.ai(a, 0.04);
  assert.equal(a.blink, null);
  const h = arena("earth", "multi-dimensional"),
    b = h.fighters[1];
  h.hazards = [{ ...hazard(h, "death", b), x: 570, y: 340, r: 100 }];
  h.ai(b, 0.04);
  if (b.blink) assert.ok(Math.hypot(b.blink.x - 570, b.blink.y - 340) > 112);
});
