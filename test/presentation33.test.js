import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
import { updateRespawnCamera } from "../src/camera.js";
import { synthesizeSfx, SFX_KINDS } from "../src/combat-sfx.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function duel(element = "light", enemy = "water") {
  const g = new Combat({ mode: "duel", element });
  g.fighters = [g.player, makeFighter("enemy", enemy, 1, 450, 300)];
  Object.assign(g.player, { x: 400, y: 300, fx: 1, fy: 0 });
  Object.assign(g.fighters[1], { fx: -1, fy: 0 });
  return g;
}
test("Boss spectators pan after death without a respawn timer, and reset when revived or finished", () => {
  const g = new Combat({ mode: "boss", element: "water", players: 4 });
  g.fell(g.player);
  assert.equal(g.player.alive, false);
  const before = { x: g.player.x, y: g.player.y };
  updateRespawnCamera(g, 0.5, { x: 1, y: 0 });
  assert.ok(g.spectatorFocus.x > before.x);
  assert.equal(g.player.x, before.x);
  g.player.alive = true;
  updateRespawnCamera(g, 0.1, { x: 1, y: 0 });
  assert.equal(g.spectatorFocus, null);
  g.player.alive = false;
  g.finished = true;
  updateRespawnCamera(g, 0.1, { x: 1, y: 0 });
  assert.equal(g.spectatorFocus, null);
});
test("Lightning resistance halves direct, flood and reflected strikes exactly once", () => {
  const g = duel("lightning", "lightning"),
    [a, b] = g.fighters;
  g.startCharge(a);
  near(b.hp, 107);
  g.hazards.push({ kind: "flood", x: 400, y: 300, r: 50, life: 5, owner: a });
  a.abilityCd = 0;
  g.startCharge(a);
  near(b.hp, 81);
  near(a.hp, 94);
  const reflected = duel("lightning", "mirror"),
    [x, y] = reflected.fighters;
  reflected.startCharge(x);
  near(x.hp, 114.8);
  near(y.hp, 108.3);
});
test("misses, weapon hits, impacts and contested strikes emit distinct combat sounds", () => {
  const miss = duel();
  miss.fighters[1].x = 700;
  miss.strike(miss.player);
  miss.time = 0.2;
  miss.resolveStrikes();
  assert.deepEqual(
    miss.audioEvents.map((e) => e.kind),
    ["swing"],
  );
  for (const [element, kind] of [
    ["light", "slice"],
    ["water", "impact"],
  ]) {
    const g = duel(element);
    g.strike(g.player);
    g.time = 0.2;
    g.resolveStrikes();
    assert.deepEqual(
      g.audioEvents.map((e) => e.kind),
      ["swing", kind],
    );
  }
  const g = duel("water", "fire");
  g.strike(g.player);
  g.strike(g.fighters[1]);
  g.time = 0.2;
  g.resolveStrikes();
  assert.deepEqual(
    g.audioEvents.map((e) => e.kind),
    ["swing", "swing", "clash"],
  );
  g.dropToken({ x: 400, y: 300, element: "earth", team: 0 });
  assert.equal(g.audioEvents.at(-1).kind, "token");
});
test("synthesized effects have distinct, finite, bounded audio with quiet tails", () => {
  const signatures = new Set();
  for (const kind of SFX_KINDS) {
    const data = synthesizeSfx(kind, 22050);
    let sum = 0,
      peak = 0;
    for (const sample of data) {
      assert.ok(Number.isFinite(sample));
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    assert.ok(peak > 0.05 && peak < 0.9);
    assert.ok(Math.sqrt(sum / data.length) > 0.01);
    assert.ok(Math.abs(data.at(-1)) < 0.001);
    signatures.add(data.length + ":" + sum.toFixed(5));
  }
  assert.equal(signatures.size, 5);
});
