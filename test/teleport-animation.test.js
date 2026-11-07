import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
import {
  teleportPose,
  TELEPORT_ARRIVAL_TIME,
} from "../src/teleport-animation.js";
const setup = () => {
  const g = new Combat({ mode: "duel", element: "multi-dimensional" });
  Object.assign(g.player, { x: 400, y: 350 });
  g.fighters = [g.player, makeFighter("enemy", "water", 1, 800, 350)];
  return g;
};
test("teleport stepping poses follow direction and wind-up without changing movement timing", () => {
  for (const [dx, dy, facing, flip] of [
    [0, 120, 0, false],
    [120, 0, 1, false],
    [-120, 0, 1, true],
    [0, -120, 2, false],
  ]) {
    const g = setup(),
      a = g.player;
    assert.ok(g.teleport(a, a.x + dx, a.y + dy));
    let p = teleportPose(a);
    assert.equal(p.frame, facing * 4);
    assert.equal(p.flip, flip);
    g.updateTeleport(a, 0.11);
    assert.equal(teleportPose(a).frame, facing * 4 + 1);
    assert.equal(a.x, 400);
    g.updateTeleport(a, 0.09);
    assert.equal(a.teleportArrival, TELEPORT_ARRIVAL_TIME);
    assert.equal(teleportPose(a).frame, facing * 4 + 2);
    assert.equal(a.x, 400 + dx);
    a.teleportArrival = 0.1;
    assert.equal(teleportPose(a).frame, facing * 4 + 3);
    for (let i = 0; i < 6; i++) g.update(0.05, { x: 0, y: 0 }, false);
    assert.equal(teleportPose(a), null);
  }
});
test("cancelled, chained and lethal teleports never leave a stale arrival sprite", () => {
  const g = setup(),
    a = g.player;
  g.teleport(a, 560, 350);
  a.knockX = 30;
  g.updateTeleport(a, 0.2);
  assert.equal(teleportPose(a), null);
  a.knockX = 0;
  g.teleport(a, 560, 350);
  g.updateTeleport(a, 0.2);
  assert.ok(teleportPose(a));
  assert.ok(g.teleport(a, 400, 350));
  assert.equal(a.teleportArrival, 0);
  assert.ok(teleportPose(a).entering);
  g.updateTeleport(a, 0.2);
  g.fell(a);
  assert.equal(a.teleportArrival, 0);
  assert.equal(teleportPose(a), null);
});
