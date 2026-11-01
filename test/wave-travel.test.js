import test from "node:test";
import assert from "node:assert/strict";
import {
  Combat,
  makeFighter,
  extraSkillsFor,
  canUseSkill,
} from "./combat-fixture.js";
import { walkToNextWave } from "./wave-fixture.js";

function clearAndChoose(game, reward = "heal") {
  for (const a of [...game.fighters])
    if (a.team === 1) game.fell(a, { killer: game.player });
  game.checkMatchEnd();
  const position = { x: game.player.x, y: game.player.y };
  game.chooseReward(reward);
  game.update(7);
  assert.equal(game.intermission, false);
  assert.equal(game.waveTravel, true);
  assert.deepEqual(
    { x: game.player.x, y: game.player.y },
    position,
    "reward does not teleport the player",
  );
  assert.ok(game.fighters.every((a) => a.team === 0));
}

for (const mode of ["gauntlet", "gauntlet-team"]) {
  test(`${mode}: three chambers connect physically; allies wait, follow and return on longer runs`, () => {
    const game = new Combat({
      mode,
      size: 4,
      element: "water",
      random: () => 0,
    });
    assert.equal(game.mapId, "waves");
    assert.equal(game.map.rooms.length, 3);
    assert.equal(
      game.map.walkable({ x: 1050, y: 500 }),
      false,
      "battle gates closed",
    );
    for (const room of [1, 2, 1, 0]) {
      clearAndChoose(game);
      const wave = game.wave;
      for (let i = 0; i < 600; i++) game.update(0.05);
      assert.equal(
        game.wave,
        wave,
        "AI cannot launch the next wave without the player",
      );
      assert.equal(game.nextWaveRoom, room);
      const skipped = [0, 1, 2].find(
        (index) => index !== game.waveRoom && index !== room,
      );
      assert.equal(
        game.map.walkable({ x: game.map.rooms[skipped].x + 400, y: 500 }),
        false,
        "cannot skip the next chamber while waiting for allies",
      );
      assert.equal(game.strike(game.player), false, "travel stays peaceful");
      walkToNextWave(game);
      assert.equal(game.waveRoom, room);
      assert.ok(game.fighters.every((a) => game.map.inRoom(a, room)));
      assert.ok(game.fighters.some((a) => a.team === 1 && a.alive));
    }
  });
}

test("wave arrival waits for a trailing ally and preserves the player's position", () => {
  const game = new Combat({ mode: "gauntlet-team", size: 4, element: "air" });
  clearAndChoose(game);
  Object.assign(game.player, game.waveRally);
  game.update(0.05, { x: 0, y: 0 }, false);
  assert.equal(game.waveTravel, true);
  const position = { x: game.player.x, y: game.player.y };
  walkToNextWave(game);
  assert.deepEqual({ x: game.player.x, y: game.player.y }, position);
});

test("a Lightning ally cannot shock teammates into a corridor deadlock", () => {
  const game = new Combat({ mode: "gauntlet-team", size: 3, element: "water" });
  const ally = game.fighters.find((a) => a.team === 0 && a !== game.player);
  Object.assign(
    ally,
    makeFighter(ally.id, "lightning", 0, game.player.x + 10, game.player.y),
  );
  clearAndChoose(game);
  assert.equal(game.isShocked(game.player), false);
  walkToNextWave(game);
  assert.equal(game.finalWave, true);
});

test("Terraformer has working Telekinesis without gaining Gravity x2", () => {
  const game = new Combat({ mode: "fused3", element: "terraformer" });
  const a = game.player;
  Object.assign(a, { x: 300, y: 350 });
  const target = makeFighter("enemy", "dark", 1, 450, 350);
  game.fighters = [a, target];
  assert.ok(extraSkillsFor(a.element).some((s) => s.name === "Telekinesis"));
  assert.equal(canUseSkill(a, "gravity", "utility"), false);
  assert.ok(game.startCharge(a, "gravity"));
  assert.ok(target.hp < target.maxHp);
  assert.ok(target.knockX > 0);
  assert.equal(a.abilityCd, 4.5);
  a.abilityCd = 0;
  target.knockX = target.knockY = 0;
  assert.ok(
    game.telekinesis(a, target, 0, -1),
    "Terraformer supports directional swipes in its own tab",
  );
  assert.ok(target.knockY < 0);
  assert.equal(target.knockX, 0);
});

test("Lightning's Flood shortcut shares its utility cooldown and activates flooded Lightning strikes", () => {
  const game = new Combat({ mode: "fused3", element: "lightning" });
  const a = game.player;
  Object.assign(a, { x: 300, y: 350 });
  const target = makeFighter("enemy", "dark", 1, 450, 350);
  game.fighters = [a, target];
  assert.ok(extraSkillsFor(a.element).some((s) => s.name === "Flood"));
  assert.ok(game.utility(a, true, "cloud"));
  assert.ok(game.hazards.some((h) => h.kind === "flood"));
  assert.ok(a.utilityCd > 0);
  const hp = a.hp;
  assert.ok(game.startCharge(a, "lightning"));
  assert.ok(a.hp < hp, "flooded strikes also hit their caster");
});
