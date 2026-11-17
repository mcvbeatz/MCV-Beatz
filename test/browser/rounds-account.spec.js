import { test, expect } from "@playwright/test";
async function ready(page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation: "portrait", music: 0, sfx: 0.6 }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
test("battle menus have requested ordering and no mode subtitles, sign-in is highlighted", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => __app.show("solo-battles"));
  await expect(page.locator("[data-launch]").first()).toHaveAttribute(
    "data-launch",
    "corruption",
  );
  await expect(page.locator("[data-launch]").last()).toHaveAttribute(
    "data-launch",
    "gauntlet",
  );
  await expect(page.locator("[data-launch] span")).toHaveCount(0);
  await page.evaluate(() => __app.show("team-battles"));
  const ids = await page
    .locator("[data-launch]")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.launch));
  expect(ids.slice(-2)).toEqual(["boss", "gauntlet-team"]);
  await page.evaluate(() => __app.show("account"));
  await expect(page.locator("[data-auth]")).toHaveText("Sign in / Register");
  expect(
    await page
      .locator("[data-auth]")
      .evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toContain("linear-gradient");
});
test("team scoreboards separate both teams and add assists while solo and Zombies stay ungrouped", async ({
  page,
}) => {
  await ready(page);
  for (const mode of [
    "gridiron",
    "tdm",
    "war",
    "rush",
    "ctf",
    "boss",
    "gauntlet-team",
    "ffa",
    "zombies",
  ]) {
    await page.evaluate((mode) => __app.chooseMode(mode), mode);
    await page.locator("#begin-btn").click();
    await page.evaluate(() => {
      const g = __arena.game;
      g.update = () => {};
      g.finish(g.player.team, "Team report");
      g.celebrationRemaining = 0;
    });
    await expect(page.locator("#match-report")).toBeVisible();
    await expect(page.locator(".team-heading")).toHaveCount(
      ["ffa", "zombies"].includes(mode) ? 0 : mode === "gauntlet-team" ? 1 : 2,
    );
    if (mode === "gridiron") {
      await expect(page.locator(".session-scoreboard thead")).toContainText(
        "Assists",
      );
      await expect(page.locator(".team-heading").first()).toContainText(
        "Your team",
      );
      await expect(page.locator(".team-heading").last()).toContainText(
        "Opposing team",
      );
      await page.screenshot({ path: "/tmp/v058-teams.png" });
    }
  }
});
test("Manage Account deletion requires explicit confirmation, cancellation does nothing and errors preserve the account", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    __app.account.user = {
      id: "test-account",
      user_metadata: { username: "Tester" },
    };
    __app.account.stats = async () => null;
    window.deletionCalls = 0;
    __app.account.deleteAccount = async () => {
      window.deletionCalls++;
      throw new Error("Database update required");
    };
    __app.show("account");
  });
  await page.locator("[data-auth]").click();
  await page.locator("#account-delete").click();
  await expect(
    page.getByRole("heading", { name: "Are you Sure?" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.deletionCalls)).toBe(0);
  await page.locator("#account-delete-cancel").click();
  await expect(page.locator("#account-delete-confirm")).toBeHidden();
  await page.locator("#account-delete").click();
  await page.locator("#account-delete-yes").click();
  await expect(page.locator("#account-message")).toHaveText(
    "Database update required",
  );
  expect(await page.evaluate(() => __app.account.user.id)).toBe("test-account");
  expect(await page.evaluate(() => window.deletionCalls)).toBe(1);
  await page.evaluate(() => {
    __app.account.deleteAccount = async () => {
      window.deletionCalls++;
      __app.account.user = null;
      return "test-account";
    };
  });
  await page.locator("#account-delete-yes").click();
  await expect(page.locator("[data-auth]")).toHaveText("Sign in / Register");
  expect(await page.evaluate(() => window.deletionCalls)).toBe(2);
});
test("Gridiron celebration pauses the visible clock, poses while idle, moves on input, and plays distinct stadium cues", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => __app.chooseMode("gridiron"));
  await page.locator("#begin-btn").click();
  await page.evaluate(async () => {
    const { updateGridiron } = await import("/src/event-modes.js");
    const g = __arena.game;
    g.countdown = 0;
    g.time = 80;
    g.ai = () => {};
    window.stadiumSounds = [];
    const emit = g.emitSound.bind(g);
    g.emitSound = (kind, a) => {
      window.stadiumSounds.push(kind);
      emit(kind, a);
    };
    g.player.x = 400;
    g.player.y = 500;
    g.ball.carrier = g.player.id;
    updateGridiron(g);
    g.player.x = 750;
    updateGridiron(g);
    g.player.x = 1500;
    updateGridiron(g);
  });
  await expect(page.locator("#objective-score")).toContainText("CELEBRATE");
  await page.waitForTimeout(300);
  const start = await page.evaluate(() => ({
    time: __arena.game.time,
    x: __arena.game.player.x,
    victory: __arena.game.player.victory,
  }));
  expect(start.time).toBe(80);
  expect(start.victory).toBe(true);
  await page.keyboard.down("a");
  await page.waitForTimeout(250);
  await page.keyboard.up("a");
  expect(await page.evaluate(() => __arena.game.player.x)).toBeLessThan(
    start.x,
  );
  expect(await page.evaluate(() => __arena.game.time)).toBe(80);
  await expect
    .poll(() => page.evaluate(() => !!__arena.game.gridCelebration))
    .toBe(false);
  expect(
    await page.evaluate(
      () => window.stadiumSounds.filter((k) => k === "crowd-run").length,
    ),
  ).toBe(2);
  expect(
    await page.evaluate(
      () => window.stadiumSounds.filter((k) => k === "crowd-touchdown").length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () => window.stadiumSounds.filter((k) => k === "whistle").length,
    ),
  ).toBe(1);
});
