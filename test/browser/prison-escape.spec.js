import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("empty Stone Prison holds, crumbles and vanishes without changing its original silhouette", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { drawStoneShell, drawEmptyPrison } =
      await import("/src/stone-prison.js");
    const canvas = document.createElement("canvas");
    canvas.width = 840;
    canvas.height = 260;
    const c = canvas.getContext("2d");
    const frames = [];
    for (const [i, elapsed] of [0, 1.9, 2.3, 2.65].entries()) {
      const tile = document.createElement("canvas");
      tile.width = 210;
      tile.height = 260;
      const ctx = tile.getContext("2d");
      ctx.translate(105, 180);
      ctx.scale(2, 2);
      drawEmptyPrison(ctx, { x: 0, y: 0, max: 2.65, life: 2.65 - elapsed });
      const pixels = tile.getContext("2d").getImageData(0, 0, 210, 260).data;
      frames.push(
        [...pixels]
          .filter((_, j) => j % 4 === 3)
          .reduce((sum, a) => sum + a, 0),
      );
      c.drawImage(tile, i * 210, 0);
    }
    return { frames, image: canvas.toDataURL().split(",")[1] };
  });
  expect(result.frames[0]).toBe(result.frames[1]);
  expect(result.frames[2]).toBeGreaterThan(0);
  expect(result.frames[2]).toBeLessThan(result.frames[1]);
  expect(result.frames[3]).toBe(0);
  await writeFile(
    "/tmp/prison-collapse.png",
    Buffer.from(result.image, "base64"),
  );
});
test("Heal is half the recorded effect level and victory and War use their reduced track levels", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("body").click();
  const result = await page.evaluate(async () => {
    const { CombatSfx } = await import("/src/combat-sfx.js");
    const ctx = new AudioContext();
    await ctx.resume();
    const s = new CombatSfx(ctx, 0.6);
    await s.ready;
    const levels = [];
    const createGain = ctx.createGain.bind(ctx);
    ctx.createGain = () => {
      const n = createGain();
      levels.push(n);
      return n;
    };
    s.serial = 0;
    s.play("heal");
    s.serial = 0;
    s.play("fireball");
    const ratio = levels[0].gain.value / levels[1].gain.value;
    s.stop();
    await ctx.close();
    const sound = __app.sound;
    sound.unlock();
    sound.setScene("victory");
    const win = sound.trackGain.gain.value;
    sound.volume("music", 0.8);
    const adjusted = sound.trackGain.gain.value;
    const setting = sound.settings.music;
    sound.setScene("defeat");
    const loss = sound.trackGain.gain.value;
    sound.setScene("battle");
    const battle = sound.trackGain.gain.value;
    sound.setScene("war");
    const war = sound.trackGain.gain.value;
    sound.setScene("volcano");
    const volcano = sound.trackGain.gain.value;
    return { ratio, win, adjusted, setting, loss, battle, war, volcano };
  });
  expect(result.ratio).toBeCloseTo(0.5, 6);
  expect(result).toMatchObject({
    war: expect.closeTo(0.9, 6),
    volcano: 1,
    win: expect.closeTo(0.75 * 0.85 * 0.9, 6),
    adjusted: expect.closeTo(0.75 * 0.85 * 0.9, 6),
    setting: 0.8,
    loss: 1,
    battle: 1,
  });
});
