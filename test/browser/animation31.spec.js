import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("targeted directional runs use repaired cycles while Sun stays on its original cycle", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const rows = [
      ["smoke", 0, 1],
      ["light", 1, 0],
      ["light", 0, -1],
      ["water", 1, 0],
      ["fire", 1, 0],
      ["fire", 0, -1],
      ["sun", 1, 0],
    ];
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = rows.length * 120;
    const c = canvas.getContext("2d");
    c.fillStyle = "#354448";
    c.fillRect(0, 0, canvas.width, canvas.height);
    const sources = [];
    rows.forEach(([e, fx, fy], row) => {
      const a = makeFighter("runner", e, 0, 0, 0);
      Object.assign(a, { fx, fy, vx: 150, movingTime: 1 });
      const selected = [];
      [0, 1, 3, 4, 5, 7].forEach((phase, col) => {
        a.gaitDistance = ((phase + 0.1) * 75) / 8;
        const draw = c.drawImage.bind(c);
        let source;
        c.drawImage = (...args) => {
          source ||= args[0].src;
          draw(...args);
        };
        c.save();
        c.translate(80 + col * 160, 90 + row * 120);
        drawCharacter(c, a, 0);
        c.restore();
        c.drawImage = draw;
        c.fillStyle = "#fff";
        c.font = "12px sans-serif";
        c.fillText(
          `${e} ${fy < 0 ? "back" : fx ? "side" : "front"} ${phase}`,
          col * 160 + 10,
          row * 120 + 112,
        );
        selected.push(source);
      });
      sources.push(selected);
    });
    return { sources, image: canvas.toDataURL().split(",")[1] };
  });
  result.sources
    .slice(0, 6)
    .flat()
    .forEach((s) => expect(s).toContain("run-repair"));
  result.sources[6].forEach((s) => expect(s).not.toContain("run-repair"));
  await writeFile("/tmp/v31-running.png", Buffer.from(result.image, "base64"));
});

test("every flyer has moving frames and every elemental has a directional casting sprite", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter, CHARACTERS } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = CHARACTERS.length * 110;
    const c = canvas.getContext("2d");
    c.fillStyle = "#354448";
    c.fillRect(0, 0, canvas.width, canvas.height);
    let flying = 0;
    const errors = [];
    CHARACTERS.forEach((e, row) => {
      const a = makeFighter("actor", e, 0, 0, 0);
      const render = (column) => {
        let src;
        const draw = c.drawImage.bind(c);
        c.drawImage = (...args) => {
          src ||= args[0].src;
          draw(...args);
        };
        c.save();
        c.translate(75 + column * 150, 85 + row * 110);
        drawCharacter(c, a, 0);
        c.restore();
        c.drawImage = draw;
        return src;
      };
      const idle = render(0);
      if (a.parts.includes("air")) {
        Object.assign(a, { vx: 150, movingTime: 0.01, fx: 1, fy: 0 });
        const first = render(1);
        a.movingTime = 0.21;
        const second = render(2);
        if (!first.includes("flight-") || !second.includes("flight-"))
          errors.push(e + " flight");
        a.vx = 0;
        a.movingTime = 0;
        flying++;
      }
      [
        [0, 1],
        [1, 0],
        [0, -1],
      ].forEach(([fx, fy], i) => {
        Object.assign(a, { castTime: 0.25, castFx: fx, castFy: fy });
        if (
          !render(i + 3).includes(e === "mud" ? "mud-core" : "cast-") ||
          idle.includes("cast-")
        )
          errors.push(e + " cast");
      });
      c.fillStyle = "#fff";
      c.font = "12px sans-serif";
      c.fillText(e, 5, row * 110 + 104);
    });
    return { flying, errors, image: canvas.toDataURL().split(",")[1] };
  });
  expect(result.errors).toEqual([]);
  expect(result.flying).toBe(10);
  await writeFile(
    "/tmp/v31-flight-cast.png",
    Buffer.from(result.image, "base64"),
  );
});

test("Earth retains its standing scale throughout the running cycle", async ({
  page,
}) => {
  await page.goto("/");
  const sizes = await page.evaluate(async () => {
    const { charactersReady, drawCharacter } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const c = document.createElement("canvas").getContext("2d");
    const a = makeFighter("earth", "earth", 0, 0, 0);
    a.fx = 1;
    a.fy = 0;
    const heights = [];
    c.drawImage = (...args) => heights.push(args[8]);
    drawCharacter(c, a, 0);
    for (let phase = 0; phase < 8; phase++) {
      Object.assign(a, {
        vx: 150,
        movingTime: 1,
        gaitDistance: ((phase + 0.1) * 75) / 8,
      });
      drawCharacter(c, a, 0);
    }
    return heights;
  });
  for (const h of sizes.slice(1)) {
    expect(h / sizes[0]).toBeGreaterThan(0.82);
    expect(h / sizes[0]).toBeLessThan(1.18);
  }
});

test("Vog expands from a small eruption and does not replay when fire shortens its duration", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { drawSmoke } = await import("/src/battle-effects.js");
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 220;
    const c = canvas.getContext("2d");
    const h = { kind: "vog", x: 100, y: 100, r: 80, life: 8, createdAt: 0 };
    const g = {
      hazards: [h],
      player: { parts: ["dark"] },
      auroraProtected: () => false,
    };
    const counts = [];
    for (const [i, time] of [0, 0.15, 0.55].entries()) {
      c.save();
      c.translate(i * 220, 0);
      drawSmoke(c, g, time);
      c.restore();
      let count = 0;
      const data = c.getImageData(i * 220, 0, 200, 200).data;
      for (let p = 3; p < data.length; p += 4) if (data[p] > 15) count++;
      counts.push(count);
    }
    return { counts, image: canvas.toDataURL().split(",")[1] };
  });
  expect(result.counts[0]).toBeLessThan(result.counts[1] / 4);
  expect(result.counts[1]).toBeLessThan(result.counts[2]);
  await writeFile("/tmp/v31-vog.png", Buffer.from(result.image, "base64"));
});
