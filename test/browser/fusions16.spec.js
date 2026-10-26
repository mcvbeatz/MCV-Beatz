import { test, expect } from "@playwright/test";
async function ready(page, element = "terraformer", orientation = "landscape") {
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem("elemental-settings", JSON.stringify({ orientation }));
  }, orientation);
  await page.goto("/?mode=fused3");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.locator(`[data-element="${element}"]`).click();
  await page.locator("#begin-btn").click();
  await page.evaluate(async () => {
    await (
      await import("/src/characters.js")
    ).charactersReady;
    const g = __arena.game;
    g.update = () => {};
    g.ai = () => {};
    g.time = 0;
    g.effects = [];
    g.portals.portals = [];
    g.portals.placing = null;
    Object.assign(g.player, {
      x: 350,
      y: 350,
      fx: 1,
      fy: 0,
      reveal: 0,
      swing: 0,
      charging: false,
      shield: 0,
      hurtReveal: 0,
      hitReact: 0,
      movingTime: 0,
    });
    const { makeFighter } = await import("/src/combat.js");
    g.fighters[1] = makeFighter("enemy", "water", 1, 700, 400);
  });
}
async function point(page, x, y) {
  return page.evaluate(
    ({ x, y }) => {
      const r = document.getElementById("game").getBoundingClientRect(),
        v = __arena.renderer.view,
        angle = Number(
          document.getElementById("orientation-root").dataset.rotation,
        );
      const lx = x * v.scale + v.tx,
        ly = y * v.scale + v.ty;
      return angle === 90
        ? { x: r.right - ly, y: r.top + lx }
        : angle === -90
          ? { x: r.left + ly, y: r.bottom - lx }
          : { x: r.left + lx, y: r.top + ly };
    },
    { x, y },
  );
}
async function frames(page) {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
test("new fusions have distinct directional, attacking, moving and victory art, with a green Sanctuary", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { drawCharacter, characterPose, paintPortraits } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    const c = document.createElement("canvas");
    c.width = c.height = 150;
    const ctx = c.getContext("2d");
    const out = {};
    for (const element of ["phoenix", "terraformer", "sanctuary"]) {
      const a = makeFighter("player", element, 0, 0, 0);
      const images = [];
      for (const [fx, fy, state] of [
        [0, 1, "idle"],
        [1, 0, "idle"],
        [0, -1, "idle"],
        [0, 1, "strike"],
        [0, 1, "move"],
        [0, 1, "win"],
      ]) {
        Object.assign(a, {
          fx,
          fy,
          swing: state === "strike" ? 0.1 : 0,
          movingTime: state === "move" ? 0.22 : 0,
          vx: state === "move" ? 150 : 0,
          victory: state === "win",
        });
        ctx.clearRect(0, 0, 150, 150);
        ctx.save();
        ctx.translate(75, 120);
        drawCharacter(ctx, a, 0.4);
        ctx.restore();
        images.push(c.toDataURL());
      }
      let green = 0;
      const data = ctx.getImageData(0, 0, 150, 150).data;
      for (let i = 0; i < data.length; i += 4)
        if (
          data[i + 3] > 200 &&
          data[i + 1] > data[i] * 1.2 &&
          data[i + 1] > data[i + 2] * 1.1
        )
          green++;
      out[element] = { unique: new Set(images).size, green };
    }
    return out;
  });
  for (const form of ["phoenix", "terraformer", "sanctuary"])
    expect(result[form].unique).toBeGreaterThanOrEqual(5);
  expect(result.sanctuary.green).toBeGreaterThan(300);
  await page.screenshot({ path: "/tmp/v16-terraformer.png" });
});
test("Chasm responds to direct arena taps in portrait and rotated landscape and animates before killing", async ({
  browser,
}) => {
  for (const orientation of ["portrait", "landscape"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await ready(page, "terraformer", orientation);
    await frames(page);
    const p = await point(page, 480, 350);
    await page.touchscreen.tap(p.x, p.y);
    expect(await page.evaluate(() => __arena.game.hazards[0]?.kind)).toBe(
      "chasm",
    );
    expect(await page.evaluate(() => __arena.game.player.charging)).toBe(false);
    await page.evaluate(() => {
      const g = __arena.game;
      g.fighters[1].x = 480;
      g.fighters[1].y = 350;
      g.time = 0.25;
      g.updateHazards(0.01);
    });
    await frames(page);
    const early = await page.locator("#game").screenshot();
    expect(await page.evaluate(() => __arena.game.fighters[1].alive)).toBe(
      true,
    );
    await page.evaluate(() => {
      const g = __arena.game;
      g.time = 0.75;
      g.updateHazards(0.01);
    });
    await frames(page);
    expect(await page.locator("#game").screenshot()).not.toEqual(early);
    await page.screenshot({ path: `/tmp/v16-chasm-${orientation}.png` });
    await page.evaluate(() => {
      const g = __arena.game;
      g.time = 1;
      g.updateHazards(0.01);
    });
    expect(await page.evaluate(() => __arena.game.fighters[1].alive)).toBe(
      false,
    );
    await context.close();
  }
});
test("Stone Prison shows its own HP and actual Strike input frees an imprisoned player", async ({
  page,
}) => {
  await ready(page, "sanctuary");
  await page.evaluate(async () => {
    const g = __arena.game;
    const { makeFighter } = await import("/src/combat.js");
    g.fighters[1] = makeFighter("enemy", "terraformer", 1, 420, 350);
    g.utility(g.fighters[1]);
  });
  await expect(page.locator("#arena-hint")).toContainText("65 / 65");
  await page.screenshot({ path: "/tmp/v16-prison.png" });
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => (__arena.game.player.attackCd = 0));
    await page.locator("#attack-btn").click();
  }
  expect(await page.evaluate(() => __arena.game.player.prisonHp)).toBe(0);
  await expect(page.locator("#arena-hint")).not.toContainText("STONE PRISON");
});
test("Phoenix and Sanctuary direct skills work and spent Life spring stays unavailable", async ({
  page,
}) => {
  await ready(page, "phoenix");
  await expect(page.locator("#extra-skill-0")).toContainText("Laser beam");
  await expect(page.locator("#extra-skill-1")).toContainText("Speed burst");
  await page.locator("#extra-skill-0").click();
  expect(await page.evaluate(() => __arena.game.projectiles[0]?.kind)).toBe(
    "laser",
  );
  await page.locator("#extra-skill-1").click();
  expect(await page.evaluate(() => __arena.game.player.burst)).toBeGreaterThan(
    0,
  );
  await page.evaluate(() => __arena.game.fell(__arena.game.player));
  expect(await page.evaluate(() => __arena.game.player.hp)).toBe(60);
  await page.screenshot({ path: "/tmp/v16-phoenix.png" });
  await page.locator("#leave-btn").click();
  await page.locator('[data-element="sanctuary"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.ai = () => {};
    g.update = () => {};
    g.player.hp = 80;
  });
  await expect(page.locator("#ability-name")).toHaveText("Life spring");
  await page.locator("#charge-btn").click();
  await expect(page.locator("#charge-btn")).toBeDisabled();
  await expect(page.locator("#ability-status")).toHaveText("Spent this match");
  await page.evaluate(() => __arena.game.updateHazards(1));
  expect(await page.evaluate(() => __arena.game.player.hp)).toBe(88);
  await expect(page.locator("#extra-skill-0")).toContainText("Rock shield");
  await page.screenshot({ path: "/tmp/v16-sanctuary.png" });
});
test("Divine owner switches from outline to full body for action, movement and damage reveals", async ({
  page,
}) => {
  await ready(page, "divine");
  const results = await page.evaluate(() => {
    const r = __arena.renderer,
      g = __arena.game;
    let calls = [];
    const body = r.avatar.bind(r),
      outline = r.outline.bind(r);
    r.avatar = (c, a, ...args) => {
      if (a.id === "player") calls.push("body");
      return body(c, a, ...args);
    };
    r.outline = (c, a, ...args) => {
      if (a.id === "player") calls.push("outline");
      return outline(c, a, ...args);
    };
    const states = [
      {},
      { reveal: 0.3 },
      { movingTime: 1.05 },
      { hurtReveal: 0.1 },
      {},
    ];
    const result = [];
    for (const state of states) {
      Object.assign(
        g.player,
        { reveal: 0, movingTime: 0, hurtReveal: 0 },
        state,
      );
      calls = [];
      r.draw(g, false);
      result.push(calls[0]);
    }
    return result;
  });
  expect(results).toEqual(["outline", "body", "body", "body", "outline"]);
});
test("new chapters and all active buttons fit a small phone in both orientations", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await ready(page);
  for (const orientation of ["landscape", "portrait"])
    for (const form of ["phoenix", "terraformer", "sanctuary"]) {
      await page.locator("#leave-btn").click();
      await page.evaluate(() => __app.show("settings"));
      await page.locator("#orientation-setting").selectOption(orientation);
      await page.evaluate(() => __app.chooseMode("fused3"));
      await page.locator(`[data-element="${form}"]`).click();
      await page.locator("#begin-btn").click();
      for (const el of await page
        .locator(".skill-controls .ability:not([hidden])")
        .all()) {
        const r = await el.boundingBox();
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(320.5);
        expect(r.y + r.height).toBeLessThanOrEqual(568.5);
      }
    }
  await page.evaluate(() => __app.show("elements"));
  await expect(page.locator("[data-chapter]")).toHaveCount(23);
  for (const form of ["phoenix", "terraformer", "sanctuary"]) {
    await page.locator(`[data-chapter="${form}"]`).click();
    await expect(page.locator("#slide-title")).toHaveText(
      form[0].toUpperCase() + form.slice(1),
    );
    await page.locator("#slides-close").click();
  }
  await context.close();
});
