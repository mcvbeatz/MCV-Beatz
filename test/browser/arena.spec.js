import { test, expect } from "@playwright/test";
async function begin(page, { mode = "duel", element = "fire" } = {}) {
  await page.goto("/");
  if (mode !== "duel") await page.locator(`[data-mode="${mode}"]`).click();
  await page.locator(`[data-element="${element}"]`).click();
  await page.locator("#begin-btn").click();
}
async function stillRival(page) {
  await page.evaluate(() => {
    __arena.game.ai = () => {};
    for (const a of __arena.game.fighters)
      if (a.team === 1) {
        a.x = 820;
        a.y = 440;
        a.vx = a.vy = 0;
      }
  });
}
async function worldTap(page, x, y) {
  const p = await page.evaluate(
    ({ x, y }) => {
      const c = document.getElementById("game"),
        r = c.getBoundingClientRect(),
        v = __arena.renderer.view;
      const lx = x * v.scale + v.tx,
        ly = y * v.scale + v.ty;
      return __arena.immersive && innerHeight > innerWidth
        ? { x: r.right - ly, y: r.top + lx }
        : { x: r.left + lx, y: r.top + ly };
    },
    { x, y },
  );
  await page.mouse.click(p.x, p.y);
}
test("automatic locking, keyboard movement, charging and pause", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await begin(page);
  await stillRival(page);
  await expect(page.locator("#lock-btn")).toHaveCount(0);
  await expect(page.locator("#fuse-btn")).toHaveCount(0);
  await page.evaluate(() => {
    const g = __arena.game;
    g.fighters[1].x = g.player.x + 55;
    g.fighters[1].y = g.player.y;
  });
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.lock))
    .toBe("enemy-0");
  const x = await page.evaluate(() => __arena.game.player.x);
  await page.keyboard.down("a");
  await page.waitForTimeout(300);
  await page.keyboard.up("a");
  expect(await page.evaluate(() => __arena.game.player.x)).toBeLessThan(x);
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.lock))
    .toBe(null);
  await page.keyboard.down("k");
  await expect(page.locator("#charge-meter")).toBeVisible();
  await page.keyboard.up("k");
  await expect(page.locator("#charge-meter")).toBeHidden();
  expect(
    await page.evaluate(() => __arena.game.player.abilityCd),
  ).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Battle paused.")).toBeVisible();
  const time = await page.evaluate(() => __arena.game.time);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => __arena.game.time)).toBe(time);
  await page.getByRole("button", { name: "Resume battle" }).click();
  expect(errors).toEqual([]);
});
test("fused selector shows nine level-two elements and Mirror has no active skill buttons", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="fused"]').click();
  await expect(page.locator("[data-element]")).toHaveCount(9);
  await expect(page.locator('[data-element="fire"]')).toHaveCount(0);
  await page.locator('[data-element="mirror"]').click();
  await page.locator("#begin-btn").click();
  await stillRival(page);
  await expect(page.locator("[data-form]")).toHaveCount(3);
  await expect(page.locator("#charge-btn")).toBeHidden();
  await expect(page.locator("#utility-btn")).toBeHidden();
  await expect(page.locator("#passive-note")).toContainText(
    "Reflect is always active",
  );
  await page.locator('[data-form="earth"]').click();
  await expect(page.locator("#utility-name")).toHaveText("Rock shield");
  expect(await page.evaluate(() => __arena.game.player.element)).toBe("mirror");
  await page.locator('[data-form="light"]').click();
  await expect(page.locator("#ability-name")).toHaveText("Healing");
});
test("Spirit places portals with arena clicks and closes them by tapping", async ({
  page,
}) => {
  await begin(page, { mode: "fused", element: "spirit" });
  await stillRival(page);
  await page.locator("#utility-btn").click();
  await expect(page.locator("#portal-notice")).toBeVisible();
  await worldTap(page, 460, 320);
  await expect
    .poll(() => page.evaluate(() => __arena.game.portals.portals.length))
    .toBe(1);
  await worldTap(page, 650, 350);
  await expect
    .poll(() => page.evaluate(() => __arena.game.portals.portals.length))
    .toBe(2);
  await expect(page.locator("#portal-notice")).toBeHidden();
  await worldTap(page, 460, 320);
  await expect
    .poll(() => page.evaluate(() => __arena.game.portals.portals.length))
    .toBe(1);
});
test("passive teleport uses world taps with no cooldown and no button", async ({
  page,
}) => {
  await begin(page, { mode: "fused", element: "gravity" });
  await stillRival(page);
  await page.evaluate(() =>
    __arena.game.applyFusion(__arena.game.player, ["light"], { burst: false }),
  );
  await expect(page.locator('[data-form="multi-dimensional"]')).toBeVisible();
  await expect(page.locator("#utility-btn")).toBeHidden();
  await worldTap(page, 520, 340);
  await expect
    .poll(() => page.evaluate(() => Math.round(__arena.game.player.x)))
    .toBe(520);
  await worldTap(page, 390, 340);
  await expect
    .poll(() => page.evaluate(() => Math.round(__arena.game.player.x)))
    .toBe(390);
  expect(await page.evaluate(() => __arena.game.player.abilityCd)).toBe(0);
});
test("rock shield renders and persists through a long mouse hold", async ({
  page,
}) => {
  await begin(page, { element: "earth" });
  await stillRival(page);
  await page.locator("#utility-btn").hover();
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.shield))
    .toBe(1);
  await page.waitForTimeout(3200);
  expect(await page.evaluate(() => __arena.game.player.shield)).toBe(1);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.shield))
    .toBe(0);
  expect(
    await page.evaluate(() => __arena.game.player.utilityCd),
  ).toBeGreaterThan(0);
});
test.describe("phone controls", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      HTMLElement.prototype.requestFullscreen = undefined;
    });
  });
  test("landscape layout fits; two thumbs can move and charge simultaneously", async ({
    page,
  }) => {
    await begin(page);
    await stillRival(page);
    expect(await page.evaluate(() => __arena.immersive)).toBe(true);
    for (const id of [
      "joystick",
      "attack-btn",
      "charge-btn",
      "utility-btn",
      "skill-switcher",
      "pause-btn",
    ]) {
      const b = await page.locator("#" + id).boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(845);
      expect(b.y + b.height).toBeLessThanOrEqual(391);
    }
    const stick = await page.locator("#joystick").boundingBox(),
      skill = await page.locator("#charge-btn").boundingBox();
    const client = await page.context().newCDPSession(page);
    const first = {
        id: 1,
        x: stick.x + stick.width / 2,
        y: stick.y + stick.height / 2,
      },
      second = {
        id: 2,
        x: skill.x + skill.width / 2,
        y: skill.y + skill.height / 2,
      };
    const start = await page.evaluate(() => ({
      x: __arena.game.player.x,
      y: __arena.game.player.y,
    }));
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [first],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...first, x: first.x + 25, y: first.y - 20 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...first, x: first.x + 25, y: first.y - 20 }, second],
    });
    await expect(page.locator("#charge-meter")).toBeVisible();
    await page.waitForTimeout(250);
    const moved = await page.evaluate(() => ({
      x: __arena.game.player.x,
      y: __arena.game.player.y,
    }));
    expect(moved.x).toBeGreaterThan(start.x);
    expect(moved.y).toBeLessThan(start.y);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.locator("#charge-meter")).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => __arena.stick.pointer))
      .toBe(null);
    await client.detach();
  });
  test("portrait fallback rotates landscape controls and maps portal taps correctly", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await begin(page, { mode: "fused", element: "spirit" });
    await stillRival(page);
    const panel = await page.locator("#arena-panel").boundingBox();
    expect(panel.width).toBeCloseTo(390, 0);
    expect(panel.height).toBeCloseTo(844, 0);
    await page.locator("#utility-btn").click();
    await worldTap(page, 460, 320);
    await worldTap(page, 650, 350);
    expect(await page.evaluate(() => __arena.game.portals.portals.length)).toBe(
      2,
    );
    const first = await page.evaluate(() => __arena.game.portals.portals[0]);
    expect(first.x).toBeCloseTo(460, 0);
    expect(first.y).toBeCloseTo(320, 0);
    const b = await page.locator("#joystick").boundingBox(),
      client = await page.context().newCDPSession(page);
    const center = { id: 1, x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const x = await page.evaluate(() => __arena.game.player.x);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [center],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...center, y: center.y + 30 }],
    });
    await page.waitForTimeout(220);
    expect(await page.evaluate(() => __arena.game.player.x)).toBeGreaterThan(x);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await expect.poll(() => page.evaluate(() => __arena.stick.x)).toBe(0);
    await client.detach();
  });
  test("fullscreen fallback can return to setup without trapped input", async ({
    page,
  }) => {
    await begin(page);
    await page.locator("#leave-btn").click();
    await expect(page.locator("#arena-panel")).not.toHaveClass(/immersive/);
    await expect(page.locator(".setup-panel")).toBeInViewport();
    expect(await page.evaluate(() => __arena.paused)).toBe(true);
  });
});
test("native fullscreen enters and exits without leaving the game trapped", async ({
  page,
}) => {
  await begin(page);
  await page.locator("#fullscreen-btn").click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id))
    .toBe("arena-panel");
  await page.locator("#fullscreen-btn").click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  expect(await page.evaluate(() => __arena.immersive)).toBe(false);
});

test("level III selector starts each fusion and Divine disappears completely at rest", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="fused3"]').click();
  await expect(page.locator("[data-element]")).toHaveCount(3);
  await expect(page.locator(".tier")).toHaveText("III");
  for (const element of ["demonic", "divine", "multi-dimensional"])
    await expect(page.locator(`[data-element="${element}"]`)).toBeVisible();
  await page.locator('[data-element="divine"]').click();
  await page.locator("#begin-btn").click();
  await stillRival(page);
  await expect(page.locator("[data-form]")).toHaveCount(4);
  await expect(page.locator("#round-mode")).toContainText("FUSED III");
  const pixels = await page.evaluate(() => {
    const { game: g, renderer: r } = __arena,
      a = g.player;
    g.effects = [];
    g.events = [];
    a.reveal = 0;
    a.movingTime = 0;
    const draw = () => {
      r.draw(g);
      return r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data;
    };
    const hidden = draw();
    a.alive = false;
    const absent = draw();
    a.alive = true;
    a.reveal = 0.45;
    const acting = draw();
    a.reveal = 0;
    return {
      hiddenDifference: hidden.reduce(
        (n, v, i) => n + Number(v !== absent[i]),
        0,
      ),
      actionDifference: acting.reduce(
        (n, v, i) => n + Number(v !== absent[i]),
        0,
      ),
    };
  });
  expect(pixels.hiddenDifference).toBe(0);
  expect(pixels.actionDifference).toBeGreaterThan(0);
});

test("Blaze has a repeatable zero-cooldown dash and Smoke only exposes Vog", async ({
  page,
}) => {
  await begin(page, { mode: "fused", element: "blaze" });
  await stillRival(page);
  await expect(page.locator("#charge-btn")).toBeHidden();
  await expect(page.locator("#utility-name")).toHaveText("Speed burst");
  await page.evaluate(() => {
    __arena.game.player.utilityCd = 5;
  });
  await expect(page.locator("#utility-btn")).toBeEnabled();
  const x = await page.evaluate(() => __arena.game.player.x);
  await page.locator("#utility-btn").click();
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.x))
    .toBeGreaterThan(x + 120);
  await expect(page.locator("#utility-status")).toHaveText("0s cooldown");
  await expect(page.locator("#utility-btn")).toBeEnabled();
  await page.locator("#utility-btn").click();
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.x))
    .toBeGreaterThan(x + 250);
  await begin(page, { mode: "fused", element: "smoke" });
  await expect(page.locator("#ability-name")).toHaveText("Vog");
  await expect(page.locator("#utility-btn")).toBeHidden();
});

test.describe("level III phone controls", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  test("all four ability sets fit in landscape and portrait fallback", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      HTMLElement.prototype.requestFullscreen = undefined;
    });
    await begin(page, { mode: "fused3", element: "multi-dimensional" });
    await stillRival(page);
    for (const size of [
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await expect(page.locator("[data-form]")).toHaveCount(4);
      for (const selector of [
        "#joystick",
        "#attack-btn",
        "#charge-btn",
        "#skill-switcher",
      ]) {
        const b = await page.locator(selector).boundingBox();
        expect(b.x).toBeGreaterThanOrEqual(-1);
        expect(b.y).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.width).toBeLessThanOrEqual(size.width + 1);
        expect(b.y + b.height).toBeLessThanOrEqual(size.height + 1);
      }
      await worldTap(page, 580, 350);
      expect(await page.evaluate(() => __arena.game.player.x)).toBeCloseTo(
        580,
        0,
      );
      await page.locator('[data-form="light"]').click();
      await expect(page.locator("#ability-name")).toHaveText("Healing");
      await page.locator('[data-form="multi-dimensional"]').click();
    }
  });
});
