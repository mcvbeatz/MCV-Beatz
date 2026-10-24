import { test, expect } from "@playwright/test";
async function begin(page, { mode = "duel", element = "fire" } = {}) {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  if (mode !== "duel")
    await page.evaluate((mode) => __app.chooseMode(mode), mode);
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
test("fused selector shows nine level-two elements and Mirror exposes shield and healing without switching", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.evaluate(() => __app.chooseMode("fused"));
  await expect(page.locator("[data-element]")).toHaveCount(9);
  await expect(page.locator('[data-element="fire"]')).toHaveCount(0);
  await page.locator('[data-element="mirror"]').click();
  await page.locator("#begin-btn").click();
  await stillRival(page);
  await expect(page.locator("[data-form]")).toHaveCount(3);
  await expect(page.locator("#charge-btn")).toBeHidden();
  await expect(page.locator("#utility-btn")).toBeHidden();
  await expect(page.locator("#passive-note")).toBeHidden();
  await expect(page.locator("#extra-skill-0")).toContainText("Rock shield");
  await expect(page.locator("#extra-skill-1")).toContainText("Healing");
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
test("passive teleport uses world taps with an informational button and no cooldown", async ({
  page,
}) => {
  await begin(page, { mode: "fused", element: "gravity" });
  await stillRival(page);
  await page.evaluate(() =>
    __arena.game.applyFusion(__arena.game.player, ["light"], { burst: false }),
  );
  await expect(page.locator('[data-form="multi-dimensional"]')).toBeVisible();
  await expect(page.locator("#utility-btn")).toBeHidden();
  await expect(page.locator("#charge-btn")).toBeHidden();
  await expect(page.locator("#teleport-info-btn")).toBeVisible();
  const before = await page.evaluate(() => ({
    x: __arena.game.player.x,
    y: __arena.game.player.y,
  }));
  await page.locator("#teleport-info-btn").click();
  expect(
    await page.evaluate(() => ({
      x: __arena.game.player.x,
      y: __arena.game.player.y,
    })),
  ).toEqual(before);
  await worldTap(page, 480, 340);
  await expect
    .poll(() => page.evaluate(() => Math.round(__arena.game.player.x)))
    .toBe(480);
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
test("arena taps prepare a bounded, vulnerable teleport before arrival", async ({
  page,
}) => {
  await begin(page, { mode: "fused3", element: "multi-dimensional" });
  await stillRival(page);
  await page.evaluate(() => {
    const g = __arena.game;
    g.player.x = 330;
    g.player.y = 340;
    window.balanceStep = g.update.bind(g);
    g.update = () => {};
  });
  await worldTap(page, 800, 340);
  const pending = await page.evaluate(() => ({
    x: __arena.game.player.x,
    blink: __arena.game.player.blink,
  }));
  expect(pending.x).toBe(330);
  expect(pending.blink.x).toBeCloseTo(510, 0);
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) balanceStep(0.05, { x: 1, y: 0 }, false);
  });
  expect(await page.evaluate(() => __arena.game.player.x)).toBe(330);
  await page.evaluate(() => {
    const g = __arena.game;
    g.damage(g.fighters[1], g.player, 14);
    balanceStep(0.05, { x: 0, y: 0 }, false);
  });
  expect(await page.evaluate(() => __arena.game.player.hp)).toBeLessThan(120);
  expect(await page.evaluate(() => __arena.game.player.x)).toBeCloseTo(510, 0);
  expect(await page.evaluate(() => __arena.game.player.blink)).toBe(null);
  await worldTap(page, 690, 340);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) balanceStep(0.05, { x: 0, y: 0 }, false);
  });
  expect(await page.evaluate(() => __arena.game.player.x)).toBeCloseTo(690, 0);
});
test("portal taps enforce clearance and a harmless opening warning", async ({
  page,
}) => {
  await begin(page, { mode: "fused", element: "spirit" });
  await stillRival(page);
  await page.evaluate(() => {
    const g = __arena.game;
    g.player.x = 330;
    g.player.y = 340;
    g.update = () => {};
  });
  await page.locator("#utility-btn").click();
  await worldTap(page, 330, 340);
  expect(await page.evaluate(() => __arena.game.portals.portals.length)).toBe(
    0,
  );
  await worldTap(page, 460, 340);
  expect(await page.evaluate(() => __arena.game.portals.portals.length)).toBe(
    1,
  );
  expect(
    await page.evaluate(() =>
      __arena.game.portals.active(__arena.game.portals.portals[0]),
    ),
  ).toBe(false);
  await page.evaluate(() => {
    Object.assign(__arena.game.fighters[1], { x: 460, y: 340 });
  });
  await worldTap(page, 460, 340);
  expect(await page.evaluate(() => __arena.game.portals.portals.length)).toBe(
    0,
  );
  expect(await page.evaluate(() => __arena.game.fighters[1].alive)).toBe(true);
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
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.tagName))
    .toBe("HTML");
  await page.locator("#fullscreen-btn").click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  expect(await page.evaluate(() => __arena.immersive)).toBe(false);
});

test("level III selector starts each fusion and Divine retains an owner-only silhouette at rest", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.evaluate(() => __app.chooseMode("fused3"));
  await expect(page.locator("[data-element]")).toHaveCount(5);
  await expect(page.locator(".tier")).toHaveText("III");
  for (const element of [
    "demonic",
    "divine",
    "multi-dimensional",
    "lightning",
    "invincible",
  ])
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
  expect(pixels.hiddenDifference).toBeGreaterThan(0);
  expect(pixels.actionDifference).toBeGreaterThan(0);
});

test("Blaze has a repeatable zero-cooldown dash and Smoke retains Vog", async ({
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
        "#teleport-info-btn",
        "#skill-switcher",
      ]) {
        const b = await page.locator(selector).boundingBox();
        expect(b.x).toBeGreaterThanOrEqual(-1);
        expect(b.y).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.width).toBeLessThanOrEqual(size.width + 1);
        expect(b.y + b.height).toBeLessThanOrEqual(size.height + 1);
      }
      await worldTap(page, 470, 350);
      await expect
        .poll(() => page.evaluate(() => Math.round(__arena.game.player.x)))
        .toBe(470);
      await page.locator('[data-form="light"]').click();
      await expect(page.locator("#ability-name")).toHaveText("Healing");
      await page.locator('[data-form="multi-dimensional"]').click();
    }
  });
});

test("Lightning fires on press without charging and Invincible exposes inherited skills", async ({
  page,
}) => {
  await begin(page, { mode: "fused3", element: "lightning" });
  await stillRival(page);
  await page.evaluate(() => {
    const g = __arena.game,
      b = g.fighters[1];
    b.element = "earth";
    b.parts = ["earth"];
    b.x = g.player.x + 180;
    b.y = g.player.y;
  });
  await expect(page.locator("#ability-name")).toHaveText("Lightning strikes");
  await expect(page.locator("#ability-status")).toContainText("instant");
  const btn = await page.locator("#charge-btn").boundingBox();
  await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => __arena.game.fighters[1].hp))
    .toBeLessThan(120);
  await expect(page.locator("#charge-meter")).toBeHidden();
  const health = await page.evaluate(() => __arena.game.fighters[1].hp);
  await page.mouse.up();
  expect(await page.evaluate(() => __arena.game.fighters[1].hp)).toBe(health);
  expect(
    await page.evaluate(() => __arena.game.player.abilityCd),
  ).toBeGreaterThan(0);
  await begin(page, { mode: "fused3", element: "invincible" });
  await stillRival(page);
  await expect(page.locator("#charge-btn")).toBeHidden();
  await expect(page.locator("#utility-btn")).toBeHidden();
  await expect(page.locator("#passive-note")).toContainText("2× strength");
  await page.locator('[data-form="fire"]').click();
  await expect(page.locator("#ability-name")).toHaveText("Flamethrower");
  expect(await page.evaluate(() => __arena.game.player.element)).toBe(
    "invincible",
  );
});

test("Divine hit feedback draws a faint clue, then the canvas returns to hidden", async ({
  page,
}) => {
  await begin(page, { mode: "fused3", element: "divine" });
  await stillRival(page);
  const result = await page.evaluate(() => {
    const { game: g, renderer: r } = __arena,
      a = g.player;
    g.player = g.fighters[1]; // View Divine as an opponent.
    a.reveal = 0;
    a.movingTime = 0;
    a.hurtReveal = 0;
    g.effects = [];
    g.events = [];
    const draw = () => {
      r.draw(g);
      return r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data;
    };
    const animationTime = g.time;
    const hidden = draw();
    g.damage(g.fighters[1], a, 14);
    const hurt = draw();
    g.update(0.2, { x: 0, y: 0 }, false); // Simulation caps individual time steps.
    for (let i = 0; i < 15; i++) g.update(0.01, { x: 0, y: 0 }, false);
    // Compare at the same animation time so torch flicker and flying bobbing
    // cannot be mistaken for a lingering Divine silhouette.
    g.time = animationTime;
    const faded = draw();
    return {
      hint: hurt.some((v, i) => v !== hidden[i]),
      hiddenAgain: faded.every((v, i) => v === hidden[i]),
    };
  });
  expect(result).toEqual({ hint: true, hiddenAgain: true });
});
