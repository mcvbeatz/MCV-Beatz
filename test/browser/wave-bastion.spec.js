import { test, expect } from "@playwright/test";

test("Team Waves renders the Bastion, opens the corridor after the pick, and waits for the whole team", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1024, height: 576 });
  await page.goto("/?mode=gauntlet-team");
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.countdown = 0;
    g.ai = () => {};
    for (const a of [...g.fighters])
      if (a.team === 1) g.fell(a, { killer: g.player });
    g.checkMatchEnd();
  });
  await expect(page.locator("#wave-reward")).toBeVisible();
  await page.locator('[data-reward="heal"]').click();
  await page.evaluate(() => __arena.game.update(7));
  await expect(page.locator("#wave-reward")).toBeHidden();
  await expect(page.locator("#objective-score")).toContainText("CHAMBER 2");
  await expect(page.locator("#attack-btn")).toBeDisabled();
  const x = await page.evaluate(() => __arena.game.player.x);
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.x))
    .toBeGreaterThan(x + 35);
  await page.keyboard.up("d");
  await page.screenshot({ path: "/tmp/v27-bastion-travel.png" });
  const result = await page.evaluate(() => {
    const g = __arena.game;
    const previous = g.wave;
    for (let i = 0; i < 4000 && g.waveTravel; i++) {
      const goal = g.map.route(g.player, g.waveRally);
      const dx = goal.x - g.player.x,
        dy = goal.y - g.player.y;
      const d = Math.hypot(dx, dy);
      g.update(0.025, d > 12 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 });
    }
    return {
      previous,
      wave: g.wave,
      room: g.waveRoom,
      allInside: g.fighters.every((a) => g.map.inRoom(a, 1)),
    };
  });
  expect(result).toEqual({ previous: 1, wave: 2, room: 1, allInside: true });
  await expect(page.locator("#objective-score")).toHaveText("WAVE 2");
  await expect(page.locator("#attack-btn")).toBeEnabled();
  await page.screenshot({ path: "/tmp/v27-bastion-chamber2.png" });
  expect(errors).toEqual([]);
});

test("Terraformer and Lightning expose their extra ability buttons", async ({
  page,
}) => {
  await page.goto("/?mode=fused3");
  await page.locator('[data-element="terraformer"]').click();
  await page.locator("#begin-btn").click();
  await expect(page.locator("#extra-skill-1")).toContainText("Telekinesis");
  await page.evaluate(async () => {
    const g = __arena.game;
    const { makeFighter } = await import("/src/combat.js");
    Object.assign(
      g.player,
      makeFighter("player", "lightning", 0, g.player.x, g.player.y),
    );
    g.ai = () => {};
  });
  await expect(page.locator("#extra-skill-1")).toContainText("Flood");
});
