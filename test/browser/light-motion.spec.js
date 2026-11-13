import { test, expect } from "@playwright/test";
test("Light keeps a steady silhouette and four distinct running keys in every direction", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  const rows = await page.evaluate(async () => {
    const { makeFighter } = await import("/src/combat.js");
    const { drawCharacter, charactersReady } =
      await import("/src/characters.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 260;
    const c = canvas.getContext("2d");
    const rows = [];
    for (const [fx, fy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      const a = makeFighter("light-test", "light", 0, 0, 0);
      Object.assign(a, { fx, fy, vx: fx * 150, vy: fy * 150, movingTime: 1 });
      const frames = [];
      for (let key = 0; key < 4; key++) {
        a.gaitDistance = (key * 75) / 4;
        c.clearRect(0, 0, 260, 260);
        c.save();
        c.translate(130, 210);
        c.scale(2.5, 2.5);
        drawCharacter(c, a, 0);
        c.restore();
        const data = c.getImageData(0, 0, 260, 260).data;
        let top = 260,
          bottom = 0;
        for (let y = 0; y < 260; y++)
          for (let x = 0; x < 260; x++)
            if (data[(y * 260 + x) * 4 + 3] > 128) {
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
        frames.push({ top, bottom, image: canvas.toDataURL() });
      }
      rows.push(frames);
    }
    return rows;
  });
  for (const frames of rows) {
    expect(new Set(frames.map((f) => f.image)).size).toBe(4);
    expect(
      Math.max(...frames.map((f) => f.top)) -
        Math.min(...frames.map((f) => f.top)),
    ).toBeLessThanOrEqual(3);
    expect(
      Math.max(...frames.map((f) => f.bottom)) -
        Math.min(...frames.map((f) => f.bottom)),
    ).toBeLessThanOrEqual(3);
  }
});

test("Dark renders four equally timed strides and distinct attacks, casts and victories", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  const results = await page.evaluate(async () => {
    const { makeFighter } = await import("/src/combat.js");
    const { drawCharacter, charactersReady } =
      await import("/src/characters.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 260;
    const c = canvas.getContext("2d");
    const render = (a) => {
      c.clearRect(0, 0, 260, 260);
      c.save();
      c.translate(130, 210);
      c.scale(2.5, 2.5);
      drawCharacter(c, a, 0);
      c.restore();
      return canvas.toDataURL();
    };
    return [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ].map(([fx, fy]) => {
      const a = makeFighter("dark-test", "dark", 0, 0, 0);
      Object.assign(a, { fx, fy, vx: fx * 150, vy: fy * 150, movingTime: 1 });
      const strides = Array.from({ length: 8 }, (_, phase) => {
        a.gaitDistance = (phase * 75) / 8;
        return render(a);
      });
      Object.assign(a, { vx: 0, vy: 0, movingTime: 0 });
      const idle = render(a);
      a.swing = 0.08;
      const strike = render(a);
      a.swing = 0;
      a.castTime = 0.2;
      a.castFx = fx;
      a.castFy = fy;
      const cast = render(a);
      a.castTime = 0;
      a.victory = true;
      a.victoryTime = 0;
      const win1 = render(a);
      a.victoryTime = 0.7;
      const win2 = render(a);
      return { strides, actions: [idle, strike, cast, win1, win2] };
    });
  });
  for (const { strides, actions } of results) {
    expect(new Set(strides).size).toBe(4);
    for (let i = 0; i < 8; i += 2) expect(strides[i]).toBe(strides[i + 1]);
    expect(new Set(actions).size).toBe(5);
  }
});

test("Dark's front and rear running artwork alternates the supporting foot", async ({
  page,
}) => {
  await page.goto("/?mode=duel");
  await page.waitForFunction(() => window.__app?.screen === "setup");
  const contacts = await page.evaluate(async () => {
    const { makeFighter } = await import("/src/combat.js");
    const { drawCharacter, charactersReady } =
      await import("/src/characters.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 260;
    const c = canvas.getContext("2d");
    return [1, -1].map((fy) => {
      const a = makeFighter("footfall", "dark", 0, 0, 0);
      Object.assign(a, { fx: 0, fy, vx: 0, vy: fy * 150, movingTime: 1 });
      return Array.from({ length: 4 }, (_, key) => {
        a.gaitDistance = (key * 75) / 4;
        c.clearRect(0, 0, 260, 260);
        c.save();
        c.translate(130, 210);
        c.scale(2.5, 2.5);
        drawCharacter(c, a, 0);
        c.restore();
        const data = c.getImageData(0, 0, 260, 260).data;
        let bottom = 0;
        for (let y = 0; y < 260; y++)
          for (let x = 0; x < 260; x++)
            if (data[(y * 260 + x) * 4 + 3] > 128) bottom = Math.max(bottom, y);
        // The lowest 12 pixels contain the planted boot, not torso or weapons.
        let sumX = 0,
          count = 0;
        for (let y = bottom - 11; y <= bottom; y++)
          for (let x = 0; x < 260; x++)
            if (data[(y * 260 + x) * 4 + 3] > 128) {
              sumX += x;
              count++;
            }
        return sumX / count - 130;
      });
    });
  });
  for (const feet of contacts) {
    expect(feet[0]).toBeLessThan(-2);
    expect(feet[1]).toBeLessThan(-2);
    expect(feet[2]).toBeGreaterThan(2);
    expect(feet[3]).toBeGreaterThan(2);
  }
});
