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
    passive: "Burn immunity · cools magma",
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
    desc: "Stand your ground. Charge a crushing blow or hold a shield against pressure.",
    passive: "Hard skin · 25% defense",
    ability: "Rock burst",
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
};
export const FUSED = {
  mud: ["Quicksand", null],
  spirit: ["Revival", "Portals"],
  mirror: [null, null],
  sun: ["Laser beam", "Heatwave"],
  blaze: [null, "Speed burst"],
  cloud: ["Tornado", "Flood"],
  smoke: ["Vog", null],
  gravity: ["Telekinesis", "Gravity field"],
  apparition: ["Doppelgänger", "Phase"],
  demonic: ["Minions", "Death"],
  divine: ["Radiance", null],
  "multi-dimensional": [null, null],
  lightning: ["Lightning strikes", null],
  invincible: [null, null],
};
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
  ELEMENTS[e]
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
    (EDGES.some(([a, b]) => a === source && b === target) ? 1.5 : 1)
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
    shield: 0,
    shieldHp: 65,
    shieldTime: 0,
    dodge: 0,
    boost: 0,
    burst: 0,
    burstHits: new Set(),
    reveal: 0,
    hurtReveal: 0,
    movingTime: 0,
    burn: 0,
    venom: 0,
    slow: 0,
    flash: 0,
    swing: 0,
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
    random = Math.random,
  } = {}) {
    this.random = random;
    this.time = 0;
    this.mode = mode;
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
    const n = mode === "team" ? size : 1,
      pool =
        mode === "fused"
          ? LEVEL_TWO
          : mode === "fused3"
            ? LEVEL_THREE
            : Object.keys(ELEMENTS);
    if (["fused", "fused3"].includes(mode) && !pool.includes(element))
      element = pool[0];
    for (let i = 0; i < n; i++) {
      this.fighters.push(
        makeFighter(
          i === 0 ? "player" : `ally-${i}`,
          i === 0 ? element : ["air", "light", "earth"][i - 1],
          0,
          330 - i * 34,
          340 + (i - (n - 1) / 2) * 95,
        ),
      );
      this.fighters.push(
        makeFighter(
          `enemy-${i}`,
          pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))],
          1,
          710 + i * 26,
          340 + (i - (n - 1) / 2) * 95,
        ),
      );
    }
    this.player = this.fighters[0];
  }
  event(text, color = "#e9cc91", x = this.player.x, y = this.player.y) {
    this.events.push({ text, color, x, y, time: this.time });
  }
  flying(a) {
    return a.parts.includes("air");
  }
  target(a) {
    return this.fighters.find(
      (b) => b.id === a.lock && b.alive && inWorld(b) && visibility(b) > 0,
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
          visibility(b) > 0 &&
          b.team !== a.team &&
          distance(a, b) <= STRIKE_RANGE,
      )
      .sort((b, c) => distance(a, b) - distance(a, c))[0];
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
          hasPassive(b, "lightning") &&
          distance(a, b) < 30,
      )
    );
  }
  move(a, dx, dy, dt) {
    if ((!a.alive && !a.ghost) || !inWorld(a)) return;
    if (this.isShocked(a)) {
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
    let speed =
      150 *
      (a.ghost ? 1.1 : a.hp < 40 ? 0.55 + (0.45 * a.hp) / 40 : 1) *
      (this.flying(a) ? 1.28 : 1) *
      (a.boost > 0 ? 1.7 : 1) *
      (a.charging ? 0.65 : 1) *
      (a.slow > 0 ? 0.48 : 1) *
      (a.shield ? 0.32 : 1);
    const blend = this.flying(a) ? Math.min(1, dt * 4) : 1;
    a.vx += (dx * speed * magnitude - a.vx) * blend;
    a.vy += (dy * speed * magnitude - a.vy) * blend;
    if (a.burst > 0) {
      a.vx = a.burstX * 650;
      a.vy = a.burstY * 650;
    }
    a.x = clamp(a.x + (a.vx + a.knockX) * dt, 135, 889);
    a.y = clamp(a.y + (a.vy + a.knockY) * dt, 175, 560);
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
    if (!a.alive || !inWorld(a) || a.attackCd > 0 || a.shield || a.stagger > 0)
      return false;
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
  startCharge(a) {
    if (
      !a.alive ||
      !inWorld(a) ||
      a.abilityCd > 0 ||
      a.shield ||
      a.stagger > 0 ||
      !skillsFor(activeForm(a))[0]
    )
      return false;
    if (activeForm(a) === "lightning") {
      if (this.cast(a, 1) === false) return false;
      a.abilityCd = 4.5;
      return true;
    }
    if (activeForm(a) === "spirit" && !this.revivalTarget(a)) {
      this.event("NO FALLEN ALLY TO REVIVE");
      return false;
    }
    a.charging = true;
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
    if (this.cast(a, p) !== false) a.abilityCd = 4.5;
  }
  fell(a, { lost = false } = {}) {
    if (!a.alive && !a.ghost) return;
    a.hp = 0;
    a.burst = 0;
    a.movingTime = 0;
    a.alive = false;
    a.charging = false;
    a.shield = 0;
    a.lock = null;
    a.lost = lost;
    a.ghost = !lost && !a.echo && hasPassive(a, "spirit");
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
      this.event("LOST BETWEEN WORLDS", "#cbb4e7", a.x, a.y);
    } else if (!a.echo) {
      this.tokens.push({
        x: a.x,
        y: a.y,
        parts: [...a.parts],
        team: a.team,
        owner: a.id,
        souls: [{ owner: a.id, parts: [...a.nativeParts] }, ...a.absorbed],
        portalCooldown: 0.3,
      });
      if (a.team === this.player.team)
        this.event(
          a.ghost ? "ANGEL GUARD AWAKENS" : "ALLY TOKEN DROPPED",
          "#a9dfd5",
          a.x,
          a.y,
        );
    }
  }
  damage(
    a,
    b,
    amount,
    ability = false,
    reflected = false,
    sourceElement = ability ? activeForm(a) : a.element,
  ) {
    if (!b.alive || !inWorld(b)) return 0;
    if (b.dodge > 0 && !a.parts.includes("light")) {
      b.dodge = 0;
      this.event("DODGED", "#b8a1df", b.x, b.y);
      return 0;
    }
    if (!reflected && hasPassive(a, "invincible")) amount *= 2;
    if (ability && hasPassive(b, "mirror") && !reflected && a.id !== b.id) {
      this.event("REFLECT", "#fff", b.x, b.y);
      return this.damage(b, a, amount, true, true, sourceElement);
    }
    let hit =
      amount *
      multiplier(sourceElement, b.element, ability) *
      (b.parts.includes("earth") ? 0.75 : 1);
    if (ability && sourceElement === "water" && b.parts.includes("fire"))
      hit *= 0.7;
    if (b.shield) {
      const blocked = Math.min(b.shieldHp, hit);
      b.shieldHp -= blocked;
      hit -= blocked;
      if (b.shieldHp <= 0) {
        b.shield = 0;
        b.utilityCd = 5;
        this.event("SHIELD BROKEN", "#e9cc91", b.x, b.y);
      }
    }
    b.hp = Math.max(0, b.hp - hit);
    if (hit > 0) {
      b.flash = 0.16;
      b.hurtReveal = 0.15;
      if (hit >= 0.5 && !hasPassive(b, "divine"))
        this.event(
          `${Math.round(hit)}`,
          a.team === b.team ? "#eab66b" : "#f3e7cd",
          b.x,
          b.y - 30,
        );
      if (b.charging) {
        b.stagger = 0.27;
        if (hit >= 0.5 && !hasPassive(b, "divine"))
          this.event("INTERRUPTED", "#e9cc91", b.x, b.y - 48);
      }
      if (b.hp <= 0) this.fell(b);
    }
    return hit;
  }
  meleeDamage(a, b, amount) {
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
      this.event("ANGEL GUARD", "#b8edeb", guard.x, guard.y - 30);
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
      if (remove.has(p.id)) continue;
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
          canHit(a, q.who) &&
          canHit(q.who, a),
      );
      if (clash) {
        this.meleeDamage(a, clash.who, 3.5);
        this.meleeDamage(clash.who, a, 3.5);
        remove.add(clash.id);
        this.event(
          "CLASH",
          "#f4d485",
          (a.x + clash.who.x) / 2,
          (a.y + clash.who.y) / 2 - 20,
        );
        this.effects.push({
          kind: "ring",
          x: (a.x + clash.who.x) / 2,
          y: (a.y + clash.who.y) / 2,
          color: "#fff4ca",
          life: 0.3,
          max: 0.3,
          r: 48,
        });
      } else
        for (const b of this.fighters)
          if (canHit(a, b)) this.meleeDamage(a, b, 14);
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
      element: activeForm(a),
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
      element: activeForm(a),
      x: a.x + a.fx * 70,
      y: a.y + a.fy * 70,
      r,
      power,
      kind,
      life,
      tick: 0,
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
    fallen.hp = Math.min(fallen.maxHp, 45 + 15 * power);
    fallen.x = clamp(a.x - a.fx * 45, 135, 889);
    fallen.y = clamp(a.y - a.fy * 45, 175, 560);
    fallen.portalCooldown = 0.8;
    fallen.blind = fallen.venom = fallen.burn = 0;
    this.event(
      `${nameOf(fallen.element).toUpperCase()} REVIVED`,
      "#bee9bf",
      fallen.x,
      fallen.y,
    );
    return true;
  }
  cast(a, p) {
    const e = activeForm(a);
    if (!skillsFor(e)[0]) return false;
    a.reveal = 0.45;
    if (e === "lightning") {
      const target =
        this.target(a) ||
        this.enemies(a)
          .filter((b) => distance(a, b) <= 300)
          .sort((b, c) => distance(a, b) - distance(a, c))[0];
      if (!target) {
        if (a.id === "player") this.event("NO VISIBLE RIVAL IN RANGE");
        return false;
      }
      const flooded = this.hazards.some(
        (h) => inWorld(h) && h.kind === "flood" && distance(h, target) <= h.r,
      );
      this.effects.push({
        kind: "lightning",
        x: target.x,
        y: target.y,
        color: "#e7faff",
        life: 0.25,
        max: 0.25,
      });
      this.damage(a, target, 26 * (flooded ? 2 : 1), true, false, "lightning");
    } else if (e === "light" || e === "divine") {
      const recipient = this.healingTarget(a);
      if (!recipient) return false;
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
      this.event("HEALED", "#c9ebbc", recipient.x, recipient.y - 30);
    } else if (e === "dark") {
      const t =
        this.target(a) ||
        this.fighters
          .filter(
            (b) =>
              b.team !== a.team &&
              b.alive &&
              inWorld(b) &&
              visibility(b) > 0 &&
              distance(a, b) < 245,
          )
          .sort((b, c) => distance(a, b) - distance(a, c))[0];
      if (t) {
        t.charging = false;
        t.charge = 0;
        t.abilityCd = Math.max(t.abilityCd, 2);
        if (!hasPassive(t, "divine")) {
          t.blind = 2 * p;
          t.lock = null;
        }
        this.damage(a, t, 12 * p, true);
        this.event("SABOTAGED", "#c1a1df", t.x, t.y);
      }
    } else if (e === "mud" || e === "smoke")
      this.area(a, p, e === "mud" ? "quicksand" : "vog", 85, 5 * p);
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
        minion.hp = minion.maxHp = 1;
        minion.life = 9;
        minion.echo = true;
        minion.summoner = a.id;
        this.fighters.push(minion);
      }
      this.event("ECHO SUMMONED");
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
    else if (e === "gravity") {
      for (const b of this.fighters)
        if (b.id !== a.id && b.alive && inWorld(b) && distance(a, b) < 200) {
          this.damage(a, b, 18 * p, true);
          b.knockX += a.fx * 260;
          b.knockY += a.fy * 260;
        }
    } else
      this.projectile(a, p, {
        speed: e === "fire" ? 290 : 330,
        r: e === "fire" ? 23 : 18,
        damage: 22,
        life: e === "fire" ? 0.85 : 1.1,
        kind: e === "fire" ? "flame" : "bolt",
      });
    return true;
  }
  utility(a, hold = true) {
    const e = activeForm(a);
    if (!hold) {
      if (a.shield) {
        a.shield = 0;
        a.utilityCd = 5;
      }
      return;
    }
    if (!a.alive || !inWorld(a) || !skillsFor(e)[1]) return false;
    if (e === "blaze") {
      if (this.isShocked(a)) return false;
      // An active dash finishes before the next one begins; there is no recharge.
      if (a.burst > 0) return true;
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
      a.charging = false;
      a.shield = 1;
      a.shieldTime = 0;
      return true;
    }
    if (a.utilityCd > 0) return false;
    a.reveal = 0.45;
    a.utilityCd = 7;
    if (e === "fire") this.area(a, 1, "magma", 66, Infinity);
    else if (e === "light") {
      for (const b of this.fighters)
        if (
          b.id !== a.id &&
          b.alive &&
          inWorld(b) &&
          distance(a, b) < 260 &&
          !hasPassive(b, "divine")
        ) {
          b.blind = 3;
          b.lock = null;
        }
      this.effects.push({
        kind: "ring",
        x: a.x,
        y: a.y,
        color: "#fff",
        r: 250,
        life: 0.5,
        max: 0.5,
      });
      this.event("FLASH");
    } else if (e === "dark" || e === "apparition") {
      a.dodge = 4;
      this.event("SHADOW STEP");
    } else if (e === "air") {
      a.boost = 2;
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
      const token = this.tokens
        .filter((t) => t.team !== a.team)
        .sort((b, c) => distance(a, b) - distance(a, c))[0];
      if (token) {
        this.tokens = this.tokens.filter((t) => t !== token);
        const dead = this.fighters.find((b) => b.id === token.owner);
        if (dead) {
          dead.lost = true;
          dead.ghost = false;
        }
        this.event("TOKEN CONSUMED");
      }
    }
    return true;
  }
  rebuildFusion(a) {
    a.parts = [
      ...new Set([...a.nativeParts, ...a.absorbed.flatMap((s) => s.parts)]),
    ];
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
    const fused = combination(a.parts, parts),
      all = [...new Set([...a.parts, ...parts])];
    if (!a.alive || !fused || all.length <= a.parts.length) return false;
    a.parts = all;
    a.forms = [...new Set([...a.forms, ...parts, fused])];
    a.element = fused;
    a.form = a.forms.length - 1;
    a.hp = Math.min(a.maxHp, a.hp + 30);
    a.charging = false;
    a.shield = 0;
    this.event(
      `${nameOf(fused).toUpperCase()} AWAKENED`,
      "#e8cf89",
      a.x,
      a.y - 20,
    );
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
    if (!a.alive || !inWorld(a) || a.echo) return false;
    const token = this.tokens.find(
      (t) =>
        inWorld(t) &&
        !t.removed &&
        t.team === a.team &&
        distance(a, t) <= TOKEN_TOUCH_RANGE &&
        combination(a.parts, t.parts),
    );
    if (!token || !this.applyFusion(a, token.parts)) return false;
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
    return this.tokens.filter((t) => t.team === team && inWorld(t));
  }
  switchForm(a, form) {
    const index =
      form === undefined
        ? (a.form + 1) % a.forms.length
        : a.forms.indexOf(form);
    if (index < 0) return false;
    a.charging = false;
    this.utility(a, false);
    a.form = index;
    this.event(`${nameOf(activeForm(a)).toUpperCase()} SKILLS`);
    return true;
  }
  teleport(a, x, y) {
    if (
      !a.alive ||
      !inWorld(a) ||
      !hasPassive(a, "multi-dimensional") ||
      this.isShocked(a) ||
      x < 135 ||
      x > 889 ||
      y < 175 ||
      y > 560
    )
      return false;
    const old = { x: a.x, y: a.y };
    a.x = x;
    a.y = y;
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
    return true;
  }
  healingTarget(a) {
    return this.fighters
      .filter((b) => b.alive && !b.echo && inWorld(b) && b.team === a.team)
      .sort((b, c) => b.hp - c.hp || distance(a, b) - distance(a, c))[0];
  }
  enemies(a) {
    return this.fighters.filter(
      (b) =>
        b.alive &&
        inWorld(b) &&
        b.team !== a.team &&
        visibility(b) > 0 &&
        (a.blind <= 0 || distance(a, b) < 45),
    );
  }
  // Restraint is an AI decision, not friendly-fire immunity. Players can still
  // strike allies, and attacks already in flight can still catch a moving ally.
  safeAttack(a, target, kind = "melee", form = activeForm(a)) {
    if (!target) return false;
    const enemies = this.enemies(a);
    const nearestEnemy = Math.min(
      distance(a, target),
      ...enemies.map((b) => distance(a, b)),
    );
    const allies = this.fighters.filter(
      (b) => b.id !== a.id && b.alive && inWorld(b) && b.team === a.team,
    );
    if (allies.some((b) => distance(a, b) < nearestEnemy)) return false;
    const d = distance(a, target) || 1;
    const dx = (target.x - a.x) / d,
      dy = (target.y - a.y) / d;
    return !allies.some((b) => {
      const bd = distance(a, b),
        along = (b.x - a.x) * dx + (b.y - a.y) * dy;
      if (kind === "melee") return canHit(a, b);
      if (form === "light") return bd < 260;
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
  ai(a, dt) {
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
    // Prefer a vulnerable nearby rival, especially one threatening a hurt ally.
    const score = (b) =>
      distance(a, b) +
      b.hp * 0.3 -
      (allies.some((c) => c.hp < 60 && distance(c, b) < 110) ? 90 : 0);
    const target = enemies.sort((b, c) => score(b) - score(c))[0];
    const patient = this.healingTarget(a);
    const heal =
      !a.echo &&
      a.forms.includes("light") &&
      patient &&
      patient.hp < patient.maxHp - 18;
    const revive =
      !a.echo && a.forms.includes("spirit") && this.revivalTarget(a);
    const d = target ? distance(a, target) : Infinity;
    const fire = hasPassive(a, "fire"),
      light = a.element === "light";
    const aggressiveLight = light && target && a.hp >= target.hp + 15;
    const desired =
      a.hp < 30
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
      const blocker = allies.find((b) => distance(a, b) < Math.min(d, 110));
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
      if (gap < 75) {
        dx += ((a.x - ally.x) / (gap || 1)) * 1.4;
        dy += ((a.y - ally.y) / (gap || 1)) * 1.4;
      }
    }
    // Step out of hostile floor effects and incoming attack lanes.
    for (const h of this.hazards.filter(inWorld)) {
      const harmful =
        h.kind === "gravity"
          ? h.owner.team !== a.team && !hasPassive(a, "apparition")
          : h.kind === "quicksand"
            ? !this.flying(a)
            : ["magma", "heatwave", "vog"].includes(h.kind) && !burnImmune(a);
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
    this.move(a, dx, dy, dt);
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
      const form = activeForm(a),
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
      this.switchForm(a, revive ? "spirit" : "light");
      this.startCharge(a);
      return;
    }
    if (!target) {
      // Only search when support, movement and hazard avoidance leave us idle.
      // Spots come solely from remembered coordinates, never hidden live state.
      if (a.lastSeen?.divine && Math.hypot(dx, dy) < 0.1) {
        if (!a.searchSpot || this.time >= (a.searchNext || 0)) {
          const angle = this.random() * Math.PI * 2,
            radius = Math.sqrt(this.random()) * 65;
          a.searchSpot = {
            x: clamp(a.lastSeen.x + Math.cos(angle) * radius, 135, 889),
            y: clamp(a.lastSeen.y + Math.sin(angle) * radius, 175, 560),
          };
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
      d < 160 &&
      target.blind <= 0 &&
      a.utilityCd <= 0 &&
      this.safeAttack(a, target, "utility", "light")
    )
      this.utility(a);
    if (
      !a.echo &&
      a.forms.includes("blaze") &&
      d > 80 &&
      d < 360 &&
      a.burst <= 0 &&
      this.safeAttack(a, target, "utility", "blaze")
    ) {
      this.switchForm(a, "blaze");
      this.utility(a);
    }
    if (d <= STRIKE_RANGE && this.safeAttack(a, target)) this.strike(a);
    if (a.echo) return;
    // Support waits for a healing opportunity instead of wasting its main skill.
    if (light) return;
    let attackForm = a.element;
    if (!skillsFor(attackForm)[0] || ["spirit", "divine"].includes(attackForm))
      attackForm = a.parts.find(
        (e) => !["light"].includes(e) && skillsFor(e)[0],
      );
    if (
      attackForm &&
      a.abilityCd <= 0 &&
      d < 300 &&
      this.safeAttack(a, target, "ability", attackForm)
    ) {
      this.switchForm(a, attackForm);
      this.startCharge(a);
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
        segmentDistance(b, old, a) > 28
      )
        continue;
      a.burstHits.add(b.id);
      this.damage(a, b, 22, true, false, "blaze");
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
          !b.alive ||
          !inWorld(b) ||
          p.hit.has(b.id) ||
          segmentDistance(b, old, p) > p.r + 15
        )
          continue;
        p.hit.add(b.id);
        let amount = p.damage;
        if (p.kind === "water" && b.parts.includes("fire")) amount *= 2;
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
      h.tick -= dt;
      if (h.tick > 0) continue;
      h.tick = 0.35;
      for (const b of this.fighters) {
        if (!b.alive || !inWorld(b) || distance(h, b) > h.r) continue;
        const flying = this.flying(b),
          immune = hasPassive(b, "divine");
        if (h.kind === "flood") {
          if (!flying) b.slow = 0.4;
          if (b.parts.includes("fire")) this.fell(b);
        } else if (h.kind === "gravity") {
          if (b.team !== h.owner.team && !hasPassive(b, "apparition"))
            b.slow = 0.5;
        } else if (h.kind === "quicksand" && !flying && !flooded) {
          b.slow = 0.5;
          this.damage(h.owner, b, 2 * h.power, true, false, h.element);
        } else if (h.kind === "vog") {
          if (!immune) {
            b.blind = 1;
            b.lock = null;
          }
          if (
            !immune &&
            !b.parts.includes("fire") &&
            !b.parts.includes("water")
          )
            this.damage(h.owner, b, 3 * h.power, true, false, h.element);
        } else if (
          h.kind === "heatwave" ||
          (h.kind === "magma" && !flying && !flooded)
        ) {
          if (
            !immune &&
            !b.parts.includes("fire") &&
            !b.parts.includes("water")
          )
            this.damage(h.owner, b, 3 * h.power, true, false, h.element);
        }
      }
    }
    this.hazards = this.hazards.filter(
      (h) => !h.removed && (h.life > 0 || !inWorld(h)),
    );
  }
  update(dt, input = { x: 0, y: 0 }, runAI = true) {
    if (this.finished) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
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
        "dodge",
        "boost",
        "venom",
        "slow",
        "flash",
        "swing",
        "reveal",
        "hurtReveal",
      ])
        a[key] = Math.max(0, a[key] - dt);
      if (a.life !== undefined && (a.life -= dt) <= 0) {
        this.fell(a);
        continue;
      }
      if (a.charging && a.stagger <= 0) a.charge = Math.min(1.8, a.charge + dt);
      if (a.shield) a.shieldTime += dt;
      else a.shieldHp = Math.min(65, a.shieldHp + dt * 5);
      if (hasPassive(a, "divine")) a.venom = a.burn = a.blind = 0;
      if (a.venom > 0)
        this.damage(a.venomSource || a, a, dt * 3, true, false, "mud");
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
        if (b.id === a.id || !b.alive || !inWorld(b) || distance(a, b) >= 30)
          continue;
        if (
          a.parts.includes("fire") &&
          !b.parts.includes("fire") &&
          !b.parts.includes("water") &&
          !hasPassive(b, "divine")
        ) {
          const hp = b.hp;
          this.damage(a, b, dt * 5, true, false, "fire");
          if (b.hp < hp) b.burn = 1;
        }
        if (hasPassive(a, "mud") && !hasPassive(b, "divine")) {
          b.venom = 5;
          b.venomSource = a;
        }
      }
    }
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    this.events = this.events.filter((e) => this.time - e.time < 1.4);
    const teams = new Set(
      this.fighters.filter((a) => a.alive && !a.echo).map((a) => a.team),
    );
    if (teams.size < 2) {
      this.finished = true;
      this.result =
        teams.size === 0 ? "draw" : teams.has(0) ? "victory" : "defeat";
    }
  }
}
