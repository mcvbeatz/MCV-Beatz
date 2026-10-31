import { initializeWar, updateWar, warRecoveryTarget } from "./war.js";
import { updateRespawnCamera } from "./camera.js";
import { createBattleMap, MATCH_MAP_IDS } from "./battle-maps.js";
import { createCorruptionMap } from "./corruption-map.js";
import {
  initializeAdvanced,
  updateAdvanced,
  advancedEnd,
  fusionScore,
  rewardChoices,
  chooseReward,
  advanceReward,
  isGauntlet,
} from "./advanced-modes.js";
import { PortalSystem, inWorld, segmentDistance } from "./portals.js";
export { inWorld } from "./portals.js";
export const ELEMENTS = {
  light: {
    name: "Light",
    color: "#f6f0d5",
    symbol: "✦",
    role: "Restoration & radiance",
    desc: "Outlast your rival with healing light. A flash creates space to recover.",
    passive: "Immune to shadow step",
    ability: "Healing",
    utility: "Flash",
  },
  dark: {
    name: "Dark",
    color: "#615973",
    symbol: "◐",
    role: "Deception & disruption",
    desc: "Break their focus. Slip past a strike and punish an interrupted charge.",
    passive: "Shadow affinity",
    ability: "Sabotage",
    utility: "Shadow step",
  },
  water: {
    name: "Water",
    color: "#428edf",
    symbol: "◉",
    role: "Control & precision",
    desc: "A focused hydro pump pushes rivals back. Water cools dangerous magma.",
    passive: "Burn immunity · cools magma · faster in Flood",
    ability: "Hydro pump",
    utility: null,
  },
  air: {
    name: "Air",
    color: "#80d9db",
    symbol: "≋",
    role: "Mobility & momentum",
    desc: "Float above hazards and control distance. Your sonic boom fades at range.",
    passive: "Flight · faster, wider turns",
    ability: "Sonic boom",
    utility: "Gust",
  },
  earth: {
    name: "Earth",
    color: "#ab8259",
    symbol: "⬡",
    role: "Defense & endurance",
    desc: "Stand your ground and hold a rock shield against pressure.",
    passive: "Hard skin · 25% defense · quicksand immunity",
    ability: null,
    utility: "Rock shield",
  },
  fire: {
    name: "Fire",
    color: "#eb7659",
    symbol: "♨",
    role: "Pressure & persistence",
    desc: "Stay close and turn up the heat. Leave molten ground to cut off an escape.",
    passive: "Contact burn · burn immunity",
    ability: "Flamethrower",
    utility: "Magma",
  },
};
export const COMBOS = {
  "earth+water": "mud",
  "air+light": "spirit",
  "earth+light": "mirror",
  "fire+light": "sun",
  "air+fire": "blaze",
  "air+water": "cloud",
  "dark+fire": "smoke",
  "dark+earth": "gravity",
  "air+dark": "apparition",
  "air+dark+fire": "demonic",
  "air+earth+light": "divine",
  "dark+earth+light": "multi-dimensional",
  "air+light+water": "lightning",
  "earth+fire+light": "invincible",
  "air+fire+light": "phoenix",
  "air+dark+earth": "terraformer",
  "earth+light+water": "sanctuary",
};
export const FUSED = {
  mud: ["Quicksand", null],
  spirit: ["Revival", "Portals"],
  mirror: [null, null],
  sun: ["Laser beam", "Heatwave"],
  blaze: [null, "Speed burst"],
  cloud: ["Tornado", "Flood"],
  smoke: ["Vog", null],
  gravity: ["Telekinesis", "Gravity x2"],
  apparition: ["Doppelgänger", "Phase"],
  demonic: ["Minions", "Death"],
  divine: ["Radiance", null],
  "multi-dimensional": [null, null],
  lightning: ["Lightning strikes", "Tailwind"],
  invincible: [null, null],
  phoenix: [null, null],
  terraformer: ["Chasm", "Stone Prison"],
  sanctuary: ["Life spring", null],
};
// Extra buttons for the selected ability set, including direct fused shortcuts.
export const EXTRA_SKILLS = {
  phoenix: [
    { name: "Laser beam", form: "sun", kind: "ability" },
    { name: "Speed burst", form: "blaze", kind: "utility" },
  ],
  terraformer: [{ name: "Rock shield", form: "earth", kind: "utility" }],
  sanctuary: [{ name: "Rock shield", form: "earth", kind: "utility" }],
  dark: [{ name: "Blindness", form: "blindness", kind: "ability" }],
  mud: [
    { name: "Hydro pump", form: "water", kind: "ability" },
    { name: "Rock shield", form: "earth", kind: "utility" },
  ],
  spirit: [{ name: "Healing", form: "light", kind: "ability" }],
  divine: [
    { name: "Revival", form: "spirit", kind: "ability" },
    { name: "Portals", form: "spirit", kind: "utility" },
  ],
  sun: [{ name: "Healing", form: "light", kind: "ability" }],
  demonic: [
    { name: "Speed burst", form: "blaze", kind: "utility" },
    { name: "Sonic boom", form: "air", kind: "ability" },
  ],
  mirror: [
    { name: "Rock shield", form: "earth", kind: "utility" },
    { name: "Healing", form: "light", kind: "ability" },
  ],
  smoke: [
    { name: "Shadow step", form: "dark", kind: "utility" },
    { name: "Flamethrower", form: "fire", kind: "ability" },
  ],
  gravity: [{ name: "Rock shield", form: "earth", kind: "utility" }],
  apparition: [{ name: "Sonic boom", form: "air", kind: "ability" }],
  "multi-dimensional": [
    { name: "Healing", form: "light", kind: "ability" },
    { name: "Shadow step", form: "dark", kind: "utility" },
  ],
  lightning: [{ name: "Healing", form: "light", kind: "ability" }],
};
export const extraSkillsFor = (form) => EXTRA_SKILLS[form] || [];
const skillForm = (a) => a.executingForm || activeForm(a);
export const canUseSkill = (a, form, kind) =>
  !a.skillsDisabled &&
  !(a.selfHealOnly && form === "light" && kind === "utility") &&
  ((form === "blindness" && a.parts.includes("dark")) ||
    a.forms.includes(form) ||
    extraSkillsFor(a.element).some((s) => s.form === form && s.kind === kind));
export const VOG_RADIUS = (500 / Math.sqrt(3)) * 0.6 * 0.8;
export const FLASH_RADIUS = VOG_RADIUS * 0.85;
export const FLOOD_WATER_SPEED = 1.25;
export const quicksandImmune = (a) => a.parts.includes("earth");
export const BURST_HIT_RANGE = 28 * 1.3;
export const CHASM_RADIUS = 56;
export const CHASM_RANGE = 400;
export const TELEKINESIS_RANGE = 400;
export const TELEKINESIS_PUSH = 520;
export const canReactToHit = (a) =>
  a.alive &&
  !a.ghost &&
  !a.charging &&
  !a.shield &&
  !(a.swing > 0) &&
  !(a.clash > 0) &&
  !(a.burst > 0) &&
  !a.blink &&
  !(a.reveal > 0);
export const EDGES = [
  ["divine", "spirit"],
  ["spirit", "light"],
  ["light", "dark"],
  ["dark", "mirror"],
  ["mirror", "demonic"],
  ["demonic", "invincible"],
  ["invincible", "sun"],
  ["sun", "apparition"],
  ["apparition", "multi-dimensional"],
  ["multi-dimensional", "blaze"],
  ["blaze", "gravity"],
  ["gravity", "mud"],
  ["mud", "earth"],
  ["earth", "lightning"],
  ["lightning", "water"],
  ["water", "fire"],
  ["fire", "earth"],
  ["smoke", "air"],
  ["air", "cloud"],
  ["cloud", "smoke"],
];
export const TELEPORT_RANGE = 180;
export const STRIKE_RANGE = 69,
  TOKEN_TOUCH_RANGE = 27;
export const nameOf = (e) =>
  e
    .split("-")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const combination = (a, b) =>
  COMBOS[[...new Set([...a, ...b])].sort().join("+")] || null;
export const recipe = (e) =>
  Object.entries(COMBOS)
    .find(([, v]) => v === e)?.[0]
    .split("+") || [e];
export const LEVEL_TWO = Object.values(COMBOS).filter(
  (e) => recipe(e).length === 2,
);
export const LEVEL_THREE = Object.values(COMBOS).filter(
  (e) => recipe(e).length === 3,
);
export const activeForm = (a) => a.forms[a.form] || a.element;
export const skillsFor = (e) =>
  e === "blindness"
    ? ["Blindness", null]
    : ELEMENTS[e]
      ? [ELEMENTS[e].ability, ELEMENTS[e].utility]
      : FUSED[e] || [null, null];
export const hasPassive = (a, form) =>
  a.parts.includes(form) || recipe(form).every((e) => a.parts.includes(e));
export const burnImmune = (a) =>
  hasPassive(a, "fire") || hasPassive(a, "water") || hasPassive(a, "divine");
export function visibility(a) {
  if (a.ghost || !hasPassive(a, "divine")) return 1;
  if (a.reveal > 0 || a.charging || a.shield || a.swing > 0) return 0.3;
  if (a.hurtReveal > 0) return 0.1;
  return a.movingTime >= 1 && a.movingTime % 1 < 0.15 ? 0.1 : 0;
}
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function multiplier(source, target, ability = true) {
  return (
    (ability && source === target ? 0.5 : 1) *
    (EDGES.some(([a, b]) => a === source && b === target) ? 1.2 : 1)
  );
}
export function canHit(a, b, range = STRIKE_RANGE) {
  if (!a.alive || !b.alive || !inWorld(a) || !inWorld(b) || a.id === b.id)
    return false;
  const d = distance(a, b);
  return (
    d <= range &&
    (d < 12 || ((b.x - a.x) * a.fx + (b.y - a.y) * a.fy) / d >= 0.38)
  );
}
export function makeFighter(id, element, team, x, y) {
  const parts = recipe(element);
  return {
    id,
    element,
    base: parts[0],
    nativeParts: [...parts],
    parts: [...parts],
    forms: parts.length > 1 ? [...parts, element] : [element],
    form: parts.length > 1 ? parts.length : 0,
    absorbed: [],
    team,
    x,
    y,
    vx: 0,
    vy: 0,
    fx: team === 0 ? 1 : -1,
    fy: 0,
    hp: 120,
    maxHp: 120,
    alive: true,
    ghost: false,
    lost: false,
    attackCd: 0,
    abilityCd: 0,
    utilityCd: 0,
    charging: false,
    charge: 0,
    stagger: 0,
    lock: null,
    blind: 0,
    whiteout: 0,
    sabotaged: false,
    prisonHp: 0,
    chasmReady: false,
    shield: 0,
    shieldHp: 65,
    shieldTime: 0,
    dodge: 0,
    boost: 0,
    burst: 0,
    burstHits: new Set(),
    reveal: 0,
    hurtReveal: 0,
    hitReact: 0,
    hitDx: 0,
    hitDy: 0,
    blink: null,
    movingTime: 0,
    burn: 0,
    venom: 0,
    venomTint: 0,
    slow: 0,
    flash: 0,
    swing: 0,
    clash: 0,
    clashPartner: null,
    reflect: 0,
    spawnFlash: 0,
    aiTimer: 0,
    knockX: 0,
    knockY: 0,
    portalCooldown: 0,
  };
}
export class Combat {
  constructor({
    element = "fire",
    mode = "duel",
    size = 2,
    players = 4,
    random = Math.random,
    countdown = false,
    mapId,
    enemyElement,
  } = {}) {
    this.random = random;
    this.time = 0;
    this.countdown =
      countdown && !["duel", "fused", "fused3", "team"].includes(mode) ? 4 : 0;
    this.mode = mode;
    if (mode === "war") {
      if (!Object.hasOwn(ELEMENTS, element)) element = "fire";
      const rivals = Object.keys(ELEMENTS).filter((e) => e !== element);
      this.warElements = [
        element,
        rivals.includes(enemyElement)
          ? enemyElement
          : rivals[
              Math.min(rivals.length - 1, Math.floor(random() * rivals.length))
            ],
      ];
      if (
        this.warElements.includes("water") &&
        this.warElements.includes("fire")
      )
        mapId = "volcano";
    }
    this.mapId =
      mode === "corruption"
        ? "corruption"
        : (mapId ??
          MATCH_MAP_IDS[
            Math.min(
              MATCH_MAP_IDS.length - 1,
              Math.floor(random() * MATCH_MAP_IDS.length),
            )
          ]);
    this.map =
      this.mapId === "corruption"
        ? createCorruptionMap()
        : this.mapId === "classic"
          ? null
          : createBattleMap(this.mapId);
    this.spectatorFocus = null;
    this.fallenAnimations = [];
    this.scores = [0, 0];
    this.deathUsed = new Set();
    this.rebirthUsed = new Set();
    this.springUsed = new Set();
    this.friendlyFire = !["corruption", "boss", "domination"].includes(mode);
    this.fusionEnabled = !["ctf", "corruption", "boss", "roulette"].includes(
      mode,
    );
    this.timeLimit =
      mode === "corruption"
        ? 120
        : ["tdm", "war", "domination", "rush", "roulette", "ffa"].includes(mode)
          ? 180
          : null;
    this.respawnDelay = [
      "ctf",
      "tdm",
      "war",
      "corruption",
      "domination",
      "rush",
      "roulette",
      "ffa",
    ].includes(mode)
      ? 10
      : null;
    this.flags =
      mode === "ctf"
        ? [0, 1].map((team) => ({
            team,
            home: { x: team === 0 ? 185 : 839, y: 350 },
            x: team === 0 ? 185 : 839,
            y: 350,
            carrier: null,
            dropped: false,
          }))
        : [];
    if (mode === "domination")
      this.flags = [0, 1, 2, 3].map((i) => ({
        team: i < 2 ? 0 : 1,
        x: i < 2 ? 285 : 739,
        y: i % 2 ? 470 : 230,
        home: { x: i < 2 ? 285 : 739, y: i % 2 ? 470 : 230 },
        progress: 0,
        capturing: null,
        contested: false,
      }));
    this.finishReason = null;
    this.events = [];
    this.effects = [];
    this.projectiles = [];
    this.waves = [];
    this.hazards = [];
    this.tokens = [];
    this.pending = [];
    this.finished = false;
    this.result = null;
    this.fighters = [];
    this.sequence = 0;
    this.portals = new PortalSystem(this);
    const n =
        mode === "war"
          ? Math.max(3, Math.min(5, Math.floor(size) || 3))
          : ["team", "ctf", "tdm", "domination", "rush"].includes(mode)
            ? Math.max(
                mode === "rush" ? 3 : 2,
                Math.min(4, Math.floor(size) || 2),
              )
            : 1,
      pool =
        mode === "fused"
          ? LEVEL_TWO
          : mode === "fused3"
            ? LEVEL_THREE
            : Object.keys(ELEMENTS);
    if (["fused", "fused3"].includes(mode) && !pool.includes(element))
      element = pool[0];
    if (mode === "ctf" && !Object.hasOwn(ELEMENTS, element)) element = "fire";
    for (let i = 0; i < n; i++) {
      this.fighters.push(
        makeFighter(
          i === 0 ? "player" : `ally-${i}`,
          mode === "war" || i === 0
            ? element
            : ["air", "light", "earth"][i - 1],
          0,
          330 - i * 34,
          340 + (i - (n - 1) / 2) * 95,
        ),
      );
      this.fighters.push(
        makeFighter(
          `enemy-${i}`,
          mode === "war"
            ? this.warElements[1]
            : pool[
                Math.min(pool.length - 1, Math.floor(random() * pool.length))
              ],
          1,
          710 + i * 26,
          340 + (i - (n - 1) / 2) * 95,
        ),
      );
    }
    if (["ffa", "corruption", "roulette"].includes(mode)) {
      const count = Math.max(2, Math.min(8, Math.floor(players) || 4));
      this.fighters = Array.from({ length: count }, (_, i) => {
        const angle = Math.PI + (i * Math.PI * 2) / count;
        return makeFighter(
          i === 0 ? "player" : `enemy-${i}`,
          mode === "corruption"
            ? "light"
            : i === 0
              ? element
              : pool[
                  Math.min(pool.length - 1, Math.floor(random() * pool.length))
                ],
          mode === "corruption" ? 0 : i,
          512 + Math.cos(angle) * 300,
          350 + Math.sin(angle) * 145,
        );
      });
    }
    if (mode === "boss") {
      const count = clamp(Math.floor(players) || 4, 4, 8);
      const bossIndex = Math.min(count - 1, Math.floor(random() * count));
      this.fighters = Array.from({ length: count }, (_, i) => {
        const boss = i === bossIndex;
        const origin =
          i === 0 && ELEMENTS[element]
            ? element
            : pool[
                Math.min(pool.length - 1, Math.floor(random() * pool.length))
              ];
        const a = makeFighter(
          i === 0 ? "player" : `enemy-${i}`,
          boss ? "invincible" : origin,
          boss ? 1 : 0,
          boss ? 740 : 250 + (i % 2) * 55,
          boss ? 350 : 180 + i * 50,
        );
        a.chosenOrigin = origin;
        if (boss) a.hp = a.maxHp = 120 * (count - 1);
        return a;
      });
    }
    if (this.map?.kind === "corruption") {
      this.fighters.forEach((a, i) =>
        Object.assign(a, this.map.spawn(i, this.fighters.length)),
      );
      this.portals.portals = this.map.portals.map((p) => ({ ...p }));
    }
    if (this.map && this.map.kind !== "corruption") {
      this.placeMapFighters();
      this.flags.forEach((flag, i) => {
        const home = (
          mode === "ctf" ? this.map.flagHomes : this.map.capturePoints
        )[i];
        Object.assign(flag, home, { home: { ...home } });
      });
    }
    for (const a of this.fighters) {
      a.infections = 0;
      if (mode === "corruption") {
        a.hp = a.maxHp = 2;
        a.selfHealOnly = true;
      }
      if (mode === "ctf" && !this.map) a.x = a.team === 0 ? 220 : 804;
      a.spawn = { x: a.x, y: a.y, element: a.element };
      a.kills = 0;
      a.deaths = 0;
    }
    this.player = this.fighters[0];
    initializeWar(this);
    initializeAdvanced(this, {
      element: ELEMENTS[element] ? element : "fire",
      size,
      players,
    });
  }
  placeMapFighters() {
    if (!this.map || this.map.kind === "corruption") return;
    const solo = ["ffa", "roulette"].includes(this.mode);
    const teams = new Map();
    for (const a of this.fighters) {
      if (!teams.has(a.team)) teams.set(a.team, []);
      teams.get(a.team).push(a);
    }
    this.fighters.forEach((a, i) => {
      const members = teams.get(a.team);
      const p = solo
        ? this.map.spawn(i, this.fighters.length)
        : this.map.teamSpawn(a.team, members.indexOf(a), members.length);
      Object.assign(a, this.map.nearest(p, 24));
      a.spawn = { x: a.x, y: a.y, element: a.element };
    });
  }
  walkablePoint(p, r = 13) {
    return this.map
      ? this.map.walkable(p, r)
      : Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.x >= 135 &&
          p.x <= 889 &&
          p.y >= 175 &&
          p.y <= 560;
  }
  floorPoint(p, r = 13) {
    return this.map?.nearest
      ? this.map.nearest(p, r)
      : { x: clamp(p.x, 135, 889), y: clamp(p.y, 175, 560) };
  }
  moveToward(a, goal, dt) {
    const waypoint =
      this.map?.kind !== "corruption" && this.map
        ? this.map.route(a, goal)
        : goal;
    this.move(a, waypoint.x - a.x, waypoint.y - a.y, dt);
  }
  rewardChoices() {
    return rewardChoices(this);
  }
  chooseReward(id) {
    return chooseReward(this, id);
  }
  cue(cue, subject, color = "#e9cc91") {
    this.effects.push({
      kind: "cue",
      cue,
      subject: subject.id || null,
      x: subject.x,
      y: subject.y,
      color,
      life: 0.65,
      max: 0.65,
    });
  }
  flying(a) {
    return a.parts.includes("air");
  }
  get countingDown() {
    return this.countdown > 1;
  }
  get countdownLabel() {
    return this.countdown > 1
      ? String(Math.ceil(this.countdown - 1))
      : this.countdown > 0
        ? "Go!"
        : "";
  }
  auroraProtected(a) {
    return (
      a.alive &&
      this.fighters.some(
        (b) =>
          b.alive &&
          !b.echo &&
          inWorld(b) &&
          b.team === a.team &&
          hasPassive(b, "sanctuary"),
      )
    );
  }
  canSee(a, b) {
    return (
      visibility(b) > 0 &&
      (this.map?.kind !== "corruption" || this.map.lineClear(a, b)) &&
      (a.parts.includes("dark") ||
        this.auroraProtected(a) ||
        !this.hazards.some(
          (h) =>
            h.kind === "vog" &&
            inWorld(h) &&
            h.life > 0 &&
            distance(h, b) <= h.r,
        ))
    );
  }
  cancelSabotaged(a) {
    if (this.auroraProtected(a)) a.sabotaged = false;
    if (!a.sabotaged) return false;
    a.sabotaged = false;
    a.charging = false;
    a.charge = 0;
    a.chargeForm = null;
    a.blink = null;
    this.cue("interrupt", a, "#c1a1df");
    return true;
  }
  target(a) {
    return this.fighters.find(
      (b) => b.id === a.lock && b.alive && inWorld(b) && this.canSee(a, b),
    );
  }
  autoLock(a) {
    a.lock = null;
    if (!a.alive || !inWorld(a) || a.blind > 0) return;
    const t = this.fighters
      .filter(
        (b) =>
          b.alive &&
          inWorld(b) &&
          this.canSee(a, b) &&
          b.team !== a.team &&
          distance(a, b) <= STRIKE_RANGE,
      )
      .sort((b, c) => this.pursuitOrder(a, b, c))[0];
    if (t) {
      a.lock = t.id;
      const d = distance(a, t);
      if (d > 0.01) {
        a.fx = (t.x - a.x) / d;
        a.fy = (t.y - a.y) / d;
      }
    }
  }
  isShocked(a) {
    return (
      a.alive &&
      inWorld(a) &&
      !hasPassive(a, "divine") &&
      this.fighters.some(
        (b) =>
          b.id !== a.id &&
          b.alive &&
          inWorld(b) &&
          (this.friendlyFire || a.team !== b.team) &&
          hasPassive(b, "lightning") &&
          distance(a, b) < 30,
      )
    );
  }
  move(a, dx, dy, dt) {
    if (this.countingDown || (!a.alive && !a.ghost) || !inWorld(a)) return;
    if (a.blink && Math.hypot(a.knockX, a.knockY) > 1) a.blink = null;
    if (a.prisonHp > 0 || a.blink || this.isShocked(a)) {
      a.vx = a.vy = a.knockX = a.knockY = a.burst = a.movingTime = 0;
      return;
    }
    const old = { x: a.x, y: a.y };
    const length = Math.hypot(dx, dy),
      magnitude = Math.min(1, length);
    if (length) {
      dx /= length;
      dy /= length;
    }
    const movementHealth =
      this.mode === "corruption" ? (a.hp / a.maxHp) * 120 : a.hp;
    const swimming =
      a.parts.includes("water") &&
      this.hazards.some(
        (h) =>
          h.kind === "flood" &&
          h.life > 0 &&
          inWorld(h) &&
          distance(a, h) <= h.r,
      );
    let speed =
      150 *
      (swimming ? FLOOD_WATER_SPEED : 1) *
      (a.waveSpeed || 1) *
      (a.ghost
        ? 1.1
        : movementHealth < 40
          ? 0.55 + (0.45 * movementHealth) / 40
          : 1) *
      (this.flying(a) ? 1.28 : 1) *
      (a.boost > 0 ? 1.7 : 1) *
      (a.charging ? 0.65 : 1) *
      (a.slow > 0 ? 0.48 : 1) *
      (a.shield ? 0.32 : 1) *
      (a.element === "invincible" ? 0.85 : 1);
    const blend = this.flying(a) ? Math.min(1, dt * 4) : 1;
    a.vx += (dx * speed * magnitude - a.vx) * blend;
    a.vy += (dy * speed * magnitude - a.vy) * blend;
    if (a.burst > 0) {
      a.vx = a.burstX * 650;
      a.vy = a.burstY * 650;
    }
    if (this.map)
      this.map.move(
        a,
        a.x + (a.vx + a.knockX) * dt,
        a.y + (a.vy + a.knockY) * dt,
      );
    else {
      a.x = clamp(a.x + (a.vx + a.knockX) * dt, 135, 889);
      a.y = clamp(a.y + (a.vy + a.knockY) * dt, 175, 560);
    }
    a.knockX *= Math.exp(-7 * dt);
    a.knockY *= Math.exp(-7 * dt);
    a.movingTime =
      (length || a.burst > 0) && distance(old, a) > 0.05
        ? a.movingTime + dt
        : 0;
    if (length) {
      a.fx = dx;
      a.fy = dy;
    }
    this.autoLock(a);
  }
  strike(a, aim = null) {
    if (this.intermission || this.countingDown) return false;
    if (!a.alive || !inWorld(a) || a.attackCd > 0 || a.shield || a.stagger > 0)
      return false;
    if (a.prisonHp > 0) {
      a.attackCd = 0.43;
      a.swing = 0.22;
      a.reveal = 0.45;
      a.prisonHp = Math.max(
        0,
        a.prisonHp -
          14 *
            (hasPassive(a, "invincible") ? 2 : a.element === "light" ? 0.9 : 1),
      );
      this.cue("shatter", a, "#c4af79");
      return true;
    }
    if (!this.aiGesture(a, "strike")) return false;
    this.autoLock(a);
    a.attackCd = 0.43;
    a.swing = 0.22;
    a.reveal = 0.45;
    this.pending.push({
      id: ++this.sequence,
      who: a,
      at: this.time + 0.11,
      aim: aim ? { ...aim } : null,
    });
    return true;
  }
  startCharge(a, form = activeForm(a)) {
    if (this.intermission || this.countingDown) return false;
    if (!canUseSkill(a, form, "ability") || a.charging) return false;
    if (
      !a.alive ||
      !inWorld(a) ||
      a.abilityCd > 0 ||
      a.shield ||
      a.stagger > 0 ||
      !skillsFor(form)[0]
    )
      return false;
    if (form === "sanctuary" && this.springUsed.has(a.id)) return false;
    if (this.cancelSabotaged(a)) return false;
    if (form === "terraformer") {
      a.chasmReady = true;
      return true;
    }
    if (form !== "gravity" && !this.aiGesture(a, `ability:${form}`))
      return false;
    if (
      ["lightning", "gravity", "blindness", "smoke", "sanctuary"].includes(form)
    ) {
      if (this.cast(a, 1, form) === false) return false;
      a.abilityCd = form === "lightning" ? 3 : form === "smoke" ? 7 : 4.5;
      return true;
    }
    if (form === "spirit" && !this.revivalTarget(a)) {
      this.cue("unavailable", a, "#dca282");
      return false;
    }
    a.charging = true;
    a.chargeForm = form;
    a.charge = 0;
    return true;
  }
  releaseCharge(a) {
    if (!a.charging) return;
    a.charging = false;
    if (!a.alive || !inWorld(a)) {
      a.charge = 0;
      return;
    }
    const p = 1 + Math.min(1, a.charge / 1.8) * 1.6;
    a.charge = 0;
    if (this.cast(a, p, a.chargeForm || activeForm(a)) !== false)
      a.abilityCd = 4.5;
    a.chargeForm = null;
  }
  fell(a, { lost = false, killer = null } = {}) {
    if (!a.alive && !a.ghost) return;
    const wasAlive = a.alive;
    if (wasAlive && !a.echo) {
      a.deaths = (a.deaths || 0) + 1;
      const source =
        killer || (a.lastDamagedAt > this.time - 5 ? a.lastDamager : null);
      const credited = source?.echo
        ? this.fighters.find((b) => b.id === source.summoner)
        : source;
      if (credited && credited.team !== a.team) {
        credited.kills = (credited.kills || 0) + 1;
        if (["tdm", "war", "rush"].includes(this.mode))
          this.scores[credited.team]++;
      }
      if (this.respawnDelay) a.respawnAt = this.time + this.respawnDelay;
      for (const flag of this.flags)
        if (flag.carrier === a.id) {
          flag.carrier = null;
          flag.x = a.x;
          flag.y = a.y;
          flag.dropped = true;
          this.cue("portal", flag, flag.team === 0 ? "#82d7eb" : "#ed947d");
        }
    }
    if (
      wasAlive &&
      !a.echo &&
      hasPassive(a, "phoenix") &&
      !this.rebirthUsed.has(a.id)
    ) {
      this.rebirthUsed.add(a.id);
      Object.assign(a, {
        hp: a.maxHp * 0.5,
        alive: true,
        ghost: false,
        lost: false,
        dimension: null,
        transit: null,
        charging: false,
        charge: 0,
        chargeForm: null,
        shield: 0,
        prisonHp: 0,
        burst: 0,
        blink: null,
        blind: 0,
        whiteout: 0,
        venom: 0,
        burn: 0,
        slow: 0,
        sabotaged: false,
        stagger: 0,
        vx: 0,
        vy: 0,
        knockX: 0,
        knockY: 0,
        swing: 0,
        clash: 0,
        hitReact: 0,
        lock: null,
        spawnFlash: 1,
        portalCooldown: 1,
      });
      delete a.respawnAt;
      Object.assign(a, this.floorPoint(a));
      this.pending = this.pending.filter((p) => p.who !== a);
      this.tokens = this.tokens.filter((t) => t.owner !== a.id);
      this.effects.push({
        kind: "rebirth",
        x: a.x,
        y: a.y,
        color: "#ffe4a3",
        r: 85,
        life: 1,
        max: 1,
      });
      return;
    }
    if (wasAlive) {
      this.fallenAnimations.push({
        fighter: { ...a, parts: [...a.parts], victory: false },
        elapsed: 0,
        duration: 1.5,
        lost,
      });
    }
    a.prisonHp = 0;
    a.chasmReady = false;
    a.hp = 0;
    a.clash = a.reflect = a.hitReact = 0;
    a.blink = null;
    a.burst = 0;
    a.movingTime = 0;
    a.alive = false;
    // The saved death appearance carries the brief visual fade; the debuff ends now.
    a.whiteout = 0;
    a.charging = false;
    a.shield = 0;
    a.lock = null;
    a.lost = lost;
    a.ghost = !this.respawnDelay && !lost && !a.echo && hasPassive(a, "spirit");
    a.dimension = null;
    a.transit = null;
    a.vx = a.vy = 0;
    if (this.portals.placing === a.id) this.portals.placing = null;
    this.tokens = this.tokens.filter((t) => t.owner !== a.id);
    if (lost) {
      for (const soul of a.absorbed || []) {
        const f = this.fighters.find((b) => b.id === soul.owner);
        if (f) {
          f.lost = true;
          f.ghost = false;
        }
      }
      this.cue("lost", { x: a.x, y: a.y }, "#cbb4e7");
    } else if (!a.echo && this.fusionEnabled) {
      this.tokens.push({
        x: a.x,
        y: a.y,
        parts: [...a.parts],
        team: a.team,
        owner: a.id,
        souls: [{ owner: a.id, parts: [...a.nativeParts] }, ...a.absorbed],
        portalCooldown: 0.3,
        bornAt: this.time,
      });
      if (a.ghost) this.cue("revive", a, "#a9dfd5");
    }
  }
  damage(
    a,
    b,
    amount,
    ability = false,
    reflected = false,
    sourceElement = ability ? skillForm(a) : a.element,
    reflectable = true,
    ignoreFriendlyFire = false,
  ) {
    if (
      !b.alive ||
      !inWorld(b) ||
      (!ignoreFriendlyFire && !this.friendlyFire && a.team === b.team)
    )
      return 0;
    if (b.dodge > 0 && !a.parts.includes("light")) {
      b.dodge = 0;
      this.cue("dodge", b, "#b8a1df");
      return 0;
    }
    // Split the incoming ability before either recipient's defenses. The
    // reflected portion retains the original matchup modifier and cannot bounce.
    let hit =
      this.mode === "corruption" && !ability
        ? 1
        : amount *
          (!ability && hasPassive(a, "invincible") ? 2 : 1) *
          (reflected ? 1 : multiplier(sourceElement, b.element, ability));
    if (!ability && a.element === "light" && this.mode !== "corruption")
      hit *= 0.9;
    const lightningWeakness =
      ability && sourceElement === "lightning" && b.element === "invincible";
    if (lightningWeakness) {
      hit *= 1.25;
      reflectable = false;
    }
    if (!reflected) hit *= a.waveDamage || 1;
    if (
      ability &&
      reflectable &&
      hasPassive(b, "mirror") &&
      !reflected &&
      a.id !== b.id
    ) {
      b.reflect = 0.65;
      this.damage(
        b,
        a,
        hit * 0.4,
        true,
        true,
        sourceElement,
        true,
        ignoreFriendlyFire,
      );
      hit *= 0.6;
    }
    hit *= b.parts.includes("earth") && !lightningWeakness ? 0.75 : 1;
    if (ability && sourceElement === "water" && b.parts.includes("fire"))
      hit *= 0.7;
    if (b.shield) {
      const blocked = Math.min(b.shieldHp, hit);
      b.shieldHp -= blocked;
      hit -= blocked;
      if (b.shieldHp <= 0) {
        b.shield = 0;
        b.utilityCd = 5;
        this.cue("shatter", b, "#b79669");
      }
    }
    b.hp = Math.max(0, b.hp - hit);
    if (hit > 0) {
      b.lastDamager = a;
      b.lastDamagedAt = this.time;
      b.flash = 0.16;
      b.hurtReveal = 0.15;
      if (canReactToHit(b) && !(b.hitReact > 0)) {
        const d = distance(a, b);
        b.hitReact = 0.24;
        b.hitDx = d > 0 ? (b.x - a.x) / d : -b.fx;
        b.hitDy = d > 0 ? (b.y - a.y) / d : -b.fy;
      }
      if (b.charging) {
        b.stagger = 0.27;
        if (hit >= 0.5 && !hasPassive(b, "divine"))
          this.cue("interrupt", b, "#e9cc91");
      }
      if (b.hp <= 0) this.fell(b, { killer: a });
    }
    return hit;
  }
  meleeDamage(a, b, amount) {
    if (!this.friendlyFire && a.team === b.team) return 0;
    if (this.mode === "corruption") {
      if (!a.alive || !b.alive || !inWorld(b)) return 0;
      if (a.element === "dark") this.corruptionHit(a, b);
      else return this.damage(a, b, 1);
      return amount;
    }
    const guard = this.fighters.find(
      (g) =>
        g.ghost &&
        inWorld(g) &&
        g.team === b.team &&
        a.team !== b.team &&
        distance(g, b) <= STRIKE_RANGE &&
        segmentDistance(g, a, b) <= 20,
    );
    if (guard) {
      guard.flash = 0.3;
      this.cue("guard", guard, "#b8edeb");
      this.effects.push({
        kind: "ring",
        x: guard.x,
        y: guard.y,
        color: "#c0f4f1",
        r: 45,
        life: 0.3,
        max: 0.3,
      });
      return 0;
    }
    return this.damage(a, b, amount);
  }
  resolveStrikes() {
    const due = this.pending.filter((p) => p.at <= this.time),
      remove = new Set();
    for (const p of due) {
      if (remove.has(p.id) || !this.pending.includes(p)) continue;
      const a = p.who;
      if (!a.alive || !inWorld(a)) {
        remove.add(p.id);
        continue;
      }
      this.autoLock(a);
      if (a.aiControlled && !this.safeAttack(a, p.aim || this.target(a))) {
        remove.add(p.id);
        continue;
      }
      const clash = this.pending.find(
        (q) =>
          q.id !== p.id &&
          !remove.has(q.id) &&
          Math.abs(q.at - p.at) <= 0.1 &&
          (this.friendlyFire || a.team !== q.who.team) &&
          canHit(a, q.who) &&
          canHit(q.who, a) &&
          (!this.map || this.map.lineClear(a, q.who)),
      );
      if (clash) {
        if (this.mode === "corruption") {
          // Both simultaneous hits land. Apply the Light hit before conversion
          // changes the health cap, even if that hit fells the Dark attacker.
          const dark = a.element === "dark" ? a : clash.who;
          const light = a.element === "light" ? a : clash.who;
          this.damage(light, dark, 1);
          this.corruptionHit(dark, light);
        } else {
          this.meleeDamage(a, clash.who, 3.5);
          this.meleeDamage(clash.who, a, 3.5);
        }
        remove.add(clash.id);
        for (const [fighter, other] of [
          [a, clash.who],
          [clash.who, a],
        ]) {
          if (!fighter.alive) continue;
          fighter.clash = 0.3;
          fighter.clashPartner = other.id;
          const d = distance(fighter, other) || 1;
          fighter.clashFx = (other.x - fighter.x) / d;
          fighter.clashFy = (other.y - fighter.y) / d;
          fighter.swing = 0;
        }
      } else
        for (const b of this.fighters)
          if (canHit(a, b) && (!this.map || this.map.lineClear(a, b)))
            this.meleeDamage(a, b, 14);
      remove.add(p.id);
    }
    this.pending = this.pending.filter((p) => !remove.has(p.id));
  }
  projectile(
    a,
    power,
    { speed = 350, r = 12, damage = 22, life = 1.05, kind = "bolt" } = {},
  ) {
    this.projectiles.push({
      owner: a,
      element: skillForm(a),
      x: a.x + a.fx * 27,
      y: a.y + a.fy * 27,
      dx: a.fx * speed,
      dy: a.fy * speed,
      r,
      damage: damage * power,
      life,
      maxLife: life,
      kind,
      hit: new Set(),
      trail: 0,
    });
  }
  area(a, power, kind, r = 90, life = 5) {
    this.hazards.push({
      owner: a,
      element: skillForm(a),
      x: a.x + a.fx * 70,
      y: a.y + a.fy * 70,
      r,
      power,
      kind,
      life,
      tick: 0,
      ...(kind === "vog"
        ? {
            fireInside: new Set(
              this.fighters
                .filter(
                  (b) =>
                    b.alive &&
                    !b.echo &&
                    inWorld(b) &&
                    b.parts.includes("fire") &&
                    distance(b, { x: a.x + a.fx * 70, y: a.y + a.fy * 70 }) <=
                      r,
                )
                .map((b) => b.id),
            ),
            fireThinned: new Set(),
          }
        : {}),
    });
  }
  revivalTarget(a) {
    return this.fighters
      .filter(
        (b) =>
          b.team === a.team && b.id !== a.id && !b.alive && !b.lost && !b.echo,
      )
      .sort((b, c) => distance(a, b) - distance(a, c))[0];
  }
  revive(a, power = 1) {
    const fallen = this.revivalTarget(a);
    if (!fallen) return false;
    if (this.respawnDelay) {
      this.respawn(fallen);
      fallen.hp = Math.min(fallen.maxHp, 50 * power);
      this.cue("revive", fallen, "#bee9bf");
      return true;
    }
    // A reclaimed soul cannot also remain inside a fused fighter. Detach it from
    // any bearer (or bearer token), then restore its own native elemental form.
    for (const b of this.fighters) {
      if (b.absorbed.some((s) => s.owner === fallen.id)) {
        b.absorbed = b.absorbed.filter((s) => s.owner !== fallen.id);
        this.rebuildFusion(b);
      }
    }
    for (const t of this.tokens) {
      if (t.souls?.some((s) => s.owner === fallen.id)) {
        t.souls = t.souls.filter((s) => s.owner !== fallen.id);
        t.parts = [...new Set(t.souls.flatMap((s) => s.parts))];
      }
    }
    this.tokens = this.tokens.filter(
      (t) => t.owner !== fallen.id && t.parts.length,
    );
    fallen.absorbed = [];
    this.rebuildFusion(fallen);
    fallen.alive = true;
    fallen.ghost = false;
    fallen.fusedInto = null;
    fallen.dimension = null;
    fallen.transit = null;
    this.fallenAnimations = this.fallenAnimations.filter(
      (d) => d.fighter.id !== fallen.id,
    );
    if (fallen === this.player) this.spectatorFocus = null;
    fallen.hp = Math.min(fallen.maxHp, 45 + 15 * power);
    Object.assign(
      fallen,
      this.floorPoint({ x: a.x - a.fx * 45, y: a.y - a.fy * 45 }),
    );
    fallen.portalCooldown = 0.8;
    fallen.blind = fallen.venom = fallen.burn = 0;
    fallen.spawnFlash = 0.65;
    this.cue("revive", fallen, "#bee9bf");
    return true;
  }
  // Borrow an ability's implementation and damage type without changing tabs.
  executeSkill(a, form, callback) {
    const previous = a.executingForm;
    a.executingForm = form;
    try {
      return callback();
    } finally {
      a.executingForm = previous;
    }
  }
  cast(a, p, form = activeForm(a)) {
    if (this.countingDown || !canUseSkill(a, form, "ability")) return false;
    return this.executeSkill(a, form, () => this.castSkill(a, p));
  }
  castSkill(a, p) {
    const e = skillForm(a);
    if (!skillsFor(e)[0]) return false;
    if (e === "sanctuary") {
      if (this.springUsed.has(a.id)) return false;
      this.springUsed.add(a.id);
      this.hazards.push({
        kind: "spring",
        owner: a,
        element: e,
        x: a.x,
        y: a.y,
        r: 85,
        power: 1,
        life: Infinity,
        tick: 0,
      });
      return true;
    }
    if (e === "terraformer") {
      a.chasmReady = true;
      return false;
    }
    if (e === "gravity") {
      const target = this.enemies(a).sort(
        (b, c) => distance(a, b) - distance(a, c),
      )[0];
      return this.telekinesis(
        a,
        target,
        target ? target.x - a.x : 0,
        target ? target.y - a.y : 0,
      );
    }
    a.reveal = 0.45;
    if (e === "lightning") {
      const flooded = this.hazards.some(
        (h) => inWorld(h) && h.kind === "flood" && h.life > 0,
      );
      const target = this.enemies(a)
        .filter((b) => distance(a, b) <= 450)
        .sort((b, c) => distance(a, b) - distance(a, c))[0];
      const targets = flooded
        ? this.fighters.filter((b) => b.alive && inWorld(b))
        : [target].filter(Boolean);
      if (!targets.length) {
        this.cue("unavailable", a, "#dca282");
        return false;
      }
      // Conductive Flood is arena-wide and strikes everyone, including its caster.
      for (const b of targets) {
        this.effects.push({
          kind: "lightning",
          x: b.x,
          y: b.y,
          color: "#e7faff",
          life: 0.25,
          max: 0.25,
        });
        this.damage(
          a,
          b,
          26 * (flooded ? 2 : 1),
          true,
          false,
          "lightning",
          true,
          flooded,
        );
      }
    } else if (e === "light" || e === "divine") {
      const recipients =
        e === "divine"
          ? this.fighters.filter(
              (b) => b.alive && !b.echo && inWorld(b) && b.team === a.team,
            )
          : [this.healingTarget(a)].filter(Boolean);
      if (!recipients.length) return false;
      for (const recipient of recipients) {
        recipient.hp = Math.min(recipient.maxHp, recipient.hp + 23 * p);
        this.effects.push({
          kind: "ring",
          x: recipient.x,
          y: recipient.y,
          color: "#fff3c4",
          r: 75,
          life: 0.7,
          max: 0.7,
        });
        this.cue("heal", recipient, "#c9ebbc");
      }
    } else if (e === "dark" || e === "blindness") {
      const t = this.enemies(a)
        .filter((b) => distance(a, b) < 245)
        .sort((b, c) => distance(a, b) - distance(a, c))[0];
      if (!t) return false;
      if (e === "blindness") {
        if (!hasPassive(t, "divine") && !this.auroraProtected(t)) {
          t.blind = 3;
          t.lock = null;
        }
        this.cue("interrupt", t, "#675475");
      } else if (!this.auroraProtected(t)) {
        const charging = t.charging || !!t.blink;
        t.charging = false;
        t.charge = 0;
        t.chargeForm = null;
        t.blink = null;
        t.sabotaged = !charging;
        this.cue("interrupt", t, "#c1a1df");
      }
    } else if (e === "mud") this.area(a, p, "quicksand", 85, 5 * p);
    else if (e === "smoke") this.area(a, 1, "vog", VOG_RADIUS, 8);
    else if (e === "apparition" || e === "demonic") {
      const limit = e === "demonic" ? 3 : 1,
        existing = this.fighters.filter(
          (b) => b.echo && b.summoner === a.id && b.alive,
        ).length;
      for (let i = existing; i < limit; i++) {
        const minion = makeFighter(
          `echo-${++this.sequence}`,
          e === "demonic" ? "fire" : a.base,
          a.team,
          a.x + 30 + i * 12,
          a.y + 30,
        );
        minion.hp = minion.maxHp = (e === "demonic" ? 8 : 1) + 20 * (p - 1);
        minion.life = 9;
        minion.echo = true;
        minion.summoner = a.id;
        minion.spawnFlash = 0.65;
        Object.assign(minion, this.floorPoint(minion));
        this.fighters.push(minion);
      }
    } else if (e === "spirit") return this.revive(a, p);
    else if (e === "sun")
      this.projectile(a, p, {
        speed: 1600,
        r: 6,
        damage: 30,
        life: 0.6,
        kind: "laser",
      });
    else if (e === "cloud")
      this.projectile(a, p, {
        speed: 200,
        r: 37,
        damage: 25,
        life: 2.5,
        kind: "tornado",
      });
    else if (e === "air")
      this.waves.push({
        owner: a,
        element: e,
        kind: "sonic",
        x: a.x,
        y: a.y,
        originX: a.x,
        originY: a.y,
        fx: a.fx,
        fy: a.fy,
        radius: 0,
        previousRadius: 0,
        totalTravel: 0,
        speed: 380,
        range: 360,
        halfAngle: 0.56,
        damage: 23 * p,
        hit: new Set(),
      });
    else if (e === "water")
      this.projectile(a, p, { speed: 390, r: 18, damage: 23, kind: "water" });
    else
      this.projectile(a, p, {
        speed: e === "fire" ? 290 : 330,
        r: e === "fire" ? 23 : 18,
        damage: 22,
        life: e === "fire" ? 0.85 : 1.1,
        kind: e === "fire" ? "flame" : "bolt",
      });
    return true;
  }
  telekinesis(a, target, dx, dy) {
    const length = Math.hypot(dx, dy);
    if (
      this.countingDown ||
      !a.alive ||
      !inWorld(a) ||
      skillForm(a) !== "gravity" ||
      a.shield ||
      a.abilityCd > 0 ||
      a.stagger > 0 ||
      !target?.alive ||
      !inWorld(target) ||
      target.team === a.team ||
      !this.canSee(a, target) ||
      distance(a, target) > TELEKINESIS_RANGE ||
      !Number.isFinite(length) ||
      length <= 0
    )
      return false;
    if (this.cancelSabotaged(a)) return false;
    if (!this.aiGesture(a, "ability:gravity")) return false;
    a.charging = false;
    a.charge = 0;
    a.abilityCd = 4.5;
    a.reveal = 0.45;
    this.damage(a, target, 18, true, false, "gravity", false);
    if (target.alive) {
      target.knockX += (dx / length) * TELEKINESIS_PUSH;
      target.knockY += (dy / length) * TELEKINESIS_PUSH;
      target.blink = null;
    }
    this.effects.push({
      kind: "telekinesis",
      x: target.x,
      y: target.y - 26,
      dx: dx / length,
      dy: dy / length,
      life: 0.4,
      max: 0.4,
    });
    return true;
  }
  utility(a, hold = true, form = activeForm(a)) {
    if (hold && (this.intermission || this.countingDown)) return false;
    if (hold && !canUseSkill(a, form, "utility")) return false;
    return this.executeSkill(a, form, () => this.utilitySkill(a, hold));
  }
  utilitySkill(a, hold) {
    const e = skillForm(a);
    if (!hold) {
      if (a.shield) {
        a.shield = 0;
        a.utilityCd = 5;
      }
      return;
    }
    if (!a.alive || !inWorld(a) || !skillsFor(e)[1]) return false;
    if (
      a.sabotaged &&
      !this.auroraProtected(a) &&
      !(a.shield && e === "earth") &&
      !(a.burst > 0 && e === "blaze") &&
      ((e === "spirit" && this.portals.owned(a).length < 2) ||
        (e === "blaze" && !this.isShocked(a)) ||
        (e === "earth" && a.utilityCd <= 0 && a.shieldHp > 0) ||
        (!["earth", "blaze", "spirit"].includes(e) &&
          a.utilityCd <= 0 &&
          !(e === "demonic" && this.deathUsed.has(a.id))))
    ) {
      this.cancelSabotaged(a);
      return false;
    }
    if (e === "blaze") {
      if (a.prisonHp > 0 || this.isShocked(a)) return false;
      // An active dash finishes before the next one begins; there is no recharge.
      if (a.burst > 0) return true;
      if (!this.aiGesture(a, "utility:blaze")) return false;
      const speed = Math.hypot(a.vx, a.vy);
      a.burstX = speed > 15 ? a.vx / speed : a.fx;
      a.burstY = speed > 15 ? a.vy / speed : a.fy;
      a.burst = 0.3;
      a.burstHits = new Set();
      a.reveal = 0.45;
      return true;
    }
    if (e === "spirit") {
      const begun = this.portals.begin(a);
      if (begun) a.reveal = 0.45;
      return begun;
    }
    if (e === "earth") {
      if (a.utilityCd > 0 || a.shieldHp <= 0) return false;
      if (a.shield) return true;
      if (!this.aiGesture(a, "utility:earth")) return false;
      a.charging = false;
      a.shield = 1;
      a.shieldTime = 0;
      return true;
    }
    if (a.utilityCd > 0 || (e === "demonic" && this.deathUsed.has(a.id)))
      return false;
    if (!this.aiGesture(a, `utility:${e}`)) return false;
    a.reveal = 0.45;
    a.utilityCd = 7;
    if (e === "terraformer") {
      const target = this.enemies(a)
        .filter((b) => distance(a, b) <= 245)
        .sort((b, c) => distance(a, b) - distance(a, c))[0];
      if (!target) {
        a.utilityCd = 0;
        return false;
      }
      Object.assign(target, {
        prisonHp: 65,
        shield: 0,
        charging: false,
        charge: 0,
        blink: null,
        burst: 0,
        vx: 0,
        vy: 0,
        knockX: 0,
        knockY: 0,
      });
      this.cue("shatter", target, "#b6ac85");
    } else if (e === "fire") this.area(a, 1, "magma", 66, Infinity);
    else if (e === "light") {
      for (const b of this.fighters)
        if (
          b.id !== a.id &&
          b.alive &&
          inWorld(b) &&
          (this.friendlyFire || a.team !== b.team) &&
          distance(a, b) <= FLASH_RADIUS + 1e-9 &&
          !hasPassive(b, "divine") &&
          !this.auroraProtected(b)
        ) {
          b.whiteout = 3;
          b.lock = null;
        }
      this.effects.push({
        kind: "ring",
        x: a.x,
        y: a.y,
        color: "#fff",
        r: FLASH_RADIUS,
        life: 0.5,
        max: 0.5,
      });
    } else if (e === "dark" || e === "apparition") {
      a.dodge = 4;
      this.cue("dodge", a, "#b8a1df");
    } else if (e === "air" || e === "lightning") {
      const team =
        a.element === "lightning"
          ? this.fighters.filter((b) => b.alive && !b.echo && b.team === a.team)
          : [a];
      for (const b of team) {
        b.boost = 2;
        this.cue("shatter", b, "#b4f1e7");
      }
      this.effects.push({
        kind: "ring",
        x: a.x,
        y: a.y,
        color: "#b4f1e7",
        r: 70,
        life: 0.4,
        max: 0.4,
      });
    } else if (e === "cloud") this.area(a, 1, "flood", 500, 8);
    else if (e === "gravity") this.area(a, 1, "gravity", 150, 6);
    else if (e === "sun") this.area(a, 1, "heatwave", 300, 5);
    else if (e === "demonic") {
      this.deathUsed.add(a.id);
      this.area(a, 1, "death", 66, Infinity);
      this.hazards.at(-1).opensAt = this.time + 0.5;
    }
    return true;
  }
  placeChasm(a, x, y) {
    if (
      this.countingDown ||
      this.intermission ||
      !a.alive ||
      !inWorld(a) ||
      !canUseSkill(a, "terraformer", "ability") ||
      a.abilityCd > 0 ||
      a.shield ||
      a.charging ||
      a.stagger > 0 ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !this.walkablePoint({ x, y }) ||
      distance(a, { x, y }) > CHASM_RANGE
    )
      return false;
    if (this.cancelSabotaged(a)) {
      a.chasmReady = false;
      return false;
    }
    if (!this.aiGesture(a, "chasm")) return false;
    a.chasmReady = false;
    a.reveal = 0.45;
    a.abilityCd = 8;
    this.hazards.push({
      kind: "chasm",
      owner: a,
      element: "terraformer",
      x,
      y,
      r: CHASM_RADIUS,
      opensAt: this.time + 1,
      life: 9,
      power: 1,
      tick: 0,
    });
    return true;
  }
  demote(a) {
    if (!a.alive || a.echo || a.parts.length < 2 || this.auroraProtected(a))
      return false;
    const form =
      a.parts.length >= 3
        ? Object.entries(COMBOS)
            .filter(
              ([parts]) =>
                parts.split("+").length === 2 &&
                parts.split("+").every((p) => a.parts.includes(p)),
            )
            .map(([, name]) => name)
            .sort()[0]
        : [...a.parts].sort()[0];
    if (!form) return false;
    const kept = recipe(form);
    a.nativeParts = a.nativeParts.filter((p) => kept.includes(p));
    a.absorbed = a.absorbed
      .map((soul) => ({
        ...soul,
        parts: soul.parts.filter((p) => kept.includes(p)),
      }))
      .filter((soul) => soul.parts.length);
    // Native-less fusions still belong to the same fighter; never revive removed souls.
    a.parts = kept;
    a.forms = [...new Set([...kept, form])];
    a.element = form;
    a.base = kept[0];
    a.demotedBase = kept[0];
    a.form = a.forms.indexOf(form);
    a.charging = false;
    a.charge = 0;
    a.chargeForm = null;
    a.shield = a.burst = a.boost = a.dodge = 0;
    a.blink = null;
    a.portalRoute = null;
    a.spawnFlash = 0.45;
    this.pending = this.pending.filter((p) => p.who !== a);
    this.cue("shatter", a, "#fff3d7");
    return true;
  }
  rebuildFusion(a) {
    a.parts = [
      ...new Set([...a.nativeParts, ...a.absorbed.flatMap((s) => s.parts)]),
    ];
    if (!a.parts.length) a.parts = [a.demotedBase || a.base];
    const fused = COMBOS[[...a.parts].sort().join("+")];
    a.element = fused || a.parts[0];
    const previous = a.forms.filter((f) =>
      recipe(f).every((p) => a.parts.includes(p)),
    );
    a.forms = [...new Set([...a.parts, ...previous, a.element])];
    a.form = a.forms.indexOf(a.element);
    a.charging = false;
    a.shield = 0;
  }
  applyFusion(a, parts, { burst = true } = {}) {
    if (!this.fusionEnabled) return false;
    const fused = combination(a.parts, parts),
      all = [...new Set([...a.parts, ...parts])];
    if (!a.alive || !fused || all.length <= a.parts.length) return false;
    const oldTier = a.parts.length;
    a.parts = all;
    a.forms = [...new Set([...a.forms, ...parts, fused])];
    a.element = fused;
    a.form = a.forms.length - 1;
    fusionScore(this, a, oldTier);
    a.hp = Math.min(a.maxHp, a.hp + 30);
    a.charging = false;
    a.shield = 0;
    if (burst) {
      this.effects.push({
        kind: "fusion",
        x: a.x,
        y: a.y,
        color: "#f4dfb2",
        r: 850,
        life: 0.7,
        max: 0.7,
      });
      for (const b of this.fighters) {
        if (b.id === a.id || (!b.alive && !b.ghost) || !inWorld(b)) continue;
        let dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 1) {
          dx = b.team === a.team ? -1 : 1;
          dy = 0;
        }
        b.knockX = (dx / (d || 1)) * 540;
        b.knockY = (dy / (d || 1)) * 540;
        b.stagger = Math.max(b.stagger, 0.25);
      }
    }
    return true;
  }
  touchTokens(a) {
    if (!this.fusionEnabled || !a.alive || !inWorld(a) || a.echo) return false;
    const token = this.tokens.find(
      (t) =>
        inWorld(t) &&
        !t.removed &&
        (t.neutral || this.mode === "ffa" || t.team === a.team) &&
        distance(a, t) <= TOKEN_TOUCH_RANGE &&
        combination(a.parts, t.parts),
    );
    if (!token || !this.applyFusion(a, token.parts)) return false;
    if (token.shard)
      a.nativeParts = [...new Set([...a.nativeParts, ...token.parts])];
    const souls = token.souls || [{ owner: token.owner, parts: token.parts }];
    a.absorbed.push(...souls);
    for (const soul of souls) {
      const fallen = this.fighters.find((b) => b.id === soul.owner);
      if (fallen) fallen.fusedInto = a.id;
    }
    this.tokens = this.tokens.filter((t) => t !== token);
    return true;
  }
  visibleTokens(team = this.player.team) {
    return this.tokens.filter(
      (t) =>
        (t.neutral || this.mode === "ffa" || t.team === team) && inWorld(t),
    );
  }
  switchForm(a, form) {
    const index =
      form === undefined
        ? (a.form + 1) % a.forms.length
        : a.forms.indexOf(form);
    if (index < 0) return false;
    a.charging = false;
    a.chasmReady = false;
    this.utility(a, false);
    a.form = index;

    return true;
  }
  teleport(a, x, y) {
    if (a.prisonHp > 0 || this.countingDown) return false;
    if (
      !a.alive ||
      !inWorld(a) ||
      a.blink ||
      !hasPassive(a, "multi-dimensional") ||
      this.isShocked(a) ||
      !this.walkablePoint({ x, y })
    )
      return false;
    const d = Math.hypot(x - a.x, y - a.y);
    if (d < 1) return false;
    const scale = Math.min(1, TELEPORT_RANGE / d);
    const destination = {
      x: a.x + (x - a.x) * scale,
      y: a.y + (y - a.y) * scale,
    };
    if (!this.walkablePoint(destination) || !this.aiGesture(a, "teleport"))
      return false;
    if (this.cancelSabotaged(a)) return false;
    a.blink = {
      ...destination,
      remaining: 0.2,
    };
    a.vx = a.vy = 0;
    return true;
  }
  updateTeleport(a, dt) {
    if (!a.blink) return;
    if (
      !a.alive ||
      !inWorld(a) ||
      this.isShocked(a) ||
      Math.hypot(a.knockX, a.knockY) > 1
    ) {
      a.blink = null;
      return;
    }
    a.blink.remaining -= dt;
    if (a.blink.remaining > 1e-9) return;
    const old = { x: a.x, y: a.y },
      destination = a.blink;
    a.blink = null;
    a.x = destination.x;
    a.y = destination.y;
    a.vx = a.vy = a.knockX = a.knockY = 0;
    for (const p of [old, a])
      this.effects.push({
        kind: "ring",
        x: p.x,
        y: p.y,
        color: "#c7a7e9",
        r: 50,
        life: 0.35,
        max: 0.35,
      });
    this.autoLock(a);
    this.touchTokens(a);
    this.portals.enter(a, a);
  }
  healingTarget(a) {
    if (a.selfHealOnly) return a.alive && inWorld(a) ? a : null;
    return this.fighters
      .filter((b) => b.alive && !b.echo && inWorld(b) && b.team === a.team)
      .sort((b, c) => b.hp - c.hp || distance(a, b) - distance(a, c))[0];
  }
  enemies(a) {
    return this.fighters.filter(
      (b) => b.alive && inWorld(b) && b.team !== a.team && this.canSee(a, b),
    );
  }
  // Restraint is an AI decision, not friendly-fire immunity. Players can still
  // strike allies, and attacks already in flight can still catch a moving ally.
  safeAttack(a, target, kind = "melee", form = activeForm(a)) {
    if (!target) return false;
    if (!this.friendlyFire) return true;
    const enemies = this.enemies(a);
    const nearestEnemy = Math.min(
      distance(a, target),
      ...enemies.map((b) => distance(a, b)),
    );
    const allies = this.fighters.filter(
      (b) => b.id !== a.id && b.alive && inWorld(b) && b.team === a.team,
    );
    if (!a.echo && allies.some((b) => distance(a, b) < nearestEnemy))
      return false;
    const d = distance(a, target) || 1;
    const dx = (target.x - a.x) / d,
      dy = (target.y - a.y) / d;
    return !allies.some((b) => {
      const bd = distance(a, b),
        along = (b.x - a.x) * dx + (b.y - a.y) * dy;
      if (kind === "melee") return canHit(a, b);
      if (form === "light") return bd <= FLASH_RADIUS;
      if (form === "gravity") return kind === "utility" ? false : bd < 200;
      if (form === "cloud" && kind === "utility") return true;
      if (form === "sun" && kind === "utility") return bd < 380;
      if (
        ["mud", "smoke"].includes(form) ||
        (form === "fire" && kind === "utility")
      )
        return distance(b, { x: a.x + dx * 70, y: a.y + dy * 70 }) < 105;
      if (form === "air" && kind === "ability")
        return bd < 380 && along / (bd || 1) > Math.cos(0.65);
      if (["dark", "apparition", "demonic", "spirit", "divine"].includes(form))
        return false;
      const reach = form === "sun" ? 1000 : form === "blaze" ? 230 : 540;
      return (
        along > 0 &&
        along < reach &&
        segmentDistance(b, a, { x: a.x + dx * reach, y: a.y + dy * reach }) < 60
      );
    });
  }
  aiGesture(a, key) {
    if (!a.aiControlled || this.relentless(a)) return true;
    if (a.aiLastGesture === key && a.aiRepeat >= 3) {
      a.aiNeedChange = true;
      return false;
    }
    a.aiRepeat = a.aiLastGesture === key ? a.aiRepeat + 1 : 1;
    a.aiLastGesture = key;
    return true;
  }
  aiProgress(a) {
    // Holding a capture point is useful progress, not an idle combat loop.
    if (
      this.mode === "domination" &&
      this.flags.some(
        (f) => f.team !== a.team && !f.contested && distance(a, f) <= 42,
      )
    ) {
      a.aiStalled = 0;
      a.aiProgressSample = null;
      return;
    }
    if (this.time < (a.aiProgressAt || 0)) return;
    a.aiProgressAt = this.time + 1;
    const previous = a.aiProgressSample;
    // A repeating safe-distance loop counts as stalled even if the feet shuffle.
    const enemyHp = this.fighters
      .filter((b) => b.team !== a.team && !b.echo)
      .reduce((sum, b) => sum + b.hp, 0);
    const sample = { x: a.x, y: a.y, enemyHp, hp: a.hp, parts: a.parts.length };
    a.aiStalled =
      previous &&
      distance(previous, a) < 50 &&
      Math.abs(previous.enemyHp - enemyHp) < 1 &&
      Math.abs(previous.hp - a.hp) < 1 &&
      previous.parts === sample.parts
        ? (a.aiStalled || 0) + 1
        : 0;
    a.aiProgressSample = sample;
    if (a.aiStalled >= 3) a.aiNeedChange = true;
  }
  aiTactic(a, target) {
    if (a.aiPlan) {
      const p = a.aiPlan;
      const gone = p.token && !this.tokens.includes(p.token);
      if (gone || this.time > p.until || distance(a, p) < 24) {
        a.aiPlan = null;
        if (distance(a, p.start) > 35) {
          a.aiLastGesture = "reposition";
          a.aiRepeat = 1;
        }
      } else return p;
    }
    const token = (a.echo || !this.fusionEnabled ? [] : this.tokens)
      .filter(
        (t) =>
          !t.removed &&
          inWorld(t) &&
          (t.neutral || this.mode === "ffa" || t.team === a.team) &&
          combination(a.parts, t.parts),
      )
      .sort((b, c) => distance(a, b) - distance(a, c))[0];
    if (
      !a.aiNeedChange &&
      !(
        token &&
        distance(a, token) < 260 &&
        (!target || distance(a, target) > 90)
      )
    )
      return null;
    a.aiNeedChange = false;
    a.aiStalled = 0;
    if (a.shield) this.utility(a, false);
    a.charging = false;
    a.charge = 0;
    const candidates = [];
    if (token) candidates.push({ x: token.x, y: token.y, token });
    // Flank around hostile terrain instead of standing at its edge. Alternate sides.
    a.aiFlank = -(a.aiFlank || 1);
    const focus = target || (a.lastSeen?.divine ? a.lastSeen : null);
    const angle = focus
      ? Math.atan2(a.y - focus.y, a.x - focus.x)
      : this.random() * Math.PI * 2;
    for (const turn of [a.aiFlank * 1.2, -a.aiFlank * 1.2, Math.PI]) {
      const center = focus || a;
      const reach =
        !target && focus
          ? 60
          : target
            ? Math.max(110, Math.min(190, distance(a, target)))
            : 140;
      candidates.push(
        this.floorPoint(
          {
            x: center.x + Math.cos(angle + turn) * reach,
            y: center.y + Math.sin(angle + turn) * reach,
          },
          24,
        ),
      );
    }
    const goal = candidates.find(
      (p) => distance(a, p) > 35 && this.mobilitySafe(a, p),
    );
    if (!goal) return null;
    a.aiPlan = { ...goal, start: { x: a.x, y: a.y }, until: this.time + 4 };
    return a.aiPlan;
  }
  aiRoute(a, goal) {
    if (this.map?.kind !== "corruption" && this.map)
      goal = this.map.route(a, goal);
    const desired = Math.atan2(goal.y - a.y, goal.x - a.x);
    let best = null,
      score = Infinity;
    const risk = (point) =>
      this.hazards
        .filter(
          (h) =>
            inWorld(h) &&
            (h.kind === "chasm"
              ? !this.flying(a)
              : h.kind === "death"
                ? a.parts.length > 1 && !this.auroraProtected(a)
                : h.kind === "quicksand"
                  ? !this.flying(a) && !quicksandImmune(a)
                  : h.kind === "gravity"
                    ? h.owner.team !== a.team && !hasPassive(a, "apparition")
                    : ["magma", "heatwave"].includes(h.kind) && !burnImmune(a)),
        )
        .reduce(
          (sum, h) => sum + Math.max(0, h.r + 12 - distance(point, h)),
          0,
        );
    const currentRisk = risk(a);
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, Math.PI]) {
      const point = {
        x: a.x + Math.cos(desired + turn) * 42,
        y: a.y + Math.sin(desired + turn) * 42,
      };
      if (!this.walkablePoint(point)) continue;
      const nextRisk = risk(point);
      if (
        !this.mobilitySafe(a, point) &&
        !(currentRisk > 0 && nextRisk < currentRisk)
      )
        continue;
      const cost = distance(point, goal) + Math.abs(turn) * 4 + nextRisk * 4;
      if (cost < score) {
        best = point;
        score = cost;
      }
    }
    return best ? { x: best.x - a.x, y: best.y - a.y } : { x: 0, y: 0 };
  }
  mobilitySafe(a, point) {
    if (
      this.map
        ? !this.map.walkable(point, 24)
        : point.x < 155 || point.x > 869 || point.y < 195 || point.y > 540
    )
      return false;
    if (
      this.fighters.some(
        (b) =>
          b.id !== a.id && b.alive && inWorld(b) && distance(b, point) < 45,
      )
    )
      return false;
    return !this.hazards.some((h) => {
      if (!inWorld(h) || distance(h, point) > h.r + 12) return false;
      if (h.kind === "chasm") return !this.flying(a);
      if (h.kind === "death")
        return a.parts.length > 1 && !this.auroraProtected(a);
      if (h.kind === "quicksand") return !this.flying(a) && !quicksandImmune(a);
      if (h.kind === "gravity")
        return h.owner.team !== a.team && !hasPassive(a, "apparition");
      if (h.kind === "flood")
        return !this.flying(a) && !a.parts.includes("water");
      return ["magma", "heatwave"].includes(h.kind) && !burnImmune(a);
    });
  }
  aiMobility(a, target, patient) {
    if (a.echo || !a.alive || !inWorld(a) || a.prisonHp > 0) return null;
    const owned = this.portals.owned(a);
    if (a.portalRoute) {
      const route = a.portalRoute;
      const entry = owned.find((p) => p.id === route.entry);
      const exit = owned.find((p) => p.id === route.exit);
      if (
        !entry ||
        !exit ||
        this.time > route.until ||
        (a.portalCooldown > 0 && distance(a, exit) < 90)
      ) {
        a.portalRoute = null;
        a.mobilityNext = this.time + 5;
      } else return entry;
    }
    if (
      a.charging ||
      a.shield ||
      a.blink ||
      a.swing > 0 ||
      a.stagger > 0 ||
      this.isShocked(a) ||
      this.time < (a.mobilityNext || 0)
    )
      return null;
    const gap = target ? distance(a, target) : Infinity;
    const retreat = target && a.hp < 45 && gap < 135;
    const support =
      patient &&
      patient.id !== a.id &&
      patient.hp < 65 &&
      distance(a, patient) > 200;
    if (!retreat && !support && (!target || gap < 220)) return null;
    const focus = support ? patient : target;
    const length = distance(a, focus) || 1;
    const nx = (focus.x - a.x) / length,
      ny = (focus.y - a.y) / length;
    const goal = retreat
      ? { x: a.x - nx * 260, y: a.y - ny * 260 }
      : { x: focus.x - nx * 90, y: focus.y - ny * 90 };
    Object.assign(goal, this.floorPoint(goal, 24));
    if (hasPassive(a, "multi-dimensional")) {
      // A decision interval is AI pacing, not a new cooldown on teleport.
      a.mobilityNext = this.time + 1.1;
      const angle = Math.atan2(goal.y - a.y, goal.x - a.x);
      const reach = Math.min(TELEPORT_RANGE, distance(a, goal));
      for (const turn of [0, 0.45, -0.45, 0.9, -0.9]) {
        const point = {
          x: a.x + Math.cos(angle + turn) * reach,
          y: a.y + Math.sin(angle + turn) * reach,
        };
        if (distance(a, point) < 70 || !this.mobilitySafe(a, point)) continue;
        if (this.teleport(a, point.x, point.y)) return { x: a.x, y: a.y };
      }
      return null;
    }
    if (!canUseSkill(a, "spirit", "utility")) return null;
    a.mobilityNext = this.time + 2;
    // Never close a gate on a traveller while rebuilding a route.
    if (
      owned.some((p) =>
        this.portals
          .travellers()
          .some(
            (e) =>
              e.dimension?.portal === p.id ||
              e.transit?.entry === p.id ||
              e.transit?.exit === p.id,
          ),
      )
    )
      return null;
    const angle = Math.atan2(goal.y - a.y, goal.x - a.x);
    const clear = (point) =>
      this.mobilitySafe(a, point) &&
      this.portals.portals
        .filter((p) => p.owner !== a.id)
        .every((p) => distance(p, point) >= 90) &&
      distance(a, point) >= 42;
    let entry = null,
      exit = null;
    for (const turn of [0, 0.65, -0.65, 1.2, -1.2]) {
      const p = {
        x: a.x + Math.cos(angle + turn) * 68,
        y: a.y + Math.sin(angle + turn) * 68,
      };
      if (clear(p)) {
        entry = p;
        break;
      }
    }
    for (const offset of [0, 55, -55, 95, -95]) {
      const p = {
        x: goal.x - Math.sin(angle) * offset,
        y: goal.y + Math.cos(angle) * offset,
      };
      if (entry && clear(p) && distance(entry, p) >= 90) {
        exit = p;
        break;
      }
    }
    if (!entry || !exit || !this.aiGesture(a, "portals")) return null;
    for (const p of owned) this.portals.close(a, p.id);
    if (!this.portals.place(a, entry.x, entry.y, { autonomous: true }))
      return null;
    if (!this.portals.place(a, exit.x, exit.y, { autonomous: true })) {
      for (const p of this.portals.owned(a)) this.portals.close(a, p.id);
      return null;
    }
    const pair = this.portals.owned(a);
    a.portalRoute = {
      entry: pair[0].id,
      exit: pair[1].id,
      until: this.time + 5,
    };
    return pair[0];
  }
  aiEscapeVog(a, dt) {
    if (
      !a.alive ||
      a.ghost ||
      !inWorld(a) ||
      a.parts.includes("dark") ||
      this.auroraProtected(a)
    )
      return false;
    const smoke = this.hazards.filter(
      (h) => h.kind === "vog" && h.life > 0 && inWorld(h),
    );
    const inside = smoke.filter((h) => distance(a, h) <= h.r);
    if (!inside.length) return false;
    a.aiControlled = true;
    // Sample reachable exits, including lanes along arena walls. Overlapping
    // fields and lethal terrain cost more than the distance to a safe edge.
    const exits = inside.flatMap((h) =>
      Array.from({ length: 24 }, (_, i) => {
        const angle = (i * Math.PI) / 12;
        const point = this.floorPoint(
          {
            x: h.x + Math.cos(angle) * (h.r + 25),
            y: h.y + Math.sin(angle) * (h.r + 25),
          },
          16,
        );
        const concealed = smoke.reduce(
          (n, fog) => n + Math.max(0, fog.r + 16 - distance(point, fog)),
          0,
        );
        return {
          ...point,
          cost:
            distance(a, point) +
            concealed * 30 +
            (this.mobilitySafe(a, point) ? 0 : 800),
        };
      }),
    );
    const exit = exits.sort((b, c) => b.cost - c.cost)[0];
    if (a.shield) this.utility(a, false);
    if (a.charging) this.releaseCharge(a);
    this.moveToward(a, exit, dt);
    const target = this.enemies(a)
      .filter((b) => distance(a, b) <= STRIKE_RANGE)
      .sort((b, c) => distance(a, b) - distance(a, c))[0];
    if (target && this.safeAttack(a, target)) this.strike(a);
    else if (!target) {
      // Sweep blindly along the escape direction without tracking hidden rivals.
      // Retain friendly-fire restraint when a teammate is in that strike lane.
      const clear =
        !this.friendlyFire ||
        !this.fighters.some(
          (b) =>
            b !== a &&
            b.alive &&
            b.team === a.team &&
            inWorld(b) &&
            canHit(a, b),
        );
      if (clear) this.strike(a);
    }
    return true;
  }
  ai(a, dt) {
    if (a.prisonHp > 0) {
      a.aiControlled = true;
      this.strike(a);
      return;
    }
    if (this.aiEscapeVog(a, dt)) return;
    if (this.mode === "corruption") return this.aiCorruption(a, dt);
    if (
      (this.mode === "boss" || (isGauntlet(this) && this.finalWave)) &&
      a.element === "invincible"
    )
      return this.aiPursuit(a, dt);
    const enemies = this.enemies(a);
    const allies = this.fighters.filter(
      (b) => b.id !== a.id && b.team === a.team && b.alive && inWorld(b),
    );
    if (a.ghost) {
      const ally = allies.sort((b, c) => b.hp - c.hp)[0];
      const enemy =
        ally &&
        enemies.sort((b, c) => distance(ally, b) - distance(ally, c))[0];
      if (enemy) {
        const d = distance(ally, enemy) || 1;
        const spot = {
          x: ally.x + ((enemy.x - ally.x) / d) * 25,
          y: ally.y + ((enemy.y - ally.y) / d) * 25,
        };
        this.move(
          a,
          distance(a, spot) > 6 ? spot.x - a.x : 0,
          distance(a, spot) > 6 ? spot.y - a.y : 0,
          dt,
        );
      } else this.move(a, 0, 0, dt);
      return;
    }
    a.aiControlled = true;
    const recovery = warRecoveryTarget(this, a);
    if (recovery) {
      this.moveToward(a, recovery, dt);
      return;
    }
    this.aiProgress(a);
    // Prefer a vulnerable nearby rival, especially one threatening a hurt ally.
    const score = (b) =>
      distance(a, b) +
      b.hp * 0.3 -
      (allies.some((c) => c.hp < 60 && distance(c, b) < 110) ? 90 : 0);
    const target = enemies.sort((b, c) => score(b) - score(c))[0];
    const patient = this.healingTarget(a);
    if (
      a.element === "sanctuary" &&
      !this.springUsed.has(a.id) &&
      a.abilityCd <= 0 &&
      patient?.hp < 100
    )
      this.startCharge(a, "sanctuary");
    if (a.element === "terraformer" && target) {
      if (
        !this.flying(target) &&
        this.safeAttack(a, target, "ability", "terraformer")
      )
        this.placeChasm(a, target.x, target.y);
      if (target.prisonHp <= 0 && distance(a, target) <= 245)
        this.utility(a, true, "terraformer");
    }
    const tactical = this.aiTactic(a, target);
    const route = tactical || this.aiMobility(a, target, patient);
    if (route) {
      const direction = tactical
        ? this.aiRoute(a, route)
        : { x: route.x - a.x, y: route.y - a.y };
      this.moveToward(a, { x: a.x + direction.x, y: a.y + direction.y }, dt);
      if (
        tactical &&
        target &&
        distance(a, target) <= STRIKE_RANGE &&
        this.safeAttack(a, target)
      )
        this.strike(a);
      return;
    }
    const heal =
      !a.echo &&
      a.forms.includes("light") &&
      patient &&
      patient.hp < patient.maxHp - 18;
    const revive =
      !a.echo && canUseSkill(a, "spirit", "ability") && this.revivalTarget(a);
    const d = target ? distance(a, target) : Infinity;
    const fire = hasPassive(a, "fire"),
      light = a.element === "light";
    const aggressiveLight = light && target && a.hp >= target.hp + 15;
    const desired = a.echo
      ? 42
      : a.hp < 30
        ? 160
        : fire && target && !burnImmune(target)
          ? 22
          : light && !aggressiveLight
            ? 175
            : 52;
    let dx = 0,
      dy = 0;
    if (target) {
      const nx = (target.x - a.x) / (d || 1),
        ny = (target.y - a.y) / (d || 1);
      const approach =
        d > desired + (desired === 22 ? 4 : 10) ? 1 : d < desired - 10 ? -1 : 0;
      dx = nx * approach;
      dy = ny * approach;
      // Take a side lane rather than attacking through the nearest teammate.
      const blocker =
        this.friendlyFire &&
        allies.find((b) => distance(a, b) < Math.min(d, 110));
      if (blocker) {
        const side =
          (blocker.x - a.x) * ny - (blocker.y - a.y) * nx >= 0 ? 1 : -1;
        dx = nx * 0.25 - ny * side;
        dy = ny * 0.25 + nx * side;
      }
      a.lastSeen = {
        x: target.x,
        y: target.y,
        until: this.time + 2,
        divine: hasPassive(target, "divine"),
      };
      a.searchSpot = null;
    } else if (a.lastSeen?.until > this.time && distance(a, a.lastSeen) > 20) {
      // Search the last observed spot, never a concealed opponent's live position.
      dx = a.lastSeen.x - a.x;
      dy = a.lastSeen.y - a.y;
    } else if (a.searchSpot && distance(a, a.searchSpot) > 45) {
      dx = a.searchSpot.x - a.x;
      dy = a.searchSpot.y - a.y;
    }
    for (const ally of allies) {
      const gap = distance(a, ally);
      if (gap < (a.echo ? 28 : 75)) {
        dx += ((a.x - ally.x) / (gap || 1)) * (a.echo ? 0.35 : 1.4);
        dy += ((a.y - ally.y) / (gap || 1)) * (a.echo ? 0.35 : 1.4);
      }
    }
    // Step out of hostile floor effects and incoming attack lanes.
    for (const h of this.hazards.filter(inWorld)) {
      const harmful =
        h.kind === "chasm"
          ? !this.flying(a)
          : h.kind === "death"
            ? a.parts.length > 1 && !this.auroraProtected(a)
            : h.kind === "gravity"
              ? h.owner.team !== a.team && !hasPassive(a, "apparition")
              : h.kind === "quicksand"
                ? !this.flying(a) && !quicksandImmune(a)
                : ["magma", "heatwave"].includes(h.kind) && !burnImmune(a);
      const gap = distance(a, h);
      if (harmful && gap < h.r + 25) {
        dx += ((a.x - h.x) / (gap || 1)) * 2;
        dy += ((a.y - h.y) / (gap || 1)) * 2;
      }
    }
    for (const p of this.projectiles.filter(inWorld)) {
      if (p.owner.id === a.id || distance(a, p) > 160) continue;
      const length = Math.hypot(p.dx, p.dy) || 1,
        nx = p.dx / length,
        ny = p.dy / length;
      if (
        segmentDistance(a, p, { x: p.x + nx * 150, y: p.y + ny * 150 }) <
        p.r + 24
      ) {
        const side = (a.x - p.x) * -ny + (a.y - p.y) * nx >= 0 ? 1 : -1;
        dx -= ny * side * 2;
        dy += nx * side * 2;
      }
    }
    const objective = this.flagObjective(a);
    if (objective) {
      dx = distance(a, objective) > 10 ? objective.x - a.x : 0;
      dy = distance(a, objective) > 10 ? objective.y - a.y : 0;
    }
    if (
      this.map &&
      this.map.kind !== "corruption" &&
      (objective || target) &&
      !this.map.lineClear(a, objective || target, 18)
    )
      this.moveToward(a, objective || target, dt);
    else this.move(a, dx, dy, dt);
    if (a.shield && a.shieldTime > 0.8) this.utility(a, false);
    a.aiTimer -= dt;
    if (a.aiTimer > 0) return;
    a.aiTimer = 0.18 + this.random() * 0.16;
    if (target) {
      const aim = distance(a, target) || 1;
      a.fx = (target.x - a.x) / aim;
      a.fy = (target.y - a.y) / aim;
    }
    if (a.charging) {
      const form = a.chargeForm || activeForm(a),
        support = ["light", "divine", "spirit"].includes(form);
      if (a.charge >= (support && patient?.hp < 45 ? 0.25 : 0.7)) {
        if (support || this.safeAttack(a, target, "ability"))
          this.releaseCharge(a);
        else {
          a.charging = false;
          a.charge = 0;
        }
      }
      return;
    }
    if ((revive || heal) && a.abilityCd <= 0) {
      const supportForm = revive
        ? "spirit"
        : a.element === "divine"
          ? "divine"
          : "light";
      this.startCharge(a, supportForm);
      return;
    }
    if (!target) {
      // Only search when support, movement and hazard avoidance leave us idle.
      // Spots come solely from remembered coordinates, never hidden live state.
      if (a.lastSeen?.divine && Math.hypot(dx, dy) < 0.1) {
        if (!a.searchSpot || this.time >= (a.searchNext || 0)) {
          const angle = this.random() * Math.PI * 2,
            radius = Math.sqrt(this.random()) * 65;
          a.searchSpot = this.floorPoint({
            x: a.lastSeen.x + Math.cos(angle) * radius,
            y: a.lastSeen.y + Math.sin(angle) * radius,
          });
          a.searchNext = this.time + 0.8;
        }
        const aim = a.searchSpot,
          gap = distance(a, aim);
        if (gap > 0) {
          a.fx = (aim.x - a.x) / gap;
          a.fy = (aim.y - a.y) / gap;
        }
        if (gap <= STRIKE_RANGE && this.safeAttack(a, aim)) this.strike(a, aim);
      }
      return;
    }
    // Light flashes to escape pressure; do not blind nearby teammates.
    if (
      !a.echo &&
      light &&
      d <= FLASH_RADIUS &&
      target.whiteout <= 0 &&
      a.utilityCd <= 0 &&
      this.safeAttack(a, target, "utility", "light")
    )
      this.utility(a);
    if (
      !a.echo &&
      canUseSkill(a, "blaze", "utility") &&
      d > 80 &&
      d < 360 &&
      a.burst <= 0 &&
      this.safeAttack(a, target, "utility", "blaze")
    ) {
      this.utility(a, true, "blaze");
    }
    if (d <= STRIKE_RANGE && this.safeAttack(a, target)) this.strike(a);
    if (a.echo) return;
    // Support waits for a healing opportunity instead of wasting its main skill.
    if (light) return;
    let attackForm = a.element === "phoenix" ? "sun" : a.element;
    if (a.aiLastGesture === `ability:${attackForm}` && a.aiRepeat >= 3)
      attackForm = a.forms.find(
        (f) =>
          f !== attackForm &&
          skillsFor(f)[0] &&
          !["light", "spirit", "divine"].includes(f),
      );
    if (!skillsFor(attackForm)[0] || ["spirit", "divine"].includes(attackForm))
      attackForm = a.parts.find(
        (e) => !["light"].includes(e) && skillsFor(e)[0],
      );
    if (
      attackForm &&
      a.abilityCd <= 0 &&
      d < (attackForm === "lightning" ? 450 : 300) &&
      this.safeAttack(a, target, "ability", attackForm)
    ) {
      this.switchForm(a, attackForm);
      if (attackForm === "gravity") this.telekinesis(a, target, a.fx, a.fy);
      else if (attackForm !== "terraformer") this.startCharge(a, attackForm);
    }
    const form = activeForm(a);
    if (
      !a.charging &&
      a.utilityCd <= 0 &&
      d < 140 &&
      this.safeAttack(a, target, "utility", form)
    ) {
      // Avoid flooding friendly Fire fighters or placing portals without a route.
      if (!["light", "spirit", "blaze"].includes(form)) this.utility(a);
    }
  }
  updateBurst(a, old, dt) {
    if (a.burst <= 0 || !a.alive) return;
    const steps = Math.max(1, Math.ceil(distance(old, a) / 9));
    for (let i = 0; i < steps; i++)
      this.effects.push({
        kind: "flame-trail",
        x: old.x + ((a.x - old.x) * i) / steps,
        y: old.y + ((a.y - old.y) * i) / steps,
        color: "#ff8b38",
        life: 0.45,
        max: 0.45,
      });
    for (const b of this.fighters) {
      if (
        !b.alive ||
        !inWorld(b) ||
        b.id === a.id ||
        a.burstHits.has(b.id) ||
        segmentDistance(b, old, a) > BURST_HIT_RANGE
      )
        continue;
      a.burstHits.add(b.id);
      this.damage(a, b, 22, true, false, "blaze", false);
      if (!a.alive) break;
    }
    a.burst = Math.max(0, a.burst - dt);
  }
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.removed || this.portals.tick(p, dt)) continue;
      const old = { x: p.x, y: p.y };
      p.life -= dt;
      p.x += p.dx * dt;
      p.y += p.dy * dt;
      p.trail = Math.min(145, p.trail + Math.hypot(p.dx, p.dy) * dt);
      if (this.portals.enter(p, old)) continue;
      for (const b of this.fighters) {
        if (
          b.id === p.owner.id ||
          (!this.friendlyFire && b.team === p.owner.team) ||
          !b.alive ||
          !inWorld(b) ||
          p.hit.has(b.id) ||
          segmentDistance(b, old, p) > p.r + 15
        )
          continue;
        p.hit.add(b.id);
        let amount = p.damage;
        if (p.kind === "water" && b.parts.includes("fire")) amount *= 2;
        if (p.kind === "tornado" && this.flying(b)) amount *= 1.15;
        this.damage(p.owner, b, amount, true, false, p.element);
        if (p.kind === "water") {
          b.knockX += p.dx * 0.7;
          b.knockY += p.dy * 0.7;
        }
        if (!["tornado", "laser"].includes(p.kind)) {
          p.life = 0;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter(
      (p) => !p.removed && (p.life > 0 || !inWorld(p)),
    );
  }
  updateWaves(dt) {
    for (const w of this.waves) {
      if (w.removed || this.portals.tick(w, dt)) continue;
      const old = { x: w.x, y: w.y };
      w.previousRadius = w.radius;
      w.radius += w.speed * dt;
      w.totalTravel += w.speed * dt;
      w.x = w.originX + w.fx * w.radius;
      w.y = w.originY + w.fy * w.radius;
      // A portal anywhere along the fan's leading edge accepts the wave.
      const gate = this.portals.portals.find((p) => {
        if (!this.portals.active(p)) return false;
        const dx = p.x - w.originX,
          dy = p.y - w.originY,
          d = Math.hypot(dx, dy);
        return (
          d >= w.previousRadius - 25 &&
          d <= w.radius + 25 &&
          (dx * w.fx + dy * w.fy) / (d || 1) >= Math.cos(w.halfAngle)
        );
      });
      if (gate && !w.portalCooldown) {
        w.x = gate.x;
        w.y = gate.y;
        if (this.portals.enter(w, w)) continue;
      }
      for (const b of this.fighters) {
        if (!b.alive || !inWorld(b) || b.id === w.owner.id || w.hit.has(b.id))
          continue;
        const dx = b.x - w.originX,
          dy = b.y - w.originY,
          d = Math.hypot(dx, dy);
        if (
          d > w.radius + 15 ||
          d < w.previousRadius - 20 ||
          (dx * w.fx + dy * w.fy) / (d || 1) < Math.cos(w.halfAngle)
        )
          continue;
        w.hit.add(b.id);
        this.damage(
          w.owner,
          b,
          w.damage * Math.max(0.15, 1 - w.totalTravel / w.range),
          true,
          false,
          w.element,
        );
      }
      if (w.totalTravel >= w.range) w.removed = true;
    }
    this.waves = this.waves.filter((w) => !w.removed);
  }
  updateHazards(dt) {
    const flooded = this.hazards.some((h) => inWorld(h) && h.kind === "flood");
    for (const h of this.hazards) {
      if (h.removed || this.portals.tick(h, dt) || this.portals.enter(h, h))
        continue;
      h.life -= dt;
      if (h.life <= 0) continue;
      if (h.kind === "vog") {
        const inside = this.fighters.filter(
          (b) =>
            b.alive &&
            !b.echo &&
            inWorld(b) &&
            b.parts.includes("fire") &&
            distance(b, h) <= h.r,
        );
        h.fireInside ??= new Set();
        h.fireThinned ??= new Set();
        for (const b of inside) {
          if (!h.fireInside.has(b.id) && !h.fireThinned.has(b.id)) {
            h.life *= 0.5;
            h.fireThinned.add(b.id);
            this.cue("shatter", b, "#ffb774");
          }
        }
        h.fireInside = new Set(inside.map((b) => b.id));
        continue;
      }
      if (h.kind === "spring") {
        for (const b of this.fighters)
          if (b.alive && inWorld(b) && distance(h, b) <= h.r)
            b.hp = Math.min(b.maxHp, b.hp + 8 * dt);
        continue;
      }
      if (h.kind === "chasm") {
        if (this.time >= h.opensAt)
          for (const b of this.fighters) {
            if (
              b.alive &&
              inWorld(b) &&
              !this.flying(b) &&
              (this.friendlyFire || b.team !== h.owner.team) &&
              distance(h, b) <= h.r
            )
              this.fell(b, { killer: h.owner });
          }
        continue;
      }
      if (h.kind === "death") {
        if (this.time + 1e-9 < (h.opensAt || 0)) continue;
        const touching = this.fighters.filter(
          (b) =>
            b.alive &&
            !b.echo &&
            inWorld(b) &&
            (this.friendlyFire || b.team !== h.owner.team) &&
            distance(h, b) <= h.r,
        );
        h.occupants ??= new Set();
        for (const b of touching) if (!h.occupants.has(b.id)) this.demote(b);
        h.occupants = new Set(touching.map((b) => b.id));
        continue;
      }
      h.tick -= dt;
      if (h.tick > 0) continue;
      h.tick = 0.35;
      for (const b of this.fighters) {
        if (
          !b.alive ||
          !inWorld(b) ||
          distance(h, b) > h.r ||
          (!this.friendlyFire && b.team === h.owner.team)
        )
          continue;
        if (
          this.auroraProtected(b) &&
          ["flood", "gravity", "heatwave", "vog"].includes(h.kind)
        )
          continue;
        const flying = this.flying(b),
          immune = hasPassive(b, "divine");
        if (h.kind === "flood") {
          if (!flying && !b.parts.includes("water")) b.slow = 0.4;
          h.floodHits ??= new Set();
          if (b.parts.includes("fire") && !h.floodHits.has(b.id)) {
            h.floodHits.add(b.id);
            this.damage(
              h.owner,
              b,
              b.maxHp * 0.25,
              true,
              false,
              "cloud",
              false,
            );
          }
        } else if (h.kind === "gravity") {
          if (b.team !== h.owner.team && !hasPassive(b, "apparition"))
            b.slow = 0.5;
        } else if (
          h.kind === "quicksand" &&
          !flying &&
          !flooded &&
          !quicksandImmune(b)
        ) {
          b.slow = 0.5;
          this.damage(h.owner, b, 2 * h.power, true, false, h.element, false);
        } else if (
          h.kind === "heatwave" ||
          (h.kind === "magma" && !flying && !flooded)
        ) {
          if (
            !immune &&
            !b.parts.includes("fire") &&
            !b.parts.includes("water")
          )
            this.damage(h.owner, b, 3 * h.power, true, false, h.element, false);
        }
      }
    }
    this.hazards = this.hazards.filter(
      (h) => !h.removed && (h.life > 0 || !inWorld(h)),
    );
  }
  advanceDeaths(dt) {
    for (const death of this.fallenAnimations) death.elapsed += Math.max(0, dt);
    this.fallenAnimations = this.fallenAnimations.filter(
      (death) =>
        death.elapsed < death.duration &&
        !this.fighters.some((a) => a.id === death.fighter.id && a.alive),
    );
  }
  update(dt, input = { x: 0, y: 0 }, runAI = true) {
    if (this.finished) return;
    this.advanceDeaths(dt);
    if (this.intermission) return advanceReward(this, dt);
    dt = Math.min(dt, 0.05);
    if (this.countdown > 0) {
      const wasLocked = this.countingDown;
      this.countdown = Math.max(0, this.countdown - dt);
      if (wasLocked) return;
    }
    if (
      ["tdm", "war", "roulette", "ffa"].includes(this.mode) &&
      this.checkMatchEnd()
    )
      return;
    this.time += dt;
    updateAdvanced(this);
    if (
      this.mode === "corruption" &&
      !this.corruptionStarted &&
      this.time >= 5
    ) {
      this.corruptionStarted = true;
      const candidates = this.fighters.filter((a) => a.alive && !a.echo);
      this.corrupt(
        candidates[
          Math.min(
            candidates.length - 1,
            Math.floor(this.random() * candidates.length),
          )
        ],
      );
    }
    for (const a of this.fighters) {
      if (!a.alive && a.respawnAt !== undefined && this.time >= a.respawnAt)
        this.respawn(a);
    }
    updateRespawnCamera(this, dt, input);
    this.portals.update();
    for (const a of this.fighters) {
      if (!a.alive && !a.ghost) continue;
      if (this.portals.tick(a, dt, a.id === "player" ? input : undefined))
        continue;
      for (const key of [
        "attackCd",
        "abilityCd",
        "utilityCd",
        "stagger",
        "blind",
        "whiteout",
        "dodge",
        "boost",
        "venom",
        "venomTint",
        "slow",
        "flash",
        "swing",
        "clash",
        "reflect",
        "spawnFlash",
        "reveal",
        "hurtReveal",
        "hitReact",
      ])
        a[key] = Math.max(0, a[key] - dt);
      if (a.life !== undefined && (a.life -= dt) <= 0) {
        this.fell(a);
        continue;
      }
      if (a.charging && a.stagger <= 0) a.charge = Math.min(1.8, a.charge + dt);
      if (a.shield) a.shieldTime += dt;
      else a.shieldHp = Math.min(65, a.shieldHp + dt * 5);
      if (hasPassive(a, "divine") || this.auroraProtected(a))
        a.venom = a.venomTint = a.burn = a.blind = a.whiteout = 0;
      if (this.auroraProtected(a)) {
        a.sabotaged = false;
        if (
          a.slow > 0 &&
          !this.hazards.some(
            (h) =>
              h.kind === "quicksand" && inWorld(h) && distance(h, a) <= h.r,
          )
        )
          a.slow = 0;
      }
      if (a.venom > 0) {
        const health = a.hp;
        this.damage(a.venomSource || a, a, dt * 3, true, false, "mud", false);
        if (a.alive && a.hp < health) a.venomTint = 0.16;
      }
      if (!a.alive && !a.ghost) continue;
      const old = { x: a.x, y: a.y };
      if (a.id === "player") this.move(a, input.x, input.y, dt);
      else if (runAI) this.ai(a, dt);
      else this.move(a, 0, 0, dt);
      this.updateBurst(a, old, dt);
      if (this.portals.enter(a, old)) continue;
      this.touchTokens(a);
      if (a.alive && a.parts.includes("water"))
        this.hazards = this.hazards.filter(
          (h) => !inWorld(h) || h.kind !== "magma" || distance(a, h) > h.r + 12,
        );
    }
    for (const t of this.tokens) {
      if (t.removed || this.portals.tick(t, dt)) continue;
      this.portals.enter(t, t);
    }
    this.tokens = this.tokens.filter((t) => !t.removed);
    for (const a of this.fighters) this.autoLock(a);
    this.resolveStrikes();
    this.updateProjectiles(dt);
    this.updateWaves(dt);
    this.updateHazards(dt);
    for (const a of this.fighters) a.burn = 0;
    for (const a of this.fighters) {
      if (!a.alive || !inWorld(a)) continue;
      for (const b of this.fighters) {
        if (
          b.id === a.id ||
          !b.alive ||
          !inWorld(b) ||
          (!this.friendlyFire && b.team === a.team) ||
          distance(a, b) >= 30
        )
          continue;
        if (
          a.parts.includes("fire") &&
          !b.parts.includes("fire") &&
          !b.parts.includes("water") &&
          !hasPassive(b, "divine") &&
          !this.auroraProtected(b)
        ) {
          const hp = b.hp;
          this.damage(a, b, dt * 5, true, false, "fire", false);
          if (b.hp < hp) b.burn = 1;
        }
        if (
          hasPassive(a, "mud") &&
          !hasPassive(b, "divine") &&
          !this.auroraProtected(b)
        ) {
          b.venom = 5;
          b.venomSource = a;
        }
      }
    }
    for (const a of this.fighters) this.updateTeleport(a, dt);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    this.events = this.events.filter((e) => this.time - e.time < 1.4);
    this.updateFlags();
    this.updateDomination(dt);
    updateWar(this, dt);
    this.checkMatchEnd();
  }
  corruptionHit(source, target) {
    if (!target.alive || target.element !== "light") return false;
    if (target.hp <= 1) return this.corrupt(target, source);
    this.damage(source, target, 1);
    return true;
  }
  corrupt(a, source = null) {
    if (!a || a.element !== "light") return false;
    const { id, x, y, spawn, kills, deaths } = a;
    if (source) source.infections = (source.infections || 0) + 1;
    const fresh = makeFighter(id, "dark", 1, x, y);
    for (const key of Object.keys(a)) delete a[key];
    Object.assign(a, fresh, {
      spawn: { ...spawn, element: "dark" },
      kills,
      deaths,
      infectedAt: this.time,
      infections: 0,
      skillsDisabled: true,
      spawnFlash: 0.65,
    });
    this.pending = this.pending.filter((p) => p.who !== a);
    this.syncCorruptionHealth();
    this.cue("shatter", a, "#a59dc1");
    return true;
  }
  syncCorruptionHealth() {
    if (this.mode !== "corruption") return;
    const cap = Math.max(
      1,
      this.fighters.filter((a) => a.element === "light" && a.alive && !a.echo)
        .length,
    );
    for (const a of this.fighters)
      if (a.element === "dark" && !a.echo) {
        a.maxHp = cap;
        if (a.alive) a.hp = Math.min(a.hp, cap);
      }
  }
  relentless(a) {
    return (
      !a.echo &&
      ((this.mode === "corruption" && a.element === "dark") ||
        ((this.mode === "boss" || (isGauntlet(this) && this.finalWave)) &&
          a.element === "invincible"))
    );
  }
  pursuitOrder(a, b, c) {
    const healer = (b) =>
      canUseSkill(b, "light", "ability") || canUseSkill(b, "divine", "ability");
    const priority =
      (this.mode === "boss" || (isGauntlet(this) && this.finalWave)) &&
      a.element === "invincible" &&
      a.aiControlled
        ? Number(healer(c)) - Number(healer(b))
        : 0;
    return priority || distance(a, b) - distance(a, c);
  }
  aiPursuit(a, dt) {
    a.aiControlled = true;
    a.aiPlan = null;
    a.aiNeedChange = false;
    if (a.shield) this.utility(a, false);
    const target = this.enemies(a).sort((b, c) =>
      this.pursuitOrder(a, b, c),
    )[0];
    if (target)
      a.pursuitMemory = { x: target.x, y: target.y, until: this.time + 3.1 };
    // Flash still hides distant opponents; continue toward their last seen spot.
    const focus =
      target || (a.pursuitMemory?.until > this.time ? a.pursuitMemory : null);
    if (!focus) {
      this.move(a, 0, 0, dt);
      return;
    }
    const gap = distance(a, focus);
    this.moveToward(a, gap > 22 ? focus : a, dt);
    if (gap <= STRIKE_RANGE) this.strike(a, focus);
    if (this.mode === "boss" || (isGauntlet(this) && this.finalWave)) {
      if (a.charging && a.charge >= 0.35) this.releaseCharge(a);
      else if (!a.charging && target && gap < 300) this.startCharge(a, "fire");
      if (target && gap < 100) this.utility(a, true, "fire");
    }
  }
  aiMazeCorruption(a, dt) {
    a.aiControlled = true;
    if (a.element === "dark") {
      a.aiPlan = null;
      a.aiNeedChange = false;
    }
    const map = this.map;
    if (!a.mazeActionOrigin || distance(a, a.mazeActionOrigin) > 35) {
      // Escaping to another position is a tactic change: Light can defend or
      // heal again after its three-action limit instead of becoming disarmed.
      if (a.aiNeedChange) {
        a.aiLastGesture = "reposition";
        a.aiRepeat = 1;
        a.aiNeedChange = false;
      }
      a.mazeActionOrigin = { x: a.x, y: a.y };
    }
    // Navigation knows the maze layout; actual strikes and locks still require a clear corridor.
    const rivals = this.fighters.filter(
      (b) => b.alive && !b.echo && inWorld(b) && b.team !== a.team,
    );
    const target = rivals.sort(
      (b, c) =>
        map.path(a, b).length - map.path(a, c).length ||
        distance(a, b) - distance(a, c),
    )[0];
    if (a.element === "light" && a.hp < a.maxHp) {
      if (a.charging && a.charge >= 0.25) this.releaseCharge(a);
      else if (!a.charging && !a.abilityCd) this.startCharge(a, "light");
    }
    if (!target) {
      this.move(a, 0, 0, dt);
      return;
    }
    let goal = target;
    if (a.element === "light") {
      if (
        !a.mazeGoal ||
        this.time >= (a.mazeGoalUntil || 0) ||
        distance(a, a.mazeGoal) < 22
      ) {
        const candidates = map.cells.map((p, id) => ({
          ...p,
          id,
          score: map.path(target, p).length - map.path(a, p).length * 0.3,
        }));
        a.mazeGoal = candidates.sort((b, c) => c.score - b.score)[0];
        a.mazeGoalUntil = this.time + 2;
      }
      goal = a.mazeGoal;
    }
    const route = map.route(a, goal);
    this.move(a, route.x - a.x, route.y - a.y, dt);
    if (canHit(a, target) && map.lineClear(a, target)) this.strike(a, target);
  }
  aiCorruption(a, dt) {
    if (this.map) return this.aiMazeCorruption(a, dt);
    if (a.element === "dark") return this.aiPursuit(a, dt);
    a.aiControlled = true;
    this.aiProgress(a);
    const target = this.enemies(a).sort(
      (b, c) => distance(a, b) - distance(a, c),
    )[0];
    if (!target) {
      this.move(a, 0, 0, dt);
      return;
    }
    const tactic = this.aiTactic(a, target);
    if (tactic) {
      const route = this.aiRoute(a, tactic);
      this.move(a, route.x, route.y, dt);
    } else {
      const d = distance(a, target);
      const direction = a.element === "dark" || d > 60 ? 1 : d < 40 ? -1 : 0;
      this.move(
        a,
        (target.x - a.x) * direction,
        (target.y - a.y) * direction,
        dt,
      );
    }
    if (distance(a, target) <= STRIKE_RANGE) this.strike(a);
    if (a.element === "light" && a.hp < a.maxHp) {
      if (a.charging && a.charge >= 0.25) this.releaseCharge(a);
      else if (!a.charging && !a.abilityCd) this.startCharge(a, "light");
    }
  }
  updateDomination(dt) {
    if (this.mode !== "domination") return;
    const living = this.fighters.filter(
      (a) => a.alive && !a.echo && inWorld(a),
    );
    for (const flag of this.flags) {
      // Score the elapsed interval for its existing owner before changing hands.
      this.scores[flag.team] += dt;
      const nearby = living.filter((a) => distance(a, flag) <= 42);
      const attackers = nearby.filter((a) => a.team !== flag.team);
      const defenders = nearby.filter((a) => a.team === flag.team);
      flag.contested = attackers.length > 0 && defenders.length > 0;
      flag.capturing = attackers.length ? 1 - flag.team : null;
      if (flag.contested) continue;
      if (!attackers.length) {
        flag.progress = Math.max(0, flag.progress - dt);
        continue;
      }
      flag.progress += dt * 2 ** (attackers.length - 1);
      if (flag.progress >= 10 - 1e-9) {
        flag.team = 1 - flag.team;
        flag.progress = 0;
        flag.capturing = null;
        this.cue("revive", flag, flag.team === 0 ? "#82d7eb" : "#ed947d");
      }
    }
  }
  respawn(a) {
    if (!a.spawn || a.echo) return false;
    this.fallenAnimations = this.fallenAnimations.filter(
      (d) => d.fighter.id !== a.id,
    );
    if (a === this.player) this.spectatorFocus = null;
    const {
      spawn,
      kills,
      deaths,
      infectedAt,
      infections,
      skillsDisabled,
      highestTier,
    } = a;
    const fresh = makeFighter(a.id, spawn.element, a.team, spawn.x, spawn.y);
    // Keep the object identity used by controls and projectiles, but clear every
    // temporary status, fusion, portal route and death from the previous life.
    for (const key of Object.keys(a)) delete a[key];
    Object.assign(a, fresh, {
      spawn,
      kills,
      deaths,
      infectedAt,
      infections,
      skillsDisabled,
      highestTier,
      spawnFlash: 0.65,
    });
    this.tokens = this.tokens.filter((t) => t.owner !== a.id);
    this.pending = this.pending.filter((p) => p.who !== a);
    this.syncCorruptionHealth();
    // Other fighters keep all tokens they absorbed, even when their source respawns.
    return true;
  }
  returnFlag(flag) {
    Object.assign(flag, flag.home, { carrier: null, dropped: false });
    this.cue("revive", flag, flag.team === 0 ? "#82d7eb" : "#ed947d");
  }
  updateFlags() {
    if (this.mode !== "ctf") return;
    const living = this.fighters.filter(
      (a) => a.alive && !a.echo && inWorld(a),
    );
    // Return friendly dropped flags before checking captures, regardless of team order.
    for (const flag of this.flags) {
      if (
        flag.dropped &&
        living.some((a) => a.team === flag.team && distance(a, flag) < 30)
      )
        this.returnFlag(flag);
    }
    for (const flag of this.flags) {
      let carrier = this.fighters.find((a) => a.id === flag.carrier);
      if (!carrier) {
        carrier = living.find(
          (a) => a.team !== flag.team && distance(a, flag) < 30,
        );
        if (carrier) {
          flag.carrier = carrier.id;
          flag.dropped = false;
          this.cue("portal", carrier, "#f3da92");
        }
      }
      if (!carrier) continue;
      flag.x = carrier.x;
      flag.y = carrier.y;
      const own = this.flags[carrier.team];
      if (!own.carrier && !own.dropped && distance(carrier, own.home) < 34) {
        this.scores[carrier.team]++;
        this.returnFlag(flag);
        this.cue("heal", carrier, "#f3da92");
      }
    }
  }
  flagObjective(a) {
    if (this.mode === "domination" && !a.echo) {
      const threatened = this.flags.filter(
        (f) => f.team === a.team && f.progress > 0,
      );
      const candidates = threatened.length
        ? threatened
        : this.flags.filter((f) => f.team !== a.team);
      const allies = this.fighters.filter(
        (b) => b !== a && b.alive && b.team === a.team && !b.echo,
      );
      return (
        candidates.sort(
          (b, c) =>
            distance(a, b) +
            allies.filter((f) => distance(f, b) < 70).length * 90 -
            (distance(a, c) +
              allies.filter((f) => distance(f, c) < 70).length * 90),
        )[0] || this.flags[0]
      );
    }
    if (this.mode !== "ctf" || a.echo) return null;
    const own = this.flags[a.team],
      enemy = this.flags[1 - a.team];
    if (enemy.carrier === a.id) return own.dropped ? own : own.home;
    const thief = this.fighters.find(
      (b) => b.id === own.carrier && b.alive && inWorld(b),
    );
    if (thief) return thief;
    if (own.dropped) return own;
    const squad = this.fighters.filter((b) => b.team === a.team && !b.echo);
    const defender = squad[squad.length - 1] === a;
    if (defender) {
      const intruder = this.enemies(a)
        .filter((b) => distance(b, own.home) < 190)
        .sort((b, c) => distance(b, own.home) - distance(c, own.home))[0];
      return (
        intruder || { x: own.home.x + (a.team === 0 ? 65 : -65), y: own.home.y }
      );
    }
    return enemy.carrier
      ? this.fighters.find((b) => b.id === enemy.carrier)
      : enemy;
  }
  celebrate(ids) {
    this.spectatorFocus = null;
    this.winnerIds = ids;
    this.celebrationRemaining = this.fighters.some(
      (a) => a.alive && !a.echo && ids.includes(a.id),
    )
      ? 4
      : Math.max(
          0,
          ...this.fallenAnimations.map((d) => d.duration - d.elapsed),
        );
    this.celebrationElapsed = 0;
    this.effects = [];
    for (const a of this.fighters) {
      a.victory = a.alive && !a.echo && ids.includes(a.id);
      a.charging = false;
      a.swing = a.clash = a.hitReact = a.burst = a.shield = 0;
      a.vx = a.vy = 0;
      if (a.victory) {
        a.dimension = a.transit = a.blink = null;
      }
    }
  }
  advanceCelebration(dt) {
    this.advanceDeaths(dt);
    const elapsed = Math.min(Math.max(0, dt), this.celebrationRemaining || 0);
    this.celebrationRemaining = Math.max(
      0,
      (this.celebrationRemaining || 0) - elapsed,
    );
    this.celebrationElapsed = (this.celebrationElapsed || 0) + elapsed;
  }
  finish(winner, reason) {
    this.finished = true;
    this.result =
      winner === null
        ? "draw"
        : winner === this.player.team
          ? "victory"
          : "defeat";
    this.finishReason = reason;
    this.winnerTeam = winner;
    this.celebrate(
      this.fighters
        .filter((a) => winner !== null && a.team === winner)
        .map((a) => a.id),
    );
    return true;
  }
  checkMatchEnd() {
    if (this.finished) return true;
    const advanced = advancedEnd(this);
    if (advanced !== null) return advanced;
    if (this.mode === "corruption") {
      if (
        !this.corruptionStarted ||
        (this.time < this.timeLimit &&
          this.fighters.some((a) => a.element === "light"))
      )
        return false;
      const longest = Math.max(
        ...this.fighters.map((a) => a.infectedAt ?? this.time),
      );
      const lights = this.fighters.filter(
        (a) => (a.infectedAt ?? this.time) === longest,
      );
      const darks = this.fighters.filter((a) => a.infectedAt !== undefined);
      const high = Math.max(0, ...darks.map((a) => a.infections || 0));
      const darkWinners = darks.filter((a) => (a.infections || 0) === high);
      this.winners = {
        light: lights.map((a) => a.id),
        dark: darkWinners.map((a) => a.id),
      };
      const label = (a) =>
        a.id === "player" ? "You" : `Fighter ${this.fighters.indexOf(a) + 1}`;
      this.finished = true;
      this.celebrate([...lights, ...darkWinners].map((a) => a.id));
      this.result = [...lights, ...darkWinners].includes(this.player)
        ? "victory"
        : "defeat";
      this.finishReason = `Light survival: ${lights.map(label).join(", ")} (${Math.min(longest, 120).toFixed(1)}s). Dark infections: ${darkWinners.map(label).join(", ")} (${high})`;
      return true;
    }
    if (this.mode === "domination") {
      if (this.time < this.timeLimit) return false;
      const diff = this.scores[0] - this.scores[1];
      return this.finish(
        Math.abs(diff) < 0.001 ? null : diff > 0 ? 0 : 1,
        "Flag-control time decided the match",
      );
    }
    if (this.mode === "ctf") {
      const winner = this.scores.findIndex((score) => score >= 3);
      return winner >= 0 ? this.finish(winner, "Three flags captured") : false;
    }
    if (this.mode === "ffa" && this.time >= this.timeLimit) {
      const players = this.fighters.filter((a) => !a.echo);
      const high = Math.max(...players.map((a) => a.kills || 0));
      const leaders = players.filter((a) => (a.kills || 0) === high);
      return this.finish(
        leaders.length === 1 ? leaders[0].team : null,
        `Most eliminations · ${high} kills`,
      );
    }
    const teams = new Set(
      this.fighters.filter((a) => a.alive && !a.echo).map((a) => a.team),
    );
    if (this.mode === "ffa" && teams.size === 0) return false;
    if (teams.size < 2)
      return this.finish(
        teams.size ? [...teams][0] : null,
        ["tdm", "war"].includes(this.mode)
          ? "Team eliminated during respawns"
          : this.mode === "ffa"
            ? "Last elemental standing"
            : "Elimination",
      );
    if (["tdm", "war"].includes(this.mode) && this.time >= this.timeLimit) {
      return this.finish(
        this.scores[0] === this.scores[1]
          ? null
          : this.scores[0] > this.scores[1]
            ? 0
            : 1,
        "Time expired",
      );
    }
    return false;
  }
}

export function viewerVisibility(a, viewer) {
  if (a.victory) return 1;
  return a.id === viewer?.id && a.element === "divine" ? 1 : visibility(a);
}
