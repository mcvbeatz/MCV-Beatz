import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("Multi-Dimensional uses distinct entry/exit stepping sprites in all directions at a consistent scale", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 750;
    const c = canvas.getContext("2d");
    c.fillStyle = "#263e44";
    c.fillRect(0, 0, 1080, 750);
    const frames = [];
    for (const [row, [fx, fy]] of [
      [0, 1],
      [1, 0],
      [0, -1],
    ].entries())
      for (let col = 0; col < 5; col++) {
        const a = makeFighter("preview", "multi-dimensional", 0, 0, 0);
        Object.assign(a, { fx, fy });
        if (col === 1 || col === 2)
          a.blink = {
            x: fx * 160,
            y: fy * 160,
            remaining: col === 1 ? 0.19 : 0.04,
          };
        if (col >= 3)
          Object.assign(a, {
            teleportArrival: col === 3 ? 0.27 : 0.04,
            teleportFx: fx,
            teleportFy: fy,
          });
        const draw = c.drawImage.bind(c);
        c.drawImage = (...args) => {
          if (col)
            frames.push({
              src: args[0].src,
              crop: args.slice(1, 5),
              scale: args[8] / args[4],
            });
          draw(...args);
        };
        c.save();
        c.translate(100 + col * 215, 210 + row * 245);
        c.scale(2.4, 2.4);
        drawCharacter(c, a, 0);
        c.restore();
        c.drawImage = draw;
      }
    return { frames, image: canvas.toDataURL().split(",")[1] };
  });
  expect(result.frames).toHaveLength(12);
  expect(
    result.frames.every((f) => f.src.includes("teleport-multi-dimensional")),
  ).toBe(true);
  expect(new Set(result.frames.map((f) => JSON.stringify(f.crop))).size).toBe(
    12,
  );
  expect(new Set(result.frames.map((f) => f.scale.toFixed(8))).size).toBe(1);
  expect(errors).toEqual([]);
  await writeFile(
    "/tmp/teleport-poses.png",
    Buffer.from(result.image, "base64"),
  );
});
