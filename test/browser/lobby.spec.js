import { test, expect } from "@playwright/test";
import { signedTestAccount } from "./local-lobby-service.js";
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
test("lobby has four controls beside movement, hidden player-settings panel, maximum seats, and selectable forms/cosmetics", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-screen=play]").click();
  await page.locator("[data-screen=team-battles]").click();
  await page.locator("[data-launch=ffa]").click();
  await expect(page.locator(".lobby-entry-actions button")).toHaveText([
    "Create Lobby",
    "Join Lobby",
    "Sign in",
  ]);
  await page.locator("[data-create]").click();
  await expect(page.locator("#lobby-status")).toContainText("Online lobby");
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
  await signedTestAccount(page);
  await page.evaluate(() => { __app.account.client.auth.updateUser = async () => ({error:null}); });
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
    const beforeReview = await b.evaluate(() =>
      JSON.stringify(__app.progressionStore().state),
    );
    await b.locator("#last-results-btn").click();
    await expect(b.locator("#last-results-panel")).toContainText(
      "Team Death Match",
    );
    await b.locator("#last-results-panel [data-next]").click();
    await expect(b.locator("#last-results-panel")).toContainText("Mastery XP");
    await b.locator("#last-results-panel [data-next]").click();
    await expect(
      b.locator("#last-results-panel .results-trophy"),
    ).toBeVisible();
    expect(
      await b.evaluate(() => JSON.stringify(__app.progressionStore().state)),
    ).toBe(beforeReview);
    await b.locator("#last-results-panel [data-close-results]").click();
    await b.locator("#last-results-btn").click();
    await b.locator("#last-results-panel [data-close-results]").click();
    expect(
      await b.evaluate(() => JSON.stringify(__app.progressionStore().state)),
    ).toBe(beforeReview);
    await b.locator("[data-start]").click();
    await expect.poll(() => room.members.get("Bob").ready).toBe(true);
    expect(room.phase).toBe("lobby");
    await b.locator("#last-results-btn").click();
    await a.locator("[data-start]").click();
    await expect(b.locator("#last-results-panel")).toBeHidden();
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

test("players choose captain-named lobbies; reducing capacity requires selected removals", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({ viewport: { width: 390, height: 844 } }),
    ),
  );
  const [a, b, c] = await Promise.all(contexts.map((ctx) => ctx.newPage()));
  const errors = [];
  for (const p of [a, b, c]) p.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const [p, id] of [
      [a, "Captain"],
      [b, "Joiner"],
      [c, "Visitor"],
    ]) {
      await ready(p, id);
      await p.evaluate(() => __app.show("team-battles"));
      await p.locator("[data-launch=ffa]").click();
      await expect(p.locator(".lobby-browser h1")).toContainText("Lobbies");
    }
    await a.locator("[data-create]").click();
    await expect(a.locator("#lobby-status")).toContainText("You are captain");
    for (const p of [b, c]) {
      await p.locator("[data-choose-join]").click();
      await p.locator("[data-refresh]").click();
      const row = p
        .locator(".open-lobby")
        .filter({ hasText: "Captain: Captain" });
      await expect(row).toContainText("players");
      await row.locator("[data-join]").click();
      await expect(p.locator("#lobby-status")).toContainText(
        "Captain: Captain",
      );
    }
    const room = [...service.rooms.values()].find((r) =>
      r.members.has("Captain"),
    );
    expect(room.members.size).toBe(3);
    await a.locator('[data-lobby-tab="players"]').click();
    await a.locator("select[data-size]").selectOption("2");
    await expect(a.locator(".lobby-kick-picker")).toContainText(
      "Choose 1 player",
    );
    await expect(a.locator("[data-size-confirm]")).toBeDisabled();
    await expect(a.locator("[data-start]")).toBeDisabled();
    expect(room.capacity).toBe(8);
    await a.locator("select[data-size]").selectOption("3");
    await expect(a.locator(".lobby-kick-picker")).toHaveCount(0);
    await expect.poll(() => room.capacity).toBe(3);
    expect(room.members.size).toBe(3);
    await a.locator("select[data-size]").selectOption("2");
    await a.locator('[data-kick="Visitor"]').check();
    await a.locator("[data-size-confirm]").click();
    await expect(c.locator(".lobby-browser-message")).toContainText(
      "removed you",
    );
    await expect.poll(() => room.capacity).toBe(2);
    expect([...room.members.keys()]).toEqual(["Captain", "Joiner"]);
    await c.locator("[data-choose-join]").click();
    const row = c
      .locator(".open-lobby")
      .filter({ hasText: "Captain: Captain" });
    await expect(row.locator("[data-join]")).toBeDisabled();
    await c.locator("[data-choose-back]").click();
    await c.locator("[data-create]").click();
    await expect(c.locator("#lobby-status")).toContainText("You are captain");
    expect(await c.evaluate(() => __app.lobby.state.roomId)).not.toBe(room.id);
    expect(errors).toEqual([]);
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
});

test("Quick Match joins an open online room and all guest multiplayer quick lobbies render the Colosseum", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
  });
  const a = await ctx.newPage(),
    b = await ctx.newPage();
  const errors = [];
  b.on("pageerror", (e) => errors.push(e.message));
  try {
    await ready(a, "QuickCaptain");
    await ready(b, "QuickJoiner");
    await a.evaluate(() => __app.openLobby("tdm"));
    await expect(a.locator("#lobby-controls")).toBeVisible();
    await b.evaluate(async () => {
      await __app.show("play");
      const original = Math.random;
      Math.random = () => 0;
      document.querySelector("#quick-match").click();
      Math.random = original;
    });
    await expect(b.locator("#lobby-status")).toContainText(
      "Captain: QuickCaptain",
    );
    expect(await b.evaluate(() => __app.lobby.state.roomId)).toBe(
      await a.evaluate(() => __app.lobby.state.roomId),
    );
    await a.evaluate(() => __app.show("play"));
    await b.evaluate(() => (__app.account.user = null));
    const modes = [
      "tdm",
      "war",
      "ctf",
      "ffa",
      "corruption",
      "gridiron",
      "turnpike",
      "zombies",
      "rush",
      "roulette",
      "gauntlet-team",
      "boss",
    ];
    for (let i = 0; i < modes.length; i++) {
      await b.evaluate(async (i) => {
        await __app.show("play");
        const original = Math.random;
        Math.random = () => (i + 0.1) / 12;
        document.querySelector("#quick-match").click();
        Math.random = original;
      }, i);
      await expect
        .poll(() => b.evaluate(() => __app.lobby?.state?.mode))
        .toBe(modes[i]);
      await expect(b.locator("#lobby-controls")).toBeVisible();
      const view = await b.evaluate(() => {
        const { game: g, renderer: r } = __arena;
        const pixels = r.ctx.getImageData(
          0,
          0,
          r.canvas.width,
          r.canvas.height,
        ).data;
        const colors = new Set();
        for (let i = 0; i < pixels.length; i += 400)
          colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
        return {
          map: g.mapId,
          actualMap: g.map,
          x: g.player.x,
          y: g.player.y,
          colors: colors.size,
          scale: r.view.scale,
        };
      });
      expect(view.map).toBe("classic");
      expect(view.actualMap).toBeNull();
      expect(Number.isFinite(view.scale)).toBe(true);
      expect(view.x).toBeGreaterThan(95);
      expect(view.y).toBeGreaterThan(100);
      expect(view.colors).toBeGreaterThan(25);
    }
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test("the open-lobby list scrolls by touch on a rotated phone", async ({
  browser,
}) => {
  const { LobbyRoom } = await import("../../src/lobby-room.js");
  const added = [];
  for (let i = 0; i < 8; i++) {
    const room = new LobbyRoom("ffa");
    room.join(`scroll-${i}`, `Captain ${i}`);
    service.rooms.set(room.id, room);
    added.push(room.id);
  }
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await ctx.newPage();
    await ready(page, "ScrollingViewer");
    await page.evaluate(async () => {
      __app.settings.orientation = "landscape";
      document.body.classList.remove("portrait-play");
      (await import("/src/orientation.js")).setOrientation("landscape");
      await __app.openLobby("ffa", false, { action: "browse" });
    });
    await page.locator("[data-choose-join]").click();
    await expect(page.locator(".open-lobby")).toHaveCount(8);
    const rect = await page.locator("#shell-content").boundingBox();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: rect.x + 30, y: rect.y + rect.height * 0.5 }],
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            id: 1,
            x: rect.x + 30 + ((rect.width - 60) * i) / 10,
            y: rect.y + rect.height * 0.5,
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
      .poll(() => page.locator("#shell-content").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(50);
  } finally {
    await ctx.close();
    for (const id of added) service.rooms.delete(id);
  }
});
