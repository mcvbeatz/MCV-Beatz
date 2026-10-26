import {
  orientationPoint,
  setOrientation,
  enableOrientedScroll,
} from "./orientation.js";
import { createApp } from "./app-shell.js";
import { MODES } from "./mode-catalog.js";
import { icon } from "./icons.js";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "./style.css";
import "./app-shell.css";
import {
  Combat,
  ELEMENTS,
  COMBOS,
  EDGES,
  LEVEL_TWO,
  LEVEL_THREE,
  nameOf,
  recipe,
  activeForm,
  skillsFor,
  extraSkillsFor,
  hasPassive,
  inWorld,
} from "./combat.js";
import { Renderer, fighterColor } from "./render.js";
import {
  CHARACTERS,
  ATTACK_NAMES,
  charactersReady,
  paintPortraits,
  portraitMarkup,
} from "./characters.js";
const $ = (id) => document.getElementById(id);
let selected = "fire",
  mode = "duel",
  teamSize = 2,
  ffaSize = 4,
  started = false,
  paused = false,
  round = 0,
  sound = false,
  audio,
  frameTime = 0,
  shownResult = false,
  immersive = false;
let app;
let game = new Combat();
const renderer = new Renderer($("game"));
const keys = new Set();
const resetActionPointers = [];
const stick = { x: 0, y: 0, pointer: null };
let heldStrike = false,
  formSignature = "";
const descriptions = {
  phoenix: [
    "Flame & renewal",
    "Fire, Air and Light. Laser beam and Speed burst are available together. Rebirth restores half health once per match.",
    "Rebirth · flight · contact burn · Angel guard",
  ],
  terraformer: [
    "Rifts & confinement",
    "Tap the arena to open a Chasm after one second. Trap the nearest enemy in a 65-HP Stone Prison, or hold Rock shield.",
    "Flight · hard skin · gravity immunity",
  ],
  sanctuary: [
    "Restoration & protection",
    "Create one permanent Life spring per match. Aurora protects living teammates from harmful status effects while you are alive.",
    "Aurora · hard skin · Reflect · venomous contact",
  ],
  mud: [
    "Control & attrition",
    "Quicksand controls the floor. Venom on contact is automatic.",
    "Venomous contact · quicksand immunity",
  ],
  spirit: [
    "Guardians & gateways",
    "Revive the nearest fallen ally. Place two portals and protect allies even after you fall.",
    "Angel guard · flight · Light affinity",
  ],
  mirror: [
    "Defense & reflection",
    "Reflect is always active. Hold Rock shield or charge Healing directly from Mirror.",
    "Reflect · hard skin · Light affinity",
  ],
  sun: [
    "Radiance & pressure",
    "A fast beam cuts through the arena. Use Heatwave for pressure and Healing to restore an ally.",
    "Contact burn · burn immunity",
  ],
  blaze: [
    "Momentum & heat",
    "Dash through fighters with a trail of flames. No cooldown; burn only hurts while touching you.",
    "Flight · contact burn",
  ],
  cloud: [
    "Weather & control",
    "Send out a tornado or flood the arena.",
    "Flight · burn immunity",
  ],
  smoke: [
    "Obscurity & pressure",
    "Use Vog and Flamethrower for pressure, and Shadow step to dodge a strike.",
    "Contact burn · burn immunity",
  ],
  gravity: [
    "Force & control",
    "Swipe an enemy to move them, or tap Telekinesis to push the nearest rival away. Reach: 400. Hold Rock shield to defend.",
    "Hard skin",
  ],
  apparition: [
    "Evasion & echoes",
    "Summon a double that pursues enemies, or send out a sonic boom.",
    "Flight · gravity immunity",
  ],
  "multi-dimensional": [
    "Space without limits",
    "Tap to prepare a teleport up to 180 units away. A visible destination and vulnerable 0.2-second delay give rivals a chance to react. No cooldown.",
    "Tap-to-teleport · Reflect · hard skin",
  ],
  divine: [
    "Protection & radiance",
    "Invisible at rest. Actions reveal a 30% silhouette; continuous movement briefly reveals 10% each second. Damage gives a brief 10% glimpse.",
    "Invisibility · Angel guard · Reflect · immunity",
  ],
  lightning: [
    "Instant strikes & contact control",
    "Strike instantly, heal an ally, or give the whole team Tailwind. Shock stops movement while fighters touch you.",
    "Contact shock · flight · burn immunity",
  ],
  invincible: [
    "Strength & endurance",
    "Melee strikes deal double damage. Movement is 15% slower. Abilities and contact burn keep their normal damage. Choose Earth, Fire or Light skills.",
    "2× melee strength · Reflect · hard skin · contact burn",
  ],
  demonic: [
    "Minions & heat",
    "Summon burning minions or place a Death sigil once per match to lower any entrant by one tier. Speed burst and Sonic boom remain available.",
    "Flight · contact burn",
  ],
};
function profile(e) {
  if (ELEMENTS[e]) return ELEMENTS[e];
  const [role, desc, passive] = descriptions[e] || [
    "Fusion",
    "A fusion of elemental abilities.",
    "Inherited passives",
  ];
  return {
    name: nameOf(e),
    color: fighterColor({ parts: recipe(e) }),
    role,
    desc,
    passive,
  };
}
function beep(frequency = 180) {
  app?.sound.tone(frequency);
}
function chip(e) {
  return `<span class="element-chip" style="--element:${profile(e).color}"><i>${icon(e)}</i>${nameOf(e)}</span>`;
}
function setProfile() {
  const e = profile(selected);
  $("profile-name").textContent = e.name;
  $("profile-symbol").innerHTML = CHARACTERS.includes(selected)
    ? portraitMarkup(selected)
    : icon(selected);
  $("character-views").hidden = !CHARACTERS.includes(selected);
  $("character-views").innerHTML = CHARACTERS.includes(selected)
    ? `<div class="character-turnaround">${["Front", "Side", "Back"].map((label, i) => `<figure>${portraitMarkup(selected, i)}<figcaption>${label}</figcaption></figure>`).join("")}</div><p class="character-attack">${ATTACK_NAMES[selected]} <span>· melee animation</span></p>`
    : "";
  paintPortraits();
  $("profile-symbol").style.color = e.color;
  $("profile-role").textContent = e.role;
  $("profile-desc").textContent = e.desc;
  $("profile-passive").textContent = e.passive;
  document.querySelector(".tier").textContent = ["I", "II", "III"][
    recipe(selected).length - 1
  ];
  $("matchup-desc").textContent = e.desc;
  $("strong-against").innerHTML =
    EDGES.filter(([a]) => a === selected)
      .map(([, b]) => chip(b))
      .join("") || '<span class="subtle">Win with timing & positioning</span>';
  $("weak-against").innerHTML =
    EDGES.filter(([, b]) => b === selected)
      .map(([a]) => chip(a))
      .join("") || '<span class="subtle">Mind your timing</span>';
  document.querySelectorAll("[data-element]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.element === selected);
    b.setAttribute("aria-pressed", b.dataset.element === selected);
  });
}
function renderSelection() {
  enableOrientedScroll($("element-grid"), "x");
  const pool =
    mode === "corruption"
      ? ["light"]
      : mode === "fused"
        ? LEVEL_TWO
        : mode === "fused3"
          ? LEVEL_THREE
          : Object.keys(ELEMENTS);
  if (!pool.includes(selected)) selected = pool[0];
  $("element-grid").innerHTML = pool
    .map(
      (id) =>
        `<button class="element-option ${id === selected ? "selected" : ""}" data-element="${id}" style="--element:${profile(id).color}" aria-pressed="${id === selected}"><span class="symbol">${CHARACTERS.includes(id) ? portraitMarkup(id) : icon(id)}</span>${nameOf(id)}</button>`,
    )
    .join("");
  document.querySelector(".setup-panel .subtle").textContent =
    mode === "fused"
      ? "9 level-II fusions"
      : mode === "fused3"
        ? `${LEVEL_THREE.length} level-III fusions`
        : mode === "corruption"
          ? "Everyone starts as Light"
          : mode === "boss"
            ? "Choose your origin · boss selected randomly"
            : "6 origins";
  $("element-grid").onclick = (e) => {
    const b = e.target.closest("[data-element]");
    if (!b) return;
    selected = b.dataset.element;
    setProfile();
    if (!started) {
      game = new Combat({
        element: selected,
        mode,
        size: teamSize,
        players: ffaSize,
      });
      formSignature = "";
      updateHUD();
    }
  };
  setProfile();
  const grid = $("element-grid"),
    card = grid.querySelector(".selected");
  if (card)
    grid.scrollLeft =
      card.offsetLeft - (grid.clientWidth - card.clientWidth) / 2;
}
function newGame() {
  releaseInput();
  game = new Combat({
    element: selected,
    mode,
    size: teamSize,
    players: ffaSize,
    countdown: true,
  });
  started = true;
  paused = false;
  shownResult = false;
  round++;
  formSignature = "";
  $("game-overlay").hidden = true;
  $("pause-btn").textContent = "II";
  $("begin-btn").innerHTML = "Restart battle <span>→</span>";
  $("game").focus({ preventScroll: true });
  app?.start();
  enterImmersive();
  beep(300);
  updateHUD();
}
function releaseInput() {
  arenaPointer = null;
  keys.clear();
  resetActionPointers.forEach((reset) => reset());
  heldStrike = false;
  stick.x = stick.y = 0;
  stick.pointer = null;
  $("stick-thumb").style.transform = "translate(0,0)";
  game.player.charging = false;
  game.utility(game.player, false);
  document
    .querySelectorAll(".pressed")
    .forEach((b) => b.classList.remove("pressed"));
}
function pause(force) {
  if (!started || game.finished) return;
  paused = typeof force === "boolean" ? force : !paused;
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
function chargeAction(p, form, down) {
  if (app?.settings.charging === "tap") {
    if (!down) return;
    if (p.charging && p.chargeForm === form) game.releaseCharge(p);
    else game.startCharge(p, form);
  } else if (down) game.startCharge(p, form);
  else if (p.chargeForm === form) game.releaseCharge(p);
}
function action(key, down = true) {
  if (
    !started ||
    paused ||
    game.finished ||
    game.intermission ||
    game.countingDown ||
    app?.screen !== "battle" ||
    app?.slidesOpen
  )
    return;
  const p = game.player;
  if (key === "j") {
    heldStrike = down;
    if (down && game.strike(p)) beep();
  }
  if (key === "k") chargeAction(p, activeForm(p), down);
  if (key === "l") game.utility(p, down);
  if (key === "u" || key === "i") {
    const skill = extraSkillsFor(activeForm(p))[key === "u" ? 0 : 1];
    if (!skill) return;
    if (skill.kind === "utility") game.utility(p, down, skill.form);
    else chargeAction(p, skill.form, down);
  }
  if (key === "tab" && down) {
    game.switchForm(p);
    formSignature = "";
  }
}
window.addEventListener("keydown", (e) => {
  if (
    $("info-dialog").open ||
    app?.slidesOpen ||
    app?.screen !== "battle" ||
    e.target.closest("input,select,textarea")
  )
    return;
  const k = e.key.toLowerCase();
  if (
    ![
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
      "u",
      "i",
      "r",
      "tab",
      "escape",
      " ",
    ].includes(k)
  )
    return;
  if (k === "tab" && !started) return;
  if (
    (e.target.closest("button") || e.target.closest("a")) &&
    [" ", "tab"].includes(k) &&
    !immersive
  )
    return;
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
  if (started && !paused && !game.finished) pause(true);
  else releaseInput();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started && !paused) pause(true);
});
// Each thumb/button owns its pointer so movement and skills work simultaneously.
for (const [id, key] of [
  ["attack-btn", "j"],
  ["charge-btn", "k"],
  ["utility-btn", "l"],
  ["extra-skill-0", "u"],
  ["extra-skill-1", "i"],
]) {
  const b = $(id);
  let pointer = null;
  resetActionPointers.push(() => {
    if (pointer !== null && b.hasPointerCapture(pointer))
      b.releasePointerCapture(pointer);
    pointer = null;
  });
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (pointer !== null) return;
    pointer = e.pointerId;
    b.setPointerCapture(pointer);
    b.classList.add("pressed");
    action(key);
  });
  const end = (e) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    b.classList.remove("pressed");
    action(key, false);
  };
  b.addEventListener("pointerup", end);
  b.addEventListener("pointercancel", end);
  b.addEventListener("lostpointercapture", end);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  b.addEventListener("keydown", (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) action(key);
    }
  });
  b.addEventListener("keyup", (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      action(key, false);
    }
  });
}
function localPoint(el, clientX, clientY) {
  return orientationPoint(el, clientX, clientY);
}
function updateStick(e) {
  const el = $("joystick"),
    p = localPoint(el, e.clientX, e.clientY),
    radius = el.clientWidth * 0.34;
  let x = p.x - el.clientWidth / 2,
    y = p.y - el.clientHeight / 2,
    d = Math.hypot(x, y);
  if (d > radius) {
    x = (x / d) * radius;
    y = (y / d) * radius;
  }
  stick.x = x / radius;
  stick.y = y / radius;
  if (Math.hypot(stick.x, stick.y) < 0.1) stick.x = stick.y = 0;
  $("stick-thumb").style.transform = `translate(${x}px,${y}px)`;
}
$("joystick").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (stick.pointer !== null) return;
  stick.pointer = e.pointerId;
  e.currentTarget.setPointerCapture(e.pointerId);
  updateStick(e);
});
$("joystick").addEventListener("pointermove", (e) => {
  if (e.pointerId === stick.pointer) {
    e.preventDefault();
    updateStick(e);
  }
});
const endStick = (e) => {
  if (e.pointerId !== stick.pointer) return;
  stick.pointer = null;
  stick.x = stick.y = 0;
  $("stick-thumb").style.transform = "translate(0,0)";
};
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  $("joystick").addEventListener(type, endStick);
let arenaPointer = null;
$("game").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (arenaPointer !== null) return;
  const local = localPoint($("game"), e.clientX, e.clientY);
  const start = renderer.worldPoint(local.x, local.y);
  const target = game
    .enemies(game.player)
    .filter(
      (b) =>
        Math.abs(start.x - b.x) <= 30 &&
        start.y >= b.y - 70 &&
        start.y <= b.y + 10,
    )
    .sort(
      (b, c) =>
        Math.hypot(start.x - b.x, start.y - b.y + 30) -
        Math.hypot(start.x - c.x, start.y - c.y + 30),
    )[0];
  arenaPointer = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    start,
    target: target?.id,
    form: activeForm(game.player),
  };
  $("game").setPointerCapture(e.pointerId);
});
$("game").addEventListener("pointerup", (e) => {
  if (arenaPointer?.id !== e.pointerId) return;
  const click =
    Math.hypot(e.clientX - arenaPointer.x, e.clientY - arenaPointer.y) < 15;
  const gesture = arenaPointer;
  arenaPointer = null;
  if (
    !started ||
    paused ||
    game.finished ||
    game.intermission ||
    game.countingDown ||
    app?.screen !== "battle" ||
    app?.slidesOpen
  )
    return;
  const local = localPoint($("game"), e.clientX, e.clientY),
    p = renderer.worldPoint(local.x, local.y),
    a = game.player;
  if (!click) {
    if (
      gesture.form === "gravity" &&
      activeForm(a) === "gravity" &&
      !game.portals.placing
    ) {
      const target = game.fighters.find((b) => b.id === gesture.target);
      // Camera panning must not add an unintended component to the finger's swipe.
      const from = localPoint($("game"), gesture.x, gesture.y);
      game.telekinesis(a, target, local.x - from.x, local.y - from.y);
    }
    return;
  }
  const portal = game.portals
    .owned(a)
    .find((q) => Math.hypot(p.x - q.x, p.y - q.y) < 36);
  if (portal) {
    game.portals.close(a, portal.id);
    return;
  }
  if (game.portals.placing === a.id) {
    game.portals.place(a, p.x, p.y);
    return;
  }
  if (activeForm(a) === "terraformer" || a.chasmReady) {
    game.placeChasm(a, p.x, p.y);
    return;
  }
  game.teleport(a, p.x, p.y);
});
$("game").addEventListener("pointercancel", () => (arenaPointer = null));
$("game").addEventListener("lostpointercapture", () => (arenaPointer = null));
$("cancel-portal").onclick = () => {
  game.portals.placing = null;
  game.player.chasmReady = false;
};
$("skill-switcher").onclick = (e) => {
  const b = e.target.closest("[data-form]");
  if (b && !game.finished && game.player.alive) {
    game.switchForm(game.player, b.dataset.form);
    formSignature = "";
    updateHUD();
  }
};
function setImmersive(value) {
  immersive = value;
  document.body.classList.toggle("immersive-play", value);
  $("arena-panel").classList.toggle("immersive", value);
  $("fullscreen-btn").textContent = value
    ? "⤢ Exit fullscreen"
    : "⛶ Fullscreen";
  $("fullscreen-btn").setAttribute(
    "aria-label",
    value ? "Exit fullscreen play" : "Enter fullscreen play",
  );
  releaseInput();
}
async function enterImmersive() {
  setImmersive(true);
  try {
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    )
      await document.documentElement.requestFullscreen();
  } catch {
    /* iOS versions without element fullscreen still get the viewport-filling layout. */
  }
  try {
    await screen.orientation?.lock?.(app?.settings.orientation || "landscape");
  } catch {
    /* The portrait fallback rotates the complete game and its input coordinates. */
  }
}
async function exitImmersive() {
  setImmersive(false);
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    screen.orientation?.unlock?.();
  } catch {}
}
$("fullscreen-btn").onclick = () =>
  immersive ? exitImmersive() : enterImmersive();
$("leave-btn").onclick = async () => {
  pause(true);
  await exitImmersive();
  app?.battleExit();
};
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && immersive && document.fullscreenEnabled)
    setImmersive(false);
});
window.addEventListener("resize", releaseInput);
$("begin-btn").onclick = newGame;
$("teleport-info-btn").onclick = () => {
  if (started && !paused && game.player.alive)
    game.cue("portal", game.player, "#d4bef3");
};
$("overlay-play").onclick = () => (paused ? pause(false) : newGame());
$("pause-btn").onclick = () => pause();
$("arena-nav").onclick = () => {
  $("game-wrap").scrollIntoView({ behavior: "smooth", block: "center" });
};
document.querySelectorAll("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.mode;
      document
        .querySelectorAll("[data-mode]")
        .forEach((x) => x.classList.toggle("selected", x === b));
      $("team-sizes").hidden = ![
        "team",
        "ctf",
        "tdm",
        "domination",
        "rush",
        "gauntlet-team",
      ].includes(mode);
      $("ffa-settings").hidden = ![
        "ffa",
        "corruption",
        "roulette",
        "boss",
      ].includes(mode);
      for (const option of $("ffa-count").options)
        option.hidden = option.disabled =
          mode === "boss" && Number(option.value) < 4;
      if (mode === "boss") ffaSize = Math.max(4, ffaSize);
      $("ffa-count").value = ffaSize;
      $("friendly-fire-state").textContent = [
        "boss",
        "corruption",
        "domination",
      ].includes(mode)
        ? "OFF"
        : "ON";
      if (mode === "rush" && teamSize < 3) teamSize = 3;
      document.querySelector('[data-size="2"]').hidden = mode === "rush";
      document.querySelectorAll("[data-size]").forEach((x) => {
        x.classList.toggle("selected", Number(x.dataset.size) === teamSize);
        x.textContent =
          mode === "gauntlet-team"
            ? `${x.dataset.size} allies`
            : `${x.dataset.size} vs ${x.dataset.size}`;
      });
      const titles = {
        corruption: "Stay in the Light.",
        boss: "One titan. One team.",
        domination: "Capture. Hold. Defend.",
        ctf: "Steal. Return. Defend.",
        tdm: "Every life counts.",
        ffa: "Every elemental for themselves.",
        duel: "One on one",
        team: "Fight together. Strike carefully.",
        fused: "One on one · level II",
        fused3: "One on one · level III",
      };
      const desc = {
        corruption:
          "2 minutes. Corruption begins after 5 seconds. Dark health scales with remaining Light fighters. Survive as Light or lead Dark infections. No friendly fire or fusion.",
        boss: "Invincible against 3–7 origins. Boss HP equals the entire opposing team. The boss hunts healers first. Last team standing. No friendly fire or fusion.",
        domination:
          "3 minutes. Four flags. Capture in 10 seconds; each additional attacker doubles speed. Defenders contest. Most flag-seconds wins. 10-second respawns. No friendly fire.",
        ctf: "First to 3 captures. Your flag must be home. No fusions. 10-second respawns.",
        tdm: "3 minutes. 10-second respawns. Most kills wins; a full team wipe ends the match.",
        ffa: "2–8 fighters. Last standing wins. Collect compatible rival tokens.",
        duel: "A new random rival every battle.",
        team: "Allies are vulnerable to your attacks.",
        fused: "Choose any level-II elemental above.",
        fused3: "Test all eight level-III elementals.",
      };
      $("mode-description").innerHTML =
        `<span>⚔</span><div><strong>${titles[mode] || MODES[mode]?.name}</strong><p>${desc[mode] || MODES[mode]?.tag}</p></div>`;
      renderSelection();
      if (!started) {
        game = new Combat({
          element: selected,
          mode,
          size: teamSize,
          players: ffaSize,
        });
        formSignature = "";
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
        game = new Combat({
          element: selected,
          mode,
          size: teamSize,
          players: ffaSize,
        });
    }),
);
$("ffa-count").onchange = () => {
  ffaSize = Number($("ffa-count").value);
  if (!started) {
    game = new Combat({
      element: selected,
      mode,
      size: teamSize,
      players: ffaSize,
    });
    updateHUD();
  }
};
$("sound-btn").onclick = () => {
  sound = !sound;
  $("sound-btn").textContent = sound ? "♫ Sound on" : "♫ Sound off";
  $("sound-btn").setAttribute("aria-pressed", sound);
  beep(400);
};
const guide = `<span class="eyebrow">TOUCH COMBAT / v0.16</span><h2>Your thumbs. Your timing.</h2><p>Use Fullscreen for landscape play. On phones, battles open in a landscape layout automatically. If Safari cannot hide its browser bars, use Share → Add to Home Screen for a standalone view.</p><table><tr><td>Bottom-left stick / WASD</td><td>Move in any direction. Drag farther for full speed.</td></tr><tr><td>Bottom-right Strike / J</td><td>Strike locks automatically onto the nearest rival within melee range.</td></tr><tr><td>Bottom-middle skills / K, L</td><td>Hold your main skill to charge, then release to cast. Hold Rock shield until you release it or it breaks.</td></tr><tr><td>Top ability-set tabs / Tab</td><td>Choose origin or fused skills. Your elemental identity and accumulated passives remain active.</td></tr><tr><td>Touch an ally token</td><td>Compatible fusion happens automatically and blows nearby and distant fighters away. Enemy tokens are hidden in team modes. Free for All allows rival tokens; Capture the Flag disables fusion.</td></tr></table><h3>Battle modes</h3><p>Capture the Flag: first to 3 captures, with 10-second respawns and no fusions. Take the enemy flag home while your own flag is at base. Touch a dropped friendly flag to return it. Team Deathmatch: most enemy kills in 3 minutes wins; ties draw. Respawns take 10 seconds, but your team loses immediately if everyone is down together. A teammate respawning keeps your fusion intact; your own respawn resets you to your starting element. Unclaimed tokens disappear when their owner respawns. Free for All: 2–8 independent fighters, last standing wins. All rival tokens are visible and compatible tokens fuse on touch.</p><h3>Corruption, Boss and Domination</h3><p>Corruption: 2–8 start as Light. At 5 seconds one random fighter becomes Dark. Two Dark strikes convert Light; Light can heal itself, with no Flash. Each Light strike removes one Dark health point; a fresh Dark has one health point per remaining Light fighter. That cap falls as Light fighters are converted, without restoring lost health. Corrupted AI relentlessly pursues the nearest visible Light and strikes as soon as its cooldown ends. Dark has no abilities and returns after 10 seconds. The last Light survivors, or those still Light at 2 minutes, win the survival category. Dark fighters with the most infections share the Dark win. Boss: choose an origin; one of 4–8 fighters becomes Invincible at random. Boss health equals their combined health; last team standing wins. The AI boss relentlessly pursues healers first, nearest healer first, then the nearest remaining opponent. Both modes disable friendly fire and fusion.</p><p>Domination: two teams start with two flags each. Stand within the ring for 10 seconds to capture an enemy flag. Each extra attacker doubles capture speed: 10 / 5 / 2.5 / 1.25 seconds. Defenders contest and pause capture; unattended progress drains over time. Every owned flag scores one flag-second each second. Most flag-seconds at 3 minutes wins; ties draw. Respawns take 10 seconds, with normal allied-token fusion rules. Friendly fire is off, so allies do not prevent AI attacks.</p><h3>Spirit: portals, revival and angel guard</h3><p>Tap Portals, then tap two clear arena positions. Each portal warns for 0.5 seconds before opening and cannot be placed under a fighter. Fighters, ghosts, attacks, tokens and lingering effects can travel through either portal. Tap your portal to close it. Closing a portal during a crossing kills the traveller; simply standing nearby is safe. A lone portal holds entrants off-screen: reverse your entry direction with the stick to retreat, or open a second exit. Closing the lone portal permanently loses anyone still inside and their token.</p><p>Revival brings back the closest recoverable fallen ally. It never heals you instead. If their token has already been fused, their contribution is removed from its bearer when they revive in elimination modes. Deathmatch revival preserves other fighters’ fusions and resets the revived fighter to their starting element. In elimination modes, a felled Spirit becomes a controllable ghost while allies remain: stand between an enemy and an ally to block melee attacks.</p><h3>Always-active abilities</h3><p>Reflect, hard skin, burn, flight, venomous contact, Angel guard and Divine immunity do not have buttons. Multi-Dimensional gains repeatable tap-to-teleport up to 180 units away, with a visible destination and 0.2-second vulnerable preparation; placement and portal-closing taps take priority. Passives stay active across ability sets.</p><h3>New tactics</h3><p>Fused II and Fused III offer separate duels for each fusion tier. Healing picks the living teammate with the lowest current health, including you. Blaze has only Speed burst: a short dash, a flame trail, impact damage and contact-only burn unless immune. It has no recharge; another dash can start as soon as the current dash ends. Smoke has Vog, Shadow step and Flamethrower. Gravity is purple.</p><p>Divine is fully invisible to enemies while still; its controller sees only a luminous outline while hidden and the full character whenever revealed. Enemies see attacks and abilities at 30% opacity. Continuous movement gives a brief 10% glimpse once per second, and damage gives a 150ms glimpse at 10% opacity. Concealed fighters cannot be target-locked, but physical attacks can still hit them. In modes with friendly fire, AI fighters avoid attacking through allies; they help endangered teammates, and dodge hazards. Fire closes in for contact burn; Light favors healing and Flash, retreats while supporting, and still strikes nearby rivals. When idle, AI searches random spots around a Divine’s last seen location. Burn stops when contact ends; Mud venom lasts five seconds after contact.</p><h3>Lightning and Invincible</h3><p>Both are available in Fused III. Cloud + Light or Spirit + Water creates Lightning: tap Lightning strikes to hit the nearest visible rival within 450 units instantly, with no charge and a 3-second cooldown. Shock prevents movement while touching Lightning; Divine is immune. Sun + Earth or Mirror + Fire creates Invincible: 2× melee damage is always active. Abilities and contact burn have normal strength. Lightning strikes bypass its Reflect and hard skin and deal 25% extra damage. Active Flood makes Lightning strikes hit everyone, including allies and the caster. Multi-Dimensional has no Rift; its Teleport reminder button explains arena taps and does not activate or limit teleportation.</p><h3>Balance update</h3><p>Reflect returns 40% of direct incoming ability damage and lets 60% through before defenses. Quicksand, Gravity x2, Flood, Heatwave, Magma, Sabotage, Speed burst, Vog, Telekinesis, contact burn and venom never trigger Reflect. Elemental advantages grant 20% extra damage. Charging raises Demonic minion health from 8 to 40 HP and Apparition copy health from 1 to 33 HP. Flood hits Fire-bearing fighters once per cast for 25% of their maximum health as base damage, with normal defenses applied, instead of instantly killing them. Flood still slows grounded fighters. Teleport has no recharge: you remain vulnerable at the departure point for 0.2 seconds, and a distant tap is limited to 180 units. Damage can kill you during preparation; knockback, Shock and portal travel cancel it.</p><h3>Movement and battle effects</h3><p>Every elemental has its own directional design. Earth and Mud run on all fours; other grounded fighters run with alternating strides; Air-based fusions hover. Level-II fusions shine and level-III fusions glow. In the Gravity skill tab, swipe directly on an enemy to move them in that direction; tap Telekinesis to push the nearest visible rival away. It has 400 range, twice the pushing distance and a 4.5-second cooldown. Gravity x2 distorts and tints its area purple. Flood covers grounded fighters to the waist; quicksand flows inward and covers their feet. Mud is immune to quicksand. Reflection creates an orbiting translucent shield, and contested melee attacks enter a paired weapon clash.</p><h3>Fused shortcuts</h3><p>Added skills appear beside fused abilities, with U and I shortcuts on a keyboard. Charge abilities share the existing main-skill cooldown, and utilities share the utility cooldown; Speed burst still has no recharge. Spirit can heal directly. Divine can revive allies and place portals, and Radiance heals every living teammate, including its caster. Earth uses Rock shield without Rock burst. Doppelgängers prioritize pursuing enemies. Combat messages use body flashes, shining tokens and visual cues instead of floating text; idle and running fighters recoil visibly when hit. Spirit and Divine AI travel through planned portal pairs, and Multi-Dimensional AI teleports to approach or escape.</p><h3>Death and adaptive tactics</h3><p>Demonic can place one permanent Death sigil per match, even across respawns. It is the size of Magma and affects flying fighters too. Each entry lowers a fighter by one tier; staying inside does not repeat it. Level III keeps its alphabetically first compatible level-II form, and level II keeps its alphabetically first origin. Fallen teammates stay felled. Invincible moves 15% slower. AI changes tactics after three repeated actions or a stalled fight and seeks compatible tokens. Corrupted fighters and the AI boss instead maintain relentless attacks.</p><h3>Combat rules</h3><p>Friendly fire is on except in Corruption, Boss and Domination. Mutual strikes within 100ms clash for quarter damage. Hits pause charging for 270ms without deleting stored power. Same-element abilities deal half damage. Fire now takes 30% less Water ability damage than in v0.1. Sonic boom is a spreading fan; the Sun laser is a fast, piercing beam.</p>`;
function openDialog(content) {
  if (started && !paused && !game.finished) pause(true);
  $("dialog-content").innerHTML = content;
  $("info-dialog").showModal();
}
$("guide-btn").onclick = () => openDialog(guide);
$("fusion-guide").onclick = () =>
  openDialog(
    `<span class="eyebrow">ELEMENT CODEX / FUSION</span><h2>Touch. Fuse. Rise.</h2><p>Only allied tokens are visible. Touch a compatible token to fuse automatically. Fusion sends fighters in every direction. Use the top tabs to choose abilities; all passives remain active.</p><table>${Object.entries(
      COMBOS,
    )
      .map(
        ([k, v]) =>
          `<tr><td>${k.split("+").map(nameOf).join(" + ")}</td><td>${nameOf(v)}</td></tr>`,
      )
      .join("")}</table>`,
  );
$("codex-btn").onclick = () =>
  openDialog(
    `<span class="eyebrow">ORIGINS & FUSIONS</span><h2>The element codex.</h2><div class="codex-grid">${[...Object.keys(ELEMENTS), ...Object.values(COMBOS)].map((id) => `<article><h3>${chip(id)}</h3><p>${profile(id).desc}</p><p>${[...skillsFor(id), ...extraSkillsFor(id).map((s) => s.name)].filter(Boolean).join(" · ") || "No active skills. Choose an inherited ability set."}</p><p>Passive: ${profile(id).passive}</p></article>`).join("")}</div>`,
  );
$("close-dialog").onclick = () => $("info-dialog").close();
const countdownDisplay = document.createElement("div");
countdownDisplay.id = "battle-countdown";
countdownDisplay.setAttribute("role", "status");
countdownDisplay.setAttribute("aria-live", "polite");
document.getElementById("orientation-root").append(countdownDisplay);
const whiteoutDisplay = document.createElement("div");
whiteoutDisplay.id = "flash-whiteout";
whiteoutDisplay.setAttribute("aria-hidden", "true");
document.getElementById("orientation-root").append(whiteoutDisplay);
function updateHUD() {
  const battleVisible = app?.screen === "battle";
  countdownDisplay.hidden =
    !battleVisible || paused || !game.countdownLabel || game.finished;
  countdownDisplay.textContent = game.countdownLabel;
  whiteoutDisplay.hidden =
    !battleVisible ||
    paused ||
    !inWorld(game.player) ||
    game.player.whiteout <= 0;
  whiteoutDisplay.style.opacity = Math.min(1, game.player.whiteout / 2);
  const a = game.player,
    e = profile(a.element),
    form = activeForm(a),
    skills = a.skillsDisabled ? [] : [...skillsFor(form)],
    extras = a.skillsDisabled ? [] : extraSkillsFor(form),
    ready =
      a.alive &&
      inWorld(a) &&
      !paused &&
      !game.finished &&
      !game.intermission &&
      !game.countingDown;
  const signature = a.forms.join("|") + ":" + form;
  if (signature !== formSignature) {
    $("skill-switcher").innerHTML = a.forms
      .map(
        (f) =>
          `<button data-form="${f}" class="form-button ${f === form ? "selected" : ""}" aria-pressed="${f === form}" style="--element:${profile(f).color}">${icon(f)}<span>${nameOf(f)}</span></button>`,
      )
      .join("");
    formSignature = signature;
  }
  if (a.selfHealOnly) skills[1] = null;
  if (a.element === "lightning" && form === "air") skills[1] = "Tailwind";
  $("leave-btn").textContent = "Leave →";
  $("leave-btn").classList.add("match-leave");
  $("hud-name").textContent = e.name.toUpperCase();
  $("hud-symbol").innerHTML = icon(a.element);
  $("hud-symbol").style.color = e.color;
  $("health-fill").style.width = `${(a.hp / a.maxHp) * 100}%`;
  $("health-label").textContent =
    !a.alive && a.respawnAt !== undefined && !game.finished
      ? `RESPAWN ${Math.max(0, Math.ceil(a.respawnAt - game.time))}s`
      : a.ghost
        ? "ANGEL GUARD"
        : a.dimension
          ? "BETWEEN WORLDS"
          : `${Math.ceil(a.hp)} / ${a.maxHp} ${game.mode === "corruption" ? "HITS" : "HP"}`;
  $("health-fill").style.background = (
    game.mode === "corruption" && a.element === "dark"
      ? a.hp / a.maxHp < 1 / 3
      : a.hp < 40
  )
    ? "#e78c6c"
    : "#b2c797";
  const clock = game.timeLimit
    ? Math.max(0, Math.ceil(game.timeLimit - game.time))
    : Math.floor(game.time);
  $("timer").textContent = `${Math.floor(clock / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(clock % 60)
    .toString()
    .padStart(2, "0")}`;
  $("enemy-count").textContent = game.fighters
    .filter((b) => b.team !== a.team && b.alive && !b.echo)
    .length.toString()
    .padStart(2, "0");
  const modeNames = {
    duel: "DUEL",
    team: "TEAM BRAWL",
    fused: "FUSED II",
    fused3: "FUSED III",
    ctf: "CAPTURE THE FLAG",
    tdm: "TEAM DEATHMATCH",
    ffa: "FREE FOR ALL",
    corruption: "CORRUPTION",
    boss: "BOSS",
    domination: "DOMINATION",
    rush: "FUSION RUSH",
    roulette: "ROULETTE",
    gauntlet: "SOLO WAVES",
    "gauntlet-team": "TEAM WAVES",
  };
  $("round-mode").textContent =
    `${modeNames[game.mode]} · ${Math.max(1, round).toString().padStart(2, "0")}`;
  $("objective-score").hidden = ![
    "ctf",
    "tdm",
    "ffa",
    "corruption",
    "boss",
    "domination",
    "rush",
    "roulette",
    "gauntlet",
    "gauntlet-team",
  ].includes(game.mode);
  $("objective-score").textContent =
    game.mode === "rush"
      ? `${game.scores[0]} – ${game.scores[1]} POINTS · ${game.tokens.filter((t) => t.shard).length} SHARDS`
      : game.mode === "roulette"
        ? game.nextForms?.[a.id]
          ? `NEXT: ${nameOf(game.nextForms[a.id])} · ${Math.max(0, Math.ceil(game.nextShuffleAt - game.time))}s`
          : `${a.kills || 0} KILLS · SHUFFLE IN ${Math.max(0, Math.ceil(game.nextShuffleAt - game.time))}s`
        : game.mode.startsWith("gauntlet")
          ? game.finalWave
            ? "FINAL BOSS"
            : `WAVE ${game.wave}`
          : game.mode === "corruption"
            ? `${game.fighters.filter((b) => b.element === "light").length} LIGHT · ${game.corruptionStarted ? `YOUR INFECTIONS ${a.infections || 0}` : `DARK IN ${Math.max(0, Math.ceil(5 - game.time))}s`}`
            : game.mode === "boss"
              ? `BOSS ${Math.ceil(game.fighters.find((b) => b.element === "invincible")?.hp || 0)} HP · ${game.fighters.filter((b) => b.element !== "invincible" && b.alive).length} CHALLENGERS`
              : game.mode === "domination"
                ? `${Math.floor(game.scores[0])} – ${Math.floor(game.scores[1])} FLAG-SECONDS`
                : game.mode === "ffa"
                  ? `${game.fighters.filter((b) => b.alive && !b.echo).length} STANDING`
                  : `${game.scores[0]} – ${game.scores[1]} ${game.mode === "ctf" ? "FLAGS · FIRST TO 3" : "KILLS"}`;
  $("charge-btn").hidden = !skills[0];
  $("utility-btn").hidden = !skills[1];
  $("teleport-info-btn").hidden = form !== "multi-dimensional";
  $("teleport-info-btn").disabled = !ready;
  $("passive-note").hidden =
    !!skills[0] ||
    !!skills[1] ||
    extras.length > 0 ||
    form === "multi-dimensional";
  $("passive-note").textContent = a.skillsDisabled
    ? "Strike Light twice to corrupt them. Dark has no abilities."
    : form === "invincible"
      ? "2× strength applies to melee. Choose Earth, Fire or Light skills above."
      : "Reflect is always active. Choose Earth or Light skills above.";
  $("ability-name").textContent = skills[0] || "";
  $("ability-symbol").innerHTML = icon(form);
  $("utility-name").textContent = skills[1] || "";
  $("ability-status").textContent =
    form === "sanctuary" && game.springUsed.has(a.id)
      ? "Spent this match"
      : form === "terraformer" && a.abilityCd <= 0
        ? "Tap arena · opens in 1s"
        : form === "sanctuary" && a.abilityCd <= 0
          ? "Tap · once per match"
          : a.abilityCd > 0
            ? `${a.abilityCd.toFixed(1)}s`
            : a.charging && a.chargeForm === form
              ? app?.settings.charging === "tap"
                ? "Tap to release"
                : "Release to cast"
              : form === "gravity"
                ? "Tap push · or swipe enemy"
                : ["lightning", "smoke", "blindness"].includes(form)
                  ? form === "lightning"
                    ? "Tap · instant strike"
                    : "Tap to activate"
                  : form === "spirit"
                    ? "Nearest fallen ally"
                    : app?.settings.charging === "tap"
                      ? "Tap to charge"
                      : "Hold to charge";
  $("ability-cooldown").style.width =
    `${(a.abilityCd / (form === "lightning" ? 3 : form === "smoke" ? 7 : form === "terraformer" ? 8 : 4.5)) * 100}%`;
  $("utility-status").textContent =
    form === "demonic"
      ? game.deathUsed.has(a.id)
        ? "Spent this match"
        : "Place floor · once per match"
      : form === "spirit"
        ? "Tap, then place"
        : form === "blaze"
          ? a.burst > 0
            ? "Dashing"
            : "0s cooldown"
          : a.utilityCd > 0
            ? `${a.utilityCd.toFixed(1)}s`
            : form === "earth"
              ? `Hold · ${Math.ceil(a.shieldHp)} HP`
              : "Tap to use";
  $("charge-btn").disabled =
    !ready ||
    a.abilityCd > 0 ||
    (form === "sanctuary" && game.springUsed.has(a.id));
  $("charge-btn").setAttribute(
    "aria-label",
    form === "gravity"
      ? "Telekinesis: tap to push the nearest enemy away, or swipe an enemy in any direction"
      : skills[0] || "Ability",
  );
  $("utility-btn").disabled =
    !ready ||
    (form === "demonic" && game.deathUsed.has(a.id)) ||
    (!["spirit", "blaze"].includes(form) && a.utilityCd > 0);
  for (let i = 0; i < 2; i++) {
    const button = $("extra-skill-" + i),
      skill = extras[i];
    button.hidden = !skill;
    if (!skill) continue;
    const ability = skill.kind === "ability";
    const cd = ability ? a.abilityCd : a.utilityCd;
    button.disabled =
      !ready || (!["blaze", "spirit"].includes(skill.form) && cd > 0);
    button.querySelector("strong").textContent = skill.name;
    button.querySelector(".ability-icon").innerHTML = icon(skill.form);
    button.querySelector("small").textContent =
      skill.form === "blaze"
        ? a.burst > 0
          ? "Dashing"
          : "0s cooldown"
        : skill.form === "spirit" && skill.kind === "utility"
          ? "Tap, then place"
          : cd > 0
            ? `${cd.toFixed(1)}s`
            : skill.form === "blindness"
              ? "Tap to blind"
              : ability
                ? a.charging && a.chargeForm === skill.form
                  ? app?.settings.charging === "tap"
                    ? "Tap to release"
                    : "Release to cast"
                  : app?.settings.charging === "tap"
                    ? "Tap to charge"
                    : "Hold to charge"
                : skill.form === "earth"
                  ? `Hold · ${Math.ceil(a.shieldHp)} HP`
                  : "Tap to use";
    button.setAttribute("aria-label", skill.name);
  }
  document
    .querySelector(".skill-controls")
    .classList.toggle("expanded-skills", extras.length > 0);
  $("attack-btn").disabled = !ready;
  $("charge-meter").hidden = !a.charging;
  $("charge-percent").textContent = `${Math.round((a.charge / 1.8) * 100)}%`;
  $("charge-fill").style.width = `${(a.charge / 1.8) * 100}%`;
  $("dimension-notice").hidden = !a.dimension;
  $("portal-notice").hidden = game.portals.placing !== a.id && !a.chasmReady;
  $("portal-instruction").textContent = a.chasmReady
    ? "Tap the arena within 400 range to open a Chasm."
    : game.portals.owned(a).length
      ? "Tap the arena to place the exit portal."
      : "Tap the arena to place the first portal.";
  $("arena-hint").textContent =
    a.prisonHp > 0
      ? `STONE PRISON · ${Math.ceil(a.prisonHp)} / 65 HP · Strike to break free.`
      : activeForm(a) === "terraformer"
        ? "CHASM · Tap the arena · opens after 1 second · flyers are safe."
        : a.ghost
          ? "ANGEL GUARD · Move between an enemy and an ally to block melee."
          : !a.alive
            ? game.respawnDelay
              ? `Respawn in ${Math.max(0, Math.ceil(a.respawnAt - game.time))} seconds. ${game.mode === "corruption" ? "You return as Dark." : "Your next life starts unfused."}`
              : game.mode === "ffa"
                ? "You are down. Watch the remaining fighters battle."
                : "You are down. Your allies can still win."
            : a.dimension
              ? "Pull the stick back against your entry direction to return."
              : game.isShocked(a)
                ? "SHOCK · Contact stops movement. You can still strike."
                : form === "gravity"
                  ? "TELEKINESIS · Swipe an enemy or tap to push the nearest away · 400 range."
                  : hasPassive(a, "multi-dimensional")
                    ? a.blink
                      ? "TELEPORT PREPARING · You can still take damage."
                      : "TAP TO TELEPORT · 180 range · 0.2s preparation · No cooldown."
                    : game.target(a)
                      ? "AUTO LOCK · Nearest rival in strike range."
                      : game.mode === "ctf"
                        ? game.flags.some((f) => f.carrier === a.id)
                          ? "FLAG CARRIED · Return home. Your flag must be at base to score."
                          : "Steal the red flag. Defend the blue flag. First to 3 · No fusions."
                        : game.mode === "ffa"
                          ? "Every rival is an enemy. Touch compatible tokens to fuse."
                          : game.mode === "corruption"
                            ? a.element === "dark"
                              ? `Two strikes corrupt Light. You can take ${Math.ceil(a.hp)} more Light strike${a.hp === 1 ? "" : "s"}.`
                              : "Take two hits before corruption. Heal yourself to recover. Dark respawns in 10 seconds."
                            : game.mode === "domination"
                              ? "Stand by enemy flags to capture. Guard your own to contest."
                              : game.mode === "boss"
                                ? "Last team standing wins. Friendly fire and fusion are off."
                                : "Target lock and token fusion are automatic.";
  if (game.finished && !game.celebrationRemaining && !shownResult) {
    shownResult = true;
    releaseInput();
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
      `${game.finishReason || "Elimination"}${["ctf", "tdm", "domination", "rush"].includes(game.mode) ? ` · ${Math.floor(game.scores[0])} – ${Math.floor(game.scores[1])}` : ""} · ${Math.floor(game.time)} seconds.`;
    $("overlay-play").innerHTML = "Fight again <span>→</span>";
  }
}
function frame(now) {
  const elapsed = Math.max(0, (now - frameTime) / 1000) || 0.016;
  const dt = Math.min(elapsed, 0.04);
  frameTime = now;
  if (
    started &&
    !paused &&
    !game.finished &&
    !game.intermission &&
    app?.screen === "battle" &&
    !app?.slidesOpen
  ) {
    let x =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft")),
      y =
        Number(keys.has("s") || keys.has("arrowdown")) -
        Number(keys.has("w") || keys.has("arrowup"));
    if (stick.pointer !== null) {
      x = stick.x;
      y = stick.y;
    }
    game.update(dt, { x, y });
    if (heldStrike || keys.has("j")) game.strike(game.player);
  }
  if (game.finished && app?.screen === "battle" && !paused)
    game.advanceCelebration(elapsed);
  if (app?.screen === "battle") renderer.draw(game, !started);
  updateHUD();
  app?.tick(game);
  requestAnimationFrame(frame);
}
document.querySelector("#attack-btn .ability-icon").innerHTML = icon("strike");
for (const [name, element] of [
  ["fire", "fire"],
  ["air", "air"],
  ["blaze", "fusion"],
])
  document.querySelector(`.${name}-orb`).innerHTML = icon(element);
renderSelection();
charactersReady.then(() => paintPortraits());
updateHUD();
requestAnimationFrame(frame);
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
  get immersive() {
    return immersive;
  },
  get stick() {
    return { ...stick };
  },
  get renderer() {
    return renderer;
  },
};

app = createApp({
  game: () => game,
  started: () => started,
  selected: () => selected,
  profile,
  pause: () => pause(true),
  releaseInput,
  exitImmersive,
  resume: () => {
    pause(false);
    enterImmersive();
  },
  chooseMode: (id) => {
    releaseInput();
    started = false;
    paused = false;
    shownResult = false;
    document.querySelector(`[data-mode="${id}"]`).click();
  },
  orientationChanged: (value) => {
    setOrientation(value);
    releaseInput();
  },
});
window.__app = app;
