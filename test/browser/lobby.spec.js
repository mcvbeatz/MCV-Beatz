import { test, expect } from "@playwright/test";
import { createLobbyServer } from "../../server/index.js";
let service, url;
test.beforeAll(async () => {
  service = createLobbyServer({
    verifyUser: async (token) => ({
      id: token,
      user_metadata: { username: token },
    }),
  });
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  url = `ws://127.0.0.1:${service.server.address().port}`;
});
test.afterAll(async () => service.close());
async function ready(page, id = null) {
  await page.route("**/app-config.json", (route) =>
    route.fulfill({ json: { multiplayerUrl: url } }),
  );
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation: "portrait", music: 0, sfx: 0 }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  if (id)
    await page.evaluate((id) => {
      __app.account.user = {
        id,
        user_metadata: {
          username: id,
          default_element: id === "Alice" ? "water" : "dark",
        },
      };
      __app.account.client = {
        auth: {
          getSession: async () => ({ data: { session: { access_token: id } } }),
        },
        rpc: async () => ({ error: null }),
        from: () => {
          throw new Error(
            "Local browser test: private progress stays on device",
          );
        },
      };
    }, id);
}
test("lobby has four controls beside movement, hidden settings, maximum seats, and selectable forms/cosmetics", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-screen=play]").click();
  await page.locator("[data-screen=team-battles]").click();
  await page.locator("[data-launch=ffa]").click();
  await expect(page.locator("#lobby-status")).toContainText("AI-only lobby");
  await expect(page.locator("#lobby-panel")).toBeHidden();
  await expect(page.locator("#lobby-controls button")).toHaveCount(4);
  expect(await page.evaluate(() => __arena.game.mapId)).toBe("classic");
  await page.locator('[data-lobby-tab="players"]').click();
  await expect(page.locator("#lobby-panel .lobby-members li")).toHaveCount(8);
  await expect(page.locator("select[data-size]")).toHaveValue("8");
  await page.locator("[data-lobby-close]").click();
  await page.locator('[data-lobby-tab="elemental"]').click();
  await page.locator("select[data-element]").selectOption("light");
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.element))
    .toBe("light");
  await page.locator("[data-lobby-close]").click();
  const before = await page.evaluate(() => __arena.game.player.x);
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.x))
    .toBeGreaterThan(before);
  await page.keyboard.up("d");
  expect(
    await page.evaluate(() => __arena.game.fighters.every((a) => a.hp === 120)),
  ).toBe(true);
  await page.locator('[data-lobby-tab="cosmetics"]').click();
  await expect(page.locator('[data-cosmetic="aura"]')).toBeVisible();
  await page.locator("#leave-btn").click();
  await page.evaluate(() => __app.show("account"));
  await page.locator(".profile-name").click();
  await page.locator('[data-default="earth"]').click();
  await expect(page.locator(".default-picker [role=status]")).toContainText(
    "Default elemental saved",
  );
  await page.evaluate(() => __app.openLobby("ffa"));
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.element))
    .toBe("earth");
});

test("forced lobby forms override defaults and cannot be changed", async ({
  page,
}) => {
  await ready(page);
  for (const [mode, form] of [
    ["gridiron", "earth"],
    ["turnpike", "air"],
    ["corruption", "light"],
    ["zombies", "ice"],
  ]) {
    await page.evaluate((mode) => __app.openLobby(mode), mode);
    await expect(page.locator('[data-lobby-tab="elemental"]')).toBeDisabled();
    await expect(page.locator('[data-lobby-tab="elemental"]')).toContainText(
      form,
    );
    expect(
      await page.evaluate(() =>
        __arena.game.fighters.every(
          (a) => a.element === __arena.game.player.element,
        ),
      ),
    ).toBe(true);
    await page.evaluate(() =>
      __app.lobby.send({ kind: "profile", element: "fire" }),
    );
    await expect
      .poll(() => page.evaluate(() => __arena.game.player.element))
      .toBe(form);
  }
});

test("two browsers share Ready signs, captain countdown, manual results and a captain-started rematch", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const c1 = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    c2 = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const a = await c1.newPage(),
    b = await c2.newPage(),
    errors = [];
  a.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  try {
    await ready(a, "Alice");
    await ready(b, "Bob");
    await a.evaluate(() => __app.openLobby("tdm"));
    await b.evaluate(() => __app.openLobby("tdm"));
    await expect(a.locator("#lobby-status")).toContainText("You are captain");
    await expect(b.locator("#lobby-status")).toContainText("Captain: Alice");
    await a.locator('[data-lobby-tab="players"]').click();
    await b.locator('[data-lobby-tab="players"]').click();
    await expect(a.locator(".lobby-members")).toContainText("Bob");
    await expect(b.locator("select[data-size]")).toBeDisabled();
    await a.locator("select[data-size]").selectOption("6");
    await expect(b.locator(".lobby-members li")).toHaveCount(6);
    await a.locator("[data-lobby-close]").click();
    await b.locator("[data-lobby-close]").click();
    await a.evaluate(() => {
      const ctx = __arena.renderer.ctx,
        paint = ctx.fillText.bind(ctx);
      ctx.fillText = (text, ...args) => {
        if (text === "Ready!") window.sawReadySign = true;
        return paint(text, ...args);
      };
    });
    await b.locator("[data-start]").click();
    await expect
      .poll(() =>
        a.evaluate(() =>
          __arena.game.fighters.some(
            (f) => f.displayName === "Bob" && f.lobbyReady,
          ),
        ),
      )
      .toBe(true);
    await expect.poll(() => a.evaluate(() => !!window.sawReadySign)).toBe(true);
    expect(await b.evaluate(() => __app.lobby.state.phase)).toBe("lobby");
    await a.locator("[data-start]").click();
    await expect(a.locator("#lobby-countdown strong")).toHaveText("5");
    await expect(b.locator("#lobby-countdown")).toContainText(
      "Starting together",
    );
    await expect
      .poll(() => a.evaluate(() => __app.lobby.state.phase), { timeout: 10000 })
      .toBe("battle");
    await expect
      .poll(() => b.evaluate(() => __app.lobby.state.phase))
      .toBe("battle");
    expect(await a.evaluate(() => __app.lobby.state.roundId)).toBe(
      await b.evaluate(() => __app.lobby.state.roundId),
    );
    const id = await b.evaluate(() => __arena.game.player.id),
      x = await b.evaluate(() => __arena.game.player.x);
    await b.keyboard.down("d");
    await expect
      .poll(() =>
        a.evaluate(
          (id) => __arena.game.fighters.find((f) => f.id === id).x,
          id,
        ),
      )
      .toBeGreaterThan(x);
    await b.keyboard.up("d");
    const room = [...service.rooms.values()].find((r) =>
      r.members.has("Alice"),
    );
    room.game.fell(room.game.fighters.find((f) => f.id === id));
    await expect
      .poll(() => b.evaluate(() => __arena.game.player.alive))
      .toBe(false);
    await b.keyboard.down("d");
    await expect
      .poll(() =>
        b.evaluate(
          () => (__arena.game.spectatorFocus?.x || 0) - __arena.game.player.x,
        ),
      )
      .toBeGreaterThan(10);
    await b.keyboard.up("d");
    room.game.finish(0, "Synchronized results");
    room.game.celebrationRemaining = 0;
    await expect(a.locator("#match-report")).toBeVisible();
    await expect(b.locator("#match-report")).toBeVisible();
    room.deadline = Date.now() + 19500;
    await expect
      .poll(() => a.evaluate(() => __app.lobby.remaining()))
      .toBeLessThan(20);
    await expect(a.locator("#game-overlay")).toHaveAttribute(
      "data-report-stage",
      "0",
    );
    await a.locator("[data-next]").click();
    room.deadline = Date.now() + 9500;
    await expect
      .poll(() => b.evaluate(() => __app.lobby.remaining()))
      .toBeLessThan(10);
    await expect(a.locator("#game-overlay")).toHaveAttribute(
      "data-report-stage",
      "1",
    );
    await expect(b.locator("#game-overlay")).toHaveAttribute(
      "data-report-stage",
      "0",
    );
    await a.locator("[data-next]").click();
    await expect(a.locator("#game-overlay")).toHaveAttribute(
      "data-report-stage",
      "2",
    );
    const old = room.roundId;
    room.deadline = Date.now() + 150;
    await expect
      .poll(() => a.evaluate(() => __app.lobby.state.phase))
      .toBe("lobby");
    await expect(b.locator("#game-overlay")).toBeHidden();
    expect(room.deadline).toBeNull();
    await b.locator("[data-start]").click();
    await expect.poll(() => room.members.get("Bob").ready).toBe(true);
    expect(room.phase).toBe("lobby");
    await a.locator("[data-start]").click();
    await expect
      .poll(() => b.evaluate(() => __app.lobby.state.phase))
      .toBe("countdown");
    room.deadline = Date.now() + 150;
    await expect
      .poll(() => b.evaluate(() => __app.lobby.state.roundId))
      .not.toBe(old);
    await a.evaluate(() => __app.show("home"));
    await expect.poll(() => room.captain).toBe("Bob");
    expect(errors).toEqual([]);
  } finally {
    await c1.close();
    await c2.close();
  }
});
test("joystick releases outside its element, on capture loss and after returning to the page", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => __app.chooseMode("duel"));
  await page.locator("#begin-btn").click();
  const position = await page.locator("#joystick").boundingBox();
  await page.mouse.move(
    position.x + position.width / 2,
    position.y + position.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    position.x + position.width * 0.8,
    position.y + position.height / 2,
  );
  expect(await page.evaluate(() => __arena.stick.pointer)).not.toBe(null);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: __arena.stick.pointer }),
    ),
  );
  expect(await page.evaluate(() => __arena.stick)).toMatchObject({
    pointer: null,
    x: 0,
    y: 0,
  });
  await page.mouse.up();
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.locator("#stick-thumb")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("rotated phone lobby keeps touch scrolling and captain controls usable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await ready(page);
  await page.evaluate(async () => {
    const { setOrientation } = await import("/src/orientation.js");
    __app.settings.orientation = "landscape";
    setOrientation("landscape");
    await __app.openLobby("gridiron");
  });
  await page.locator('[data-lobby-tab="players"]').tap();
  await expect(page.locator("#lobby-panel")).toBeVisible();
  const points = await page.locator("#lobby-panel").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      from: { x: r.left + 20, y: r.top + 20 },
      to: { x: r.right - 20, y: r.top + 20 },
    };
  });
  const cdp = await context.newCDPSession(page);
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
          y: points.from.y,
        },
      ],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => page.locator("#lobby-panel").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(25);
  await page.locator("#lobby-panel").evaluate((el) => (el.scrollTop = 0));
  await page.locator("[data-lobby-close]").tap();
  await page.locator("[data-start]").tap();
  await expect
    .poll(() => page.evaluate(() => __app.lobby.state.phase))
    .toBe("countdown");
  await context.close();
});
