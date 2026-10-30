import test from "node:test";
import assert from "node:assert/strict";
import { Combat } from "../src/combat.js";
import { CHARACTERS, deathPose } from "../src/characters.js";
import { updateRespawnCamera, cameraView } from "../src/camera.js";

for (const mapId of ["classic", "garden", "tower", "corruption"]) {
  test(`${mapId}: respawn input pans only the camera, clamps, and returns to the fighter`, () => {
    const g = new Combat({
      mode: mapId === "corruption" ? "corruption" : "roulette",
      mapId,
      players: 4,
    });
    if (mapId === "corruption") g.corrupt(g.player);
    const a = g.player,
      before = { x: a.x, y: a.y },
      spawn = { ...a.spawn };
    g.fell(a);
    for (let i = 0; i < 20; i++) g.update(0.05, { x: 1, y: 1 }, false);
    assert.ok(g.spectatorFocus.x > before.x);
    assert.deepEqual({ x: a.x, y: a.y }, before);
    assert.deepEqual(a.spawn, spawn);
    assert.equal(a.alive, false);
    const b = g.map?.bounds || { left: 95, top: 100, width: 834, height: 530 };
    updateRespawnCamera(g, 100, { x: 1, y: 1 });
    assert.equal(g.spectatorFocus.x, b.left + b.width);
    assert.equal(g.spectatorFocus.y, b.top + b.height);
    updateRespawnCamera(g, 100, { x: -1, y: -1 });
    assert.equal(g.spectatorFocus.x, b.left);
    assert.equal(g.spectatorFocus.y, b.top);
    const view = cameraView(600, 330, {
      map: g.map,
      focus: g.spectatorFocus,
      spectating: true,
    });
    assert.ok(Number.isFinite(view.tx));
    g.time = a.respawnAt;
    g.update(0.01, { x: 0, y: 0 }, false);
    assert.equal(a.alive, true);
    assert.equal(g.spectatorFocus, null);
    assert.equal(g.fallenAnimations.length, 0);
  });
}
test("all elementals keep a frozen death appearance and fade before respawn", () => {
  assert.equal(CHARACTERS.length, 23);
  for (const element of CHARACTERS) {
    const g = new Combat({ mode: "roulette", element, mapId: "classic" });
    g.rebirthUsed.add(g.player.id);
    g.player.whiteout = 3;
    g.fell(g.player);
    assert.equal(g.player.whiteout, 0, "Flash debuff must end on death");
    assert.equal(g.fallenAnimations.length, 1, element);
    const death = g.fallenAnimations[0],
      original = { ...death.fighter };
    assert.equal(death.fighter.element, element);
    assert.equal(
      death.fighter.whiteout,
      3,
      "Keep the starting opacity for the short fade",
    );
    assert.equal(g.player.alive, false);
    const start = deathPose(death);
    g.player.x += 100;
    g.player.parts = ["fire"];
    g.advanceDeaths(0.7);
    const middle = deathPose(death);
    assert.equal(death.fighter.x, original.x);
    assert.equal(middle.rotation, 0);
    assert.equal(start.rotation, 0);
    assert.equal(middle.x, start.x);
    assert.equal(middle.y, start.y);
    g.advanceDeaths(0.5);
    assert.ok(deathPose(death).opacity < start.opacity);
    g.advanceDeaths(0.4);
    assert.equal(g.fallenAnimations.length, 0);
    assert.equal(g.player.alive, false);
    assert.equal(g.player.respawnAt, 10);
  }
});
test("elimination finishes and reward pauses let death animations complete", () => {
  const g = new Combat({ mode: "duel", mapId: "classic" });
  g.fell(g.fighters[1]);
  g.checkMatchEnd();
  assert.equal(g.finished, true);
  assert.equal(g.fallenAnimations.length, 1);
  g.advanceCelebration(0.75);
  assert.equal(g.fallenAnimations[0].elapsed, 0.75);
  g.advanceCelebration(1);
  assert.equal(g.fallenAnimations.length, 0);
  const wave = new Combat({ mode: "gauntlet", mapId: "garden" });
  wave.fell(wave.fighters[1]);
  wave.intermission = true;
  wave.rewardRemaining = 7;
  const time = wave.time;
  wave.update(0.5);
  assert.equal(wave.time, time);
  assert.equal(wave.fallenAnimations[0].elapsed, 0.5);
});
test("Phoenix's first Rebirth remains immediate; its next fall animates", () => {
  const g = new Combat({
    mode: "roulette",
    element: "phoenix",
    mapId: "garden",
  });
  g.fell(g.player);
  assert.equal(g.player.alive, true);
  assert.equal(g.fallenAnimations.length, 0);
  g.fell(g.player);
  assert.equal(g.player.alive, false);
  assert.equal(g.fallenAnimations.length, 1);
});
test("Angel guard retains movement instead of enabling a respawn camera", () => {
  const g = new Combat({ mode: "team", element: "spirit", mapId: "classic" });
  g.fell(g.player);
  const x = g.player.x;
  g.update(0.05, { x: 1, y: 0 }, false);
  assert.equal(g.spectatorFocus, null);
  assert.ok(g.player.x > x);
});
