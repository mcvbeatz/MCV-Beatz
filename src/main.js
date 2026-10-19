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
  COMBOS,
  EDGES,
  LEVEL_TWO,
  LEVEL_THREE,
  nameOf,
  recipe,
  activeForm,
  skillsFor,
  hasPassive,
  inWorld,
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
  audio,
  frameTime = 0,
  shownResult = false,
  immersive = false;
let game = new Combat();
const renderer = new Renderer($("game"));
const keys = new Set();
const resetActionPointers = [];
const stick = { x: 0, y: 0, pointer: null };
let heldStrike = false,
  formSignature = "";
const descriptions = {
  mud: [
    "Control & attrition",
    "Quicksand controls the floor. Venom on contact is automatic.",
    "Venomous contact · origin passives",
  ],
  spirit: [
    "Guardians & gateways",
    "Revive the nearest fallen ally. Place two portals and protect allies even after you fall.",
    "Angel guard · flight · Light affinity",
  ],
  mirror: [
    "Defense & reflection",
    "Reflect is always active. Switch to Earth or Light to use their skills.",
    "Reflect · hard skin · Light affinity",
  ],
  sun: [
    "Radiance & pressure",
    "A fast beam cuts through the arena. Heatwave punishes anyone nearby.",
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
    "Fill an area with burning, blinding vog.",
    "Contact burn · burn immunity",
  ],
  gravity: [
    "Force & control",
    "Push fighters away with telekinesis and slow rivals in a gravity field.",
    "Hard skin",
  ],
  apparition: [
    "Evasion & echoes",
    "Summon a fragile double to distract your opponent.",
    "Flight · gravity immunity",
  ],
  "multi-dimensional": [
    "Space without limits",
    "Tap anywhere on the arena to teleport. The Teleport button is a reminder; arena taps work immediately with no cooldown.",
    "Tap-to-teleport · Reflect · hard skin",
  ],
  divine: [
    "Protection & radiance",
    "Invisible at rest. Actions reveal a 30% silhouette; continuous movement briefly reveals 10% each second. Damage gives a brief 10% glimpse.",
    "Invisibility · Angel guard · Reflect · immunity",
  ],
  lightning: [
    "Instant strikes & contact control",
    "Tap Lightning strikes for an instant ranged hit. Shock stops movement while fighters touch you.",
    "Contact shock · flight · burn immunity",
  ],
  invincible: [
    "Strength & endurance",
    "All outgoing damage is doubled. Choose Earth, Fire or Light skills; you still take damage normally.",
    "2× strength · Reflect · hard skin · contact burn",
  ],
  demonic: [
    "Minions & heat",
    "Summon burning minions and consume a rival token.",
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
  if (!sound) return;
  audio ??= new AudioContext();
  if (audio.state === "suspended") audio.resume();
  const osc = audio.createOscillator(),
    gain = audio.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    frequency / 2,
    audio.currentTime + 0.08,
  );
  gain.gain.setValueAtTime(0.06, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.12);
}
function chip(e) {
  return `<span class="element-chip" style="--element:${profile(e).color}"><i>${icon(e)}</i>${nameOf(e)}</span>`;
}
function setProfile() {
  const e = profile(selected);
  $("profile-name").textContent = e.name;
  $("profile-symbol").innerHTML = icon(selected);
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
  const pool =
    mode === "fused"
      ? LEVEL_TWO
      : mode === "fused3"
        ? LEVEL_THREE
        : Object.keys(ELEMENTS);
  if (!pool.includes(selected)) selected = pool[0];
  $("element-grid").innerHTML = pool
    .map(
      (id) =>
        `<button class="element-option ${id === selected ? "selected" : ""}" data-element="${id}" style="--element:${profile(id).color}" aria-pressed="${id === selected}"><span class="symbol">${icon(id)}</span>${nameOf(id)}</button>`,
    )
    .join("");
  document.querySelector(".setup-panel .subtle").textContent =
    mode === "fused"
      ? "9 level-II fusions"
      : mode === "fused3"
        ? `${LEVEL_THREE.length} level-III fusions`
        : "6 origins";
  $("element-grid").onclick = (e) => {
    const b = e.target.closest("[data-element]");
    if (!b) return;
    selected = b.dataset.element;
    setProfile();
    if (!started) {
      game = new Combat({ element: selected, mode, size: teamSize });
      formSignature = "";
      updateHUD();
    }
  };
  setProfile();
}
function newGame() {
  releaseInput();
  game = new Combat({ element: selected, mode, size: teamSize });
  started = true;
  paused = false;
  shownResult = false;
  round++;
  formSignature = "";
  $("game-overlay").hidden = true;
  $("pause-btn").textContent = "II";
  $("begin-btn").innerHTML = "Restart battle <span>→</span>";
  $("game").focus({ preventScroll: true });
  if (matchMedia("(pointer:coarse)").matches || innerWidth < 900)
    enterImmersive();
  beep(300);
  updateHUD();
}
function releaseInput() {
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
function action(key, down = true) {
  if (!started || paused || game.finished) return;
  const p = game.player;
  if (key === "j") {
    heldStrike = down;
    if (down && game.strike(p)) beep();
  }
  if (key === "k") {
    if (down) game.startCharge(p);
    else {
      game.releaseCharge(p);
      beep(260);
    }
  }
  if (key === "l") game.utility(p, down);
  if (key === "tab" && down) {
    game.switchForm(p);
    formSignature = "";
  }
}
window.addEventListener("keydown", (e) => {
  if ($("info-dialog").open) return;
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
function isRotated() {
  return immersive && innerHeight > innerWidth;
}
function localPoint(el, clientX, clientY) {
  const r = el.getBoundingClientRect();
  return isRotated()
    ? { x: clientY - r.top, y: r.right - clientX }
    : { x: clientX - r.left, y: clientY - r.top };
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
  arenaPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  $("game").setPointerCapture(e.pointerId);
});
$("game").addEventListener("pointerup", (e) => {
  if (arenaPointer?.id !== e.pointerId) return;
  const click =
    Math.hypot(e.clientX - arenaPointer.x, e.clientY - arenaPointer.y) < 15;
  arenaPointer = null;
  if (!click || !started || paused || game.finished) return;
  const local = localPoint($("game"), e.clientX, e.clientY),
    p = renderer.worldPoint(local.x, local.y),
    a = game.player;
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
  game.teleport(a, p.x, p.y);
});
$("game").addEventListener("pointercancel", () => (arenaPointer = null));
$("cancel-portal").onclick = () => (game.portals.placing = null);
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
    if (!document.fullscreenElement && $("arena-panel").requestFullscreen)
      await $("arena-panel").requestFullscreen();
  } catch {
    /* iOS versions without element fullscreen still get the viewport-filling layout. */
  }
  try {
    await screen.orientation?.lock?.("landscape");
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
  document
    .querySelector(".setup-panel")
    .scrollIntoView({ behavior: "smooth", block: "start" });
};
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && immersive && document.fullscreenEnabled)
    setImmersive(false);
});
window.addEventListener("resize", releaseInput);
$("begin-btn").onclick = newGame;
$("teleport-info-btn").onclick = () => {
  if (started && !paused && game.player.alive)
    game.event(
      "TAP THE ARENA TO TELEPORT",
      "#d4bef3",
      game.player.x,
      game.player.y - 30,
    );
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
      $("team-sizes").hidden = mode !== "team";
      const titles = {
        duel: "One on one",
        team: "Fight together. Strike carefully.",
        fused: "One on one · level II",
        fused3: "One on one · level III",
      };
      const desc = {
        duel: "A new random rival every battle.",
        team: "Allies are vulnerable to your attacks.",
        fused: "Choose any level-II elemental above.",
        fused3: "Test all five level-III elementals.",
      };
      $("mode-description").innerHTML =
        `<span>⚔</span><div><strong>${titles[mode]}</strong><p>${desc[mode]}</p></div>`;
      renderSelection();
      if (!started) {
        game = new Combat({ element: selected, mode, size: teamSize });
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
        game = new Combat({ element: selected, mode, size: teamSize });
    }),
);
$("sound-btn").onclick = () => {
  sound = !sound;
  $("sound-btn").textContent = sound ? "♫ Sound on" : "♫ Sound off";
  $("sound-btn").setAttribute("aria-pressed", sound);
  beep(400);
};
const guide = `<span class="eyebrow">TOUCH COMBAT / v0.4</span><h2>Your thumbs. Your timing.</h2><p>Use Fullscreen for landscape play. On phones, battles open in a landscape layout automatically. If Safari cannot hide its browser bars, use Share → Add to Home Screen for a standalone view.</p><table><tr><td>Bottom-left stick / WASD</td><td>Move in any direction. Drag farther for full speed.</td></tr><tr><td>Bottom-right Strike / J</td><td>Strike locks automatically onto the nearest rival within melee range.</td></tr><tr><td>Bottom-middle skills / K, L</td><td>Hold your main skill to charge, then release to cast. Hold Rock shield until you release it or it breaks.</td></tr><tr><td>Top ability-set tabs / Tab</td><td>Choose origin or fused skills. Your elemental identity and accumulated passives remain active.</td></tr><tr><td>Touch an ally token</td><td>Compatible fusion happens automatically and blows nearby and distant fighters away. Enemy tokens are hidden.</td></tr></table><h3>Spirit: portals, revival and angel guard</h3><p>Tap Portals, then tap two arena positions. Fighters, ghosts, attacks, tokens and lingering effects can travel through either portal. Tap your portal to close it. Closing a portal during a crossing kills the traveller. A lone portal holds entrants off-screen: reverse your entry direction with the stick to retreat, or open a second exit. Closing the lone portal permanently loses anyone still inside and their token.</p><p>Revival brings back the closest recoverable fallen ally. It never heals you instead. If their token has already been fused, their contribution is removed from its bearer when they revive. A felled Spirit becomes a controllable ghost while allies remain: stand between an enemy and an ally to block melee attacks.</p><h3>Always-active abilities</h3><p>Reflect, hard skin, burn, flight, venomous contact, Angel guard and Divine immunity do not have buttons. Multi-Dimensional gains unlimited tap-to-teleport on the arena; placement and portal-closing taps take priority. Passives stay active across ability sets.</p><h3>New tactics</h3><p>Fused II and Fused III offer separate duels for each fusion tier. Healing picks the living teammate with the lowest current health, including you. Blaze has only Speed burst: a short dash, a flame trail, impact damage and contact-only burn unless immune. It has no recharge; another dash can start as soon as the current dash ends. Smoke has only Vog. Gravity is purple.</p><p>Divine is fully invisible while still, even to its controller. Attacks and abilities show a 30% silhouette. Continuous movement gives a brief 10% glimpse once per second, and damage gives a 150ms glimpse at 10% opacity. Concealed fighters cannot be target-locked, but physical attacks can still hit them. AI fighters avoid attacking through allies, help endangered teammates, and dodge hazards. Fire closes in for contact burn; Light favors healing and Flash, retreats while supporting, and still strikes nearby rivals. When idle, AI searches random spots around a Divine’s last seen location. Burn stops when contact ends; Mud venom lasts five seconds after contact.</p><h3>Lightning and Invincible</h3><p>Both are available in Fused III. Cloud + Light or Spirit + Water creates Lightning: tap Lightning strikes to hit the nearest visible rival within range instantly, with no charge and a 4.5-second cooldown. Shock prevents movement while touching Lightning; Divine is immune. Sun + Earth or Mirror + Fire creates Invincible: 2× outgoing damage is always active, including inherited skills. It still takes damage normally. Multi-Dimensional has no Rift; its Teleport reminder button explains arena taps and does not activate or limit teleportation.</p><h3>Combat rules</h3><p>Friendly fire is on. Mutual strikes within 100ms clash for quarter damage. Hits pause charging for 270ms without deleting stored power. Same-element abilities deal half damage. Fire now takes 30% less Water ability damage than in v0.1. Sonic boom is a spreading fan; the Sun laser is a fast, piercing beam.</p>`;
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
    `<span class="eyebrow">ORIGINS & FUSIONS</span><h2>The element codex.</h2><div class="codex-grid">${[...Object.keys(ELEMENTS), ...Object.values(COMBOS)].map((id) => `<article><h3>${chip(id)}</h3><p>${profile(id).desc}</p><p>${skillsFor(id).filter(Boolean).join(" · ") || "No active skills. Choose an inherited ability set."}</p><p>Passive: ${profile(id).passive}</p></article>`).join("")}</div>`,
  );
$("close-dialog").onclick = () => $("info-dialog").close();
function updateHUD() {
  const a = game.player,
    e = profile(a.element),
    form = activeForm(a),
    skills = skillsFor(form),
    ready = a.alive && inWorld(a) && !paused && !game.finished;
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
  $("hud-name").textContent = e.name.toUpperCase();
  $("hud-symbol").innerHTML = icon(a.element);
  $("hud-symbol").style.color = e.color;
  $("health-fill").style.width = `${(a.hp / a.maxHp) * 100}%`;
  $("health-label").textContent = a.ghost
    ? "ANGEL GUARD"
    : a.dimension
      ? "BETWEEN WORLDS"
      : `${Math.ceil(a.hp)} / ${a.maxHp} HP`;
  $("health-fill").style.background = a.hp < 40 ? "#e78c6c" : "#b2c797";
  $("timer").textContent = `${Math.floor(game.time / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(game.time % 60)
    .toString()
    .padStart(2, "0")}`;
  $("enemy-count").textContent = game.fighters
    .filter((b) => b.team === 1 && b.alive && !b.echo)
    .length.toString()
    .padStart(2, "0");
  $("round-mode").textContent =
    `${game.mode === "team" ? "TEAM BRAWL" : game.mode === "fused" ? "FUSED II" : game.mode === "fused3" ? "FUSED III" : "DUEL"} · ${Math.max(1, round).toString().padStart(2, "0")}`;
  $("charge-btn").hidden = !skills[0];
  $("utility-btn").hidden = !skills[1];
  $("teleport-info-btn").hidden = form !== "multi-dimensional";
  $("teleport-info-btn").disabled = !ready;
  $("passive-note").hidden =
    !!skills[0] || !!skills[1] || form === "multi-dimensional";
  $("passive-note").textContent =
    form === "invincible"
      ? "2× strength is always active. Choose Earth, Fire or Light skills above."
      : "Reflect is always active. Choose Earth or Light skills above.";
  $("ability-name").textContent = skills[0] || "";
  $("ability-symbol").innerHTML = icon(form);
  $("utility-name").textContent = skills[1] || "";
  $("ability-status").textContent =
    a.abilityCd > 0
      ? `${a.abilityCd.toFixed(1)}s`
      : a.charging
        ? "Release to cast"
        : form === "lightning"
          ? "Tap · instant strike"
          : form === "spirit"
            ? "Nearest fallen ally"
            : "Hold to charge";
  $("ability-cooldown").style.width = `${(a.abilityCd / 4.5) * 100}%`;
  $("utility-status").textContent =
    form === "spirit"
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
  $("charge-btn").disabled = !ready || a.abilityCd > 0;
  $("utility-btn").disabled =
    !ready || (!["spirit", "blaze"].includes(form) && a.utilityCd > 0);
  $("attack-btn").disabled = !ready;
  $("charge-meter").hidden = !a.charging;
  $("charge-percent").textContent = `${Math.round((a.charge / 1.8) * 100)}%`;
  $("charge-fill").style.width = `${(a.charge / 1.8) * 100}%`;
  $("dimension-notice").hidden = !a.dimension;
  $("portal-notice").hidden = game.portals.placing !== a.id;
  $("portal-instruction").textContent = game.portals.owned(a).length
    ? "Tap the arena to place the exit portal."
    : "Tap the arena to place the first portal.";
  $("arena-hint").textContent = a.ghost
    ? "ANGEL GUARD · Move between an enemy and an ally to block melee."
    : !a.alive
      ? "You are down. Your allies can still win."
      : a.dimension
        ? "Pull the stick back against your entry direction to return."
        : game.isShocked(a)
          ? "SHOCK · Contact stops movement. You can still strike."
          : hasPassive(a, "multi-dimensional")
            ? "PASSIVE TELEPORT · Tap anywhere on the arena."
            : game.target(a)
              ? "AUTO LOCK · Nearest rival in strike range."
              : "Target lock and token fusion are automatic.";
  if (game.finished && !shownResult) {
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
      `${Math.floor(game.time)} seconds · ${game.result === "victory" ? "Your team prevailed." : game.result === "draw" ? "Both teams fell." : "Your team has fallen."}`;
    $("overlay-play").innerHTML = "Fight again <span>→</span>";
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
    if (stick.pointer !== null) {
      x = stick.x;
      y = stick.y;
    }
    game.update(dt, { x, y });
    if (heldStrike || keys.has("j")) game.strike(game.player);
  }
  renderer.draw(game, !started);
  updateHUD();
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
