import { test, expect } from "@playwright/test";
for (const [element, mode] of [
  ["ice", "fused"],
  ["abyssal", "fused3"],
]) {
  test(`${element} has working portraits, held icicles, Drain and shield controls`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      HTMLElement.prototype.requestFullscreen = undefined;
      localStorage.setItem(
        "elemental-settings",
        JSON.stringify({
          music: 0,
          sfx: 0,
          charging: "tap",
          orientation: "landscape",
        }),
      );
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?mode=${mode}`);
    await page.waitForFunction(() => window.__app?.screen === "setup");
    await page.locator(`[data-element="${element}"]`).click();
    expect(
      await page.evaluate(
        async () => await (await import("/src/characters.js")).charactersReady,
      ),
    ).toBe(true);
    const previews = await page
      .locator("#character-views canvas")
      .evaluateAll((cs) =>
        cs.map((c) => ({
          image: c.toDataURL(),
          ink: c
            .getContext("2d")
            .getImageData(0, 0, c.width, c.height)
            .data.some((v, i) => i % 4 === 3 && v > 0),
        })),
      );
    expect(previews.length).toBe(3);
    expect(previews.every((p) => p.ink)).toBe(true);
    expect(new Set(previews.map((p) => p.image)).size).toBe(3);
    await page.locator("#begin-btn").click();
    await page.evaluate(async () => {
      const g = __arena.game,
        { makeFighter } = await import("/src/combat.js");
      g.countdown = 0;
      g.ai = () => {};
      const a = g.player;
      Object.assign(a, { fx: 1, fy: 0, hp: 60 });
      g.fighters = [a, makeFighter("rival", "light", 1, a.x + 100, a.y)];
    });
    const button = page.locator("#charge-btn");
    await expect(button).toContainText("Icicle Burst");
    await expect(button).toContainText("Hold to fire");
    const box = await button.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect
      .poll(() => page.evaluate(() => __arena.game.fighters[1].hp))
      .toBeLessThan(120);
    expect(await page.evaluate(() => __arena.game.player.charging)).toBe(true);
    await expect(page.locator("#charge-meter")).toBeHidden();
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => __arena.game.player.charging))
      .toBe(false);
    await page.evaluate(() => {
      const g = __arena.game;
      g.projectiles = [];
      g.fighters[1].x = g.player.x + 25;
    });
    await expect
      .poll(() => page.evaluate(() => __arena.game.player.draining))
      .toBe(1);
    expect(await page.evaluate(() => __arena.game.fighters[1].drained)).toBe(1);
    if (element === "abyssal") {
      const utility = page.locator("#utility-btn");
      await expect(utility).toContainText("Void Mantle");
      const b = await utility.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await expect
        .poll(() => page.evaluate(() => __arena.game.player.shieldKind))
        .toBe("void");
      await page.screenshot({ path: "/tmp/abyssal-battle.png" });
      await page
        .locator("#arena-panel")
        .screenshot({ path: "/tmp/abyssal-guide.png" });
      await page.mouse.up();
      await expect
        .poll(() => page.evaluate(() => __arena.game.player.shield))
        .toBe(0);
    } else {
      await page.screenshot({ path: "/tmp/ice-battle.png" });
      await page
        .locator("#arena-panel")
        .screenshot({ path: "/tmp/ice-guide.png" });
    }
    expect(errors).toEqual([]);
  });
}
test("new sprite sets render four distinct running steps, casts, attacks and hurt poses with stable sizes", async ({
  page,
}) => {
  await page.goto("/?mode=fused");
  await page.waitForFunction(() => window.__app);
  const result = await page.evaluate(async () => {
    const { drawCharacter, charactersReady } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const sheet = document.createElement("canvas");
    sheet.width = 1200;
    sheet.height = 620;
    const s = sheet.getContext("2d");
    s.fillStyle = "#233d43";
    s.fillRect(0, 0, 1200, 620);
    const checks = [];
    for (const [e, element] of ["ice", "abyssal"].entries())
      for (let face = 0; face < 3; face++) {
        const a = makeFighter("preview", element, 0, 0, 0);
        [a.fx, a.fy] = [
          [0, 1],
          [1, 0],
          [0, -1],
        ][face];
        const frames = [];
        const heights = [];
        for (let pose = 0; pose < 8; pose++) {
          Object.assign(a, {
            vx: 0,
            vy: 0,
            movingTime: 0,
            gaitDistance: 0,
            castTime: 0,
            swing: 0,
            hitReact: 0,
          });
          if (pose >= 1 && pose <= 4)
            Object.assign(a, {
              vx: a.fx * 150,
              vy: a.fy * 150,
              movingTime: 0.2,
              gaitDistance: ((pose - 1) * 75) / 4,
            });
          if (pose === 5)
            Object.assign(a, { castTime: 0.3, castFx: a.fx, castFy: a.fy });
          if (pose === 6) a.swing = 0.08;
          if (pose === 7)
            Object.assign(a, { hitReact: 0.22, hitDx: 0, hitDy: 0 });
          const c = document.createElement("canvas");
          c.width = c.height = 120;
          const ctx = c.getContext("2d");
          ctx.translate(60, 95);
          drawCharacter(ctx, a, 0);
          const data = ctx.getImageData(0, 0, 120, 120).data;
          const rows = [];
          for (let y = 0; y < 120; y++)
            for (let x = 0; x < 120; x++)
              if (data[(y * 120 + x) * 4 + 3] > 100) {
                rows.push(y);
                break;
              }
          if (pose <= 4) heights.push(Math.max(...rows) - Math.min(...rows));
          if (pose >= 1 && pose <= 4) frames.push(c.toDataURL());
          s.drawImage(c, pose * 145, (e * 3 + face) * 100);
        }
        checks.push({
          element,
          face,
          steps: new Set(frames).size,
          spread: Math.max(...heights) - Math.min(...heights),
        });
      }
    sheet.id = "sprite-review";
    Object.assign(sheet.style, {
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "9999",
    });
    document.body.appendChild(sheet);
    return checks;
  });
  expect(result.every((r) => r.steps === 4)).toBe(true);
  expect(result.every((r) => r.spread <= 7)).toBe(true);
  await page
    .locator("#sprite-review")
    .screenshot({ path: "/tmp/ice-abyssal-poses.png" });
});
