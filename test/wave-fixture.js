import assert from "node:assert/strict";

// Walk the player with ordinary movement; allies must navigate on their own.
export function walkToNextWave(game) {
  assert.equal(game.waveTravel, true);
  const wave = game.wave;
  for (let i = 0; i < 4000 && game.waveTravel; i++) {
    const goal = game.map.route(game.player, game.waveRally);
    const dx = goal.x - game.player.x,
      dy = goal.y - game.player.y;
    const gap = Math.hypot(dx, dy);
    game.update(
      0.025,
      gap > 12 ? { x: dx / gap, y: dy / gap } : { x: 0, y: 0 },
    );
    assert.ok(
      game.fighters.every((a) => game.map.walkable(a)),
      "fighters remain on the floor",
    );
  }
  assert.equal(game.waveTravel, false, "the whole team reaches the next room");
  assert.equal(game.wave, wave + 1);
}
