// Run against the local Vite server to refresh real in-game tutorial images.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("public/guides", { recursive: true });
await page.goto(process.env.GUIDE_URL || "http://127.0.0.1:5173/");
await page.waitForFunction(() => window.__app?.screen === "home");
await page.evaluate(async () => {
  await (
    await import("/src/characters.js")
  ).charactersReady;
});
const modes = [
  "boss",
  "ctf",
  "domination",
  "gauntlet",
  "gauntlet-team",
  "roulette",
  "ffa",
  "tdm",
  "rush",
  "corruption",
  "duel",
  "fused",
  "fused3",
  "team",
];
async function start(mode, element) {
  await page.evaluate(({ mode }) => __app.chooseMode(mode), { mode });
  if (element) await page.locator(`[data-element="${element}"]`).click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    __arena.game.ai = () => {};
    __arena.game.update = () => {};
  });
}
async function capture(name) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page
    .locator("#arena-panel")
    .screenshot({ path: `public/guides/${name}.png` });
}
for (const mode of modes) {
  await start(mode, mode === "corruption" ? "light" : undefined);
  await page.evaluate(async (mode) => {
    const g = __arena.game;
    if (mode === "roulette") {
      g.time = 20;
      const { updateAdvanced } = await import("/src/advanced-modes.js");
      updateAdvanced(g);
    }
    if (mode === "corruption") {
      g.time = 7;
      g.corruptionStarted = true;
      g.corrupt(g.fighters[1]);
      g.player.hp = 1;
    }
    if (mode === "domination") {
      g.flags[2].progress = 6;
      g.flags[2].capturing = 0;
      g.player.x = g.flags[2].x;
      g.player.y = g.flags[2].y;
    }
    if (mode === "ctf") {
      g.player.x = g.flags[1].x;
      g.player.y = g.flags[1].y;
      g.updateFlags?.();
    }
  }, mode);
  await capture(mode);
}
const origins = ["water", "dark", "fire", "air", "earth", "light"];
const fusions = [
  "mud",
  "spirit",
  "mirror",
  "sun",
  "blaze",
  "cloud",
  "smoke",
  "gravity",
  "apparition",
];
const thirds = [
  "demonic",
  "divine",
  "multi-dimensional",
  "lightning",
  "invincible",
];
for (const element of [...origins, ...fusions, ...thirds]) {
  await start(
    origins.includes(element)
      ? "duel"
      : fusions.includes(element)
        ? "fused"
        : "fused3",
    element,
  );
  await page.evaluate((element) => {
    const g = __arena.game,
      a = g.player;
    if (element === "earth" || element === "mirror")
      g.utility(a, true, "earth");
    if (["cloud", "mud", "gravity"].includes(element))
      g.area(
        a,
        1,
        element === "cloud"
          ? "flood"
          : element === "mud"
            ? "quicksand"
            : "gravity",
        140,
        8,
      );
    if (["spirit", "divine"].includes(element)) {
      g.portals.begin(a);
      g.portals.place(a, 450, 260);
      g.portals.place(a, 660, 450);
      g.time = 1;
      g.portals.update();
    }
  }, element);
  await capture(element);
}
await start("duel", "water");
await capture("controls");
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(`Captured ${modes.length + 21} real game guide images.`);
