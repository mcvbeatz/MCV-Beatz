import { test, expect } from "@playwright/test";

async function point(page, x, y) {
  return page.evaluate(
    ({ x, y }) => {
      const r = document.getElementById("game").getBoundingClientRect(),
        v = __arena.renderer.view;
      const lx = x * v.scale + v.tx,
        ly = y * v.scale + v.ty;
      return __arena.immersive && innerHeight > innerWidth
        ? { x: r.right - ly, y: r.top + lx }
        : { x: r.left + lx, y: r.top + ly };
    },
    { x, y },
  );
}
test.describe("swipe telekinesis on a phone", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  test("direction is correct in landscape and rotated portrait; the button only explains", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      HTMLElement.prototype.requestFullscreen = undefined;
    });
    await page.goto("/");
    await page.locator('[data-mode="fused"]').click();
    await page.locator('[data-element="gravity"]').click();
    await page.locator("#begin-btn").click();
    await page.evaluate(() => {
      const g = __arena.game;
      g.update = () => {};
      Object.assign(g.player, { x: 330, y: 340, abilityCd: 0 });
      Object.assign(g.fighters[1], {
        x: 430,
        y: 340,
        element: "earth",
        parts: ["earth"],
      });
    });
    await expect(page.locator("#ability-status")).toHaveText(
      "Swipe enemies to move them",
    );
    await page.locator("#charge-btn").click();
    expect(await page.evaluate(() => __arena.game.player.abilityCd)).toBe(0);
    expect(await page.evaluate(() => __arena.game.player.charging)).toBe(false);
    const client = await page.context().newCDPSession(page);
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const [dx, dy] of [
        [90, 0],
        [0, -90],
      ]) {
        await page.evaluate(() => {
          __arena.game.player.abilityCd = 0;
          Object.assign(__arena.game.fighters[1], {
            knockX: 0,
            knockY: 0,
            hp: 120,
          });
        });
        const start = await point(page, 430, 310),
          end = await point(page, 430 + dx, 310 + dy);
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ id: 1, ...start }],
        });
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ id: 1, ...end }],
        });
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        const result = await page.evaluate(() => ({
          x: __arena.game.fighters[1].knockX,
          y: __arena.game.fighters[1].knockY,
          cd: __arena.game.player.abilityCd,
        }));
        expect(result.x).toBeCloseTo(dx ? 260 : 0, 3);
        expect(result.y).toBeCloseTo(dy ? -260 : 0, 3);
        expect(result.cd).toBe(4.5);
      }
    }
    await page.evaluate(() => {
      __arena.game.player.abilityCd = 0;
      __arena.game.fighters[1].knockX = 0;
      __arena.game.fighters[1].knockY = 0;
    });
    const start = await point(page, 430, 310);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, ...start }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    expect(await page.evaluate(() => __arena.game.player.abilityCd)).toBe(0);
    await client.detach();
  });
});

test("water and quicksand hide the correct portion of grounded sprites", async ({
  page,
}) => {
  await page.goto("/");
  const counts = await page.evaluate(async () => {
    await (
      await import("/src/characters.js")
    ).charactersReady;
    const { makeFighter } = await import("/src/combat.js");
    const a = makeFighter("test", "earth", 0, 90, 130),
      c = document.createElement("canvas");
    c.width = c.height = 180;
    const ctx = c.getContext("2d"),
      out = [];
    for (const depth of [0, 10, 32]) {
      ctx.clearRect(0, 0, 180, 180);
      __arena.renderer.avatar(ctx, a, 0, depth);
      const lower = ctx.getImageData(50, 120, 80, 15).data;
      const waist = ctx.getImageData(50, 100, 80, 15).data;
      out.push({
        feet: lower.filter((v, i) => i % 4 === 3 && v > 30).length,
        waist: waist.filter((v, i) => i % 4 === 3 && v > 30).length,
      });
    }
    return out;
  });
  expect(counts[0].feet).toBeGreaterThan(20);
  expect(counts[1].feet).toBe(0);
  expect(counts[1].waist).toBeGreaterThan(20);
  expect(counts[2].waist).toBe(0);
});

test("gravity fuzz stays inside its area and does not reveal an invisible Divine", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    await (
      await import("/src/characters.js")
    ).charactersReady;
    const { makeFighter } = await import("/src/combat.js");
    const g = __arena.game,
      r = __arena.renderer;
    g.update = () => {};
    g.time = 0;
    g.effects = [];
    g.events = [];
    const a = makeFighter("hidden", "divine", 1, 450, 350);
    g.fighters = [a];
    const pixels = () => {
      r.draw(g);
      return r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data;
    };
    const before = pixels();
    g.hazards = [{ kind: "gravity", x: 450, y: 350, r: 100, owner: a }];
    const after = pixels();
    a.alive = false;
    const absent = pixels();
    let inside = 0,
      outside = 0,
      leaked = 0;
    for (let i = 0; i < after.length; i += 4) {
      if (
        after[i] !== absent[i] ||
        after[i + 1] !== absent[i + 1] ||
        after[i + 2] !== absent[i + 2]
      )
        leaked++;
      if (
        after[i] === before[i] &&
        after[i + 1] === before[i + 1] &&
        after[i + 2] === before[i + 2]
      )
        continue;
      const x = (i / 4) % r.canvas.width,
        y = Math.floor(i / 4 / r.canvas.width),
        world = r.worldPoint(x, y);
      if (Math.hypot(world.x - 450, world.y - 350) > 103) outside++;
      else inside++;
    }
    return { inside, outside, leaked };
  });
  expect(result.inside).toBeGreaterThan(500);
  expect(result.outside).toBe(0);
  expect(result.leaked).toBe(0);
});
