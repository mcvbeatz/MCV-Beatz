import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, distance } from "./combat-fixture.js";
import { separateCTF, ctfMove } from "../src/ctf-ai.js";

const minimum = (fighters) =>
  Math.min(
    ...fighters.flatMap((a, i) =>
      fighters.slice(i + 1).map((b) => distance(a, b)),
    ),
  );
test("CTF separates exact allied/enemy stacks at flags and corridors without moving the player or crossing walls", () => {
  for (const cell of [80, 64, 72, 41]) {
    const g = new Combat({ mode: "ctf", random: () => 0.3 }),
      origin = g.map.cells[cell];
    for (const a of g.fighters)
      Object.assign(a, { ...origin, parts: ["earth"] });
    for (let step = 0; step < 200; step++) {
      separateCTF(g, 0.02);
      assert.ok(g.fighters.every((a) => g.map.walkable(a)));
      assert.equal(g.player.x, origin.x);
      assert.equal(g.player.y, origin.y);
    }
    for (let i = 0; i < g.fighters.length; i++) {
      for (const b of g.fighters.slice(i + 1)) {
        const a = g.fighters[i];
        // Characters on opposite sides of a tree wall do not share floor space.
        if (g.map.lineClear(a, b))
          assert.ok(distance(a, b) > (a.team === b.team ? 65 : 51));
      }
    }
  }
});
test("CTF spacing preserves prison, shock, ghost and portal states", () => {
  const g = new Combat({ mode: "ctf", random: () => 0.3 }),
    p = g.map.cells[80];
  const trapped = makeFighter("trapped", "earth", 0, p.x, p.y);
  const shocked = makeFighter("shocked", "earth", 0, p.x, p.y);
  const ghost = makeFighter("ghost", "earth", 0, p.x, p.y);
  const traveller = makeFighter("traveller", "earth", 1, p.x, p.y);
  const blinking = makeFighter("blinking", "earth", 0, p.x, p.y);
  Object.assign(trapped, { prisonHp: 65 });
  ghost.ghost = true;
  traveller.transit = {};
  blinking.blink = {};
  const mobile = makeFighter("mobile", "earth", 1, p.x, p.y);
  g.fighters = [trapped, shocked, ghost, traveller, blinking, mobile];
  g.isShocked = (a) => a === shocked;
  for (let step = 0; step < 50; step++) separateCTF(g, 0.02);
  for (const a of [trapped, shocked, ghost, traveller, blinking])
    assert.equal(distance(a, p), 0);
  assert.ok(distance(mobile, p) > 51);
});
test("CTF spacing does not push through a wall or affect other modes", () => {
  const g = new Combat({ mode: "ctf", random: () => 0.3 });
  let pair;
  for (const cell of g.map.cells)
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const a = {
        x: cell.x + Math.cos(angle) * 30,
        y: cell.y + Math.sin(angle) * 30,
      };
      const b = {
        x: a.x + Math.cos(angle) * 44,
        y: a.y + Math.sin(angle) * 44,
      };
      if (g.map.walkable(a) && g.map.walkable(b) && !g.map.lineClear(a, b))
        pair = [a, b];
    }
  assert.ok(pair, "fixture straddles a tree wall");
  g.fighters = pair.map((p, i) => makeFighter(`bot${i}`, "earth", 0, p.x, p.y));
  separateCTF(g, 0.05);
  g.fighters.forEach((a, i) => assert.equal(distance(a, pair[i]), 0));
  g.mode = "tdm";
  g.fighters.forEach((a) => Object.assign(a, g.map.cells[80]));
  separateCTF(g, 0.05);
  assert.equal(distance(...g.fighters), 0);
});
test("CTF spacing preserves Fire contact damage while preventing coincident bodies", () => {
  const g = new Combat({ mode: "ctf", random: () => 0.3 }),
    p = g.map.cells[80];
  const fire = makeFighter("fire", "fire", 0, p.x, p.y),
    target = makeFighter("target", "earth", 1, p.x, p.y);
  g.fighters = [fire, target];
  for (let i = 0; i < 40; i++) separateCTF(g, 0.02);
  assert.ok(distance(fire, target) > 27 && distance(fire, target) < 30);
  g.countdown = 0;
  g.ai = () => {};
  g.update(0.02);
  assert.ok(target.hp < target.maxHp);
});
test("CTF followers and opposing runners move out of shared lanes and still make progress", () => {
  for (const team of [0, 1]) {
    const g = new Combat({ mode: "ctf", random: () => 0.3 }),
      origin = g.flags[team].home;
    const bots = Array.from({ length: 3 }, (_, i) =>
      makeFighter(`runner${i}`, "earth", team, origin.x, origin.y),
    );
    g.fighters = bots;
    for (const a of bots) a.ctfRole = "steal";
    for (let i = 0; i < 300; i++) {
      g.time += 0.02;
      for (const a of bots) ctfMove(g, a, g.flags[1 - team], 0.02);
      separateCTF(g, 0.02);
      assert.ok(bots.every((a) => g.map.walkable(a)));
    }
    assert.ok(minimum(bots) > 60);
    assert.ok(bots.every((a) => distance(a, origin) > 100));
  }
});
test("Crowded CTF teams spread out while continuing to attack and steal", () => {
  const g = new Combat({ mode: "ctf", random: () => 0.3 });
  g.countdown = 0;
  g.player.id = "bot-player";
  const p = g.map.cells[80];
  for (const a of g.fighters)
    Object.assign(a, makeFighter(a.id, "earth", a.team, p.x, p.y), {
      spawn: { ...p, element: "earth" },
    });
  const hits = [0, 0],
    damage = g.damage.bind(g);
  g.damage = (a, b, ...args) => {
    const before = b.hp + (b.shield ? b.shieldHp : 0);
    const result = damage(a, b, ...args);
    if (a.team !== b.team && b.hp + (b.shield ? b.shieldHp : 0) < before)
      hits[a.team]++;
    return result;
  };
  for (let i = 0; i < 400; i++) g.update(0.02);
  assert.ok(g.fighters.every((a) => !a.alive || g.map.walkable(a)));
  assert.ok(hits.every((n) => n > 0));
  assert.ok(minimum(g.fighters.filter((a) => a.alive)) > 43);
});
