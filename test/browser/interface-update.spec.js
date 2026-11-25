import { test, expect } from "@playwright/test";
import {
  installLobbyService,
  signedTestAccount,
} from "./local-lobby-service.js";
const route = installLobbyService(test);
async function ready(page, orientation = "auto") {
  await route(page);
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ orientation, music: 0, sfx: 0 }),
    );
  }, orientation);
  await page.goto("/");
  await page.waitForFunction(() => window.__app?.screen === "home");
}
test("account sections require sign-in; managed email/password changes show confirmations and errors", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => __app.show("account"));
  await expect(page.locator("#account-form")).toBeVisible();
  await expect(page.locator(".progress-tabs")).toHaveCount(0);
  await page.evaluate(() => __app.openProgress("mastery"));
  await expect(page.locator(".progress-tabs")).toHaveCount(0);
  await signedTestAccount(page);
  await page.evaluate(() => __app.show("account"));
  await expect(page.locator(".progress-tabs button")).toHaveCount(5);
  await page.locator("[data-auth]").click();
  await page.evaluate(() => {
    window.accountUpdates = [];
    __app.account.client.auth.updateUser = async (...args) => {
      accountUpdates.push(args);
      __app.account.listeners.forEach((f) => f());
      return { error: null };
    };
  });
  await page
    .locator('#change-email-form [name="email"]')
    .fill("new@example.com");
  await page.locator("#change-email-form button").click();
  await expect(page.locator("#change-email-form [role=status]")).toContainText(
    "confirmation",
  );
  await page
    .locator('#change-password-form [name="password"]')
    .fill("Example-pass-123");
  await page
    .locator('#change-password-form [name="confirmation"]')
    .fill("different-pass-123");
  await page.locator("#change-password-form button").click();
  await expect(
    page.locator("#change-password-form [role=status]"),
  ).toContainText("do not match");
  expect(await page.evaluate(() => accountUpdates.length)).toBe(1);
  for (const name of ["password", "confirmation"])
    await page
      .locator(`#change-password-form [name="${name}"]`)
      .fill("Example-pass-123");
  await page.locator("#change-password-form button").click();
  await expect(page.locator("#change-password-form [role=status]")).toHaveText(
    "Password updated.",
  );
  await expect(
    page.locator('#change-password-form [name="password"]'),
  ).toHaveValue("");
  expect(
    await page.evaluate(() =>
      accountUpdates.map((args) => Object.keys(args[0])),
    ),
  ).toEqual([["email"], ["password"]]);
  await page.evaluate(() => {
    __app.account.client.auth.updateUser = async () => ({
      error: new Error("Please sign in again"),
    });
  });
  await page.locator("#change-email-form button").click();
  await expect(page.locator("#change-email-form [role=status]")).toContainText(
    "Please sign in again",
  );
  await page.evaluate(() => {
    __app.account.user = null;
    __app.account.listeners.forEach((f) => f());
  });
  await expect(page.locator("#account-form")).toBeVisible();
  await expect(page.locator(".progress-tabs")).toHaveCount(0);
});

test("Quick Match searches other modes before creating a lobby, and Settings preserves the shared room", async ({
  browser,
}) => {
  const c1 = await browser.newContext(),
    c2 = await browser.newContext();
  const a = await c1.newPage(),
    b = await c2.newPage();
  try {
    await ready(a);
    await ready(b);
    await a.evaluate(() =>
      __app.openLobby("gridiron", false, { action: "create" }),
    );
    await a.waitForFunction(() => __app.lobby?.state);
    const id = await a.evaluate(() => __app.lobby.state.roomId);
    await b.evaluate(async () => {
      await __app.show("play");
      const random = Math.random;
      Math.random = () => 0;
      document.querySelector("#quick-match").click();
      Math.random = random;
    });
    await b.waitForFunction(() => __app.lobby?.state);
    expect(await b.evaluate(() => __app.lobby.state.roomId)).toBe(id);
    expect(await b.evaluate(() => __app.lobby.state.mode)).toBe("gridiron");
    await b.locator("#pause-btn").click();
    await expect(b.locator("#battle-settings-dialog")).toBeVisible();
    await expect(b.locator("#battle-settings-dialog")).toContainText(
      "Online play continues",
    );
    await b.keyboard.press("d");
    await b.waitForTimeout(250);
    expect(await b.evaluate(() => __app.lobby.state.roomId)).toBe(id);
    expect(await a.evaluate(() => __app.lobby.state.members.length)).toBe(2);
    await b.locator("#battle-settings-dialog [data-resume]").click();
    await expect(b.locator("#lobby-controls")).toBeVisible();
  } finally {
    await c1.close();
    await c2.close();
  }
});

test("Auto-Rotation, Ability Charging and layout persist; offline Settings pauses and resumes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.evaluate(() => __app.show("settings"));
  await expect(page.locator("#orientation-setting")).toHaveValue("auto");
  await expect(page.locator("#charging-setting option")).toHaveText([
    "Hold & Release",
    "Tap to Charge",
  ]);
  await page.locator("#charging-setting").selectOption("tap");
  await page.locator("#ability-layout-setting").selectOption("cluster");
  await expect(page.locator("#orientation-root")).toHaveAttribute(
    "data-orientation",
    "portrait",
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#orientation-root")).toHaveAttribute(
    "data-orientation",
    "landscape",
  );
  await expect(page.locator("#orientation-root")).toHaveAttribute(
    "data-rotation",
    "0",
  );
  await page.evaluate(() => __app.chooseMode("dungeon"));
  await page.locator("#begin-btn").click();
  await expect(page.locator("#pause-btn")).toHaveText("Settings");
  await page.locator("#pause-btn").click();
  await expect(page.locator("#battle-settings-dialog")).toBeVisible();
  expect(await page.evaluate(() => __arena.paused)).toBe(true);
  for (const control of await page
    .locator("#battle-settings-dialog select, #battle-settings-dialog input")
    .all()) {
    expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await page.locator("#battle-ability-layout-setting").selectOption("standard");
  await page.locator("#battle-settings-dialog [data-resume]").click();
  await expect.poll(() => page.evaluate(() => __arena.paused)).toBe(false);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("elemental-settings")),
    ),
  ).toMatchObject({
    orientation: "auto",
    abilityLayout: "standard",
    charging: "tap",
  });
  // No init script on a second page: read the saved settings as a new launch.
  const second = await page.context().newPage();
  await route(second);
  await second.goto("/");
  await second.waitForFunction(() => window.__app?.screen === "home");
  expect(await second.evaluate(() => __app.settings)).toMatchObject({
    orientation: "auto",
    abilityLayout: "standard",
    charging: "tap",
  });
  await second.close();
});
for (const orientation of ["portrait", "landscape"]) {
  test(`setup profiles and Strike Cluster stay usable in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      orientation === "portrait"
        ? { width: 390, height: 844 }
        : { width: 844, height: 390 },
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page, orientation);
    await page.evaluate(() => __app.chooseMode("gauntlet"));
    await page.locator('[data-element="light"]').click();
    await expect(page.locator("#profile-name")).toHaveText("Light");
    await expect(page.locator(".setup-abilities")).toContainText("Healing");
    await expect(page.locator(".setup-abilities")).toContainText("Flash");
    await expect(page.locator(".comparison-row")).toHaveCount(5);
    await expect(page.locator("#profile-role")).toHaveCount(0);
    await page.screenshot({ path: `/tmp/setup-${orientation}.png` });
    await page.locator("#element-next").click();
    await expect(page.locator("#profile-name")).toHaveText("Dark");
    for (const mode of ["duel", "fused", "fused3"]) {
      await page.evaluate((mode) => __app.chooseMode(mode), mode);
      const forms = await page
        .locator("#element-grid [data-element]")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.element));
      for (const form of forms) {
        await page.locator(`#element-grid [data-element="${form}"]`).click();
        await expect(page.locator(".setup-champion canvas")).toHaveAttribute(
          "data-character",
          form,
        );
        expect(
          await page
            .locator(".comparison-row meter")
            .evaluateAll((nodes) =>
              nodes.every((n) => Number.isFinite(n.value)),
            ),
        ).toBe(true);
      }
    }
    await page.evaluate(() => __app.show("settings"));
    await page.locator("#ability-layout-setting").selectOption("cluster");
    await page.evaluate(() => __app.chooseMode("fused3"));
    await page.locator('[data-element="demonic"]').click();
    await page.locator("#begin-btn").click();
    const buttons = page.locator(".skill-controls > .ability:visible");
    await expect(buttons).toHaveCount(4);
    const strike = await page.locator("#attack-btn").boundingBox(),
      stick = await page.locator("#joystick").boundingBox();
    for (const b of await buttons.all()) {
      const r = await b.boundingBox();
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      for (const other of [strike, stick])
        expect(
          r.x + r.width <= other.x + 1 ||
            r.x >= other.x + other.width - 1 ||
            r.y + r.height <= other.y + 1 ||
            r.y >= other.y + other.height - 1,
        ).toBe(true);
    }
    await page.screenshot({ path: `/tmp/cluster-${orientation}.png` });
    expect(errors).toEqual([]);
  });
}
