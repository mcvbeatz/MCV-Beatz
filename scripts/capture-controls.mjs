// Real engine states and input, with temporary teaching annotations in the DOM.
// Capture the displayed app; no source sprites or saved screenshots are edited.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  HTMLElement.prototype.requestFullscreen = undefined;
  Math.random = () => 0.35;
  localStorage.setItem(
    "elemental-settings",
    JSON.stringify({ orientation: "landscape" }),
  );
});
await mkdir("public/guides", { recursive: true });
await page.goto(process.env.GUIDE_URL || "http://127.0.0.1:5173/");
await page.waitForFunction(() => window.__app?.screen === "home");
await page.evaluate(
  async () => await (await import("/src/characters.js")).charactersReady,
);
async function start(mode, element) {
  await page.mouse.up();
  await page.evaluate((mode) => {
    document.getElementById("teaching-overlay")?.remove();
    __app.chooseMode(mode);
  }, mode);
  await page.locator(`[data-element="${element}"]`).click();
  await page.locator("#begin-btn").click();
  await page.evaluate(() => {
    const g = __arena.game;
    g.ai = () => {};
    g.update = () => {};
    g.fighters.forEach((a, i) =>
      Object.assign(a, { x: i ? 800 : 440, y: i ? 470 : 350, fx: 1, fy: 0 }),
    );
    g.time = 0.5;
  });
  await frames();
}
async function frames() {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}
async function world(x, y) {
  return page.evaluate(
    ({ x, y }) => {
      const r = document.getElementById("game").getBoundingClientRect(),
        v = __arena.renderer.view;
      return { x: r.x + x * v.scale + v.tx, y: r.y + y * v.scale + v.ty };
    },
    { x, y },
  );
}
async function annotate({ rings = [], arrows = [], caption = "", inset } = {}) {
  await frames();
  await page.evaluate(
    ({ rings, arrows, caption, inset }) => {
      document.getElementById("teaching-overlay")?.remove();
      const panel = document.getElementById("arena-panel"),
        rect = panel.getBoundingClientRect();
      const o = document.createElement("div");
      o.id = "teaching-overlay";
      o.style = "position:absolute;inset:0;z-index:90;pointer-events:none";
      panel.append(o);
      const label = (text, x, y) => {
        const el = document.createElement("span");
        el.textContent = text;
        el.style = `position:absolute;left:${x}px;top:${y}px;background:#102a2af2;color:#fff2c9;border:1px solid #e8c578;border-radius:6px;padding:6px 9px;font:600 13px sans-serif;max-width:300px`;
        o.append(el);
      };
      for (const { selector, label: text } of rings) {
        const r = document.querySelector(selector).getBoundingClientRect();
        const box = document.createElement("div");
        box.style = `position:absolute;left:${r.x - rect.x - 4}px;top:${r.y - rect.y - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;border:3px solid #ffe4a2;border-radius:12px;box-shadow:0 0 12px #ffdc7c77;box-sizing:border-box`;
        o.append(box);
        label(
          text,
          Math.min(720, Math.max(6, r.x - rect.x)),
          Math.max(8, r.y - rect.y - 36),
        );
      }
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style = "position:absolute;inset:0";
      svg.innerHTML =
        '<defs><marker id="guide-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#8ff4ef" stroke-width="2"/></marker></defs>';
      o.append(svg);
      const canvas = document.getElementById("game").getBoundingClientRect(),
        v = __arena.renderer.view;
      for (const a of arrows) {
        const x1 = canvas.x - rect.x + a.from[0] * v.scale + v.tx,
          y1 = canvas.y - rect.y + a.from[1] * v.scale + v.ty,
          x2 = canvas.x - rect.x + a.to[0] * v.scale + v.tx,
          y2 = canvas.y - rect.y + a.to[1] * v.scale + v.ty;
        const path = document.createElementNS(svg.namespaceURI, "path");
        path.setAttribute("d", `M${x1} ${y1} L${x2} ${y2}`);
        path.setAttribute("stroke", "#8ff4ef");
        path.setAttribute("stroke-width", "4");
        path.setAttribute("fill", "none");
        path.setAttribute("marker-end", "url(#guide-arrow)");
        svg.append(path);
        if (a.label) label(a.label, (x1 + x2) / 2 - 45, Math.min(y1, y2) - 35);
      }
      if (caption) label(caption, 20, 148);
      if (inset) {
        const box = document.createElement("div");
        box.style =
          "position:absolute;right:25px;top:145px;background:#102a2a;padding:7px;border:2px solid #f5df9f;border-radius:8px;color:#fff2c9;font:600 12px sans-serif";
        box.innerHTML = `Before contact<br><img src="${inset}" style="display:block;width:230px;margin-top:5px">`;
        o.append(box);
      }
    },
    { rings, arrows, caption, inset },
  );
  if (inset)
    await page.waitForFunction(
      () => document.querySelector("#teaching-overlay img")?.complete,
    );
}
async function capture(name) {
  await frames();
  await page
    .locator("#arena-panel")
    .screenshot({ path: `public/guides/${name}.png` });
}
// Move: actual held analog stick and a running frame from Combat.move.
await start("duel", "water");
let r = await page.locator("#joystick").boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
await page.mouse.down();
await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.3);
await page.evaluate(() => {
  const g = __arena.game;
  g.move(g.player, 1, -0.4, 0.15);
  g.player.movingTime = 0.3;
});
await annotate({
  rings: [{ selector: "#joystick", label: "Drag away from center" }],
  arrows: [{ from: [465, 345], to: [570, 290], label: "Movement direction" }],
});
await capture("control-move");
// Strike: a real automatic lock and resolved melee damage with Strike held.
await start("duel", "dark");
await page.evaluate(async () => {
  const g = __arena.game,
    { makeFighter } = await import("/src/combat.js");
  g.fighters[1] = makeFighter("enemy", "water", 1, 484, 350);
  g.autoLock(g.player);
});
await page.locator("#attack-btn").hover();
await page.mouse.down();
await page.evaluate(() => {
  const g = __arena.game;
  g.time += 0.12;
  g.resolveStrikes();
});
await annotate({
  rings: [{ selector: "#attack-btn", label: "Press Strike" }],
  arrows: [
    { from: [565, 270], to: [484, 317], label: "Automatic target lock" },
  ],
  caption: "Close enough to strike · hit connects",
});
await capture("control-strike");
// Skills: charge then release Sonic boom into its visible wind fan.
await start("duel", "air");
await page.locator("#charge-btn").hover();
await page.mouse.down();
await page.evaluate(() => {
  __arena.game.player.charge = 1;
});
await page.mouse.up();
await page.evaluate(() => __arena.game.updateWaves(0.23));
await annotate({
  rings: [{ selector: "#charge-btn", label: "Charge, then release" }],
  arrows: [
    { from: [470, 390], to: [610, 390], label: "Sonic boom fans outward" },
  ],
});
await capture("control-skills");
// Fused identity stays while the selected origin tab changes its buttons.
await start("fused", "mirror");
await page.locator('[data-form="light"]').click();
await annotate({
  rings: [
    {
      selector: "#skill-switcher",
      label: "Switch Earth / Light / Mirror here",
    },
    {
      selector: ".skill-controls",
      label: "Skills change with the selected tab",
    },
  ],
  caption: "Still Mirror · inherited passives stay active",
});
await capture("control-switch");
// Real token drop, then absorption. Include a close-up of the actual pre-pickup state.
await start("team", "light");
await page.evaluate(() => {
  const g = __arena.game,
    a = g.fighters.find((b) => b !== g.player && b.team === g.player.team);
  Object.assign(a, { x: 485, y: 350 });
  g.fell(a);
  g.time += 0.5;
});
await frames();
let from = await world(385, 265),
  to = await world(545, 390);
await page.screenshot({
  path: "public/guides/control-token-before.png",
  clip: { x: from.x, y: from.y, width: to.x - from.x, height: to.y - from.y },
});
await page.evaluate(() => {
  const g = __arena.game;
  g.player.x = 485;
  if (!g.touchTokens(g.player)) throw new Error("Token demonstration failed");
  g.effects.forEach((e) => (e.life *= 0.8));
});
await annotate({
  caption: "Air token absorbed · Light becomes Spirit",
  arrows: [{ from: [400, 390], to: [480, 350], label: "Touch to fuse" }],
  inset: "/guides/control-token-before.png",
});
await capture("control-fusion");
// Portal taps: both gates have been placed using actual canvas clicks.
await start("fused", "spirit");
await page.locator("#utility-btn").click();
for (const [x, y] of [
  [520, 270],
  [690, 400],
]) {
  const p = await world(x, y);
  await page.mouse.click(p.x, p.y);
}
await page.evaluate(() => {
  __arena.game.time += 0.7;
  __arena.game.portals.update();
});
await annotate({
  rings: [{ selector: "#utility-btn", label: "1 · Activate Portals" }],
  arrows: [
    { from: [570, 210], to: [520, 270], label: "2 · Tap here" },
    { from: [750, 340], to: [690, 400], label: "3 · Tap a second spot" },
  ],
});
await capture("control-portals");
// Teleport: destination marker during the genuine preparation window.
await start("fused3", "multi-dimensional");
let p = await world(590, 300);
await page.mouse.click(p.x, p.y);
await annotate({
  rings: [
    { selector: "#teleport-info-btn", label: "Tap the arena to teleport" },
  ],
  arrows: [{ from: [455, 350], to: [590, 300], label: "Tap destination" }],
  caption: "0.2-second preparation · no cooldown",
});
await capture("control-teleport");
// Telekinesis: actual swipe moves a selected enemy in the swipe direction.
await start("fused", "gravity");
await page.evaluate(() =>
  Object.assign(__arena.game.fighters[1], { x: 540, y: 340 }),
);
p = await world(540, 340);
let end = await world(625, 285);
await page.mouse.move(p.x, p.y);
await page.mouse.down();
await page.mouse.move(end.x, end.y, { steps: 4 });
await page.mouse.up();
await page.evaluate(() => {
  const g = __arena.game;
  g.move(g.fighters[1], 0, 0, 0.025);
});
await annotate({
  arrows: [{ from: [540, 340], to: [625, 285], label: "Swipe enemy this way" }],
  rings: [{ selector: "#charge-btn", label: "Or tap to push nearest enemy" }],
});
await capture("control-telekinesis");
await page.evaluate(() => {
  document.getElementById("teaching-overlay")?.remove();
  __app.show("settings");
});
await frames();
await page
  .locator("#app-shell")
  .screenshot({ path: "public/guides/control-settings.png" });
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log("Captured 9 action lessons plus the token pickup close-up.");
