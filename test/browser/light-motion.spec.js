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
