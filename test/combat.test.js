import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  canHit,
  multiplier,
  combination,
  activeForm,
  skillsFor,
  LEVEL_TWO,
  inWorld,
} from "../src/combat.js";
const advance = (g, s, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < s - 1e-8; t += 0.01) g.update(0.01, input, false);
};
function duel(element = "light", rival = "water") {
  const g = new Combat({ element, random: () => 0.2 });
  g.fighters[1] = makeFighter("enemy-0", rival, 1, 450, 300);
  g.player.x = 400;
  g.player.y = 300;
  g.player.fx = 1;
  g.player.fy = 0;
  return g;
}
function portals(
  g,
  points = [
    [400, 300],
    [650, 300],
  ],
) {
  assert.ok(g.portals.begin(g.player));
  for (const [x, y] of points) assert.ok(g.portals.place(g.player, x, y));
  return g.portals.portals;
}
function remoteSpirit() {
  const g = duel("spirit");
  g.player.x = 250;
  g.player.y = 450;
  g.fighters[1].x = 800;
  g.fighters[1].y = 450;
  return g;
}
test("melee is directional and short range", () => {
  const g = duel(),
    [a, b] = g.fighters;
  assert.ok(canHit(a, b));
  a.fx = -1;
  assert.equal(canHit(a, b), false);
  a.fx = 1;
  b.x = 500;
  assert.equal(canHit(a, b), false);
  b.x = 450;
  g.strike(a);
  advance(g, 0.15);
  assert.equal(b.hp, 106);
});
test("automatic lock picks the nearest opponent only inside strike range", () => {
  const g = duel(),
    [a, b] = g.fighters;
  const closer = makeFighter("closer", "water", 1, 370, 300);
  g.fighters.push(closer);
  g.autoLock(a);
  assert.equal(a.lock, "closer");
  assert.equal(a.fx, -1);
  closer.x = 200;
  b.x = 500;
  g.autoLock(a);
  assert.equal(a.lock, null);
  b.x = 450;
  g.move(a, 0, 1, 0.1);
  assert.equal(a.lock, b.id);
  assert.equal(a.x, 400);
  assert.ok(a.fy < 0);
  a.blind = 1;
  g.autoLock(a);
  assert.equal(a.lock, null);
});
test("contested facing strikes deal quarter damage", () => {
  const g = duel(),
    [a, b] = g.fighters;
  g.strike(a);
  advance(g, 0.04);
  g.strike(b);
  advance(g, 0.15);
  assert.equal(a.hp, 116.5);
  assert.equal(b.hp, 116.5);
});
test("strikes outside the clash window deal full damage", () => {
  const g = duel(),
    [a, b] = g.fighters;
  g.strike(a);
  advance(g, 0.15);
  g.strike(b);
  advance(g, 0.15);
  assert.equal(a.hp, 106);
  assert.equal(b.hp, 106);
});
test("friendly fire damages a teammate in the strike arc", () => {
  const g = duel(),
    ally = makeFighter("ally", "water", 0, 440, 300);
  g.fighters.push(ally);
  g.strike(g.player);
  advance(g, 0.15);
  assert.equal(ally.hp, 106);
});
test("movement has analog speed, low-health slowdown, and flight inertia", () => {
  const g = duel();
  const full = makeFighter("f", "water", 0, 300, 300),
    half = makeFighter("h", "water", 0, 300, 300),
    hurt = makeFighter("hurt", "water", 0, 300, 300),
    air = makeFighter("air", "air", 0, 300, 300);
  hurt.hp = 10;
  g.move(full, 1, 0, 0.1);
  g.move(half, 0.5, 0, 0.1);
  g.move(hurt, 1, 0, 0.1);
  assert.equal(full.x - 300, 2 * (half.x - 300));
  assert.ok(hurt.x < full.x);
  for (let i = 0; i < 20; i++) g.move(air, 1, 0, 0.05);
  g.move(air, -1, 0, 0.05);
  assert.ok(air.vx > 0);
});
test("hits pause charging without deleting stored power", () => {
  const g = duel(),
    [a, b] = g.fighters;
  g.startCharge(b);
  advance(g, 0.6);
  const charge = b.charge;
  g.damage(a, b, 14);
  advance(g, 0.1);
  assert.ok(b.charging);
  assert.equal(b.charge, charge);
  advance(g, 0.4);
  assert.ok(b.charge > charge);
});
test("charge strengthens skills and enforces cooldown", () => {
  const g = duel(),
    b = g.fighters[1];
  g.startCharge(b);
  advance(g, 1.81);
  g.releaseCharge(b);
  assert.ok(g.projectiles[0].damage > 50);
  assert.equal(b.abilityCd, 4.5);
  assert.equal(g.startCharge(b), false);
});
test("same-element resistance and hierarchy remain explicit", () => {
  assert.equal(multiplier("water", "water"), 0.5);
  assert.equal(multiplier("water", "water", false), 1);
  assert.equal(multiplier("water", "fire"), 1.5);
  assert.equal(multiplier("fire", "earth"), 1.5);
});
test("water ability damage against Fire is reduced by exactly 30%", () => {
  const g = duel("water", "fire"),
    [a, b] = g.fighters;
  const hit = g.damage(a, b, 23 * 2, true);
  assert.ok(Math.abs(hit - 23 * 2 * 1.5 * 0.7) < 1e-9);
});
test("automatic token touch fuses once, pushes both teams, and hides rival tokens", () => {
  const g = duel(),
    [a, b] = g.fighters;
  const ally = makeFighter("ally", "air", 0, 410, 300),
    other = makeFighter("other", "water", 0, 300, 300);
  g.fighters.push(ally, other);
  g.fell(ally);
  g.tokens.push({
    owner: "rival-token",
    team: 1,
    parts: ["earth"],
    x: a.x,
    y: a.y,
  });
  assert.equal(g.visibleTokens().length, 1);
  advance(g, 0.01);
  assert.equal(a.element, "spirit");
  assert.ok(b.knockX > 0);
  assert.ok(other.knockX < 0);
  assert.equal(g.tokens.length, 1);
  assert.equal(g.visibleTokens().length, 0);
  assert.equal(g.effects[0].kind, "fusion");
  assert.equal(g.touchTokens(a), false);
});
test("fusion requires actual contact and ignores incompatible or enemy tokens", () => {
  const g = duel();
  g.tokens.push({ x: 440, y: 300, parts: ["air"], team: 0, owner: "test" });
  assert.equal(g.touchTokens(g.player), false);
  g.tokens[0].x = 400;
  g.tokens[0].team = 1;
  assert.equal(g.touchTokens(g.player), false);
  g.tokens[0].team = 0;
  g.tokens[0].parts = ["water"];
  assert.equal(g.touchTokens(g.player), false);
  assert.equal(combination(["light"], ["water"]), null);
});
test("skill switching keeps fused identity, passives and cooldowns", () => {
  const g = duel("mirror"),
    a = g.player;
  assert.deepEqual(a.forms, ["earth", "light", "mirror"]);
  assert.deepEqual(skillsFor("mirror"), [null, null]);
  assert.equal(g.startCharge(a), false);
  assert.equal(g.utility(a), false);
  a.abilityCd = 3;
  g.switchForm(a, "earth");
  assert.equal(activeForm(a), "earth");
  assert.equal(a.element, "mirror");
  assert.equal(a.abilityCd, 3);
  const b = g.fighters[1],
    hp = b.hp;
  g.damage(b, a, 20, true);
  assert.equal(a.hp, 120);
  assert.ok(b.hp < hp);
});
test("level-three compatible fusion preserves all origin skill sets", () => {
  const g = duel("gravity");
  assert.ok(g.applyFusion(g.player, ["light"]));
  assert.equal(g.player.element, "multi-dimensional");
  assert.ok(g.player.forms.includes("earth"));
  assert.ok(g.player.forms.includes("dark"));
  assert.ok(g.player.forms.includes("light"));
});
test("all nine level-two elements can start fused mode, with randomized rivals", () => {
  assert.equal(LEVEL_TWO.length, 9);
  const rivals = new Set();
  for (let i = 0; i < LEVEL_TWO.length; i++) {
    const g = new Combat({
      mode: "fused",
      element: LEVEL_TWO[i],
      random: () => i / 9,
    });
    assert.equal(g.player.element, LEVEL_TWO[i]);
    assert.equal(g.player.parts.length, 2);
    rivals.add(g.fighters[1].element);
  }
  assert.equal(rivals.size, 9);
});
test("base rivals are randomized across the six origins", () => {
  const rivals = new Set();
  for (let i = 0; i < 6; i++)
    rivals.add(new Combat({ random: () => i / 6 }).fighters[1].element);
  assert.equal(rivals.size, 6);
});
test("rock shield lasts while held, blocks all directions, and breaks", () => {
  const g = duel("earth"),
    [a, b] = g.fighters;
  a.x = 250;
  b.x = 800;
  g.utility(a);
  advance(g, 4);
  assert.equal(a.shield, 1);
  g.damage(b, a, 20);
  assert.equal(a.hp, 120);
  assert.equal(a.shieldHp, 50);
  b.x = 200;
  g.damage(b, a, 100);
  assert.equal(a.shield, 0);
  assert.equal(a.hp, 95);
  assert.equal(a.utilityCd, 5);
  assert.equal(g.utility(a), false);
});
test("releasing the rock shield drops it and starts its cooldown", () => {
  const g = duel("earth");
  g.utility(g.player);
  advance(g, 1);
  g.utility(g.player, false);
  assert.equal(g.player.shield, 0);
  assert.equal(g.player.utilityCd, 5);
});
test("water passively cools magma without an ability button", () => {
  const g = duel("water");
  g.hazards.push({
    kind: "magma",
    owner: g.fighters[1],
    element: "fire",
    x: 400,
    y: 300,
    r: 60,
    life: Infinity,
    tick: 0,
    power: 1,
  });
  advance(g, 0.02);
  assert.equal(g.hazards.length, 0);
  assert.equal(skillsFor("water")[1], null);
});
test("sonic boom fans out, weakens at distance and misses outside the cone", () => {
  const g = duel("air");
  const a = g.player;
  a.x = 250;
  a.y = 300;
  const near = makeFighter("near", "water", 1, 350, 335),
    far = makeFighter("far", "water", 1, 550, 300),
    side = makeFighter("side", "water", 1, 350, 410),
    behind = makeFighter("behind", "water", 1, 150, 300);
  g.fighters = [a, near, far, side, behind];
  g.cast(a, 1);
  assert.equal(g.projectiles.length, 0);
  assert.equal(g.waves.length, 1);
  advance(g, 0.85);
  assert.ok(near.hp < far.hp);
  assert.ok(far.hp < 120);
  assert.equal(side.hp, 120);
  assert.equal(behind.hp, 120);
});
test("laser beams use swept collision and pierce multiple fighters", () => {
  const g = duel("sun");
  const a = g.player;
  a.x = 250;
  const b = g.fighters[1];
  b.x = 350;
  const extra = makeFighter("extra", "water", 1, 420, 300);
  g.fighters.push(extra);
  g.cast(a, 1);
  assert.equal(g.projectiles[0].kind, "laser");
  advance(g, 0.1);
  assert.ok(b.hp < 120);
  assert.ok(extra.hp < 120);
  assert.ok(g.projectiles[0].trail > 100);
});
test("paired portals transport fighters and can kill during crossing", () => {
  const g = remoteSpirit(),
    pair = portals(g),
    b = g.fighters[1];
  b.x = 400;
  b.y = 300;
  advance(g, 0.01);
  assert.ok(b.transit);
  assert.equal(inWorld(b), false);
  advance(g, 0.2);
  assert.ok(inWorld(b));
  assert.equal(Math.abs(b.x - 650), 49);
  b.portalCooldown = 0;
  b.x = 400;
  advance(g, 0.01);
  assert.ok(b.transit);
  g.portals.close(g.player, pair[0].id);
  assert.equal(b.alive, false);
  assert.equal(b.lost, false);
  assert.ok(g.tokens.some((t) => t.owner === b.id));
});
test("a lone portal traps a fighter; reversing movement returns them", () => {
  const g = remoteSpirit();
  portals(g, [[400, 300]]);
  g.player.x = 400;
  g.player.y = 300;
  g.player.fx = 1;
  advance(g, 0.01);
  assert.ok(g.player.dimension);
  assert.equal(inWorld(g.player), false);
  advance(g, 0.3, { x: -1, y: 0 });
  assert.equal(g.player.dimension, null);
  assert.ok(g.player.x < 400);
});
test("opening the second portal immediately releases trapped entrants", () => {
  const g = remoteSpirit();
  portals(g, [[400, 300]]);
  const b = g.fighters[1];
  b.x = 400;
  b.y = 300;
  advance(g, 0.01);
  assert.ok(b.dimension);
  assert.ok(g.portals.place(g.player, 650, 300));
  assert.ok(inWorld(b));
  assert.equal(Math.abs(b.x - 650), 49);
});
test("closing a lone portal loses the fighter and token permanently", () => {
  const g = remoteSpirit(),
    [p] = portals(g, [[400, 300]]),
    b = g.fighters[1];
  b.x = 400;
  b.y = 300;
  advance(g, 0.01);
  g.portals.close(g.player, p.id);
  assert.equal(b.alive, false);
  assert.equal(b.lost, true);
  assert.equal(
    g.tokens.some((t) => t.owner === b.id),
    false,
  );
  assert.equal(g.revivalTarget({ ...g.player, team: 1 }), undefined);
});
test("tokens, projectiles and lingering effects share portal transport", () => {
  const g = remoteSpirit();
  portals(g);
  const token = { owner: "token", parts: ["earth"], team: 0, x: 400, y: 300 };
  g.tokens.push(token);
  g.hazards.push({
    owner: g.player,
    element: "fire",
    kind: "magma",
    x: 400,
    y: 300,
    r: 20,
    power: 1,
    life: 5,
    tick: 0,
  });
  const h = g.hazards[0];
  g.player.x = 350;
  g.player.y = 300;
  g.player.fx = 1;
  g.player.fy = 0;
  g.projectile(g.player, 1, { speed: 400 });
  const p = g.projectiles[0];
  advance(g, 0.05);
  assert.ok(token.transit);
  assert.ok(h.transit);
  assert.ok(p.transit);
  advance(g, 0.25);
  assert.ok(token.x > 650);
  assert.ok(h.x > 650);
  assert.ok(p.x > 650);
});
test("sonic wave fans can enter portals and emerge at the exit", () => {
  const g = remoteSpirit();
  portals(g);
  g.switchForm(g.player, "air");
  g.player.x = 300;
  g.player.y = 300;
  g.player.fx = 1;
  g.player.fy = 0;
  g.cast(g.player, 1);
  const w = g.waves[0];
  advance(g, 0.25);
  assert.ok(w.transit);
  advance(g, 0.25);
  assert.ok(w.originX >= 650);
});
test("ghosts can travel through portals", () => {
  const g = remoteSpirit();
  portals(g);
  const ghost = makeFighter("ghost", "spirit", 0, 400, 300);
  g.fighters.push(ghost);
  g.fell(ghost);
  advance(g, 0.01);
  assert.ok(ghost.transit);
  advance(g, 0.2);
  assert.ok(ghost.x > 650);
  assert.ok(ghost.ghost);
});
test("revival selects the closest felled ally, never heals its caster", () => {
  const g = remoteSpirit(),
    a = g.player;
  a.hp = 50;
  const far = makeFighter("far", "water", 0, 700, 500),
    near = makeFighter("near", "earth", 0, 300, 450);
  g.fighters.push(far, near);
  g.fell(far);
  g.fell(near);
  g.cast(a, 1);
  assert.equal(near.alive, true);
  assert.equal(far.alive, false);
  assert.equal(a.hp, 50);
  assert.equal(
    g.tokens.some((t) => t.owner === near.id),
    false,
  );
});
test("revival of an absorbed token removes that soul from the bearer", () => {
  const g = remoteSpirit();
  const carrier = makeFighter("carrier", "light", 0, 500, 300),
    ally = makeFighter("fallen", "earth", 0, 510, 300);
  g.fighters.push(carrier, ally);
  g.fell(ally);
  assert.ok(g.touchTokens(carrier));
  assert.equal(carrier.element, "mirror");
  assert.ok(g.revive(g.player));
  assert.equal(ally.alive, true);
  assert.equal(carrier.element, "light");
  assert.equal(carrier.parts.includes("earth"), false);
});
test("revival without a fallen ally does not heal or consume cooldown", () => {
  const g = remoteSpirit();
  g.player.hp = 30;
  assert.equal(g.startCharge(g.player), false);
  assert.equal(g.cast(g.player, 2), false);
  assert.equal(g.player.hp, 30);
  assert.equal(g.player.abilityCd, 0);
});
test("Angel guard is controllable after death and blocks only enemy melee", () => {
  const g = duel("spirit"),
    ghost = g.player,
    b = g.fighters[1];
  const ally = makeFighter("ally", "water", 0, 400, 300);
  g.fighters.push(ally);
  ghost.x = 425;
  g.fell(ghost);
  assert.ok(ghost.ghost);
  // Keep the newly compatible Spirit + Water token outside contact range.
  g.tokens[0].x = 200;
  g.move(ghost, 0, -1, 0.01);
  assert.ok(ghost.y < 300);
  g.strike(b);
  advance(g, 0.15);
  assert.equal(ally.hp, 120);
  assert.ok(g.events.some((e) => e.text === "ANGEL GUARD"));
  g.damage(b, ally, 20, true);
  assert.equal(ally.hp, 110);
  assert.equal(g.strike(ghost), false);
});
test("Multi-Dimensional teleport is passive, immediate, unlimited, and inherited", () => {
  const g = duel("multi-dimensional");
  g.switchForm(g.player, "earth");
  assert.equal(skillsFor("multi-dimensional")[1], null);
  assert.ok(g.teleport(g.player, 600, 400));
  assert.ok(g.teleport(g.player, 200, 200));
  assert.equal(g.player.x, 200);
  assert.equal(g.player.abilityCd, 0);
  assert.equal(g.teleport(g.player, 0, 0), false);
});
test("all team sizes end when the living fighters of one team are defeated", () => {
  for (const size of [2, 3, 4]) {
    const g = new Combat({ mode: "team", size });
    assert.equal(g.fighters.length, size * 2);
    for (const b of g.fighters) if (b.team === 1) g.fell(b);
    advance(g, 0.01);
    assert.equal(g.result, "victory");
  }
});
test("all live attack types and summoned minions traverse linked portals", () => {
  for (const kind of ["bolt", "flame", "water", "tornado", "laser"]) {
    const g = remoteSpirit();
    portals(g);
    g.player.x = 300;
    g.player.y = 300;
    g.player.fx = 1;
    g.player.fy = 0;
    g.projectile(g.player, 1, { kind, speed: 500, life: 2 });
    const p = g.projectiles[0];
    advance(g, 0.12);
    assert.ok(p.transit, kind);
    advance(g, 0.22);
    assert.ok(p.x > 650, kind);
  }
  const g = remoteSpirit();
  portals(g);
  const minion = makeFighter("minion", "fire", 0, 400, 300);
  minion.echo = true;
  g.fighters.push(minion);
  advance(g, 0.01);
  assert.ok(minion.transit);
  advance(g, 0.2);
  assert.ok(minion.x > 650);
});
test("off-screen projectiles and ground effects pause their lifetimes until released", () => {
  const g = remoteSpirit();
  portals(g, [[400, 300]]);
  g.player.x = 350;
  g.player.y = 300;
  g.projectile(g.player, 1, { speed: 500, life: 1 });
  g.hazards.push({
    owner: g.player,
    element: "fire",
    kind: "magma",
    x: 400,
    y: 300,
    r: 20,
    power: 1,
    life: 2,
    tick: 0,
  });
  const p = g.projectiles[0],
    h = g.hazards[0];
  advance(g, 0.1);
  assert.ok(p.dimension);
  assert.ok(h.dimension);
  const life = p.life;
  advance(g, 2);
  assert.equal(p.life, life);
  assert.equal(h.life, 2);
  g.portals.place(g.player, 650, 300);
  assert.ok(inWorld(p));
  assert.ok(inWorld(h));
});
test("a token lost in a closed lone portal loses all of its absorbed souls", () => {
  const g = remoteSpirit();
  const one = makeFighter("one", "earth", 0, 410, 300),
    two = makeFighter("two", "light", 0, 415, 300);
  g.fighters.push(one, two);
  g.fell(two);
  g.touchTokens(one);
  g.fell(one);
  portals(g, [[400, 300]]);
  advance(g, 0.31);
  assert.ok(g.tokens[0].dimension);
  g.portals.close(g.player, g.portals.portals[0].id);
  assert.ok(one.lost);
  assert.ok(two.lost);
  assert.equal(g.revivalTarget(g.player), undefined);
});
test("a held rock shield survives portal transit and still releases normally", () => {
  const g = remoteSpirit();
  portals(g);
  const earth = g.fighters[1];
  earth.parts = ["earth"];
  earth.element = "earth";
  earth.forms = ["earth"];
  earth.form = 0;
  earth.x = 400;
  earth.y = 300;
  g.utility(earth);
  advance(g, 0.01);
  assert.ok(earth.transit);
  assert.equal(earth.shield, 1);
  advance(g, 0.2);
  assert.equal(earth.shield, 1);
  g.utility(earth, false);
  assert.equal(earth.shield, 0);
});
test("releasing a charge while off-screen clears the held state", () => {
  const g = remoteSpirit();
  portals(g, [[400, 300]]);
  g.switchForm(g.player, "light");
  g.startCharge(g.player);
  g.player.x = 400;
  g.player.y = 300;
  advance(g, 0.01);
  assert.ok(g.player.dimension);
  assert.ok(g.player.charging);
  g.releaseCharge(g.player);
  assert.equal(g.player.charging, false);
  assert.equal(g.player.abilityCd, 0);
});
