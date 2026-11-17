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
test("Multiplayer click opens an honest AI-only lobby, safe movement and selectable default/cosmetics", async ({
  page,
}) => {
  await ready(page);
  await page.locator("[data-screen=play]").click();
  await page.locator("[data-screen=team-battles]").click();
  await expect(page.locator("#shell-content h1")).toHaveText("Multiplayer");
  await page.locator("[data-launch=gridiron]").click();
  await expect(page.locator("#lobby-panel")).toContainText("AI-only lobby");
  await expect(page.locator("#lobby-panel .lobby-members li")).toHaveCount(8);
  expect(await page.evaluate(() => __arena.game.mapId)).toBe("classic");
  await page.locator("#lobby-panel [data-element]").selectOption("light");
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.element))
    .toBe("light");
  const before = await page.evaluate(() => __arena.game.player.x);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.x))
    .toBeGreaterThan(before);
  await page.keyboard.up("d");
  expect(
    await page.evaluate(() => __arena.game.fighters.every((a) => a.hp === 120)),
  ).toBe(true);
  await page.locator("#lobby-panel summary").click();
  await expect(page.locator("[data-cosmetic=aura]")).toBeVisible();
  await page.locator("[data-leave]").click();
  await page.locator("#shell-account").click();
  await page.locator(".profile-name").click();
  await page.locator("[data-default=earth]").click();
  await expect(page.locator(".default-picker [role=status]")).toHaveText(
    "Default elemental saved.",
  );
  await page.locator("[data-close]").click();
  await page.evaluate(() => __app.openLobby("ffa"));
  await expect
    .poll(() => page.evaluate(() => __arena.game.player.element))
    .toBe("earth");
});
test("two browsers share lobby, captain countdown, independent players, results and the same next round", async ({
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
    await expect(a.locator("#lobby-panel")).toContainText("You are captain");
    await b.evaluate(() => __app.openLobby("tdm"));
    await expect(b.locator("#lobby-panel")).toContainText("Captain: Alice");
    await expect(a.locator(".lobby-members")).toContainText("Bob");
    await expect(b.locator("[data-start]")).toBeDisabled();
    await a.locator("#lobby-panel [data-size]").selectOption("6");
    await expect(b.locator(".lobby-members li")).toHaveCount(6);
    await a.locator("[data-start]").click();
    await expect(b.locator("[data-lobby-clock]")).toContainText(
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
    expect(await a.evaluate(() => __arena.game.mapId)).not.toBe("classic");
    const id = await b.evaluate(() => __arena.game.player.id),
      x = await b.evaluate(() => __arena.game.player.x);
    await b.keyboard.down("d");
    await b.waitForTimeout(220);
    await b.keyboard.up("d");
    await expect
      .poll(() =>
        a.evaluate(
          (id) => __arena.game.fighters.find((f) => f.id === id).x,
          id,
        ),
      )
      .toBeGreaterThan(x);
    const room = [...service.rooms.values()].find((r) =>
      r.members.has("Alice"),
    );
    const remote = room.game.fighters.find((f) => f.id === id);
    room.game.fell(remote);
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
    room.game.finish(0, "Browser synchronized result");
    room.game.celebrationRemaining = 0;
    await expect(a.locator("#match-report")).toBeVisible();
    await expect(b.locator("#match-report")).toBeVisible();
    expect(await a.locator(".team-heading").first().textContent()).toContain(
      "Your team",
    );
    expect(
      await a.evaluate(() => __arena.game.progressReport.match.id),
    ).not.toBe(await b.evaluate(() => __arena.game.progressReport.match.id));
    room.deadline = Date.now() + 19500;
    await expect(a.locator("#game-overlay")).toHaveAttribute(
      "data-report-stage",
      "1",
    );
    await expect(b.locator("#game-overlay")).toHaveAttribute(
      "data-report-stage",
      "1",
    );
    room.deadline = Date.now() + 9500;
    await expect(a.locator("#game-overlay")).toHaveAttribute(
      "data-report-stage",
      "2",
    );
    await expect(b.locator("#game-overlay")).toHaveAttribute(
      "data-report-stage",
      "2",
    );
    const old = room.roundId;
    room.deadline = Date.now() + 150;
    await expect
      .poll(() => a.evaluate(() => __app.lobby.state.phase))
      .toBe("countdown");
    room.deadline = Date.now() + 150;
    await expect
      .poll(() => b.evaluate(() => __app.lobby.state.roundId))
      .not.toBe(old);
    expect(await a.evaluate(() => __app.lobby.state.roundId)).toBe(
      await b.evaluate(() => __app.lobby.state.roundId),
    );
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
  await page.locator("[data-start]").tap();
  await expect
    .poll(() => page.evaluate(() => __app.lobby.state.phase))
    .toBe("countdown");
  await context.close();
});
