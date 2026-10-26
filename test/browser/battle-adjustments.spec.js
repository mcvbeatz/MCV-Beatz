import { test, expect } from "@playwright/test";

test("every elemental uses distinct directional sidestep and damaged frames with attack priority", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  const result = await page.evaluate(async () => {
    const { charactersReady, CHARACTERS, drawCharacter, characterPose } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 180;
    const c = canvas.getContext("2d");
    const snapshot = (a) => {
      c.clearRect(0, 0, 180, 180);
      c.save();
      c.translate(90, 145);
      drawCharacter(c, a, 0);
      c.restore();
      return canvas.toDataURL();
    };
    const errors = [];
    let count = 0;
    for (const e of CHARACTERS)
      for (const [fx, fy] of [
        [0, 1],
        [1, 0],
        [-1, 0],
        [0, -1],
      ]) {
        const a = makeFighter("test", e, 0, 0, 0);
        a.fx = fx;
        a.fy = fy;
        const idle = snapshot(a);
        a.lock = "rival";
        a.vx = 150;
        a.movingTime = 0.01;
        const stepA = snapshot(a);
        let p = characterPose(a);
        if (!p.sidestepping || p.running || p.runFrame !== null)
          errors.push(`${e}: step state`);
        a.movingTime = 0.21;
        const stepB = snapshot(a);
        if (stepA === stepB || stepA === idle) errors.push(`${e}: step frames`);
        a.hitReact = 0.12;
        a.hitDx = 1;
        a.hitDy = 0;
        const hurt = snapshot(a);
        p = characterPose(a);
        if (!p.reacting || p.sidestepping || hurt === idle || hurt === stepA)
          errors.push(`${e}: hurt`);
        a.swing = 0.08;
        if (characterPose(a).reacting || characterPose(a).sidestepping)
          errors.push(`${e}: attack priority`);
        count++;
      }
    return { errors, count, ready: await charactersReady };
  });
  expect(result).toEqual({ errors: [], count: 92, ready: true });
});

test("Death button places a floor sigil, stays spent, and demotion updates ability tabs", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.evaluate(() => __app.chooseMode("fused3"));
  await page.locator('[data-element="demonic"]').click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.update = () => {};
    g.player.x = 350;
    g.player.y = 350;
    g.player.fx = 1;
    g.player.fy = 0;
  });
  await expect(page.locator("#utility-status")).toHaveText(
    "Place floor · once per match",
  );
  await page.locator("#utility-btn").click();
  await expect(page.locator("#utility-status")).toHaveText("Spent this match");
  await expect(page.locator("#utility-btn")).toBeDisabled();
  const state = await page.evaluate(() => {
    const g = __arena.game,
      h = g.hazards.find((h) => h.kind === "death");
    g.player.x = h.x;
    g.player.y = h.y;
    g.updateHazards(0.01);
    return {
      element: g.player.element,
      parts: g.player.parts,
      life: h.life === Infinity,
      r: h.r,
    };
  });
  expect(state).toEqual({
    element: "apparition",
    parts: ["air", "dark"],
    life: true,
    r: 66,
  });
  await expect(page.locator('[data-form="demonic"]')).toHaveCount(0);
  await expect(page.locator('[data-form="apparition"]')).toBeVisible();
});

test("white portals animate opening and closing while keeping transport timing", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  const result = await page.evaluate(async () => {
    const { drawPortal } = await import("/src/battle-effects.js");
    const g = __arena.game;
    g.update = () => {};
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 180;
    const c = canvas.getContext("2d");
    const render = (progress, closing = false) => {
      c.clearRect(0, 0, 180, 180);
      drawPortal(c, { x: 90, y: 90 }, 0, progress, closing);
      return {
        url: canvas.toDataURL(),
        data: c.getImageData(0, 0, 180, 180).data,
      };
    };
    const early = render(0.2),
      open = render(1),
      close = render(0.5, true);
    let tinted = 0,
      visible = 0;
    for (let i = 0; i < open.data.length; i += 4) {
      if (open.data[i + 3] < 80) continue;
      visible++;
      if (
        Math.max(open.data[i], open.data[i + 1], open.data[i + 2]) -
          Math.min(open.data[i], open.data[i + 1], open.data[i + 2]) >
        20
      )
        tinted++;
    }
    g.portals.begin(g.player);
    g.portals.place(g.player, 450, 300);
    const p = g.portals.portals[0];
    const before = g.portals.active(p);
    g.time = 0.5;
    const after = g.portals.active(p);
    g.portals.close(g.player, p.id);
    return {
      distinct: new Set([early.url, open.url, close.url]).size,
      visible,
      tinted,
      before,
      after,
      closed: g.portals.portals.length,
      animation: g.effects.at(-1).kind,
    };
  });
  expect(result.distinct).toBe(3);
  expect(result.visible).toBeGreaterThan(1000);
  expect(result.tinted).toBe(0);
  expect(result.before).toBe(false);
  expect(result.after).toBe(true);
  expect(result.closed).toBe(0);
  expect(result.animation).toBe("portal-close");
});
