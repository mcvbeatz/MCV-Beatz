import { icon } from "./icons.js";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "./style.css";
import {
  Combat,
  ELEMENTS,
  FUSED,
  COMBOS,
  EDGES,
  nameOf,
  distance,
  combination,
} from "./combat.js";
import { Renderer, fighterColor } from "./render.js";
const $ = (id) => document.getElementById(id);
let selected = "fire",
  mode = "duel",
  teamSize = 2,
  started = false,
  paused = false,
  round = 0,
  sound = false,
  context,
  frameTime = 0,
  shownResult = false;
let game = new Combat();
const renderer = new Renderer($("game"));
const keys = new Set();
let pointerMove = null;
let soundEventTime = -1;
function beep(frequency = 180) {
  if (!sound) return;
  context ??= new AudioContext();
  const osc = context.createOscillator(),
    gain = context.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, context.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    frequency / 2,
    context.currentTime + 0.08,
  );
  gain.gain.setValueAtTime(0.06, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.12);
}
function chip(e) {
  return `<span class="element-chip" style="--element:${ELEMENTS[e]?.color || "#bda1c8"}"><i>${icon(e)}</i>${nameOf(e)}</span>`;
}
$("element-grid").innerHTML = Object.entries(ELEMENTS)
  .map(
    ([id, e]) =>
      `<button class="element-option ${id === selected ? "selected" : ""}" data-element="${id}" style="--element:${e.color}" aria-pressed="${id === selected}"><span class="symbol">${icon(id)}</span>${e.name}</button>`,
  )
  .join("");
function setProfile() {
  const e = ELEMENTS[selected];
  $("profile-name").textContent = e.name;
  $("profile-symbol").innerHTML = icon(selected);
  $("profile-symbol").style.color = e.color;
  $("profile-role").textContent = e.role;
  $("profile-desc").textContent = e.desc;
  $("profile-passive").textContent = e.passive;
  $("matchup-desc").textContent = {
    fire: "Keep the pressure on. Fire punishes enemies who get too close.",
    water:
      "Keep a clear line of fire. A hydro pump is devastating against fire.",
    earth: "Trade carefully. Hard skin gives you an edge in a close fight.",
    air: "Stay moving. Flying clears ground hazards, but turns take time.",
    dark: "Watch for a charge. Sabotage steals your rival’s biggest moment.",
    light: "Choose your openings. Recover health before rejoining the fight.",
  }[selected];
  $("strong-against").innerHTML =
    EDGES.filter(([a]) => a === selected)
      .map(([, b]) => chip(b))
      .join("") || '<span class="subtle">Win with timing & positioning</span>';
  $("weak-against").innerHTML = EDGES.filter(([, b]) => b === selected)
    .map(([a]) => chip(a))
    .join("");
  document.querySelectorAll("[data-element]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.element === selected);
    b.setAttribute("aria-pressed", b.dataset.element === selected);
  });
}
function newGame() {
  game = new Combat({ element: selected, mode, size: teamSize });
  started = true;
  paused = false;
  shownResult = false;
  round++;
  keys.clear();
  pointerMove = null;
  $("game-overlay").hidden = true;
  $("pause-btn").textContent = "II";
  $("begin-btn").innerHTML = "Restart battle <span>→</span>";
  $("game").focus({ preventScroll: true });
  beep(300);
  updateHUD();
}
function releaseInput() {
  keys.clear();
  pointerMove = null;
  if (game.player.charging) game.releaseCharge(game.player);
  game.utility(game.player, false);
}
function pause() {
  if (!started || game.finished) return;
  paused = !paused;
  releaseInput();
  $("pause-btn").textContent = paused ? "▶" : "II";
  $("game-overlay").hidden = !paused;
  if (paused) {
    $("overlay-kicker").textContent = "TAKE A BREATH";
    $("overlay-title").textContent = "Battle paused.";
    $("overlay-text").textContent = "Your next opening can wait.";
    $("overlay-play").innerHTML = "Resume battle <span>→</span>";
  } else $("game").focus({ preventScroll: true });
}
function action(key, down = true) {
  if (!started || paused || game.finished || !game.player.alive) return;
  const p = game.player;
  if (key === "j" && down) {
    game.strike(p);
    beep();
  }
  if (key === "k") {
    if (down) game.startCharge(p);
    else {
      game.releaseCharge(p);
      beep(260);
    }
  }
  if (key === "l") game.utility(p, down);
  if (key === "q" && down) game.toggleLock(p);
  if (key === "f" && down) game.fuse(p);
  if (key === "tab" && down) game.switchForm(p);
}
window.addEventListener("keydown", (e) => {
  if ($("info-dialog").open) return;
  const k = e.key.toLowerCase();
  const isGameKey = [
    "w",
    "a",
    "s",
    "d",
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "j",
    "k",
    "l",
    "q",
    "f",
    "r",
    "tab",
    "escape",
    " ",
  ].includes(k);
  if (!isGameKey) return;
  if (k === "tab" && !started) return;
  e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === "escape") pause();
  else if (k === "r") newGame();
  else if (k === " " && !started) newGame();
  else action(k);
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  keys.delete(k);
  action(k, false);
});
window.addEventListener("blur", () => {
  if (started && !paused && !game.finished) pause();
  else releaseInput();
});
for (const [id, key] of [
  ["attack-btn", "j"],
  ["charge-btn", "k"],
  ["utility-btn", "l"],
  ["lock-btn", "q"],
  ["fuse-btn", "f"],
]) {
  const b = $(id);
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    action(key);
  });
  b.addEventListener("pointerup", () => action(key, false));
  b.addEventListener("pointercancel", () => action(key, false));
  b.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action(key);
    }
  });
  b.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") action(key, false);
  });
}
$("game").style.touchAction = "none";
$("game").addEventListener("pointerdown", (e) => {
  const r = $("game").getBoundingClientRect();
  pointerMove = {
    x: ((e.clientX - r.left) / r.width) * 1024,
    y: ((e.clientY - r.top) / r.height) * 680,
  };
  $("game").setPointerCapture(e.pointerId);
});
$("game").addEventListener("pointermove", (e) => {
  if (!pointerMove) return;
  const r = $("game").getBoundingClientRect();
  pointerMove = {
    x: ((e.clientX - r.left) / r.width) * 1024,
    y: ((e.clientY - r.top) / r.height) * 680,
  };
});
$("game").addEventListener("pointerup", () => (pointerMove = null));
$("game").addEventListener("pointercancel", () => (pointerMove = null));
$("begin-btn").onclick = newGame;
$("overlay-play").onclick = () => (paused ? pause() : newGame());
$("pause-btn").onclick = pause;
$("arena-nav").onclick = () => {
  if ($("info-dialog").open) $("info-dialog").close();
  $("game-wrap").scrollIntoView({ behavior: "smooth", block: "center" });
};
document.querySelectorAll("[data-element]").forEach(
  (b) =>
    (b.onclick = () => {
      selected = b.dataset.element;
      setProfile();
      if (!started) {
        game = new Combat({ element: selected, mode, size: teamSize });
        updateHUD();
      }
    }),
);
document.querySelectorAll("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.mode;
      document
        .querySelectorAll("[data-mode]")
        .forEach((x) => x.classList.toggle("selected", x === b));
      $("team-sizes").hidden = mode !== "team";
      const titles = {
        duel: "One on one",
        team: "Fight together. Strike carefully.",
        fused: "One on one · fused",
      };
      const descriptions = {
        duel: "You, a rival, and no room for mistakes.",
        team: "Allies are vulnerable to your attacks.",
        fused: "Start evolved. Switch forms with Tab.",
      };
      $("mode-description").innerHTML =
        `<span>⚔</span><div><strong>${titles[mode]}</strong><p>${descriptions[mode]}</p></div>`;
      if (!started) {
        game = new Combat({ element: selected, mode, size: teamSize });
        updateHUD();
      }
    }),
);
document.querySelectorAll("[data-size]").forEach(
  (b) =>
    (b.onclick = () => {
      teamSize = Number(b.dataset.size);
      document
        .querySelectorAll("[data-size]")
        .forEach((x) => x.classList.toggle("selected", x === b));
      if (!started)
        game = new Combat({ element: selected, mode, size: teamSize });
    }),
);
$("sound-btn").onclick = () => {
  sound = !sound;
  $("sound-btn").textContent = sound ? "♫ Sound on" : "♫ Sound off";
  $("sound-btn").setAttribute("aria-pressed", sound);
  beep(400);
};
const guide = `<span class="eyebrow">THE BASICS</span><h2>Every strike is a decision.</h2><table><tr><td>W A S D / Arrow keys</td><td>Move freely. On touch, hold a point in the arena to move toward it.</td></tr><tr><td>J · Strike</td><td>Tap for a short directional melee attack. You must face your target.</td></tr><tr><td>Q · Target lock</td><td>Lock the nearest rival. Within range, face them while moving in any direction.</td></tr><tr><td>Hold K · Release K</td><td>Charge an elemental ability, then release. A full 1.8-second charge increases potency to 2.6×. Cooldown: 4.5 seconds.</td></tr><tr><td>L · Utility</td><td>Use your second ability. Earth holds L for a shield lasting up to 3 seconds.</td></tr><tr><td>F · Fuse / Tab · Form</td><td>Claim a compatible fallen ally’s token within range. Tab cycles your accumulated forms.</td></tr><tr><td>Esc / R</td><td>Pause / start a fresh battle with the selected setup.</td></tr></table><h3>Timing matters</h3><p>Opposing strikes within 100ms of each other clash if both fighters are in range and facing each other: each takes quarter damage. A hit pauses charging for 270ms but preserves the charge already built. Dark’s sabotage cancels a charge.</p><h3>Positioning matters</h3><p>Friendly fire is always on. Low health slows movement. Flight is faster but changes direction gradually. Same-element abilities deal half damage; a hierarchy advantage applies a 1.5× multiplier. Hydro pump has an additional 2× multiplier against fire.</p><h3>Prototype scope</h3><p>Local AI battles; no online multiplayer yet. Fusion and each form have playable first-pass abilities. Advanced spirit-realm blocking, shared portals, full token resurrection/death rules, interactable scenery and a complete status simulation remain future work. Lightning and Invincible are matchup entries, not selectable origins.</p>`;
const fusion = `<span class="eyebrow">ELEMENT CODEX / FUSION</span><h2>More than the sum.</h2><p>Only a fallen ally’s compatible token can be claimed. Stand nearby and press F. Your colors merge: two origins gain a shine, three gain a glow. Accumulated origin passives persist when you switch forms with Tab.</p><h3>Level II · Shine</h3><table>${Object.entries(
  COMBOS,
)
  .filter(([k]) => k.split("+").length === 2)
  .map(
    ([k, v]) =>
      `<tr><td>${k.split("+").map(nameOf).join(" + ")}</td><td>${nameOf(v)}</td><td>${FUSED[v].join(" / ")}</td></tr>`,
  )
  .join("")}</table><h3>Level III · Glow</h3><table>${Object.entries(COMBOS)
  .filter(([k]) => k.split("+").length === 3)
  .map(
    ([k, v]) =>
      `<tr><td>${k.split("+").map(nameOf).join(" + ")}</td><td>${nameOf(v)}</td></tr>`,
  )
  .join(
    "",
  )}</table><p style="margin-top:18px">Try Fused mode for an immediate level-II duel. Use Team brawl to earn fusion from fallen allies. Some advanced fused abilities use simplified prototype behavior; see How to play.</p>`;
function openDialog(content) {
  if (started && !paused && !game.finished) pause();
  $("dialog-content").innerHTML = content;
  $("info-dialog").showModal();
}
$("guide-btn").onclick = () => openDialog(guide);
$("fusion-guide").onclick = () => openDialog(fusion);
$("codex-btn").onclick = () =>
  openDialog(
    `<span class="eyebrow">SIX ORIGINS. ONE ARENA.</span><h2>The element codex.</h2><div class="codex-grid">${Object.entries(
      ELEMENTS,
    )
      .map(
        ([id, e]) =>
          `<article><h3>${chip(id)}</h3><p>${e.desc}</p><p><strong>${e.ability}</strong> · ${e.utility}</p><p>${e.passive}</p></article>`,
      )
      .join("")}</div><h3>Fusion paths</h3><p>${Object.entries(COMBOS)
      .map(([k, v]) => `${k.split("+").map(nameOf).join(" + ")} → ${nameOf(v)}`)
      .join("<br>")}</p>`,
  );
$("close-dialog").onclick = () => $("info-dialog").close();
$("info-dialog").addEventListener("click", (e) => {
  if (e.target === $("info-dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
function updateHUD() {
  const p = game.player,
    e = ELEMENTS[p.element];
  $("hud-name").textContent = nameOf(p.element).toUpperCase();
  $("hud-symbol").innerHTML = icon(p.element);
  $("hud-symbol").style.color = e?.color || fighterColor(p);
  $("health-fill").style.width = `${(p.hp / p.maxHp) * 100}%`;
  $("health-fill").style.background = p.hp < 40 ? "#e78c6c" : "#b2c797";
  $("health-label").textContent = `${Math.ceil(p.hp)} / ${p.maxHp} HP`;
  $("timer").textContent = `${Math.floor(game.time / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(game.time % 60)
    .toString()
    .padStart(2, "0")}`;
  $("enemy-count").textContent = game.fighters
    .filter((a) => a.team === 1 && a.alive && !a.echo)
    .length.toString()
    .padStart(2, "0");
  $("round-mode").textContent =
    `${game.mode === "team" ? "TEAM BRAWL" : game.mode === "fused" ? "FUSED DUEL" : "DUEL"} · ROUND ${Math.max(1, round).toString().padStart(2, "0")}`;
  $("ability-name").textContent =
    e?.ability || FUSED[p.element]?.[0] || "Elemental burst";
  $("ability-symbol").innerHTML = icon(p.element);
  $("utility-name").textContent =
    e?.utility || FUSED[p.element]?.[1] || "Guard";
  $("ability-status").textContent =
    p.abilityCd > 0
      ? `${p.abilityCd.toFixed(1)}s cooldown`
      : p.charging
        ? "Release to cast"
        : "Hold to charge";
  $("ability-cooldown").style.width = `${(p.abilityCd / 4.5) * 100}%`;
  $("utility-status").textContent =
    p.utilityCd > 0
      ? `${p.utilityCd.toFixed(1)}s cooldown`
      : p.element === "earth"
        ? `Hold · ${Math.ceil(p.shieldHp)} shield`
        : "Ready";
  $("lock-status").textContent =
    p.blind > 0 ? "Blinded" : game.target(p) ? "Locked on" : "Unlocked";
  $("lock-btn").classList.toggle("locked", !!game.target(p));
  $("charge-meter").hidden = !p.charging;
  $("charge-percent").textContent = `${Math.round((p.charge / 1.8) * 100)}%`;
  $("charge-fill").style.width = `${(p.charge / 1.8) * 100}%`;
  const token = game.tokens.find(
    (t) =>
      t.team === p.team && distance(p, t) < 85 && combination(p.parts, t.parts),
  );
  $("fuse-status").textContent = token
    ? "Compatible token!"
    : p.parts.length > 1
      ? "Tab to switch form"
      : "Ally token needed";
  $("fuse-btn").classList.toggle("locked", !!token);
  $("arena-hint").textContent =
    !p.alive && !game.finished
      ? "You are down. Your allies can still win."
      : p.parts.length > 1
        ? `${nameOf(p.element)} · ${p.parts.length === 2 ? "II / SHINE" : "III / GLOW"} · TAB to switch form`
        : "Find your rhythm. Every opening counts.";
  if (game.finished && !shownResult) {
    shownResult = true;
    $("game-overlay").hidden = false;
    $("overlay-kicker").textContent =
      game.result === "victory"
        ? "THE COLOSSEUM REMEMBERS"
        : game.result === "draw"
          ? "NO ONE YIELDS"
          : "ANOTHER LESSON LEARNED";
    $("overlay-title").textContent =
      game.result === "victory"
        ? "The arena is yours."
        : game.result === "draw"
          ? "A mutual reckoning."
          : "Rise and fight again.";
    $("overlay-text").textContent =
      `${Math.floor(game.time)} seconds · ${game.result === "victory" ? "Your team prevailed." : game.result === "draw" ? "Both teams fell." : "Your team has fallen."}`;
    $("overlay-play").innerHTML = "Fight again <span>→</span>";
    keys.clear();
  }
}
function frame(now) {
  const dt = Math.min((now - frameTime) / 1000, 0.04) || 0.016;
  frameTime = now;
  if (started && !paused && !game.finished) {
    let x =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft")),
      y =
        Number(keys.has("s") || keys.has("arrowdown")) -
        Number(keys.has("w") || keys.has("arrowup"));
    if (pointerMove) {
      const d = distance(game.player, pointerMove);
      if (d > 8) {
        x = pointerMove.x - game.player.x;
        y = pointerMove.y - game.player.y;
      }
    }
    game.update(dt, { x, y });
    if (keys.has("j")) game.strike(game.player);
    const latest = game.events.at(-1);
    if (latest && latest.time > soundEventTime) {
      soundEventTime = latest.time;
      if (/^\d+$/.test(latest.text)) beep(100);
    }
  }
  renderer.draw(game, !started);
  updateHUD();
  requestAnimationFrame(frame);
}
document.querySelector("#attack-btn .ability-icon").innerHTML = icon("strike");
document.querySelector(".fire-orb").innerHTML = icon("fire");
document.querySelector(".air-orb").innerHTML = icon("air");
document.querySelector(".blaze-orb").innerHTML = icon("fusion");
setProfile();
updateHUD();
requestAnimationFrame(frame);
// Read-only inspection hook for browser smoke tests and local debugging.
window.__arena = {
  get game() {
    return game;
  },
  get started() {
    return started;
  },
  get paused() {
    return paused;
  },
};
