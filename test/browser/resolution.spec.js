import { test, expect } from "@playwright/test";

for (const [density, orientation] of [
  [1, "landscape"],
  [2, "portrait"],
  [3, "landscape"],
]) {
  test(`rendering and touch placement stay aligned at ${density}x in ${orientation}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: density,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((orientation) => {
      HTMLElement.prototype.requestFullscreen = undefined;
      localStorage.setItem(
        "elemental-settings",
        JSON.stringify({ orientation }),
      );
    }, orientation);
    await page.goto("/?mode=duel");
    await page.waitForFunction(() => window.__app?.screen === "setup");
    await page.locator("#begin-btn").click();
    await expect(page.locator("#fullscreen-btn")).toHaveCount(0);
    const placement = await page.evaluate(async () => {
      const { Combat } = await import("/src/combat.js");
      const { charactersReady } = await import("/src/characters.js");
      await charactersReady;
      const g = __arena.game,
        r = __arena.renderer;
      Object.assign(
        g,
        new Combat({ mode: "duel", mapId: "tower", element: "spirit" }),
      );
      g.update = () => {};
      Object.assign(g.player, { x: 760, y: 680 });
      g.portals.portals = [];
      g.portals.placing = g.player.id;
      r.draw(g);
      const canvas = r.canvas,
        v = r.view;
      const target = { x: 830, y: 680 };
      const local = {
        x: target.x * v.scale + v.tx,
        y: target.y * v.scale + v.ty,
      };
      const rect = canvas.getBoundingClientRect();
      const rotated =
        document.getElementById("orientation-root").dataset.rotation === "90";
      return {
        target,
        pointer: rotated
          ? { x: rect.right - local.y, y: rect.top + local.x }
          : { x: rect.left + local.x, y: rect.top + local.y },
        width: canvas.width,
        height: canvas.height,
        cssWidth: canvas.clientWidth,
        cssHeight: canvas.clientHeight,
        cssScaling: getComputedStyle(canvas).imageRendering,
      };
    });
    expect(placement.width).toBe(
      Math.round(placement.cssWidth * Math.min(2, density)),
    );
    expect(placement.height).toBe(
      Math.round(placement.cssHeight * Math.min(2, density)),
    );
    expect(placement.cssScaling).toBe("auto");
    await page.mouse.click(placement.pointer.x, placement.pointer.y);
    const portals = await page.evaluate(() => __arena.game.portals.portals);
    expect(portals).toHaveLength(1);
    expect(portals[0].x).toBeCloseTo(placement.target.x, 0);
    expect(portals[0].y).toBeCloseTo(placement.target.y, 0);
    // Exercise each cached map, including resizing the live backing store.
    const maps = await page.evaluate(async () => {
      const { Combat } = await import("/src/combat.js");
      const r = __arena.renderer;
      return ["classic", "garden", "tower", "corruption"].map((mapId) => {
        const g = new Combat({
          mode: mapId === "corruption" ? "corruption" : "duel",
          mapId,
        });
        r.draw(g);
        const data = r.ctx.getImageData(
          r.canvas.width / 2,
          r.canvas.height / 2,
          1,
          1,
        ).data;
        return [...data];
      });
    });
    expect(maps.every((c) => c[3] === 255 && c[0] + c[1] + c[2] > 30)).toBe(
      true,
    );
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(
        () =>
          __arena.renderer.canvas.width ===
          Math.round(
            __arena.renderer.canvas.clientWidth * Math.min(2, devicePixelRatio),
          ),
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/elemental-resolution-${density}x.png`,
    });
    await page.locator("#leave-btn").click();
    await expect(page.locator("#arena-panel")).not.toHaveClass(/immersive/);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("gravity distortion follows the field at high density and leaves the exterior untouched", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { distortGravity } = await import("/src/battle-effects.js");
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#539c85";
    ctx.fillRect(0, 0, 800, 600);
    for (let x = 0; x < 800; x += 16) {
      ctx.fillStyle = "#eee8cf";
      ctx.fillRect(x, 0, 3, 600);
    }
    const before = ctx.getImageData(0, 0, 800, 600).data;
    const view = { scale: 0.8, tx: 30, ty: 10 };
    ctx.setTransform(1.6, 0, 0, 1.6, 60, 20);
    distortGravity(
      ctx,
      c,
      document.createElement("canvas"),
      { hazards: [{ kind: "gravity", x: 300, y: 200, r: 65 }] },
      view,
      1,
    );
    const after = ctx.getImageData(0, 0, 800, 600).data;
    let inside = 0,
      outside = 0;
    for (let y = 0; y < 600; y++)
      for (let x = 0; x < 800; x++) {
        const i = (y * 800 + x) * 4;
        const changed =
          Math.abs(after[i] - before[i]) +
            Math.abs(after[i + 1] - before[i + 1]) +
            Math.abs(after[i + 2] - before[i + 2]) >
          10;
        const distance = Math.hypot(x - 540, y - 340);
        if (changed && distance < 100) inside++;
        if (changed && distance > 107) outside++;
      }
    return { inside, outside };
  });
  expect(result.inside).toBeGreaterThan(1000);
  expect(result.outside).toBe(0);
});
