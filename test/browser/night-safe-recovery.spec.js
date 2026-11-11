import { test, expect } from "@playwright/test";
for (const recovery of ["rebirth", "revival", "respawn"]) {
  test(`${recovery} places the player on maze floor and the move stick can move them`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      HTMLElement.prototype.requestFullscreen = undefined;
      localStorage.setItem(
        "elemental-settings",
        JSON.stringify({ music: 0, sfx: 0, orientation: "landscape" }),
      );
    });
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.goto("/?mode=corruption");
    await page.waitForFunction(() => window.__app?.screen === "setup");
    await page.locator("#begin-btn").click();
    const start = await page.evaluate((recovery) => {
      const g = __arena.game;
      g.countdown = 0;
      g.corruptionStarted = true;
      const update = g.update.bind(g);
      g.update = (dt, input) => update(dt, input, false);
      const wall = g.map.walls.find((w) => w.kind === "line");
      const blocked = {
        x: (wall.a.x + wall.b.x) / 2,
        y: (wall.a.y + wall.b.y) / 2,
      };
      const a = g.player;
      if (recovery === "rebirth") {
        for (const b of g.fighters.slice(1, 6)) g.corrupt(b);
        const p = g.map.cells.find(
          (p) =>
            !g.map.walkable({
              x: Math.max(135, Math.min(889, p.x)),
              y: Math.max(175, Math.min(560, p.y)),
            }),
        );
        Object.assign(a, p, { hp: 1 });
        g.meleeDamage(g.fighters[1], a, 1);
      } else if (recovery === "revival") {
        for (const b of g.fighters.slice(0, 7)) g.corrupt(b);
        Object.assign(a, blocked);
        g.fell(a);
        g.revive(g.fighters[7]);
      } else {
        g.corrupt(a);
        Object.assign(a.spawn, blocked);
        g.fell(a);
        g.respawn(a);
      }
      const direction = Array.from(
        { length: 16 },
        (_, i) => (i * Math.PI) / 8,
      ).find((angle) => {
        const next = {
          x: a.x + Math.cos(angle) * 20,
          y: a.y + Math.sin(angle) * 20,
        };
        return g.map.walkable(next) && g.map.lineClear(a, next, 13);
      });
      return {
        x: a.x,
        y: a.y,
        direction,
        alive: a.alive,
        safe: g.map.walkable(a, 16),
      };
    }, recovery);
    expect(start.alive).toBe(true);
    expect(start.safe).toBe(true);
    expect(start.direction).not.toBeUndefined();
    const box = await page.locator("#joystick").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + Math.cos(start.direction) * box.width * 0.3,
      box.y + box.height / 2 + Math.sin(start.direction) * box.height * 0.3,
    );
    await expect
      .poll(() =>
        page.evaluate(
          (start) =>
            Math.hypot(
              __arena.game.player.x - start.x,
              __arena.game.player.y - start.y,
            ),
          start,
        ),
      )
      .toBeGreaterThan(3);
    await page.mouse.up();
    expect(
      await page.evaluate(() => __arena.game.map.walkable(__arena.game.player)),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
