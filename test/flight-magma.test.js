import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter, ELEMENTS, COMBOS } from "./combat-fixture.js";

function arena(element, kind) {
  const game = new Combat({ element: "fire", random: () => 0 });
  Object.assign(game.player, { x: 700, y: 350 });
  const bot = makeFighter("bot", element, 1, 300, 350);
  Object.assign(bot, { attackCd: 999, abilityCd: 999, utilityCd: 999 });
  game.fighters = [game.player, bot];
  if (kind)
    game.hazards.push({
      kind,
      owner: game.player,
      x: 342,
      y: 350,
      r: 20,
      element: "fire",
      power: 1,
      life: 10,
      tick: 0,
    });
  return { game, bot };
}

test("every flying elemental routes through magma and accepts destinations inside it across skill tabs", () => {
  for (const element of [...Object.keys(ELEMENTS), ...Object.values(COMBOS)]) {
    const { game, bot } = arena(element, "magma");
    if (!game.flying(bot)) continue;
    for (let form = 0; form < bot.forms.length; form++) {
      bot.form = form;
      const label = `${element}, ${bot.forms[form]} skills`;
      assert.equal(game.mobilitySafe(bot, { x: 342, y: 350 }), true, label);
      assert.deepEqual(game.aiRoute(bot, game.player), { x: 42, y: 0 }, label);
    }
  }
});

test("flying AI pursues its target without steering away from magma", () => {
  const clear = arena("air");
  const magma = arena("air", "magma");
  magma.game.hazards[0].r = 66;
  for (const { game, bot } of [clear, magma]) game.ai(bot, 0.05);
  assert.ok(clear.bot.x > 300);
  assert.equal(magma.bot.x, clear.bot.x);
  assert.equal(magma.bot.y, clear.bot.y);
});

test("grounded AI still avoids magma and vulnerable flyers still avoid Heatwave", () => {
  for (const [element, kind] of [
    ["earth", "magma"],
    ["air", "heatwave"],
  ]) {
    const { game, bot } = arena(element, kind);
    assert.equal(game.mobilitySafe(bot, { x: 342, y: 350 }), false);
    assert.notDeepEqual(game.aiRoute(bot, game.player), { x: 42, y: 0 });
    game.hazards[0].r = 66;
    game.ai(bot, 0.05);
    assert.ok(bot.x < 300, `${element} must move away from ${kind}`);
  }
});
