import { test, expect } from "@playwright/test";

const origins = ["water", "dark", "fire", "air", "earth", "light"];

test("an unavailable sprite atlas leaves combat playable with the procedural avatar", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\/origins[^/]*\.png(?:\?.*)?$/, (route) => route.abort());
  await page.goto("/");
  expect(
    await page.evaluate(
      async () => (await import("/src/characters.js")).charactersReady,
    ),
  ).toBe(false);
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.ai = () => {};
  });
  const start = await page.evaluate(() => __arena.game.player.x);
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.x))
    .toBeGreaterThan(start + 10);
  await page.keyboard.up("d");
  expect(errors).toEqual([]);
});

test("all six concepts have populated, distinct turnaround previews", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page.evaluate(
      async () => (await import("/src/characters.js")).charactersReady,
    ),
  ).toBe(true);
  for (const element of origins) {
    await page.locator(`[data-element="${element}"]`).click();
    await expect(page.locator("#character-views canvas")).toHaveCount(3);
    const images = await page
      .locator("#character-views canvas")
      .evaluateAll((canvases) =>
        canvases.map((c) => {
          const data = c
            .getContext("2d")
            .getImageData(0, 0, c.width, c.height).data;
          return {
            image: c.toDataURL(),
            pixels: data.filter((v, i) => i % 4 === 3 && v > 20).length,
          };
        }),
      );
    expect(new Set(images.map((i) => i.image)).size).toBe(3);
    for (const i of images) expect(i.pixels).toBeGreaterThan(350);
  }
  await page.locator('[data-mode="fused"]').click();
  await expect(page.locator("#character-views")).toBeHidden();
});

test("every origin draws four directions and distinct attack frames without mutating combat", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { drawCharacter, charactersReady } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const c = document.createElement("canvas");
    c.width = c.height = 240;
    const ctx = c.getContext("2d");
    const images = [],
      errors = [];
    for (const element of ["water", "dark", "fire", "air", "earth", "light"]) {
      const a = makeFighter("preview", element, 0, 0, 0);
      for (const [fx, fy] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ]) {
        for (const swing of [0, 0.07]) {
          Object.assign(a, { fx, fy, swing });
          const before = JSON.stringify(a);
          ctx.clearRect(0, 0, 240, 240);
          ctx.save();
          ctx.translate(120, 140);
          if (!drawCharacter(ctx, a, 0)) errors.push(element);
          ctx.restore();
          if (before !== JSON.stringify(a)) errors.push("state mutation");
          images.push(c.toDataURL());
        }
      }
    }
    return { distinct: new Set(images).size, errors };
  });
  expect(result.errors).toEqual([]);
  expect(result.distinct).toBe(48);
});

test("attack poses enter contact when melee hits and recover on the existing timer", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-element="water"]').click();
  await page.locator("#begin-btn").click();
  const result = await page.evaluate(async () => {
    const { characterPose, charactersReady } =
      await import("/src/characters.js");
    await charactersReady;
    const g = __arena.game,
      a = g.player,
      b = g.fighters[1];
    const advance = g.update.bind(g);
    g.update = () => {};
    Object.assign(a, { x: 330, y: 340, attackCd: 0, stagger: 0 });
    Object.assign(b, { x: 385, y: 340 });
    g.strike(a);
    const before = b.hp;
    advance(0.05, { x: 0, y: 0 }, false);
    advance(0.05, { x: 0, y: 0 }, false);
    const windup = { hp: b.hp, pose: characterPose(a).frame };
    advance(0.011, { x: 0, y: 0 }, false);
    const contact = { hp: b.hp, pose: characterPose(a).frame };
    for (let i = 0; i < 3; i++) advance(0.05, { x: 0, y: 0 }, false);
    return {
      before,
      windup,
      contact,
      recovered: a.swing === 0,
      cooldown: a.attackCd,
    };
  });
  expect(result.windup.hp).toBe(result.before);
  expect(result.windup.pose).toBeLessThan(3);
  expect(result.contact.hp).toBeLessThan(result.before);
  expect(result.contact.pose).toBeGreaterThanOrEqual(3);
  expect(result.recovered).toBe(true);
  expect(result.cooldown).toBeGreaterThan(0);
});
