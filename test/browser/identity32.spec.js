import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("repaired movement keeps a complete cycle at standing scale in every direction", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 1120;
    canvas.height = 15 * 160;
    const c = canvas.getContext("2d");
    c.fillStyle = "#34464a";
    c.fillRect(0, 0, canvas.width, canvas.height);
    const rows = [];
    for (const [ei, element] of [
      "water",
      "fire",
      "light",
      "multi-dimensional",
      "lightning",
    ].entries()) {
      for (const [direction, [fx, fy]] of [
        [0, 1],
        [1, 0],
        [0, -1],
      ].entries()) {
        const row = ei * 3 + direction;
        const a = makeFighter("preview", element, 0, 0, 0);
        Object.assign(a, { fx, fy });
        const frames = [];
        for (let col = 0; col < 7; col++) {
          if (col)
            Object.assign(a, {
              vx: fx * 150,
              vy: fy * 150,
              movingTime: col % 2 ? 0.01 : 0.21,
              gaitDistance: (([0, 1, 3, 4, 5, 7][col - 1] + 0.1) * 75) / 8,
            });
          const draw = c.drawImage.bind(c);
          let selected;
          c.drawImage = (...args) => {
            selected ||= {
              src: args[0].src,
              crop: args.slice(1, 5),
              height: args[8],
            };
            draw(...args);
          };
          c.save();
          c.translate(col * 160 + 80, row * 160 + 135);
          c.scale(1.6, 1.6);
          drawCharacter(c, a, 0);
          c.restore();
          c.drawImage = draw;
          frames.push(selected);
        }
        c.fillStyle = "white";
        c.font = "12px sans-serif";
        c.fillText(
          `${element} ${direction}: idle | six movement frames`,
          6,
          row * 160 + 153,
        );
        rows.push({ element, frames });
      }
    }
    return { rows, image: canvas.toDataURL().split(",")[1] };
  });
  for (const { element, frames } of result.rows) {
    const expected =
      element === "lightning" ? "flight-lightning" : `run-repair-${element}`;
    for (const f of frames.slice(1)) {
      expect(f.src).toContain(expected);
      expect(f.height / frames[0].height).toBeGreaterThan(0.82);
      expect(f.height / frames[0].height).toBeLessThan(1.18);
    }
    expect(
      new Set(frames.slice(1).map((f) => JSON.stringify(f.crop))).size,
    ).toBe(element === "lightning" ? 2 : 6);
  }
  await writeFile(
    "/tmp/v32-identities.png",
    Buffer.from(result.image, "base64"),
  );
});

test("Wind holds a stable sideways flight pose and still animates vertically", async ({
  page,
}) => {
  await page.goto("/");
  const frames = await page.evaluate(async () => {
    const { characterPose } = await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    const a = makeFighter("wind", "air", 0, 0, 0);
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].map(([fx, fy]) => {
      Object.assign(a, { fx, fy, vx: fx * 150, vy: fy * 150 });
      return [0.01, 0.21].map((movingTime) => {
        a.movingTime = movingTime;
        const p = characterPose(a);
        return { frame: p.flightFrame, moving: p.flyingMoving };
      });
    });
  });
  for (const pair of frames) expect(pair.every((p) => p.moving)).toBe(true);
  for (const pair of frames.slice(0, 2))
    expect(pair[0].frame).toBe(pair[1].frame);
  for (const pair of frames.slice(2))
    expect(pair[0].frame).not.toBe(pair[1].frame);
});

test("level-III bodies retain uniform scale through actions, death and status tints", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter, drawFallenCharacter } =
      await import("/src/characters.js");
    const { Renderer } = await import("/src/render.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 1500;
    canvas.height = 700;
    const c = canvas.getContext("2d");
    c.fillStyle = "#34464a";
    c.fillRect(0, 0, 1500, 700);
    const renderer = new Renderer(document.createElement("canvas"));
    const checks = [];
    for (const [col, element] of [
      "lightning",
      "sanctuary",
      "terraformer",
      "phoenix",
      "invincible",
      "gravity",
    ].entries()) {
      const a = makeFighter("preview", element, 0, 0, 0);
      a.fx = 0;
      a.fy = 1;
      for (const [row, action] of ["idle", "move", "cast", "death"].entries()) {
        Object.assign(a, {
          vx: action === "move" ? 150 : 0,
          movingTime: action === "move" ? 0.21 : 0,
          castTime: action === "cast" ? 0.25 : 0,
          castFx: 0,
          castFy: 1,
        });
        const draw = c.drawImage.bind(c);
        let transform;
        c.drawImage = (...args) => {
          transform ||= c.getTransform();
          draw(...args);
        };
        c.save();
        c.translate(125 + col * 250, 140 + row * 170);
        if (action === "death")
          drawFallenCharacter(c, { fighter: a, elapsed: 0.1, duration: 1 });
        else drawCharacter(c, a, 0);
        c.restore();
        c.drawImage = draw;
        checks.push({
          element,
          action,
          x: Math.hypot(transform.a, transform.b),
          y: Math.hypot(transform.c, transform.d),
        });
        c.fillStyle = "white";
        c.font = "14px sans-serif";
        c.fillText(`${element} ${action}`, col * 250 + 20, row * 170 + 160);
      }
      // Status compositing must retain the entire enlarged sprite, including a dash.
      const plain = document.createElement("canvas"),
        tinted = document.createElement("canvas");
      plain.width = tinted.width = 400;
      plain.height = tinted.height = 400;
      Object.assign(a, {
        castTime: 0,
        fx: 1,
        fy: 0,
        burst: 0.2,
        burstX: 1,
        burstY: 0,
      });
      for (const [img, blind] of [
        [plain, 0],
        [tinted, 1],
      ]) {
        a.blind = blind;
        const ctx = img.getContext("2d");
        ctx.translate(200, 250);
        renderer.characterBody(ctx, a, 0);
      }
      const alpha = (img) => {
        const d = img.getContext("2d").getImageData(0, 0, 400, 400).data;
        return d.filter((v, i) => i % 4 === 3 && v > 200).length;
      };
      checks.push({ element, coverage: alpha(tinted) / alpha(plain) });
    }
    return { checks, image: canvas.toDataURL().split(",")[1] };
  });
  const scales = {
    lightning: 1,
    sanctuary: 1.3,
    terraformer: 1.4,
    phoenix: 1.275,
    invincible: 1.1,
    gravity: 1.1,
  };
  for (const check of result.checks) {
    if (check.coverage !== undefined)
      expect(check.coverage).toBeGreaterThan(0.98);
    else {
      expect(check.x).toBeCloseTo(scales[check.element]);
      expect(check.y).toBeCloseTo(check.x);
    }
  }
  await writeFile(
    "/tmp/v32-larger-fusions.png",
    Buffer.from(result.image, "base64"),
  );
});
