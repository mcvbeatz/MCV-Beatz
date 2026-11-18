import { test, expect } from "@playwright/test";
async function swipe(page, cdp, selector, axis) {
  const points = await page.locator(selector).evaluate((el, axis) => {
    const r = el.getBoundingClientRect();
    const rotation = Number(
      document.getElementById("orientation-root").dataset.rotation,
    );
    const screen = (x, y) =>
      rotation === 90
        ? { x: r.right - y, y: r.top + x }
        : rotation === -90
          ? { x: r.left + y, y: r.bottom - x }
          : { x: r.left + x, y: r.top + y };
    return axis === "y"
      ? {
          from: screen(Math.min(el.clientWidth - 30, 140), 90),
          to: screen(Math.min(el.clientWidth - 30, 140), 20),
        }
      : { from: screen(el.clientWidth - 25, 55), to: screen(25, 55) };
  }, axis);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, ...points.from }],
  });
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          id: 1,
          x: points.from.x + ((points.to.x - points.from.x) * i) / 10,
          y: points.from.y + ((points.to.y - points.from.y) * i) / 10,
        },
      ],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}
for (const [label, orientation, width, height] of [
  ["portrait", "portrait", 320, 568],
  ["landscape", "landscape", 568, 320],
  ["rotated", "landscape", 320, 568],
]) {
  test(`scoreboard itself scrolls the whole results page on ${label} touch screens`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    await page.addInitScript((orientation) => {
      HTMLElement.prototype.requestFullscreen = undefined;
      localStorage.setItem(
        "elemental-settings",
        JSON.stringify({ orientation, music: 0, sfx: 0 }),
      );
    }, orientation);
    await page.goto("/");
    await page.waitForFunction(() => window.__app?.screen === "home");
    await page.evaluate(() => __app.chooseMode("gridiron"));
    await page.locator("#begin-btn").click();
    await page.evaluate(() => {
      const g = __arena.game;
      g.update = () => {};
      g.finish(0, "Scroll check");
      g.celebrationRemaining = 0;
    });
    await expect(page.locator("#match-report")).toBeVisible();
    await swipe(page, cdp, ".scoreboard-scroll", "y");
    await expect
      .poll(() => page.locator("#game-overlay").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(30);
    await page.locator("#game-overlay").evaluate((el) => (el.scrollTop = 0));
    const overflow = await page
      .locator(".scoreboard-scroll")
      .evaluate((el) => el.scrollWidth > el.clientWidth + 30);
    if (overflow) {
      await swipe(page, cdp, ".scoreboard-scroll", "x");
      await expect
        .poll(() =>
          page.locator(".scoreboard-scroll").evaluate((el) => el.scrollLeft),
        )
        .toBeGreaterThan(15);
      expect(
        await page.locator("#game-overlay").evaluate((el) => el.scrollTop),
      ).toBeLessThan(5);
    }
    await context.close();
  });
}
