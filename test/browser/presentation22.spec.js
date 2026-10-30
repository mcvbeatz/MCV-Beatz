import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

async function start(
  page,
  orientation = "landscape",
  mode = "fused3",
  element = "demonic",
) {
  await page.addInitScript((orientation) => {
    HTMLElement.prototype.requestFullscreen = undefined;
    localStorage.setItem("elemental-settings", JSON.stringify({ orientation }));
  }, orientation);
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  await page.evaluate((mode) => __app.chooseMode(mode), mode);
  await page.locator(`[data-element="${element}"]`).click();
  await page.locator("#begin-btn").click();
  await page.evaluate(async () => {
    await (
      await import("/src/characters.js")
    ).charactersReady;
    __arena.game.countdown = 0;
    __arena.game.ai = () => {};
  });
}

for (const [width, height] of [
  [844, 390],
  [568, 320],
  [390, 844],
]) {
  test(`landscape controls occupy edge rows at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await start(page);
    await page.evaluate(() => {
      __arena.game.update = () => {};
    });
    await expect(page.locator(".skill-controls .ability:visible")).toHaveCount(
      4,
    );
    const layout = await page.evaluate(() => {
      const wrap = document.getElementById("game-wrap");
      const rect = wrap.getBoundingClientRect();
      const rotated =
        document.getElementById("orientation-root").dataset.rotation === "90";
      const box = (el) => {
        const b = el.getBoundingClientRect();
        return rotated
          ? {
              x: b.top - rect.top,
              y: rect.right - b.right,
              w: b.height,
              h: b.width,
            }
          : {
              x: b.left - rect.left,
              y: b.top - rect.top,
              w: b.width,
              h: b.height,
            };
      };
      return {
        w: wrap.clientWidth,
        h: wrap.clientHeight,
        health: box(document.querySelector(".fighter-card")),
        stats: box(document.querySelector(".round-info")),
        tabs: box(document.querySelector(".skill-switcher")),
        move: box(document.getElementById("joystick")),
        strike: box(document.getElementById("attack-btn")),
        abilities: [...document.querySelectorAll(".skill-controls .ability")]
          .filter((e) => !e.hidden)
          .map(box),
      };
    });
    expect(layout.tabs.y).toBeLessThan(12);
    expect(layout.tabs.x).toBeGreaterThan(layout.health.x + layout.health.w);
    expect(layout.tabs.x + layout.tabs.w).toBeLessThanOrEqual(layout.stats.x);
    expect(layout.stats.x).toBeGreaterThan(layout.w * 0.65);
    for (const b of layout.abilities) {
      expect(b.h).toBeLessThanOrEqual(58);
      expect(b.y).toBeGreaterThan(layout.h - 80);
      expect(b.x).toBeGreaterThan(layout.move.x + layout.move.w);
      expect(b.x + b.w).toBeLessThan(layout.strike.x);
      expect(b.y).toBeCloseTo(layout.abilities[0].y);
    }
    // A tab that overflows a narrow/rotated row remains reachable by scrolling.
    await page.locator('[data-form="fire"]').click();
    await expect(page.locator('[data-form="fire"]')).toHaveClass(/selected/);
    await page.locator('[data-form="demonic"]').click();
    await expect(page.locator('[data-form="demonic"]')).toHaveClass(/selected/);
    await page.screenshot({ path: `/tmp/elemental-landscape-${width}.png` });
  });
}

for (const mode of ["duel", "ffa"]) {
  test(`Flash fades promptly on death in ${mode}`, async ({ page }) => {
    await start(page, "landscape", mode, "fire");
    await page.evaluate(() => {
      const g = __arena.game;
      g.update = () => {};
      g.player.whiteout = 3;
    });
    await expect(page.locator("#flash-whiteout")).toHaveCSS("opacity", "1");
    await page.evaluate(() => {
      const g = __arena.game;
      g.fell(g.player);
      if (g.mode === "duel") g.checkMatchEnd();
      else g.advanceDeaths(0.09);
    });
    if (mode === "ffa") {
      await expect(page.locator("#flash-whiteout")).toHaveCSS("opacity", "0.5");
      await page.evaluate(() => __arena.game.advanceDeaths(0.1));
    }
    await expect(page.locator("#flash-whiteout")).toBeHidden({ timeout: 1000 });
    expect(await page.evaluate(() => __arena.game.player.whiteout)).toBe(0);
    expect(await page.evaluate(() => __arena.game.player.alive)).toBe(false);
  });
}

test("Divine crossfades for its owner and opponents without changing targeting visibility", async ({
  page,
}) => {
  await start(page, "landscape", "fused3", "divine");
  const samples = await page.evaluate(async () => {
    const { makeFighter, visibility } = await import("/src/combat.js");
    const r = __arena.renderer;
    return [true, false].map((owner) => {
      const a = makeFighter("fade-test", "divine", 0, 500, 300);
      const viewer = owner ? a : __arena.game.player;
      a.reveal = 0;
      const hidden = r.characterOpacity(a, viewer, 0);
      a.reveal = 1;
      const start = r.characterOpacity(a, viewer, 1);
      const midway = r.characterOpacity(a, viewer, 1.06);
      const visible = r.characterOpacity(a, viewer, 1.13);
      a.reveal = 0;
      const endStart = r.characterOpacity(a, viewer, 2);
      const targetable = visibility(a);
      const endMid = r.characterOpacity(a, viewer, 2.06);
      const end = r.characterOpacity(a, viewer, 2.13);
      return {
        hidden,
        start,
        midway,
        visible,
        endStart,
        endMid,
        end,
        targetable,
      };
    });
  });
  for (const [i, s] of samples.entries()) {
    expect(s.hidden).toBe(0);
    expect(s.start).toBe(0);
    expect(s.midway).toBeGreaterThan(0);
    expect(s.midway).toBeLessThan(s.visible);
    expect(s.visible).toBeCloseTo(i === 0 ? 1 : 0.3);
    expect(s.endStart).toBe(s.visible);
    expect(s.endMid).toBeGreaterThan(0);
    expect(s.endMid).toBeLessThan(s.visible);
    expect(s.end).toBe(0);
    expect(s.targetable).toBe(0);
  }
});

test("Blaze leans and faces the dash direction across inherited elemental designs", async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { drawCharacter, characterPose } = await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const c = canvas.getContext("2d");
    c.fillStyle = "#253331";
    c.fillRect(0, 0, 800, 600);
    const samples = [];
    for (const [row, element] of [
      "blaze",
      "phoenix",
      "demonic",
      "smoke",
    ].entries()) {
      for (const [col, [dx, dy]] of [
        [1, 0],
        [-1, 0],
        [0, -1],
        [0, 1],
      ].entries()) {
        const a = makeFighter("dash", element, 0, 0, 0);
        Object.assign(a, {
          fx: -dx,
          fy: -dy,
          burst: 0.15,
          burstX: dx,
          burstY: dy,
          lock: "rival",
        });
        const pose = characterPose(a);
        const matrices = [];
        const drawImage = c.drawImage.bind(c);
        c.drawImage = (...args) => {
          const { a, b, c: skew, d } = c.getTransform();
          matrices.push({ a, b, c: skew, d });
          drawImage(...args);
        };
        c.save();
        c.translate(100 + col * 200, 110 + row * 145);
        drawCharacter(c, a, 1);
        c.restore();
        c.drawImage = drawImage;
        c.fillStyle = "#efe2b4";
        c.font = "12px sans-serif";
        c.fillText(`${element} ${dx},${dy}`, 50 + col * 200, 135 + row * 145);
        samples.push({ dx, dy, pose, matrices });
      }
    }
    return { samples, image: canvas.toDataURL().split(",")[1] };
  });
  for (const { dx, dy, pose, matrices } of result.samples) {
    expect(pose.dashing).toBe(true);
    expect(pose.dashLean).toBe(1);
    expect(pose.facing).toBe(dx ? 1 : dy < 0 ? 2 : 0);
    expect(pose.flip).toBe(dx < 0);
    expect(matrices.length).toBeGreaterThan(0);
    for (const m of matrices) {
      // Rotation/mirroring preserve lengths and right angles. Shear and
      // nonuniform scaling would visibly warp the body during a dash.
      expect(Math.hypot(m.a, m.b)).toBeCloseTo(1, 8);
      expect(Math.hypot(m.c, m.d)).toBeCloseTo(1, 8);
      expect(m.a * m.c + m.b * m.d).toBeCloseTo(0, 8);
      if (dx) expect(-m.c * dx).toBeGreaterThan(0);
    }
  }
  await writeFile(
    "/tmp/elemental-dash-poses.png",
    Buffer.from(result.image, "base64"),
  );
});
