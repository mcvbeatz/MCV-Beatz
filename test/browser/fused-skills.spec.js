import { test, expect } from "@playwright/test";
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
async function prepare(page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
  });
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
}
async function fighter(page, element) {
  await page.evaluate(async (element) => {
    const { makeFighter } = await import("/src/combat.js");
    const g = __arena.game;
    g.update = () => {};
    Object.assign(g.player, makeFighter("player", element, 0, 330, 340));
    g.fighters = [
      g.player,
      makeFighter("enemy", "water", 1, 650, 340),
      makeFighter("ally", "water", 0, 350, 400),
    ];
    g.fighters[2].hp = 20;
  }, element);
  await expect(page.locator("#hud-name")).toHaveText(
    element.replaceAll("-", " ").toUpperCase(),
  );
}
test("phone origin menu scrolls all the way to Fire without overflowing the page", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation: "portrait" }),
    ),
  );
  await prepare(page);
  await page.locator("#element-grid").scrollIntoViewIfNeeded();
  const grid = page.locator("#element-grid"),
    fire = page.locator('[data-element="fire"]');
  const stats = await grid.evaluate((e) => ({
    client: e.clientWidth,
    scroll: e.scrollWidth,
  }));
  expect(stats.scroll).toBeGreaterThan(stats.client);
  await grid.evaluate((e) => {
    e.scrollLeft = 0;
  });
  const box = await grid.boundingBox();
  const c = await page.context().newCDPSession(page);
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: box.x + box.width - 15, y: box.y + 35 }],
  });
  for (let i = 1; i <= 10; i++)
    await c.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          id: 1,
          x: box.x + box.width - 15 - ((box.width - 30) * i) / 10,
          y: box.y + 35,
        },
      ],
    });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() =>
      fire.evaluate((e) => {
        const r = e.getBoundingClientRect(),
          g = e.parentElement.getBoundingClientRect();
        return r.left >= g.left - 1 && r.right <= g.right + 1;
      }),
    )
    .toBe(true);
  await fire.tap();
  await expect(page.locator("#profile-name")).toHaveText("Fire");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await c.detach();
});
test("every added fused skill remains visible and fits beside movement and strike controls on small phones", async ({
  page,
}) => {
  await prepare(page);
  await page.locator("#begin-btn").click();
  const expected = {
    spirit: ["Revival", "Portals", "Healing"],
    divine: ["Radiance", "Revival", "Portals"],
    sun: ["Laser beam", "Heatwave", "Healing"],
    demonic: ["Minions", "Death", "Speed burst", "Sonic boom"],
    mirror: ["Rock shield", "Healing"],
    smoke: ["Vog", "Shadow step", "Flamethrower"],
    gravity: ["Telekinesis", "Gravity x2", "Rock shield"],
    apparition: ["Doppelgänger", "Phase", "Sonic boom"],
    "multi-dimensional": ["Teleport", "Healing", "Shadow step"],
    lightning: ["Lightning strikes", "Tailwind", "Healing"],
  };
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [element, names] of Object.entries(expected)) {
      await fighter(page, element);
      await expect(
        page.locator(".skill-controls > button:visible strong"),
      ).toHaveText(names);
      const rects = await page.evaluate(() =>
        ["#joystick", "#attack-btn", ".skill-controls > button:not([hidden])"]
          .flatMap((s) => [...document.querySelectorAll(s)])
          .map((e) => {
            const r = e.getBoundingClientRect();
            return {
              name: e.id,
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              fits:
                r.left >= 0 &&
                r.top >= 0 &&
                r.right <= innerWidth &&
                r.bottom <= innerHeight,
            };
          }),
      );
      expect(
        rects.every((r) => r.fits),
        JSON.stringify({ element, viewport, rects }),
      ).toBe(true);
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i],
            b = rects[j];
          expect(
            a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top,
            `${element}: ${a.name} overlaps ${b.name}`,
          ).toBe(false);
        }
    }
  }
});
test("direct fused buttons cast healing, revive, shield, flamethrower and sonic boom without switching tabs", async ({
  page,
}) => {
  await prepare(page);
  await page.locator("#begin-btn").click();
  await fighter(page, "mirror");
  const shield = page.locator("#extra-skill-0");
  const r = await shield.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  expect(await page.evaluate(() => __arena.game.player.shield)).toBe(1);
  await page.mouse.up();
  expect(await page.evaluate(() => __arena.game.player.shield)).toBe(0);
  await page.locator("#extra-skill-1").tap();
  expect(await page.evaluate(() => __arena.game.fighters[2].hp)).toBe(43);
  expect(
    await page.locator('[data-form="mirror"]').getAttribute("aria-pressed"),
  ).toBe("true");
  await fighter(page, "divine");
  await page.evaluate(() => __arena.game.fell(__arena.game.fighters[2]));
  await page.locator("#extra-skill-0").tap();
  expect(await page.evaluate(() => __arena.game.fighters[2].alive)).toBe(true);
  expect(
    await page.locator('[data-form="divine"]').getAttribute("aria-pressed"),
  ).toBe("true");
  await fighter(page, "smoke");
  await page.locator("#extra-skill-1").tap();
  expect(await page.evaluate(() => __arena.game.projectiles.at(-1).kind)).toBe(
    "flame",
  );
  expect(
    await page.locator('[data-form="smoke"]').getAttribute("aria-pressed"),
  ).toBe("true");
  await fighter(page, "demonic");
  await page.locator("#extra-skill-1").tap();
  expect(await page.evaluate(() => __arena.game.waves.at(-1).kind)).toBe(
    "sonic",
  );
  expect(
    await page.locator('[data-form="demonic"]').getAttribute("aria-pressed"),
  ).toBe("true");
  await fighter(page, "earth");
  await expect(page.locator("#charge-btn")).toBeHidden();
  await expect(page.locator("#utility-name")).toHaveText("Rock shield");
});
