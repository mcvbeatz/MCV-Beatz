import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

for (const element of ["light", "dark"]) {
  test(`${element} army sees the correct traps in Moonveil Temple`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await page.setViewportSize({ width: 1024, height: 576 });
    await page.goto("/?mode=war");
    await page.locator(`[data-element="${element}"]`).click();
    await page.locator("#begin-btn").click();
    const visible = await page.evaluate(async () => {
      const g = __arena.game;
      g.countdown = 0;
      g.ai = () => {};
      const { canSeeWarTrap } = await import("/src/war.js");
      return {
        map: g.mapId,
        traps: g.spikeTraps.filter((t) => canSeeWarTrap(g, g.player, t)).length,
      };
    });
    expect(visible).toEqual({
      map: "temple",
      traps: element === "dark" ? 10 : 0,
    });
    await page.screenshot({ path: `/tmp/v28-temple-${element}.png` });
    if (element === "light") {
      const after = await page.evaluate(async () => {
        const g = __arena.game,
          trap = g.spikeTraps[0];
        const { canSeeWarTrap, updateWar } = await import("/src/war.js");
        Object.assign(g.player, { x: trap.x, y: trap.y });
        updateWar(g, 0);
        g.update = () => {};
        return {
          hp: g.player.hp,
          visible: g.spikeTraps.filter((t) => canSeeWarTrap(g, g.player, t))
            .length,
        };
      });
      expect(after).toEqual({ hp: 102, visible: 1 });
      await page.screenshot({ path: "/tmp/v28-temple-discovered.png" });
    }
    const overview = await page.evaluate(async () => {
      const { paintBattleMap } = await import("/src/battle-maps-render.js");
      const { drawTempleTraps } = await import("/src/temple-map-render.js");
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 680;
      const c = canvas.getContext("2d");
      c.scale(0.5, 0.5);
      paintBattleMap(c, __arena.game.map);
      drawTempleTraps(c, __arena.game);
      return canvas.toDataURL().split(",")[1];
    });
    await writeFile(
      `/tmp/v28-temple-overview-${element}.png`,
      Buffer.from(overview, "base64"),
    );
    expect(errors).toEqual([]);
  });
}

test("all thirteen running designs render six distinct stride frames, including quadrupeds", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { charactersReady, drawCharacter, characterPose } =
      await import("/src/characters.js");
    const { makeFighter } = await import("/src/combat.js");
    await charactersReady;
    const elements = [
      "water",
      "dark",
      "fire",
      "light",
      "earth",
      "mud",
      "mirror",
      "sun",
      "smoke",
      "gravity",
      "invincible",
      "multi-dimensional",
      "sanctuary",
    ];
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = elements.length * 110;
    const c = canvas.getContext("2d");
    c.fillStyle = "#23363d";
    c.fillRect(0, 0, canvas.width, canvas.height);
    const sources = [];
    elements.forEach((element, row) => {
      const frames = [];
      for (const [column, phase] of [0, 1, 3, 4, 5, 7].entries()) {
        const a = makeFighter("runner", element, 0, 0, 0);
        Object.assign(a, {
          vx: 150,
          fx: 1,
          fy: 0,
          movingTime: 0.1,
          gaitDistance: ((phase + 0.1) * 75) / 8,
        });
        const pose = characterPose(a);
        const draw = c.drawImage.bind(c);
        let source;
        c.drawImage = (...args) => {
          source ||= `${args[0].src}:${args[1]},${args[2]}`;
          draw(...args);
        };
        c.save();
        c.translate(90 + column * 170, 80 + row * 110);
        drawCharacter(c, a, 0);
        c.restore();
        c.drawImage = draw;
        c.fillStyle = "#e3e5d2";
        c.font = "12px sans-serif";
        c.fillText(
          `${element} · ${phase + 1}`,
          30 + column * 170,
          102 + row * 110,
        );
        frames.push({
          source,
          extra: pose.runInbetween,
          planted: pose.footContact,
        });
      }
      sources.push(frames);
    });
    return { sources, image: canvas.toDataURL().split(",")[1] };
  });
  for (const frames of result.sources) {
    expect(new Set(frames.map((f) => f.source)).size).toBe(6);
    expect(frames.map((f) => f.planted)).toEqual([
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
    expect(frames.map((f) => f.extra)).toEqual([
      false,
      false,
      true,
      false,
      false,
      true,
    ]);
  }
  await writeFile(
    "/tmp/v29-running-frames.png",
    Buffer.from(result.image, "base64"),
  );
});
