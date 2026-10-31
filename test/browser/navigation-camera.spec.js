import { test, expect } from "@playwright/test";
async function ready(page, orientation = "portrait") {
  await page.addInitScript((orientation) => {
    localStorage.setItem("elemental-settings", JSON.stringify({ orientation }));
    HTMLElement.prototype.requestFullscreen = undefined;
  }, orientation);
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
async function start(page, mode, element) {
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator(`[data-element="${element}"]`).click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.ai = () => {};
    g.update = () => {};
    g.portals.portals = [];
    g.portals.placing = null;
    g.player.dimension = g.player.transit = null;
    g.player.x = 500;
    g.player.y = 350;
    g.fighters
      .filter((a) => a !== g.player)
      .forEach((a) => {
        a.x = 850;
        a.y = 500;
      });
  });
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
async function world(page, x, y) {
  return page.evaluate(
    ({ x, y }) => {
      const v = __arena.renderer.view,
        r = document.getElementById("game").getBoundingClientRect(),
        angle = getComputedStyle(document.documentElement)
          .getPropertyValue("--app-rotation")
          .trim();
      const lx = x * v.scale + v.tx,
        ly = y * v.scale + v.ty;
      return angle === "90deg"
        ? { x: r.right - ly, y: r.top + lx }
        : angle === "-90deg"
          ? { x: r.left + ly, y: r.bottom - lx }
          : { x: r.left + lx, y: r.top + ly };
    },
    { x, y },
  );
}
test("Play has ordered Team/Solo lists, native scrolling and Quick Match across both categories", async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await ready(page, "landscape");
  await page.locator('[data-screen="play"]').click();
  await expect(page.locator(".battle-categories button")).toHaveCount(3);
  await page.locator('[data-screen="team-battles"]').click();
  expect(
    await page
      .locator("[data-launch]")
      .evaluateAll((es) => es.map((e) => e.dataset.launch)),
  ).toEqual([
    "tdm",
    "war",
    "rush",
    "boss",
    "domination",
    "gauntlet-team",
    "ctf",
  ]);
  expect(
    await page
      .locator(".mode-scroll")
      .evaluate((e) => e.scrollHeight > e.clientHeight),
  ).toBe(true);
  await expect(page.locator("#mode-next")).toHaveCount(0);
  const rows = await page
    .locator(".mode-card")
    .evaluateAll((es) =>
      es.map((e) => ({ width: e.clientWidth, height: e.clientHeight })),
    );
  expect(rows.every((r) => r.width > 490 && r.height < 90)).toBe(true);
  await page.locator('[data-launch="boss"]').click();
  await expect(page.locator("#setup-mode-title")).toHaveText("Boss");
  await page.locator("#change-mode-btn").click();
  await expect(page.locator('[data-launch="boss"]')).toHaveCount(1);
  await page.locator("#shell-back").click();
  await page.locator('[data-screen="solo-battles"]').click();
  expect(
    await page
      .locator("[data-launch]")
      .evaluateAll((es) => es.map((e) => e.dataset.launch)),
  ).toEqual(["ffa", "roulette", "gauntlet", "corruption"]);
  await expect(page.locator('[data-launch="gauntlet"] strong')).toHaveText(
    "Solo Waves",
  );
  for (const [random, mode, group] of [
    [0, "tdm", "team-battles"],
    [0.99, "corruption", "solo-battles"],
  ]) {
    await page.evaluate(() => __app.show("play"));
    await page.evaluate((v) => {
      window.savedRandom = Math.random;
      Math.random = () => v;
    }, random);
    await page.locator("#quick-match").click();
    await page.evaluate(() => (Math.random = window.savedRandom));
    expect(await page.evaluate(() => __arena.game.mode)).toBe(mode);
    await page.locator("#change-mode-btn").click();
    expect(await page.evaluate(() => __app.screen)).toBe(group);
  }
});
test("Leave is prominent from battle start and returns to the same setup before and after victory", async ({
  page,
}) => {
  await ready(page);
  await start(page, "fused", "mirror");
  await expect(page.locator("#leave-btn")).toHaveText("Leave →");
  await expect(page.locator("#leave-btn")).toHaveClass(/match-leave/);
  await page.locator("#leave-btn").click();
  await expect(page.locator("#setup-mode-title")).toHaveText("Fused II Duel");
  await expect(page.locator("#resume-btn")).toBeVisible();
  await expect(page.locator('[data-element="mirror"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#resume-btn").click();
  await page.evaluate(() =>
    __arena.game.finish(__arena.game.player.team, "test"),
  );
  await page.locator("#leave-btn").click();
  await expect(page.locator("#setup-mode-title")).toHaveText("Fused II Duel");
  await expect(page.locator("#resume-btn")).toBeHidden();
});
test("element cards keep identical proportions across orientation changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.evaluate(() => __app.chooseMode("fused3"));
  const portrait = await page
    .locator("[data-element]")
    .first()
    .evaluate((e) => ({ w: e.offsetWidth, h: e.offsetHeight }));
  await page.evaluate(() => __app.show("settings"));
  await page.locator("#orientation-setting").selectOption("landscape");
  await page.evaluate(() => __app.chooseMode("fused3"));
  const landscape = await page
    .locator("[data-element]")
    .first()
    .evaluate((e) => ({ w: e.offsetWidth, h: e.offsetHeight }));
  expect(landscape).toEqual(portrait);
  expect(landscape).toEqual({ w: 90, h: 75 });
});
test("portrait separates controls, zooms fighters and follows the player while clamping the map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await start(page, "fused3", "demonic");
  const canvas = await page.locator("#game").boundingBox(),
    stick = await page.locator("#joystick").boundingBox(),
    strike = await page.locator("#attack-btn").boundingBox(),
    skills = await page.locator(".skill-controls").boundingBox();
  expect(stick.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
  expect(strike.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
  expect(skills.y).toBeGreaterThan(stick.y + stick.height);
  expect(skills.width).toBeGreaterThan(350);
  expect(stick.x + stick.width / 2).toBeLessThan(195);
  expect(strike.x + strike.width / 2).toBeGreaterThan(195);
  const before = await page.evaluate(() => __arena.renderer.view);
  expect(before.scale).toBeGreaterThanOrEqual(350 / 530);
  await page.evaluate(() => (__arena.game.player.x = 550));
  await page.waitForTimeout(50);
  const after = await page.evaluate(() => __arena.renderer.view);
  expect(after.tx).toBeLessThan(before.tx);
  await page.evaluate(() => (__arena.game.player.x = 135));
  await page.waitForTimeout(50);
  let v = await page.evaluate(() => __arena.renderer.view);
  expect(-v.tx / v.scale).toBeCloseTo(95, 5);
  await page.evaluate(() => (__arena.game.player.x = 889));
  await page.waitForTimeout(50);
  v = await page.evaluate(() => __arena.renderer.view);
  expect((390 - v.tx) / v.scale).toBeCloseTo(929, 5);
  await page.screenshot({ path: "/tmp/v14-portrait-layout.png" });
});
test("portrait camera keeps portal taps, teleport destinations and enemy swipes aligned in both phone positions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await start(page, "fused", "spirit");
    await page.locator("#utility-btn").click();
    for (const [x, y] of [
      [580, 300],
      [430, 450],
    ]) {
      const p = await world(page, x, y);
      await page.mouse.click(p.x, p.y);
    }
    const portals = await page.evaluate(() =>
      __arena.game.portals.portals.map((p) => ({ x: p.x, y: p.y })),
    );
    expect(portals).toHaveLength(2);
    expect(portals[0].x).toBeCloseTo(580, 0);
    expect(portals[1].y).toBeCloseTo(450, 0);
    await start(page, "fused3", "multi-dimensional");
    let p = await world(page, 590, 320);
    await page.mouse.click(p.x, p.y);
    const blink = await page.evaluate(() => __arena.game.player.blink);
    expect(blink.x).toBeCloseTo(590, 0);
    expect(blink.y).toBeCloseTo(320, 0);
    await start(page, "fused", "gravity");
    await page.evaluate(() =>
      Object.assign(__arena.game.fighters[1], { x: 580, y: 350 }),
    );
    p = await world(page, 580, 350);
    const end = await world(page, 630, 310);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await page.mouse.up();
    const k = await page.evaluate(() => ({
      x: __arena.game.fighters[1].knockX,
      y: __arena.game.fighters[1].knockY,
    }));
    expect(k.x).toBeGreaterThan(0);
    expect(k.y).toBeLessThan(0);
  }
});
test("element library opens only the chosen chapter; Controls uses distinct action screenshots and Home uses battle icons", async ({
  page,
}) => {
  await ready(page);
  const symbols = await page.locator(".home-elements span").evaluateAll((es) =>
    es.map((e) => ({
      name: e.title,
      shape: e.querySelector("svg").innerHTML,
    })),
  );
  expect(symbols).toHaveLength(6);
  const expected = await page.evaluate(async () => {
    const { icon } = await import("/src/icons.js");
    return ["light", "dark", "water", "air", "earth", "fire"].map((e) => {
      const el = document.createElement("div");
      el.innerHTML = icon(e);
      return el.querySelector("svg").innerHTML;
    });
  });
  expect(symbols.map((s) => s.shape)).toEqual(expected);
  await page.evaluate(() => __app.show("tutorial"));
  await page.locator("#tutorial-elements").click();
  await expect(page.locator("[data-chapter]")).toHaveCount(23);
  await page.locator('[data-chapter="lightning"]').click();
  await expect(page.locator("#slide-title")).toHaveText("Lightning");
  while (await page.locator("#slide-next").isEnabled()) {
    await page.locator("#slide-next").click();
    await expect(page.locator("#slide-title")).toContainText("Lightning");
  }
  await page.locator("#slides-close").click();
  await expect(page.locator('[data-chapter="water"]')).toBeVisible();
  await page.locator("#shell-back").click();
  await page.locator("#tutorial-controls").click();
  const images = [];
  while (true) {
    await expect
      .poll(() =>
        page
          .locator("#slide-screenshot")
          .evaluate((i) => i.complete && i.naturalWidth > 0),
      )
      .toBe(true);
    images.push(await page.locator("#slide-screenshot").getAttribute("src"));
    if (!(await page.locator("#slide-next").isEnabled())) break;
    await page.locator("#slide-next").click();
  }
  expect(images).toHaveLength(9);
  expect(images).toEqual(
    [
      "move",
      "strike",
      "skills",
      "switch",
      "fusion",
      "portals",
      "teleport",
      "telekinesis",
      "settings",
    ].map((name) => `/guides/control-${name}.png`),
  );
  await expect(page.locator("#slide-body")).toContainText(
    "Leave returns to battle setup",
  );
});

test("compact mode lists scroll with touch in normal and rotated landscape", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 568, height: 320 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await ready(page, "landscape");
  const client = await context.newCDPSession(page);
  for (const viewport of [
    { width: 568, height: 320 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => __app.show("team-battles"));
    await page.waitForTimeout(80);
    const points = await page.locator(".mode-scroll").evaluate((el) => {
      const r = el.getBoundingClientRect(),
        x = el.clientWidth / 2,
        start = el.clientHeight - 20,
        end = 20;
      const rotated =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--app-rotation")
          .trim() === "90deg";
      return rotated
        ? {
            from: { x: r.right - start, y: r.top + x },
            to: { x: r.right - end, y: r.top + x },
          }
        : {
            from: { x: r.left + x, y: r.top + start },
            to: { x: r.left + x, y: r.top + end },
          };
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, ...points.from }],
    });
    for (let i = 1; i <= 10; i++) {
      await client.send("Input.dispatchTouchEvent", {
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
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => page.locator(".mode-scroll").evaluate((e) => e.scrollTop))
      .toBeGreaterThan(60);
    await page.locator('[data-launch="boss"]').tap();
    await expect(page.locator("#setup-mode-title")).toHaveText("Boss");
  }
  await client.detach();
  await context.close();
});

test("telekinesis swipe direction stays screen-relative while the portrait camera follows movement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await start(page, "fused", "gravity");
  await page.evaluate(() =>
    Object.assign(__arena.game.fighters[1], { x: 580, y: 350 }),
  );
  const p = await world(page, 580, 350);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.evaluate(() => (__arena.game.player.x = 550));
  await page.waitForTimeout(80);
  await page.mouse.move(p.x, p.y - 60, { steps: 4 });
  await page.mouse.up();
  const push = await page.evaluate(() => ({
    x: __arena.game.fighters[1].knockX,
    y: __arena.game.fighters[1].knockY,
  }));
  expect(push.x).toBeCloseTo(0, 5);
  expect(push.y).toBeCloseTo(-520, 5);
});

test("rotated character pickers, chapter lists and chapter swipes remain usable with real touch", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await ready(page, "landscape");
  const client = await context.newCDPSession(page);
  async function swipe(selector, axis) {
    const points = await page.locator(selector).evaluate((el, axis) => {
      const r = el.getBoundingClientRect(),
        w = el.clientWidth,
        h = el.clientHeight;
      const from =
          axis === "x" ? { x: w - 25, y: h / 2 } : { x: w / 2, y: h - 20 },
        to = axis === "x" ? { x: 25, y: h / 2 } : { x: w / 2, y: 20 };
      return {
        from: { x: r.right - from.y, y: r.top + from.x },
        to: { x: r.right - to.y, y: r.top + to.x },
      };
    }, axis);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, ...points.from }],
    });
    for (let i = 1; i <= 10; i++) {
      await client.send("Input.dispatchTouchEvent", {
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
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  await page.evaluate(() => __app.chooseMode("fused"));
  const before = await page.locator("#profile-name").textContent();
  await swipe("#element-grid", "x");
  expect(
    await page.locator("#element-grid").evaluate((e) => e.scrollLeft),
  ).toBeGreaterThan(100);
  await expect(page.locator("#profile-name")).toHaveText(before);
  await page.locator('[data-element="apparition"]').tap();
  await expect(page.locator("#profile-name")).toHaveText("Apparition");
  await page.evaluate(() => __app.show("elements"));
  await swipe(".element-library", "y");
  expect(
    await page.locator(".element-library").evaluate((e) => e.scrollTop),
  ).toBeGreaterThan(100);
  expect(await page.evaluate(() => __app.slidesOpen)).toBe(false);
  await page.locator('[data-chapter="lightning"]').tap();
  await expect(page.locator("#slide-count")).toHaveText("1 / 4");
  await swipe("#slide-card", "x");
  await expect(page.locator("#slide-count")).toHaveText("2 / 4");
  await page.locator("#slides-close").tap();
  await client.detach();
  await context.close();
});
