import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  distance,
  inWorld,
  multiplier,
} from "../src/combat.js";
function arena(element = "spirit", rival = "water") {
  const g = new Combat({ element, random: () => 0 });
  Object.assign(g.player, { x: 250, y: 450, fx: 1, fy: 0 });
  g.fighters[1] = makeFighter("enemy-0", rival, 1, 800, 450);
  return g;
}
const advance = (g, seconds, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < seconds - 1e-8; t += 0.01) g.update(0.01, input, false);
};
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function gate(g, x = 400, y = 300) {
  g.portals.begin(g.player);
  assert.ok(g.portals.place(g.player, x, y));
  return g.portals.portals.at(-1);
}
test("portal placement rejects living fighters, ghosts and the owner, without consuming a slot", () => {
  const g = arena(),
    b = g.fighters[1];
  g.portals.begin(g.player);
  assert.equal(g.portals.place(g.player, g.player.x, g.player.y), false);
  assert.equal(g.portals.place(g.player, b.x, b.y), false);
  const ghost = makeFighter("ghost", "spirit", 0, 500, 350);
  ghost.alive = false;
  ghost.ghost = true;
  g.fighters.push(ghost);
  assert.equal(g.portals.place(g.player, 520, 350), false);
  assert.equal(g.portals.portals.length, 0);
  assert.equal(g.portals.placing, g.player.id);
  assert.ok(g.portals.place(g.player, 400, 300));
});
test("portals warn for 500ms; closing a warning or an unentered portal cannot kill by proximity", () => {
  const g = arena(),
    b = g.fighters[1],
    p = gate(g);
  b.x = p.x;
  b.y = p.y;
  advance(g, 0.49);
  assert.ok(inWorld(b));
  assert.equal(g.portals.active(p), false);
  g.portals.close(g.player, p.id);
  assert.ok(b.alive);
  assert.equal(b.hp, 120);
  b.x = 800;
  b.y = 450;
  const next = gate(g);
  advance(g, 0.5);
  assert.ok(g.portals.active(next));
  b.x = next.x;
  b.y = next.y;
  // The actor has not crossed yet: simply closing underneath it is harmless.
  g.portals.close(g.player, next.id);
  assert.ok(b.alive);
});
test("active portals still kill actual crossing travellers, and a closed warning exit leaves entrants trapped", () => {
  const g = arena(),
    a = g.player;
  const first = gate(g);
  advance(g, 0.5);
  a.x = first.x;
  a.y = first.y;
  advance(g, 0.01);
  assert.ok(a.dimension);
  const second = gate(g, 650, 300);
  advance(g, 0.2);
  assert.ok(a.dimension);
  g.portals.close(a, second.id);
  assert.ok(a.alive && a.dimension);
  const replacement = gate(g, 650, 300);
  advance(g, 0.5);
  assert.ok(inWorld(a));
  a.portalCooldown = 0;
  a.x = first.x;
  a.y = first.y;
  advance(g, 0.01);
  assert.ok(a.transit);
  g.portals.close(a, replacement.id);
  assert.equal(a.alive, false);
  assert.equal(a.lost, false);
});
test("Mirror-family abilities split 40/60 across skill tabs and apply defenses separately", () => {
  for (const element of [
    "mirror",
    "divine",
    "invincible",
    "multi-dimensional",
  ]) {
    const g = arena("air", element),
      a = g.player,
      b = g.fighters[1];
    g.switchForm(b, "light");
    const taken = g.damage(a, b, 20, true, false, "air");
    near(taken, 9);
    near(b.hp, 111);
    near(a.hp, 112);
  }
  const g = arena("mirror", "mirror"),
    a = g.player,
    b = g.fighters[1];
  g.damage(a, b, 20, true, false, "mirror");
  near(a.hp, 117);
  near(b.hp, 115.5); // Same-element half damage once, no recursive bounces.
});
test("reflection keeps the original matchup once and an active shield absorbs only the retained share", () => {
  const g = arena("dark", "mirror"),
    a = g.player,
    b = g.fighters[1];
  g.switchForm(b, "earth");
  g.utility(b);
  g.damage(a, b, 20, true, false, "dark");
  near(a.hp, 110.4);
  near(b.shieldHp, 54.2);
  near(b.hp, 120);
  assert.equal(multiplier("dark", "mirror"), 1.2);
});
test("Invincible doubles melee but keeps contact burn and ability damage at normal strength", () => {
  for (const element of ["fire", "invincible"]) {
    const g = arena(element, "air"),
      a = g.player,
      b = g.fighters[1];
    b.x = a.x + 20;
    b.y = a.y;
    advance(g, 0.1);
    near(b.hp, 119.5);
    const hp = b.hp;
    g.damage(a, b, 20, true, false, "fire");
    near(b.hp, hp - 20);
    const next = b.hp;
    g.damage(a, b, 14, false);
    near(b.hp, next - (element === "invincible" ? 28 : 14));
  }
});
test("Demonic gets three 8-HP minions, while Apparition retains its single 1-HP double", () => {
  for (const element of ["demonic", "apparition"]) {
    const g = arena(element);
    g.cast(g.player, 1);
    const echoes = g.fighters.filter((a) => a.echo);
    assert.equal(echoes.length, element === "demonic" ? 3 : 1);
    for (const e of echoes) assert.equal(e.hp, element === "demonic" ? 8 : 1);
    g.damage(g.fighters[1], echoes[0], 2, false);
    assert.equal(echoes[0].alive, element === "demonic");
    if (echoes[0].alive) {
      g.damage(g.fighters[1], echoes[0], 14, false);
      assert.equal(echoes[0].alive, false);
    }
  }
});
test("Flood hits Fire-bearing fighters once per cast, including re-entry, and a new cast can hit again", () => {
  const g = arena("cloud", "fire"),
    a = g.player,
    b = g.fighters[1];
  b.x = 400;
  b.y = 300;
  g.hazards.push({
    owner: a,
    kind: "flood",
    element: "cloud",
    x: 400,
    y: 300,
    r: 80,
    power: 1,
    life: 8,
    tick: 0,
  });
  advance(g, 0.01);
  assert.equal(b.hp, 90);
  assert.ok(b.slow > 0);
  advance(g, 1);
  assert.equal(b.hp, 90);
  b.x = 700;
  advance(g, 0.4);
  b.x = 400;
  advance(g, 0.4);
  assert.equal(b.hp, 90);
  g.hazards.push({ ...g.hazards[0], floodHits: new Set(), tick: 0 });
  advance(g, 0.01);
  assert.equal(b.hp, 60);
});
test("Flood uses max-health base damage with defenses and reflection, and does not damage non-Fire fighters", () => {
  const g = arena("cloud", "invincible"),
    a = g.player,
    b = g.fighters[1];
  b.x = 400;
  b.y = 300;
  const earth = makeFighter("earth", "earth", 1, 440, 300);
  g.fighters.push(earth);
  g.hazards.push({
    owner: a,
    kind: "flood",
    element: "cloud",
    x: 400,
    y: 300,
    r: 80,
    power: 1,
    life: 8,
    tick: 0,
  });
  advance(g, 0.01);
  near(b.hp, 106.5);
  near(a.hp, 108);
  assert.equal(earth.hp, 120);
  assert.ok(earth.slow > 0);
  assert.ok(b.alive);
});
test("teleport caps distance, locks its destination, stays vulnerable for 200ms, and can immediately repeat", () => {
  const g = arena("multi-dimensional"),
    a = g.player;
  a.x = 300;
  a.y = 300;
  assert.ok(g.teleport(a, 800, 300));
  near(a.blink.x, 480);
  assert.equal(g.teleport(a, 200, 300), false);
  near(a.blink.x, 480);
  advance(g, 0.19, { x: 1, y: 0 });
  near(a.x, 300);
  assert.ok(inWorld(a));
  g.damage(g.fighters[1], a, 14);
  near(a.hp, 109.5);
  advance(g, 0.01);
  near(a.x, 480);
  assert.equal(a.blink, null);
  assert.ok(g.teleport(a, 660, 300));
  advance(g, 0.2);
  near(a.x, 660);
  assert.equal(a.abilityCd, 0);
});
test("death, knockback and Shock cancel a pending teleport rather than granting escape immunity", () => {
  for (const reason of ["death", "knockback", "shock"]) {
    const g = arena("multi-dimensional"),
      a = g.player;
    a.x = 300;
    a.y = 300;
    g.teleport(a, 480, 300);
    if (reason === "death") g.damage(g.fighters[1], a, 1000);
    if (reason === "knockback") a.knockX = 200;
    if (reason === "shock")
      g.fighters.push(makeFighter("lightning", "lightning", 1, 320, 300));
    advance(g, 0.25);
    assert.equal(a.blink, null);
    assert.ok(a.x < 480);
  }
});
test("teleport can enter a ready portal at arrival, and portal entry cancels a pending departure", () => {
  const g = arena("multi-dimensional"),
    a = g.player;
  const p = gate(g, 400, 300);
  advance(g, 0.5);
  a.x = 300;
  a.y = 300;
  g.teleport(a, 400, 300);
  advance(g, 0.2);
  assert.ok(a.dimension);
  assert.equal(a.blink, null);
  // Retreat then start on a portal: transport cancels the pending blink.
  advance(g, 0.3, { x: -1, y: 0 });
  a.portalCooldown = 0;
  a.x = p.x;
  a.y = p.y;
  assert.ok(g.teleport(a, 550, 300));
  g.portals.enter(a, a);
  assert.equal(a.blink, null);
  assert.ok(a.dimension);
});
