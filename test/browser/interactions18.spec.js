import { test, expect } from "@playwright/test";
for (const orientation of ["portrait", "landscape"]) {
  test(`enemy Flash fully covers a phone in ${orientation}, holds white for one second and fades for two`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.addInitScript((orientation) => {
      HTMLElement.prototype.requestFullscreen = undefined;
      localStorage.setItem(
        "elemental-settings",
        JSON.stringify({ orientation }),
      );
    }, orientation);
    await page.goto("/?mode=duel");
    await page.waitForFunction(() => window.__app?.screen === "setup");
    await page.locator('[data-element="water"]').click();
    await page.locator("#begin-btn").click();
    const cast = await page.evaluate(async () => {
      const { makeFighter, FLASH_RADIUS } = await import("/src/combat.js");
      const g = __arena.game;
      g.update = () => {};
      g.ai = () => {};
      g.hazards = [];
      g.effects = [];
      g.portals.portals = [];
      Object.assign(g.player, { x: 450, y: 350, whiteout: 0 });
      const enemy = makeFighter(
        "light-enemy",
        "light",
        1,
        450 + FLASH_RADIUS + 1,
        350,
      );
      g.fighters = [g.player, enemy];
      g.utility(enemy);
      const outside = g.player.whiteout;
      enemy.utilityCd = 0;
      enemy.x = 450 + FLASH_RADIUS - 1;
      g.utility(enemy);
      return { outside, inside: g.player.whiteout };
    });
    expect(cast).toEqual({ outside: 0, inside: 3 });
    const overlay = page.locator("#flash-whiteout");
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(overlay).toHaveCSS("background-color", "rgb(255, 255, 255)");
    const r = await overlay.boundingBox();
    expect(Math.abs(r.x)).toBeLessThan(1);
    expect(Math.abs(r.y)).toBeLessThan(1);
    expect(Math.abs(r.width - 390)).toBeLessThan(1);
    expect(Math.abs(r.height - 844)).toBeLessThan(1);
    const screenshot = await page.screenshot({
      path: `/tmp/v18-flash-${orientation}.png`,
    });
    const whiteFraction = await page.evaluate(async (base64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      let white = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255)
          white++;
      return white / (img.width * img.height);
    }, screenshot.toString("base64"));
    expect(whiteFraction).toBeGreaterThan(0.9999);
    const advance = async (seconds) =>
      page.evaluate(async (seconds) => {
        const { Combat } = await import("/src/combat.js");
        for (let i = 0; i < Math.round(seconds / 0.01); i++)
          Combat.prototype.update.call(
            __arena.game,
            0.01,
            { x: 0, y: 0 },
            false,
          );
      }, seconds);
    await advance(0.99);
    await expect(overlay).toHaveCSS("opacity", "1");
    await advance(1.01);
    await expect
      .poll(() =>
        overlay.evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBeCloseTo(0.5, 4);
    await advance(0.99);
    expect(
      await overlay.evaluate((el) => Number(getComputedStyle(el).opacity)),
    ).toBeLessThan(0.01);
    await advance(0.02);
    await expect(overlay).toBeHidden();
    await context.close();
  });
}
