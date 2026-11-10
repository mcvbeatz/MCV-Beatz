import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  recipe,
  combination,
  hasPassive,
  LEVEL_TWO,
  LEVEL_THREE,
  ICICLE_DPS,
  ICICLE_INTERVAL,
} from "./combat-fixture.js";
function arena(element = "ice", enemy = "light") {
  const g = new Combat({ element, mode: "tdm", random: () => 0 });
  g.fighters = [g.player, makeFighter("rival", enemy, 1, 420, 350)];
  Object.assign(g.player, { x: 300, y: 350, fx: 1, fy: 0 });
  return g;
}
function tick(g, seconds) {
  for (let t = 0; t < seconds - 1e-8; t += 0.01)
    g.update(0.01, { x: 0, y: 0 }, false);
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("Ice and both Abyssal recipes fuse through tokens and enter their correct tier", () => {
  assert.ok(LEVEL_TWO.includes("ice"));
  assert.ok(LEVEL_THREE.includes("abyssal"));
  for (const [base, token, result] of [
    ["water", "dark", "ice"],
    ["ice", "earth", "abyssal"],
    ["mud", "dark", "abyssal"],
  ]) {
    assert.equal(combination(recipe(base), recipe(token)), result);
    const g = arena(base);
    const ally = makeFighter("ally", token, 0, g.player.x, g.player.y);
    g.fighters.push(ally);
    g.fell(ally);
    assert.ok(g.touchTokens(g.player));
    assert.equal(g.player.element, result);
    assert.ok(hasPassive(g.player, "ice"));
  }
});
test("held Icicle Burst has endless five-shot cadence, 3 base DPS, forward aim and no release shot", () => {
  for (const element of ["ice", "abyssal"]) {
    const g = arena(element),
      a = g.player;
    assert.ok(g.startCharge(a));
    for (let i = 0; i < 1000; i++) g.updateIcicles(a, 0.01);
    assert.equal(g.projectiles.length, 50);
    near(
      g.projectiles.reduce((n, p) => n + p.damage, 0),
      30,
    );
    assert.ok(
      g.projectiles.every(
        (p) =>
          p.kind === "icicle" &&
          p.dx > 0 &&
          p.dy === 0 &&
          p.damage === ICICLE_DPS * ICICLE_INTERVAL,
      ),
    );
    a.fx = 0;
    a.fy = -1;
    g.updateIcicles(a, 0.2);
    assert.ok(g.projectiles.at(-1).dy < 0);
    assert.equal(g.projectiles.at(-1).dx, 0);
    const count = g.projectiles.length;
    g.releaseCharge(a);
    g.updateIcicles(a, 1);
    assert.equal(g.projectiles.length, count);
    assert.equal(a.abilityCd, 0);
    assert.ok(g.startCharge(a));
  }
});
test("icicles use swept hits, shield defenses and stop after the first fighter", () => {
  const g = arena(),
    a = g.player,
    b = g.fighters[1];
  b.x = 350;
  const behind = makeFighter("behind", "light", 1, 390, 350);
  g.fighters.push(behind);
  g.startCharge(a);
  g.updateIcicles(a, 0.01);
  g.updateProjectiles(0.3);
  near(b.hp, 119.4);
  assert.equal(behind.hp, 120);
  assert.equal(g.projectiles.length, 0);
  b.shield = 1;
  b.shieldHp = 65;
  g.updateIcicles(a, 0.2);
  g.updateProjectiles(0.3);
  near(b.hp, 119.4);
  near(b.shieldHp, 64.4);
});
test("Icicle Burst stops on sabotage, death, prison and form change; stagger pauses shots", () => {
  const g = arena(),
    a = g.player;
  a.sabotaged = true;
  assert.equal(g.startCharge(a), false);
  a.prisonHp = 65;
  assert.equal(g.startCharge(a), false);
  a.prisonHp = 0;
  assert.ok(g.startCharge(a));
  a.stagger = 0.3;
  g.updateIcicles(a, 0.2);
  assert.equal(g.projectiles.length, 0);
  a.stagger = 0;
  a.prisonHp = 65;
  g.updateIcicles(a, 0.2);
  assert.equal(a.charging, false);
  a.prisonHp = 0;
  g.startCharge(a);
  g.switchForm(a, "water");
  g.updateIcicles(a, 0.2);
  assert.equal(g.projectiles.length, 0);
  g.startCharge(a, "ice");
  g.fell(a);
  g.updateIcicles(a, 0.2);
  assert.equal(g.projectiles.length, 0);
});
test("Drain transfers only actual contact damage, stops on separation and follows friendly fire", () => {
  const g = arena(),
    a = g.player,
    b = g.fighters[1];
  a.hp = 50;
  b.x = 325;
  tick(g, 1);
  near(b.hp, 117);
  near(a.hp, 53);
  assert.equal(a.draining, 1);
  assert.equal(b.drained, 1);
  b.x = 500;
  tick(g, 0.1);
  near(a.hp, 53);
  near(b.hp, 117);
  assert.equal(a.draining, 0);
  assert.equal(b.drained, 0);
  g.checkMatchEnd = () => false;
  b.x = 325;
  b.team = a.team;
  g.friendlyFire = false;
  tick(g, 1);
  near(a.hp, 53);
  near(b.hp, 117);
  g.friendlyFire = true;
  tick(g, 1);
  near(a.hp, 56);
  near(b.hp, 114);
});
test("Drain cannot heal through a shield, over-heal, or steal more than remaining HP", () => {
  const g = arena(),
    a = g.player,
    b = g.fighters[1];
  a.hp = 50;
  b.x = 325;
  b.shield = 1;
  tick(g, 1);
  near(a.hp, 50);
  near(b.hp, 120);
  near(b.shieldHp, 62);
  assert.equal(a.draining, 0);
  b.shield = 0;
  b.hp = 0.01;
  tick(g, 0.01);
  near(a.hp, 50.01);
  assert.equal(b.alive, false);
  const h = arena();
  h.fighters[1].x = 325;
  tick(h, 1);
  assert.equal(h.player.hp, 120);
});
test("Void Mantle is held, absorbs attacks, damages on touch, breaks, and recharges", () => {
  const g = arena("abyssal"),
    a = g.player,
    b = g.fighters[1];
  b.x = 325;
  assert.ok(g.utility(a));
  assert.equal(a.shieldKind, "void");
  assert.equal(g.startCharge(a), false);
  tick(g, 0.01);
  near(b.hp, 120 - (5 + 3) * 0.01); // Venom starts ticking on the next frame.
  near(g.damage(b, a, 20), 0);
  near(a.shieldHp, 51.5);
  g.damage(b, a, 100);
  assert.equal(a.shield, 0);
  assert.equal(a.utilityCd, 5);
  assert.equal(g.utility(a), false);
  b.x = 500;
  tick(g, 5.1);
  assert.ok(g.utility(a));
  g.utility(a, false);
  assert.equal(a.shield, 0);
  assert.equal(a.utilityCd, 5);
});
test("Void Mantle cancels the stream, respects Sabotage and never survives death", () => {
  const g = arena("abyssal"),
    a = g.player;
  a.sabotaged = true;
  assert.equal(g.utility(a), false);
  assert.equal(a.shield, 0);
  g.startCharge(a);
  assert.ok(g.utility(a));
  assert.equal(a.charging, false);
  g.fell(a);
  assert.equal(a.shield, 0);
});
test("AI sustains icicles and can choose Void Mantle under close pressure", () => {
  const g = arena("light", "abyssal"),
    a = g.fighters[1];
  g.player.x = 300;
  a.x = 420;
  a.aiControlled = true;
  g.startCharge(a);
  a.aiTimer = 0;
  g.ai(a, 0.01);
  assert.equal(a.charging, true);
  a.x = 340;
  a.aiTimer = 0;
  g.ai(a, 0.01);
  assert.equal(a.shieldKind, "void");
  assert.ok(a.shield);
});

test("rapid release and re-press cannot bypass the icicle firing cadence", () => {
  const g = arena(),
    a = g.player;
  for (let i = 0; i < 100; i++) {
    assert.ok(g.startCharge(a));
    g.updateIcicles(a, 0.01);
    g.releaseCharge(a);
  }
  assert.equal(g.projectiles.length, 5);
  g.updateIcicles(a, 0.2);
  g.startCharge(a);
  g.updateIcicles(a, 0.01);
  assert.equal(g.projectiles.length, 6);
});
