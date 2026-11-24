import test from "node:test";
import assert from "node:assert/strict";
import { LobbyRoom } from "../src/lobby-room.js";
import { unpackGame } from "../src/multiplayer-protocol.js";
for (const mode of ["gridiron", "turnpike"]) {
  test(`${mode}: five-second lobby timer is followed by three synchronized locked field seconds`, () => {
    let now = 0;
    const room = new LobbyRoom(mode, { now: () => now });
    room.join("a", "A");
    room.join("b", "B");
    room.command("a", { kind: "start" });
    now = 4999;
    room.tick(0.03);
    assert.equal(room.phase, "countdown");
    now = 5000;
    room.tick(0.03);
    assert.equal(room.phase, "battle");
    const game = room.game,
      actor = game.player;
    const start = { x: actor.x, y: actor.y, hp: actor.hp };
    assert.equal(game.countdownLabel, "3");
    room.command("a", { kind: "move", x: 1, y: 0 });
    room.command("a", { kind: "strike" });
    room.command("a", { kind: "startCharge" });
    const labels = new Set();
    for (let i = 0; i < 60; i++) {
      now += 50;
      room.command("a", { kind: "move", x: 1, y: 0 });
      labels.add(game.countdownLabel);
      room.tick(0.05);
      assert.equal(game.time, 0);
      assert.deepEqual({ x: actor.x, y: actor.y, hp: actor.hp }, start);
      assert.equal(actor.swing, 0);
      assert.equal(
        game.audioEvents.some((e) => e.kind === "whistle"),
        false,
      );
      const copy = unpackGame(room.snapshot().game);
      assert.equal(copy.countdownLabel, game.countdownLabel);
    }
    assert.deepEqual([...labels], ["3", "2", "1"]);
    // Floating-point boundaries may consume one final held simulation step.
    for (let i = 0; i < 3; i++) {
      now += 50;
      room.tick(0.05);
    }
    assert.equal(game.countdownLabel, "Go!");
    assert.ok(game.time > 0);
    assert.ok(Math.hypot(actor.x - start.x, actor.y - start.y) > 0);
    if (mode === "gridiron")
      assert.equal(
        game.audioEvents.filter((e) => e.kind === "whistle").length,
        1,
      );
    room.game.finish(0, "done");
    room.game.celebrationRemaining = 0;
    room.tick(0.05);
    now += 30001;
    room.tick(0.05);
    room.command("a", { kind: "start" });
    now += 5001;
    room.tick(0.05);
    assert.equal(room.game.countdownLabel, "3");
  });
}
