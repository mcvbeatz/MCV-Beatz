import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("live movement advances planted steps for Fire and Light, with and without target lock", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mode=duel");
  await page.locator('[data-element="fire"]').click();
  await page.locator("#begin-btn").click();
  for (const [element, locked] of [
    ["fire", false],
    ["fire", true],
    ["light", true],
  ]) {
    await page.evaluate(
      async ({ element, locked }) => {
        const { makeFighter } = await import("/src/combat.js");
        const { charactersReady, characterPose } =
          await import("/src/characters.js");
        await charactersReady;
        const g = __arena.game;
        g.countdown = 0;
        g.map = null;
        g.ai = () => {};
        const a = makeFighter("player", element, 0, 350, 350);
        g.player = a;
        g.fighters = [a, makeFighter("rival", "light", 1, 800, 500)];
        g.autoLock = (fighter) => {
          fighter.lock = locked ? "rival" : null;
        };
        const canvas = document.createElement("canvas");
        canvas.width = 1120;
        canvas.height = 150;
        const c = canvas.getContext("2d");
        c.fillStyle = "#b3ac7c";
        c.fillRect(0, 0, canvas.width, canvas.height);
        const phases = new Set();
        window.motionCheck = { done: false, contacts: [], distance: 0 };
        const sample = () => {
          const p = characterPose(a);
          if (p.groundedMoving && !phases.has(p.gaitFrame)) {
            phases.add(p.gaitFrame);
            c.save();
            c.translate(70 + p.gaitFrame * 140 - a.x, 100 - a.y);
            __arena.renderer.avatar(c, a, g.time);
            c.restore();
            c.fillStyle = "#182820";
            c.font = "12px sans-serif";
            c.fillText(
              `${p.gaitFrame + 1}${p.footContact ? " · planted" : ""}`,
              p.gaitFrame * 140 + 25,
              135,
            );
            if (p.footContact) window.motionCheck.contacts.push(p.gaitFrame);
          }
          if (phases.size === 8) {
            Object.assign(window.motionCheck, {
              done: true,
              image: canvas.toDataURL().split(",")[1],
              distance: a.x - 350,
              locked: p.sidestepping,
            });
          } else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { element, locked },
    );
    await page.keyboard.down("d");
    await page.waitForFunction(() => window.motionCheck.done);
    await page.keyboard.up("d");
    const result = await page.evaluate(() => window.motionCheck);
    expect(result.contacts.sort()).toEqual([1, 2, 5, 6]);
    expect(result.distance).toBeGreaterThan(60);
    expect(result.distance).toBeLessThan(160);
    expect(result.locked).toBe(locked);
    await writeFile(
      `/tmp/v29-${element}-${locked ? "locked" : "run"}.png`,
      Buffer.from(result.image, "base64"),
    );
  }
  expect(errors).toEqual([]);
});
