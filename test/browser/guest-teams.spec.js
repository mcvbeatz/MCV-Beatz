import { test, expect } from "@playwright/test";
import { createLobbyServer } from "../../server/index.js";
import { signedTestAccount } from "./local-lobby-service.js";
let service, verifies;
test.beforeAll(async () => {
  verifies = [];
  service = createLobbyServer({
    verifyUser: async (id) => {
      verifies.push(id);
      return { id, user_metadata: { username: id } };
    },
  });
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
});
test.afterAll(async () => service.close());
async function ready(page, id) {
  await page.route("**/app-config.json", (r) =>
    r.fulfill({
      json: {
        multiplayerUrl: `ws://127.0.0.1:${service.server.address().port}`,
      },
    }),
  );
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation: "landscape", music: 0, sfx: 0 }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
  if (id) await signedTestAccount(page, id);
}

test("guest and signed-in players share rooms, floor buttons lock full teams, usernames render and only accounts earn progress", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({ viewport: { width: 844, height: 390 } }),
    ),
  );
  const [a, b, c] = await Promise.all(contexts.map((ctx) => ctx.newPage()));
  const errors = [];
  for (const p of [a, b, c]) p.on("pageerror", (e) => errors.push(e.message));
  try {
    await ready(a);
    await ready(b, "Bob");
    await ready(c);
    for (const p of [a, b, c]) {
      await p.evaluate(() => __app.show("team-battles"));
      await p.locator('[data-launch="tdm"]').click();
    }
    await expect(a.locator(".lobby-entry-actions button")).toHaveText([
      "Create Lobby",
      "Join Lobby",
      "Sign in",
    ]);
    await expect(b.locator(".lobby-entry-actions button")).toHaveText([
      "Create Lobby",
      "Join Lobby",
    ]);
    await expect(a.locator("[data-offline]")).toHaveCount(0);
    await a.locator("[data-create]").click();
    await expect(a.locator("#lobby-controls")).toBeVisible();
    const captain = await a.evaluate(() => __app.lobby.state.members[0]);
    expect(captain.guest).toBe(true);
    expect(captain.name).toMatch(/^Guest /);
    await a.locator('[data-lobby-tab="players"]').click();
    await a.locator("select[data-size]").selectOption("4");
    await a.locator("[data-lobby-close]").click();
    for (const p of [b, c]) {
      await p.locator("[data-choose-join]").click();
      await p
        .locator(".open-lobby")
        .filter({ hasText: captain.name })
        .locator("[data-join]")
        .click();
      await expect(p.locator("#lobby-status")).toContainText(captain.name);
    }
    const room = service.rooms.get(
      await a.evaluate(() => __app.lobby.state.roomId),
    );
    expect(room.members.size).toBe(3);
    const third = await c.evaluate(() => __app.lobby.userId);
    await expect(b.locator('[data-lobby-team="0"]')).toBeDisabled();
    await expect(b.locator('[data-lobby-team="0"]')).toContainText("Locked");
    await a.locator('[data-lobby-team="1"]').click();
    await expect.poll(() => room.members.get(captain.id).seat % 2).toBe(1);
    await expect(c.locator('[data-lobby-team="1"]')).toBeDisabled();
    await expect(c.locator('[data-lobby-team="1"]')).toContainText("2 / 2");
    expect(room.members.get(third).seat % 2).toBe(0);
    await a.evaluate(() => {
      window.namesPainted = new Set();
      const ctx = __arena.renderer.ctx,
        draw = ctx.fillText.bind(ctx);
      ctx.fillText = (text, ...args) => {
        namesPainted.add(text);
        draw(text, ...args);
      };
    });
    await expect
      .poll(() => a.evaluate(() => namesPainted.has("Bob")))
      .toBe(true);
    await expect
      .poll(() => a.evaluate((name) => namesPainted.has(name), captain.name))
      .toBe(true);
    const guestBefore = await a.evaluate(() =>
      localStorage.getItem("fusion-throwdown:progress:v1:guest"),
    );
    await a.locator("[data-start]").click();
    room.deadline = Date.now() + 150;
    await expect
      .poll(() => a.evaluate(() => __app.lobby.state.phase))
      .toBe("battle");
    await expect(a.locator("#lobby-team-picker")).toBeHidden();
    expect(
      room.game.fighters.find(
        (f) => f.id === room.members.get(captain.id).actorId,
      ).team,
    ).toBe(1);
    await a.evaluate(() => namesPainted.clear());
    await expect
      .poll(() => a.evaluate(() => namesPainted.has("Bob")))
      .toBe(true);
    room.game.time = 60;
    room.game.finish(1, "Finished");
    room.game.celebrationRemaining = 0;
    await expect(a.locator("#match-report")).toBeVisible();
    await expect(b.locator("#match-report")).toBeVisible();
    expect(
      await a.evaluate(() => __app.progressionStore().state.totals.matches),
    ).toBe(0);
    expect(
      await a.evaluate(() =>
        localStorage.getItem("fusion-throwdown:progress:v1:guest"),
      ),
    ).toBe(guestBefore);
    await expect
      .poll(() =>
        b.evaluate(() => __app.progressionStore().state.totals.matches),
      )
      .toBe(1);
    await a.locator("#match-report [data-next]").click();
    await expect(a.locator("#match-report")).toContainText(
      "Sign in to save stats",
    );
    await expect(a.locator(".xp-result")).toHaveCount(0);
    await b.locator("#match-report [data-next]").click();
    await expect(b.locator("#match-report")).toContainText("Mastery XP");
    room.deadline = Date.now() + 100;
    await expect(a.locator("#last-results-btn")).toBeVisible();
    await a.locator("#last-results-btn").click();
    await a.locator("#last-results-panel [data-next]").click();
    expect(
      await a.evaluate(() =>
        localStorage.getItem("fusion-throwdown:progress:v1:guest"),
      ),
    ).toBe(guestBefore);
    expect(verifies).toContain("Bob");
    expect(verifies.every((id) => id === "Bob")).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
});

test("team floor controls appear only in selectable-team modes", async ({
  page,
}) => {
  await ready(page);
  for (const mode of ["tdm", "war", "ctf", "rush", "gridiron"]) {
    await page.evaluate((mode) => __app.openLobby(mode), mode);
    await expect(page.locator("#lobby-team-picker")).toBeVisible();
    await expect(page.locator("#lobby-team-picker button")).toHaveCount(2);
    if (mode === "tdm") {
      const previous = await page.evaluate(() => __app.lobby.state.roomId);
      await page.evaluate(() =>
        __app.openLobby("tdm", false, { action: "create" }),
      );
      await expect
        .poll(() => page.evaluate(() => __app.lobby?.state?.roomId))
        .not.toBe(previous);
      await expect(page.locator("#lobby-team-picker")).toBeVisible();
    }
    await page.locator('[data-lobby-team="1"]').click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            __app.lobby.state.members.find((m) => m.id === __app.lobby.userId)
              .team,
        ),
      )
      .toBe(1);
  }
  for (const mode of [
    "ffa",
    "corruption",
    "turnpike",
    "zombies",
    "gauntlet-team",
    "boss",
    "roulette",
  ]) {
    await page.evaluate((mode) => __app.openLobby(mode), mode);
    await expect(page.locator("#lobby-controls")).toBeVisible();
    await expect(page.locator("#lobby-team-picker")).toBeHidden();
  }
});

test("guest solo matches keep their scoreboard but do not write stats, XP or achievements", async ({
  page,
}) => {
  await ready(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("fusion-throwdown:progress:v1:guest"),
  );
  await page.evaluate(() => __app.chooseMode("dungeon"));
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.time = 120;
    g.finish(0, "Finished");
    g.celebrationRemaining = 0;
  });
  await expect(page.locator("#match-report")).toBeVisible();
  expect(
    await page.evaluate(() => __app.progressionStore().state.totals.matches),
  ).toBe(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("fusion-throwdown:progress:v1:guest"),
    ),
  ).toBe(before);
});
