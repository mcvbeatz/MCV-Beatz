import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  canUseSkill,
  distance,
} from "./combat-fixture.js";
import { createCorruptionMap } from "../src/corruption-map.js";
import {
  EXPLOSION_RADIUS,
  RACE_ITEMS,
  useRaceItem,
  updateGridiron,
  updateRace,
  eventEnd,
  setRaceForm,
} from "../src/event-modes.js";
const tick = (g, s, ai = false) => {
  for (let t = 0; t < s - 1e-8 && !g.finished; t += 0.02)
    g.update(0.02, { x: 0, y: 0 }, ai);
};
test("Explosion uses Gravity's radius, damages and blows away allies and enemies once per use", () => {
  const g = new Combat({ mode: "team", element: "invincible" }),
    a = g.player;
  Object.assign(a, { x: 500, y: 350 });
  const near = makeFighter("near", "air", 1, 500 + EXPLOSION_RADIUS - 1, 350),
    ally = makeFighter("ally", "water", 0, 450, 350),
    far = makeFighter("far", "air", 1, 651, 350);
  g.fighters = [a, near, ally, far];
  assert.ok(g.startCharge(a));
  assert.equal(near.hp, 115);
  assert.equal(ally.hp, 115);
  assert.equal(far.hp, 120);
  assert.ok(near.knockX > 500);
  assert.ok(ally.knockX < 0);
  assert.equal(a.hp, 120);
  assert.equal(g.startCharge(a), false);
  assert.equal(near.hp, 115);
});
test("CTF is always four versus four in a distinct connected evergreen maze", () => {
  const g = new Combat({ mode: "ctf", size: 2, mapId: "tower" });
  assert.equal(g.fighters.length, 8);
  assert.equal(g.map.kind, "evergreen");
  assert.notDeepEqual(g.map.walls, createCorruptionMap().walls);
  for (const a of g.fighters) assert.ok(g.map.walkable(a));
  for (const a of g.fighters)
    for (const flag of g.flags) assert.ok(g.map.path(a, flag).length);
});
test("any hit on a CTF carrier defeats them even through a shield and drops the flag", () => {
  const g = new Combat({ mode: "ctf", element: "earth" }),
    a = g.player,
    b = g.fighters[1];
  Object.assign(a, g.map.cells[80]);
  Object.assign(b, { x: a.x + 40, y: a.y });
  g.flags[1].carrier = a.id;
  a.shield = 1;
  a.shieldHp = 65;
  g.damage(b, a, 1);
  assert.equal(a.alive, false);
  assert.equal(g.flags[1].carrier, null);
  assert.equal(g.flags[1].dropped, true);
  assert.equal(a.respawnAt, 10);
  assert.ok(g.effects.some((e) => e.kind === "fusion" && e.r === 150));
  assert.ok(b.knockX > 0);
});
test("Gridiron has eight Earth players, fixed spawns and friendly fire", () => {
  for (const random of [() => 0, () => 0.99]) {
    const g = new Combat({ mode: "gridiron", size: 1, random });
    assert.equal(g.fighters.length, 8);
    assert.equal(g.friendlyFire, true);
    assert.equal(g.respawnDelay, 5);
    for (const team of [0, 1]) {
      const members = g.fighters.filter((a) => a.team === team);
      assert.equal(members.filter((a) => a.element === "gravity").length, 0);
      assert.equal(members.filter((a) => a.element === "earth").length, 4);
    }
    const a = g.player,
      p = { ...a.spawn };
    g.fell(a);
    a.x += 100;
    tick(g, 5.02);
    assert.ok(a.alive);
    assert.equal(a.x, p.x);
    assert.equal(a.y, p.y);
  }
});
test("Gridiron shield blocks pickups and protects possession only until it breaks", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0.99 }),
    a = g.player,
    b = g.fighters[4];
  Object.assign(a, { x: g.ball.x, y: g.ball.y, shield: 1, shieldHp: 65 });
  updateGridiron(g);
  assert.equal(g.ball.carrier, null);
  a.shield = 0;
  updateGridiron(g);
  assert.equal(g.ball.carrier, a.id);
  a.shield = 1;
  g.damage(b, a, 10);
  assert.equal(g.ball.carrier, a.id);
  assert.ok(a.shieldHp < 65);
  a.shieldHp = 1;
  g.damage(b, a, 10);
  assert.equal(g.ball.carrier, null);
  assert.ok(g.ball.lastCarrier === a.id);
  g.time = 0.2;
  Object.assign(b, { x: g.ball.x, y: g.ball.y });
  updateGridiron(g);
  assert.equal(g.ball.carrier, b.id);
  const friend = g.fighters[5];
  g.damage(friend, b, 1);
  assert.equal(g.ball.carrier, null, "friendly attacks can fumble");
});
test("Gridiron scores the opposite end zone, resets possession, and ends tied regulation with sudden death", () => {
  const g = new Combat({ mode: "gridiron" });
  g.ball.x = 1550;
  g.ball.y = 550;
  updateGridiron(g);
  assert.deepEqual(g.scores, [1, 0]);
  const receiver = g.fighters.find((a) => a.id === g.ball.carrier);
  assert.equal(receiver.team, 1);
  assert.equal(g.ball.x, receiver.spawn.x);
  g.scores = [1, 1];
  g.time = 180;
  assert.equal(eventEnd(g), false);
  assert.equal(g.suddenDeath, true);
  g.ball.carrier = null;
  g.ball.x = 250;
  g.ball.y = 550;
  updateGridiron(g);
  assert.equal(g.finished, true);
  assert.equal(g.winnerTeam, 1);
  assert.match(g.finishReason, /Sudden/);
  const regulation = new Combat({ mode: "gridiron" });
  regulation.time = 180;
  regulation.scores = [3, 1];
  assert.ok(eventEnd(regulation));
  assert.equal(regulation.winnerTeam, 0);
});
test("Turnpike starts eight Air racers and off-course flight and guardian angels are slower", () => {
  const g = new Combat({ mode: "turnpike" });
  assert.equal(g.fighters.length, 8);
  assert.ok(g.fighters.every((a) => a.element === "air"));
  const a = g.player;
  Object.assign(a, g.map.trackAt(100), { vx: 0, vy: 0 });
  g.move(a, 1, 0, 0.05);
  const normal = a.vx;
  Object.assign(a, { x: 1200, y: 1200, vx: 0, vy: 0 });
  assert.equal(g.map.onTrack(a), false);
  g.move(a, 1, 0, 0.05);
  assert.ok(a.vx < normal * 0.25);
  Object.assign(a, g.map.trackAt(100), { vx: 0, vy: 0 });
  g.fell(a);
  assert.equal(a.ghost, true);
  assert.equal(a.alive, false);
  g.move(a, 1, 0, 0.05);
  assert.ok(a.vx < normal * 0.7);
  const p = { x: a.x, y: a.y };
  g.time = a.respawnAt;
  g.respawn(a);
  assert.equal(a.element, "air");
  assert.equal(a.alive, true);
  assert.equal(a.ghost, false);
  assert.equal(a.x, p.x);
  assert.equal(a.y, p.y);
});
test("racing pickups occupy one slot, failed casts keep it and all thirteen abilities are selectable", () => {
  const g = new Combat({ mode: "turnpike" }),
    a = g.player;
  assert.equal(RACE_ITEMS.length, 13);
  assert.equal(canUseSkill(a, "air", "ability"), false);
  g.raceDrops = [
    { kind: "ability", item: "lightning", x: a.x, y: a.y, expires: 20 },
    { kind: "ability", item: "laser", x: a.x, y: a.y, expires: 20 },
  ];
  updateRace(g);
  assert.equal(a.raceItem, "lightning");
  assert.equal(g.raceDrops.length, 1);
  for (const b of g.fighters.slice(1)) b.alive = false;
  assert.equal(useRaceItem(g, a), false);
  assert.equal(a.raceItem, "lightning");
  g.fighters[1].alive = true;
  Object.assign(g.fighters[1], { x: a.x + 70, y: a.y });
  assert.ok(useRaceItem(g, a));
  assert.equal(a.raceItem, null);
  updateRace(g);
  assert.equal(a.raceItem, "laser");
});
for (const [item] of RACE_ITEMS)
  test(`racing ${item} pickup performs its effect and consumes one charge`, () => {
    const g = new Combat({ mode: "turnpike", random: () => 0.4 }),
      a = g.player,
      b = g.fighters[1];
    Object.assign(a, { x: 1000, y: 1000, fx: 1, fy: 0 });
    Object.assign(b, { x: 1080, y: 1000 });
    for (const c of g.fighters.slice(2)) Object.assign(c, { x: 2000, y: 1500 });
    a.raceItem = item;
    assert.ok(useRaceItem(g, a), item);
    if (item === "teleport") {
      assert.equal(a.raceItem, item);
      assert.ok(g.teleport(a, 1150, 1000));
    }
    assert.equal(a.raceItem, null);
    if (item === "portals") {
      assert.equal(g.portals.placing, a.id);
      assert.ok(g.portals.place(a, 1250, 1000));
      assert.ok(g.portals.place(a, 1500, 1000));
      assert.equal(g.portals.owned(a).length, 2);
    }
    if (item === "prison") assert.ok(b.prisonHp > 0);
    if (item === "explosion") assert.equal(b.hp, 115);
  });
test("Blaze lasts seven seconds, health heals and Randomizer demotes or changes level-one forms per entry", () => {
  const g = new Combat({ mode: "turnpike", random: () => 0.5 }),
    a = g.player;
  a.hp = 40;
  g.raceDrops = [
    { kind: "fire", x: a.x, y: a.y, expires: 30 },
    { kind: "health", x: a.x, y: a.y, expires: 30 },
  ];
  updateRace(g);
  assert.equal(a.element, "blaze");
  assert.equal(a.hp, 99.8);
  g.time = 6.99;
  updateRace(g);
  assert.equal(a.element, "blaze");
  g.time = 7;
  updateRace(g);
  assert.equal(a.element, "air");
  a.raceItem = "randomizer";
  useRaceItem(g, a);
  const h = g.hazards.at(-1);
  g.time = 8;
  Object.assign(a, { x: h.x, y: h.y });
  setRaceForm(a, "blaze");
  updateRace(g);
  assert.equal(a.parts.length, 1);
  const first = a.element;
  updateRace(g);
  assert.equal(a.element, first);
  a.x += 200;
  updateRace(g);
  a.x = h.x;
  updateRace(g);
  assert.notEqual(a.element, first);
});
test("ordered racing checkpoints prevent skipped/reverse laps and a third full circuit wins", () => {
  const g = new Combat({ mode: "turnpike" }),
    a = g.player;
  const gate = g.map.checkpoints[0];
  Object.assign(a, gate);
  a.racePrevious = { x: gate.x - gate.dx * 5, y: gate.y - gate.dy * 5 };
  updateRace(g);
  assert.equal(a.raceLaps, 0);
  for (let lap = 0; lap < 3; lap++)
    for (let i = 1; i <= 16; i++) {
      const p = g.map.checkpoints[i % 16];
      Object.assign(a, { x: p.x + p.dx * 3, y: p.y + p.dy * 3 });
      a.racePrevious = { x: p.x - p.dx * 3, y: p.y - p.dy * 3 };
      updateRace(g);
    }
  assert.equal(a.raceLaps, 3);
  assert.ok(eventEnd(g));
  assert.equal(g.winnerTeam, a.team);
});
test("Turnpike timeout ranks progress and an all-ghost field does not end early", () => {
  const g = new Combat({ mode: "turnpike" });
  for (const a of g.fighters) g.fell(a);
  assert.equal(eventEnd(g), false);
  g.fighters[3].raceProgress = 900;
  g.time = 180;
  assert.ok(eventEnd(g));
  assert.equal(g.winnerTeam, 3);
});

test("a racer breaks out of Stone Prison even when all rivals are far away", () => {
  const g = new Combat({ mode: "turnpike" });
  const a = g.fighters[1];
  Object.assign(a, g.map.trackAt(1000), { prisonHp: 65 });
  for (let i = 0; i < 250 && a.prisonHp > 0; i++) {
    a.attackCd = Math.max(0, a.attackCd - 0.02);
    g.ai(a, 0.02);
  }
  assert.equal(a.prisonHp, 0);
});

test("catch-up drops appear ahead of the last racer and the lowest-health racer", () => {
  const g = new Combat({ mode: "turnpike", random: () => 0.5 });
  g.raceDrops = [];
  for (let i = 0; i < 8; i++) {
    const a = g.fighters[i];
    Object.assign(a, g.map.trackAt(100 + i * 25));
    a.racePrevious = { x: a.x, y: a.y };
  }
  g.fighters[6].hp = 10;
  g.time = 7;
  g.nextRaceAbility = 100;
  updateRace(g);
  const fire = g.raceDrops.find((d) => d.kind === "fire");
  const health = g.raceDrops.find((d) => d.kind === "health");
  assert.ok(Math.abs(g.map.projectTrack(fire).progress - 270) < 1);
  assert.ok(Math.abs(g.map.projectTrack(health).progress - 420) < 1);
});

test("Blaze bursts also slow down when leaving the racing course", () => {
  const g = new Combat({ mode: "turnpike" }),
    a = g.player;
  setRaceForm(a, "blaze");
  Object.assign(a, { x: 1200, y: 1200, fx: 1, fy: 0 });
  assert.equal(g.map.onTrack(a), false);
  g.utility(a, true, "blaze");
  g.move(a, 1, 0, 0.02);
  assert.ok(a.vx > 0 && a.vx < 130);
});

test("Air racing AI uses Tailwind on every recharge, including after three consecutive uses", () => {
  const g = new Combat({ mode: "turnpike" }),
    a = g.fighters[1];
  g.fighters = [a];
  g.player = a;
  g.raceDrops = [];
  g.nextRaceAbility = g.nextRaceFire = g.nextRaceHealth = Infinity;
  const uses = [],
    utility = g.utility.bind(g);
  g.utility = (who, hold, form) => {
    const used = utility(who, hold, form);
    if (used && form === "air") uses.push(g.time);
    return used;
  };
  tick(g, 30, true);
  assert.equal(uses.length, 5);
  assert.ok(uses[0] <= 0.02);
  for (let i = 1; i < uses.length; i++)
    assert.ok(uses[i] - uses[i - 1] >= 7 && uses[i] - uses[i - 1] < 7.03);
  assert.ok(a.raceProgress > 0);
  // Other repeated actions retain the adaptive AI limit.
  a.aiLastGesture = "strike";
  a.aiRepeat = 3;
  assert.equal(g.aiGesture(a, "strike"), false);
});

test("racing Tailwind waits for the countdown and prison escape, and is not used by ghosts or Blaze", () => {
  const g = new Combat({ mode: "turnpike", countdown: true }),
    a = g.fighters[1];
  g.ai(a, 0.02);
  assert.equal(a.boost, 0);
  assert.equal(a.utilityCd, 0);
  g.countdown = 0;
  a.prisonHp = 65;
  g.ai(a, 0.02);
  assert.equal(a.boost, 0);
  a.prisonHp = 0;
  a.stagger = 0;
  g.ai(a, 0.02);
  assert.equal(a.boost, 2);
  assert.equal(a.utilityCd, 7);
  g.fell(a);
  a.boost = a.utilityCd = 0;
  g.ai(a, 0.02);
  assert.equal(a.boost, 0);
  g.respawn(a);
  g.ai(a, 0.02);
  assert.equal(a.boost, 2);
  setRaceForm(a, "blaze");
  a.boost = a.utilityCd = 0;
  g.ai(a, 0.02);
  assert.equal(a.boost, 0);
  assert.ok(a.burst > 0);
});
