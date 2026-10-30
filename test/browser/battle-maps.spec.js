import { test, expect } from "@playwright/test";
for (const mapId of ["garden", "tower"])
  for (const orientation of ["portrait", "landscape"]) {
    test(`${mapId} works on a phone in ${orientation}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        ({ mapId, orientation }) => {
          HTMLElement.prototype.requestFullscreen = undefined;
          Math.random = () => (mapId === "garden" ? 0.4 : 0.9);
          localStorage.setItem(
            "elemental-settings",
            JSON.stringify({ orientation }),
          );
        },
        { mapId, orientation },
      );
      await page.goto("/?mode=ctf");
      await page.waitForFunction(() => window.__app?.screen === "setup");
      await page.locator('[data-element="fire"]').click();
      await page.locator("#begin-btn").click();
      await page.evaluate(() => {
        __arena.game.countdown = 0;
        __arena.game.ai = () => {};
      });
      expect(await page.evaluate(() => __arena.game.map.kind)).toBe(mapId);
      await expect(page.locator("#arena-title")).toHaveText(
        mapId === "garden" ? "THE CROSSWATER GARDEN" : "THE ASTRAL TOWER",
      );
      await page.evaluate(() => {
        const g = __arena.game;
        Object.assign(g.player, {
          x: g.map.kind === "garden" ? 1024 : 760,
          y: 680,
        });
      });
      await page.waitForTimeout(100);
      const before = await page.evaluate(() => __arena.game.player.x);
      await page.keyboard.down("d");
      await page.waitForTimeout(400);
      await page.keyboard.up("d");
      expect(await page.evaluate(() => __arena.game.player.x)).toBeGreaterThan(
        before + 25,
      );
      expect(
        await page.evaluate(() =>
          __arena.game.map.walkable(__arena.game.player),
        ),
      ).toBe(true);
      // World/screen transforms used by taps remain inverses on both map sizes.
      expect(
        await page.evaluate(() => {
          const a = __arena.game.player,
            v = __arena.renderer.view;
          const canvas = document.getElementById("game");
          return (
            a.x * v.scale + v.tx >= 0 &&
            a.x * v.scale + v.tx <= canvas.width &&
            a.y * v.scale + v.ty >= 0 &&
            a.y * v.scale + v.ty <= canvas.height
          );
        }),
      ).toBe(true);
      for (const selector of [
        "#joystick",
        "#attack-btn",
        "#charge-btn",
        "#leave-btn",
      ]) {
        const r = await page.locator(selector).boundingBox();
        expect(r.x).toBeGreaterThanOrEqual(-1);
        expect(r.y).toBeGreaterThanOrEqual(-1);
        expect(r.x + r.width).toBeLessThanOrEqual(391);
        expect(r.y + r.height).toBeLessThanOrEqual(845);
      }
      await page.screenshot({
        path: `/tmp/elemental-${mapId}-${orientation}.png`,
      });
      if (orientation === "landscape") {
        await page.evaluate(async () => {
          const { paintBattleMap, drawBattleAmbience } =
            await import("/src/battle-maps-render.js");
          const c = document.createElement("canvas");
          c.id = "map-overview";
          c.width = 2048;
          c.height = 1360;
          c.style =
            "position:fixed;inset:0;z-index:999999;width:100vw;height:100vh;object-fit:contain;background:#080d13";
          const ctx = c.getContext("2d");
          paintBattleMap(ctx, __arena.game.map);
          drawBattleAmbience(ctx, __arena.game.map, 0);
          document.body.append(c);
        });
        const data = await page
          .locator("#map-overview")
          .evaluate((c) => c.toDataURL().split(",")[1]);
        const { writeFile } = await import("node:fs/promises");
        await writeFile(
          `/tmp/elemental-${mapId}-overview.png`,
          Buffer.from(data, "base64"),
        );
      }
      expect(errors).toEqual([]);
      await context.close();
    });
  }
test("Survive the Night label retains the maze and existing mode link", async ({
  page,
}) => {
  await page.goto("/?mode=corruption");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await expect(page.locator("#setup-mode-title")).toHaveText(
    "Survive the Night",
  );
  await page.locator("#begin-btn").click();
  expect(await page.evaluate(() => __arena.game.map.kind)).toBe("corruption");
  await expect(page.locator("#round-mode")).toContainText("SURVIVE THE NIGHT");
});
