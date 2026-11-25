import { test, expect } from "@playwright/test";
import { installLobbyService } from "./local-lobby-service.js";
const route = installLobbyService(test);
async function open(page, orientation) {
  await route(page);
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem("elemental-settings", JSON.stringify({orientation, music: 0, sfx: 0}));
  }, orientation);
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
for (const [width, height, orientation] of [
  [390, 844, "auto"], [844, 390, "auto"], [375, 667, "portrait"],
  [390, 844, "landscape"], [844, 390, "portrait"],
]) {
  test(`all setup profiles fit ${width}x${height} ${orientation}`, async ({ page }) => {
    await page.setViewportSize({width, height});
    await open(page, orientation);
    for (const mode of ["duel", "fused", "fused3"]) {
      await page.evaluate((mode) => __app.chooseMode(mode), mode);
      const forms = await page.locator("#element-grid [data-element]").evaluateAll(ns => ns.map(n => n.dataset.element));
      for (const form of forms) {
        await page.locator(`[data-element="${form}"]`).click();
        const overflow = await page.evaluate(() => [".setup-panel", ".element-profile", ".setup-comparison", ".setup-abilities"].map(s => {
          const e = document.querySelector(s);
          return {selector:s, x: e.scrollWidth - e.clientWidth, y: e.scrollHeight - e.clientHeight};
        }));
        for (const result of overflow) {
          expect(result.x, `${form} ${result.selector} horizontal`).toBeLessThanOrEqual(1);
          expect(result.y, `${form} ${result.selector} vertical`).toBeLessThanOrEqual(1);
        }
      }
    }
    await expect(page.locator("#begin-btn")).toBeInViewport();
  });
}
for (const orientation of ["landscape", "portrait", "auto"]) {
  test(`settings remain readable and rotate in lobby and battle: ${orientation}`, async ({ browser }) => {
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const page = await context.newPage();
    try {
      await open(page, orientation);
      await page.evaluate(() => __app.show("settings"));
      await expect(page.locator(".settings-panel")).not.toContainText("Standard spreads");
      await checkSelects(page, "#app-shell");
      await page.evaluate(() => __app.openLobby("tdm", false, {action:"create"}));
      await page.waitForFunction(() => __app.lobby?.state);
      const room = await page.evaluate(() => __app.lobby.state.roomId);
      await page.locator("#pause-btn").tap();
      await expect(page.locator("#battle-settings-dialog")).toBeVisible();
      await checkSelects(page, "#battle-settings-dialog");
      await checkRotation(page);
      await page.setViewportSize({width:844,height:390});
      await checkRotation(page);
      await checkSelects(page, "#battle-settings-dialog");
      await page.locator("#battle-settings-dialog [data-resume]").tap();
      expect(await page.evaluate(() => __app.lobby.state.roomId)).toBe(room);
      await page.evaluate(() => __app.show("home"));
      await page.evaluate(() => __app.chooseMode("dungeon"));
      await page.locator("#begin-btn").click();
      await page.locator("#pause-btn").tap();
      await checkRotation(page);
      await checkSelects(page, "#battle-settings-dialog");
      expect(await page.evaluate(() => __arena.paused)).toBe(true);
      await page.locator("#battle-settings-dialog [data-resume]").tap();
      await expect.poll(() => page.evaluate(() => __arena.paused)).toBe(false);
    } finally { await context.close(); }
  });
}
async function checkSelects(page, root) {
  for (const select of await page.locator(`${root} .settings-panel select`).all()) {
    const original = await select.inputValue();
    const space = await select.evaluate(e => {
      const s = getComputedStyle(e);
      return { height:e.clientHeight, needed:parseFloat(s.fontSize) * 1.5 + parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) };
    });
    expect(space.height).toBeGreaterThanOrEqual(space.needed);
    await select.selectOption({index: 1});
    await select.selectOption(original);
  }
}
async function checkRotation(page) {
  // Browser viewport changes dispatch resize asynchronously. Wait for the app
  // to consume that event before checking the newly rotated modal geometry.
  await page.waitForFunction(() => {
    const landscape = __app.settings.orientation === "auto"
      ? innerWidth >= innerHeight : __app.settings.orientation === "landscape";
    const expected = landscape ? Math.max(innerWidth, innerHeight) : Math.min(innerWidth, innerHeight);
    const angle = landscape && innerHeight > innerWidth ? 90 : !landscape && innerWidth > innerHeight ? -90 : 0;
    return parseFloat(document.documentElement.style.getPropertyValue("--app-width")) === expected &&
      Number(document.querySelector("#orientation-root").dataset.rotation) === angle;
  });
  const result = await page.evaluate(() => {
    const el = document.querySelector("#battle-settings-dialog");
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    const expected = Number(document.querySelector("#orientation-root").dataset.rotation);
    const r = el.getBoundingClientRect();
    return {actual:Math.round(Math.atan2(matrix.b,matrix.a)*180/Math.PI),expected,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight};
  });
  expect(result.actual).toBe(result.expected);
  expect(result.x).toBeGreaterThanOrEqual(0);
  expect(result.y).toBeGreaterThanOrEqual(0);
  expect(result.right).toBeLessThanOrEqual(result.w + 1);
  expect(result.bottom).toBeLessThanOrEqual(result.h + 1);
}
