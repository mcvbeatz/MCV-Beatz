import { test, expect } from "@playwright/test";
async function start(page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem(
      "elemental-settings",
      JSON.stringify({ music: 0, sfx: 0, orientation: "landscape" }),
    );
  });
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto("/?mode=corruption");
  await page.waitForFunction(() => window.__app?.screen === "setup");
}
test("Survive the Night setup allows only eight players, without restricting other modes", async ({
  page,
}) => {
  await start(page);
  await expect(page.locator("#ffa-count")).toHaveValue("8");
  await expect(page.locator("#ffa-count option:enabled")).toHaveCount(1);
  await expect(page.locator("#ffa-count option:enabled")).toHaveText("8");
  await page.evaluate(() => __app.chooseMode("ffa"));
  await expect(page.locator("#ffa-count option:enabled")).toHaveCount(7);
  await page.locator("#ffa-count").selectOption("2");
  await page.evaluate(() => __app.chooseMode("corruption"));
  await expect(page.locator("#ffa-count")).toHaveValue("8");
  await page.locator("#begin-btn").click();
  expect(await page.evaluate(() => __arena.game.fighters.length)).toBe(8);
});
test("last survivor Spirit shows Rebirth and Revival, has no portal button, and rescues the oldest Dark", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.countdown = 0;
    g.update = () => {};
    g.corruptionStarted = true;
    for (const a of g.fighters.slice(1)) {
      g.time++;
      g.corrupt(a);
    }
  });
  await expect(page.locator("#hud-name")).toHaveText("SPIRIT");
  await expect(page.locator("#passive-note")).toContainText("REBIRTH READY");
  await expect(page.locator("#utility-btn")).toBeHidden();
  await expect(
    page.locator("button.ability:visible").filter({ hasText: "Portals" }),
  ).toHaveCount(0);
  await expect(page.locator("#ability-name")).toHaveText("Revival");
  const button = page.locator("#charge-btn");
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.evaluate(() => {
    __arena.game.player.charge = 0.6;
  });
  await page.mouse.up();
  expect(await page.evaluate(() => __arena.game.fighters[1].element)).toBe(
    "light",
  );
  expect(await page.evaluate(() => __arena.game.portals.portals.length)).toBe(
    0,
  );
  await expect(page.locator("#objective-score")).toContainText("2 LIGHT");
  await page.screenshot({ path: "/tmp/night-spirit-perks.png" });
  expect(errors).toEqual([]);
});
test("third conversion reveals Smoke's normal skills in the battle HUD", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.countdown = 0;
    g.update = () => {};
    g.corruptionStarted = true;
    g.corrupt(g.player);
    for (const a of g.fighters.slice(1, 4)) g.corrupt(a, g.player);
  });
  await expect(page.locator("#hud-name")).toHaveText("SMOKE");
  await expect(page.locator("#ability-name")).toHaveText("Vog");
  await expect(page.locator("#extra-skill-0")).toContainText("Shadow step");
  await expect(page.locator("#extra-skill-1")).toContainText("Flamethrower");
  await expect(page.locator("#passive-note")).toContainText(
    "Immune to Spirit rescue",
  );
  await page.locator("#charge-btn").click();
  expect(
    await page.evaluate(() =>
      __arena.game.hazards.some((h) => h.kind === "vog"),
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/night-smoke-perks.png" });
  expect(errors).toEqual([]);
});
