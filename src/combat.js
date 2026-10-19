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
    utility: "Extinguish",
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
};
export const FUSED = {
  mud: ["Quicksand", "Venom bite"],
  spirit: ["Revival", "Portal step"],
  mirror: ["Prism burst", "Reflect"],
  sun: ["Laser beam", "Heatwave"],
  blaze: ["Flame burst", "Speed burst"],
  cloud: ["Tornado", "Flood"],
  smoke: ["Vog", "Smoke veil"],
  gravity: ["Telekinesis", "Gravity field"],
  apparition: ["Doppelgänger", "Phase"],
  demonic: ["Minions", "Death"],
  divine: ["Radiance", "Immunity"],
  "multi-dimensional": ["Rift", "Phase shift"],
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
export const nameOf = (e) =>
  e
    .split("-")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const combination = (a, b) =>
  COMBOS[[...new Set([...a, ...b])].sort().join("+")] || null;
export function multiplier(source, target, ability = true) {
  return (
    (ability && source === target ? 0.5 : 1) *
    (EDGES.some(([a, b]) => a === source && b === target) ? 1.5 : 1)
  );
}
export function canHit(a, b, range = 69) {
  if (!a.alive || !b.alive || a.id === b.id) return false;
  const d = distance(a, b);
  return (
    d <= range &&
    (d < 12 || ((b.x - a.x) * a.fx + (b.y - a.y) * a.fy) / d >= 0.38)
  );
}
export function makeFighter(id, element, team, x, y) {
  return {
    id,
    element,
    base: element,
    parts: [element],
    forms: [element],
    form: 0,
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
    dodge: 0,
    boost: 0,
    burn: 0,
    venom: 0,
    slow: 0,
    flash: 0,
    swing: 0,
    aiTimer: 0,
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
    this.hazards = [];
    this.tokens = [];
    this.pending = [];
    this.finished = false;
    this.result = null;
    this.fighters = [];
    this.sequence = 0;
    const n = mode === "team" ? size : 1;
    const rivals = ["water", "earth", "dark", "fire"];
    const allies = ["air", "light", "earth"];
    for (let i = 0; i < n; i++) {
      this.fighters.push(
        makeFighter(
          i === 0 ? "player" : `ally-${i}`,
          i === 0 ? element : allies[i - 1],
          0,
          330 - i * 34,
          340 + (i - (n - 1) / 2) * 95,
        ),
      );
      this.fighters.push(
        makeFighter(
          `enemy-${i}`,
          rivals[i],
          1,
          710 + i * 26,
          340 + (i - (n - 1) / 2) * 95,
        ),
      );
    }
    this.player = this.fighters[0];
    if (mode === "fused") {
      const compatible = Object.keys(ELEMENTS).find((e) =>
        combination([element], [e]),
      );
      this.applyFusion(this.player, [compatible]);
      this.applyFusion(this.fighters[1], ["earth"]);
    }
  }
  event(text, color = "#e9cc91", x = this.player.x, y = this.player.y) {
    this.events.push({ text, color, x, y, time: this.time });
  }
  flying(a) {
    return a.parts.includes("air");
  }
  target(a) {
    return this.fighters.find((b) => b.id === a.lock && b.alive);
  }
  toggleLock(a) {
    if (a.blind > 0) {
      this.event("BLINDED");
      return;
    }
    if (a.lock) {
      a.lock = null;
      return;
    }
    const enemies = this.fighters
      .filter((b) => b.alive && b.team !== a.team)
      .sort((b, c) => distance(a, b) - distance(a, c));
    a.lock = enemies[0]?.id || null;
  }
  move(a, dx, dy, dt) {
    if (!a.alive) return;
    const length = Math.hypot(dx, dy);
    let speed =
      150 *
      (a.hp < 40 ? 0.55 + (0.45 * a.hp) / 40 : 1) *
      (this.flying(a) ? 1.28 : 1) *
      (a.boost > 0 ? 1.7 : 1) *
      (a.charging ? 0.65 : 1) *
      (a.slow > 0 ? 0.48 : 1) *
      (a.shield ? 0.32 : 1);
    if (length) {
      dx /= length;
      dy /= length;
    }
    const blend = this.flying(a) ? Math.min(1, dt * 4) : 1;
    a.vx += (dx * speed - a.vx) * blend;
    a.vy += (dy * speed - a.vy) * blend;
    a.x = Math.max(135, Math.min(889, a.x + a.vx * dt));
    a.y = Math.max(175, Math.min(560, a.y + a.vy * dt));
    const t = this.target(a);
    if (t && distance(a, t) < 245 && !a.blind) {
      const d = distance(a, t) || 1;
      a.fx = (t.x - a.x) / d;
      a.fy = (t.y - a.y) / d;
    } else if (length) {
      a.fx = dx;
      a.fy = dy;
    }
  }
  strike(a) {
    if (!a.alive || a.attackCd > 0 || a.shield || a.stagger > 0) return false;
    a.attackCd = 0.43;
    a.swing = 0.22;
    this.pending.push({ id: ++this.sequence, who: a, at: this.time + 0.11 });
    return true;
  }
  startCharge(a) {
    if (!a.alive || a.abilityCd > 0 || a.shield || a.stagger > 0) return false;
    a.charging = true;
    a.charge = 0;
    return true;
  }
  releaseCharge(a) {
    if (!a.charging || !a.alive) return;
    a.charging = false;
    const power = 1 + Math.min(1, a.charge / 1.8) * 1.6;
    a.abilityCd = 4.5;
    a.charge = 0;
    this.cast(a, power);
  }
  damage(a, b, amount, ability = false, reflected = false) {
    if (!b.alive) return 0;
    if (b.dodge > 0 && !a.parts.includes("light")) {
      b.dodge = 0;
      this.event("DODGED", "#b8a1df", b.x, b.y);
      return 0;
    }
    if (
      ability &&
      b.parts.includes("earth") &&
      b.parts.includes("light") &&
      !reflected &&
      a.id !== b.id
    ) {
      this.event("REFLECT", "#fff", b.x, b.y);
      return this.damage(b, a, amount, true, true);
    }
    let hit =
      amount *
      multiplier(a.element, b.element, ability) *
      (b.parts.includes("earth") ? 0.75 : 1);
    if (b.shield) {
      const blocked = Math.min(b.shieldHp, hit);
      b.shieldHp -= blocked;
      hit -= blocked;
      if (b.shieldHp <= 0) {
        b.shield = 0;
        this.event("SHIELD BROKEN", "#e9cc91", b.x, b.y);
      }
    }
    b.hp = Math.max(0, b.hp - hit);
    if (hit > 0) {
      b.flash = 0.16;
      if (hit >= 0.5)
        this.event(
          `${Math.round(hit)}`,
          a.team === b.team ? "#eab66b" : "#f3e7cd",
          b.x,
          b.y - 30,
        );
      if (b.charging) {
        b.stagger = 0.27;
        this.event("INTERRUPTED", "#e9cc91", b.x, b.y - 48);
      }
      if (b.hp <= 0) {
        b.alive = false;
        b.charging = false;
        b.shield = 0;
        this.tokens.push({
          x: b.x,
          y: b.y,
          parts: [...b.parts],
          team: b.team,
          owner: b.id,
        });
        this.event("TOKEN DROPPED", "#82cec3", b.x, b.y);
      }
    }
    return hit;
  }
  resolveStrikes() {
    const due = this.pending.filter((p) => p.at <= this.time);
    const remove = new Set();
    for (const p of due) {
      if (remove.has(p.id)) continue;
      const a = p.who;
      if (!a.alive) {
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
        this.damage(a, clash.who, 14 * 0.25);
        this.damage(clash.who, a, 14 * 0.25);
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
      } else {
        for (const b of this.fighters) if (canHit(a, b)) this.damage(a, b, 14);
      }
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
    });
  }
  area(a, power, kind, r = 90, life = 5) {
    this.hazards.push({
      owner: a,
      x: a.x + a.fx * 70,
      y: a.y + a.fy * 70,
      r,
      power,
      kind,
      life,
      tick: 0,
    });
  }
  cast(a, p) {
    const e = a.element;
    if (e === "light" || e === "divine") {
      a.hp = Math.min(a.maxHp, a.hp + 23 * p);
      this.effects.push({
        kind: "ring",
        x: a.x,
        y: a.y,
        color: "#fff3c4",
        r: 75,
        life: 0.7,
        max: 0.7,
      });
      this.event("HEALED", "#c9ebbc", a.x, a.y - 30);
    } else if (e === "dark") {
      const t =
        this.target(a) ||
        this.fighters
          .filter((b) => b.team !== a.team && b.alive && distance(a, b) < 245)
          .sort((b, c) => distance(a, b) - distance(a, c))[0];
      if (t && distance(a, t) < 260) {
        t.charging = false;
        t.charge = 0;
        t.abilityCd = Math.max(t.abilityCd, 2);
        t.blind = 2 * p;
        t.lock = null;
        this.damage(a, t, 12 * p, true);
        this.event("SABOTAGED", "#c1a1df", t.x, t.y);
      }
    } else if (e === "mud" || e === "smoke") {
      this.area(a, p, e === "mud" ? "quicksand" : "vog", 85, 5 * p);
    } else if (e === "apparition" || e === "demonic") {
      for (let i = 0; i < (e === "demonic" ? 3 : 1); i++) {
        const minion = makeFighter(
          `echo-${++this.sequence}`,
          a.base,
          a.team,
          a.x + 30 + i * 12,
          a.y + 30,
        );
        minion.hp = 1;
        minion.maxHp = 1;
        minion.life = 9;
        minion.echo = true;
        this.fighters.push(minion);
      }
      this.event("ECHO SUMMONED");
    } else if (e === "spirit") {
      const token = this.tokens.find(
        (t) => t.team === a.team && distance(a, t) < 180,
      );
      if (token) {
        const fallen = this.fighters.find((b) => b.id === token.owner);
        fallen.alive = true;
        fallen.hp = 60;
        fallen.x = token.x;
        fallen.y = token.y;
        this.tokens = this.tokens.filter((t) => t !== token);
        this.event("REVIVED");
      } else {
        a.hp = Math.min(a.maxHp, a.hp + 20 * p);
        this.event("SPIRIT HEAL");
      }
    } else if (e === "sun") {
      this.projectile(a, p, {
        speed: 720,
        r: 9,
        damage: 30,
        life: 1,
        kind: "laser",
      });
    } else if (e === "cloud") {
      this.projectile(a, p, {
        speed: 200,
        r: 37,
        damage: 25,
        life: 2.5,
        kind: "tornado",
      });
    } else if (e === "air") {
      this.projectile(a, p, {
        speed: 330,
        r: 30,
        damage: 23,
        life: 1.1,
        kind: "sonic",
      });
    } else if (e === "water") {
      this.projectile(a, p, { speed: 390, r: 18, damage: 23, kind: "water" });
    } else if (e === "gravity") {
      for (const b of this.fighters)
        if (b.id !== a.id && b.alive && distance(a, b) < 200) {
          this.damage(a, b, 18 * p, true);
          b.x = Math.max(135, Math.min(889, b.x + a.fx * 45));
          b.y = Math.max(175, Math.min(560, b.y + a.fy * 45));
        }
    } else {
      this.projectile(a, p, {
        speed: e === "fire" ? 290 : 330,
        r: e === "fire" ? 23 : 18,
        damage: 22,
        life: e === "fire" ? 0.85 : 1.1,
        kind: e === "fire" ? "flame" : "bolt",
      });
    }
  }
  utility(a, hold = true) {
    if (!a.alive) return;
    if (a.element === "earth") {
      if (!hold) {
        if (a.shield) {
          a.shield = 0;
          a.utilityCd = 5;
        }
        return;
      }
      if (a.utilityCd > 0 || a.shieldHp <= 0) return;
      a.shield = 1;
      a.shieldTime = 0;
      return;
    }
    if (!hold || a.utilityCd > 0) return;
    a.utilityCd = 7;
    const e = a.element;
    if (e === "fire") this.area(a, 1, "magma", 66, Infinity);
    else if (e === "light") {
      for (const b of this.fighters)
        if (b.id !== a.id && b.alive && distance(a, b) < 260) {
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
    } else if (
      e === "dark" ||
      e === "apparition" ||
      e === "multi-dimensional"
    ) {
      a.dodge = 4;
      this.event("SHADOW STEP");
    } else if (e === "water") {
      this.hazards = this.hazards.filter((h) => distance(a, h) > 200);
      a.burn = 0;
      this.event("EXTINGUISHED");
    } else if (e === "air" || e === "blaze") {
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
    else if (e === "mud") {
      for (const b of this.fighters)
        if (canHit(a, b, 90)) {
          b.venom = 6;
          this.damage(a, b, 8, true);
        }
    } else if (e === "smoke") this.area(a, 1, "vog", 130, 5);
    else if (e === "spirit") {
      a.x = Math.max(135, Math.min(889, a.x + a.fx * 180));
      a.y = Math.max(175, Math.min(560, a.y + a.fy * 180));
      this.event("PORTAL STEP");
    } else if (e === "demonic") {
      const token = this.tokens.find((t) => t.team !== a.team);
      if (token) {
        this.tokens = this.tokens.filter((t) => t !== token);
        this.event("TOKEN CONSUMED");
      }
    } else if (e === "divine") {
      a.hp = Math.min(a.maxHp, a.hp + 25);
      a.burn = 0;
      a.venom = 0;
      a.blind = 0;
    } else {
      a.dodge = 3;
      this.event("PRISM GUARD");
    }
  }
  applyFusion(a, parts) {
    const fused = combination(a.parts, parts);
    if (!fused) return false;
    const all = [...new Set([...a.parts, ...parts])];
    if (all.length <= a.parts.length) return false;
    a.parts = all;
    a.forms = [...new Set([...a.forms, ...parts, fused])];
    a.element = fused;
    a.form = a.forms.length - 1;
    a.hp = Math.min(a.maxHp, a.hp + 30);
    this.event(
      `${nameOf(fused).toUpperCase()} AWAKENED`,
      "#e8cf89",
      a.x,
      a.y - 20,
    );
    return true;
  }
  fuse(a) {
    const t = this.tokens.find(
      (t) =>
        t.team === a.team &&
        distance(a, t) < 85 &&
        combination(a.parts, t.parts),
    );
    if (t && this.applyFusion(a, t.parts)) {
      this.tokens = this.tokens.filter((x) => x !== t);
      return true;
    }
    this.event("NEED A COMPATIBLE ALLY TOKEN");
    return false;
  }
  switchForm(a) {
    if (a.forms.length < 2) return;
    a.charging = false;
    a.shield = 0;
    a.form = (a.form + 1) % a.forms.length;
    a.element = a.forms[a.form];
    this.event(nameOf(a.element).toUpperCase());
  }
  ai(a, dt) {
    const enemies = this.fighters.filter((b) => b.alive && b.team !== a.team);
    const target = enemies.sort((b, c) => distance(a, b) - distance(a, c))[0];
    if (!target) return;
    const d = distance(a, target);
    a.lock = a.blind > 0 ? null : target.id;
    const phase = Math.sin(this.time * 1.5 + a.x * 0.01);
    let dx = (target.x - a.x) / (d || 1),
      dy = (target.y - a.y) / (d || 1);
    if (d < 49) {
      dx = -dx * 0.45;
      dy = -dy * 0.45;
    } else if (d < 100) {
      const ox = dx;
      dx = dx * 0.3 - dy * phase * 0.5;
      dy = dy * 0.3 + ox * phase * 0.5;
    }
    this.move(a, dx, dy, dt);
    a.aiTimer -= dt;
    if (a.aiTimer <= 0) {
      a.aiTimer = 0.25 + this.random() * 0.4;
      if (d < 72) this.strike(a);
      else if (
        d < 235 &&
        a.abilityCd <= 0 &&
        !a.charging &&
        this.random() < 0.28
      )
        this.startCharge(a);
      if (a.utilityCd <= 0 && d < 130 && this.random() < 0.12) this.utility(a);
      if (a.charging && a.charge > 0.6 + this.random() * 0.5)
        this.releaseCharge(a);
      if (a.shield && a.shieldTime > 0.8) this.utility(a, false);
      if (a.hp < 70) this.fuseAI(a);
    }
  }
  fuseAI(a) {
    const t = this.tokens.find(
      (t) =>
        t.team === a.team &&
        distance(a, t) < 85 &&
        combination(a.parts, t.parts),
    );
    if (t && this.applyFusion(a, t.parts))
      this.tokens = this.tokens.filter((x) => x !== t);
  }
  update(dt, input = { x: 0, y: 0 }, runAI = true) {
    if (this.finished) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    for (const a of this.fighters) {
      if (!a.alive) continue;
      for (const key of [
        "attackCd",
        "abilityCd",
        "utilityCd",
        "stagger",
        "blind",
        "dodge",
        "boost",
        "burn",
        "venom",
        "slow",
        "flash",
        "swing",
      ])
        a[key] = Math.max(0, a[key] - dt);
      if (a.life !== undefined && (a.life -= dt) <= 0) {
        a.alive = false;
        continue;
      }
      if (a.charging && a.stagger <= 0) a.charge = Math.min(1.8, a.charge + dt);
      if (a.shield) {
        a.shieldTime += dt;
        if (a.shieldTime >= 3) {
          a.shield = 0;
          a.utilityCd = 5;
        }
      } else a.shieldHp = Math.min(65, a.shieldHp + dt * 5);
      if (a.venom > 0 && !a.parts.includes("light")) this.damage(a, a, dt * 3);
      if (a.id === "player") this.move(a, input.x, input.y, dt);
      else if (runAI) this.ai(a, dt);
      if (a.parts.includes("water"))
        this.hazards = this.hazards.filter(
          (h) => h.kind !== "magma" || distance(a, h) > h.r + 12,
        );
    }
    this.resolveStrikes();
    for (const p of this.projectiles) {
      p.life -= dt;
      p.x += p.dx * dt;
      p.y += p.dy * dt;
      for (const b of this.fighters) {
        if (
          b.id === p.owner.id ||
          !b.alive ||
          p.hit.has(b.id) ||
          distance(p, b) > p.r + 15
        )
          continue;
        p.hit.add(b.id);
        let damage = p.damage;
        if (p.kind === "sonic") damage *= Math.max(0.15, p.life / p.maxLife);
        if (p.kind === "water" && b.parts.includes("fire")) damage *= 2;
        this.damage(p.owner, b, damage, true);
        if (p.kind === "water") {
          b.x = Math.max(135, Math.min(889, b.x + p.dx * 0.07));
          b.y = Math.max(175, Math.min(560, b.y + p.dy * 0.07));
        }
        if (!["sonic", "tornado", "laser"].includes(p.kind)) p.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
    const flooded = this.hazards.some((h) => h.kind === "flood");
    for (const h of this.hazards) {
      h.life -= dt;
      h.tick -= dt;
      if (h.tick > 0) continue;
      h.tick = 0.35;
      for (const b of this.fighters) {
        if (!b.alive || distance(h, b) > h.r) continue;
        const flying = this.flying(b);
        if (h.kind === "flood") {
          if (!flying) b.slow = 0.4;
          if (b.parts.includes("fire")) this.damage(h.owner, b, 1000, true);
        } else if (h.kind === "gravity") {
          if (b.team !== h.owner.team && b.element !== "apparition")
            b.slow = 0.5;
        } else if (h.kind === "quicksand" && !flying && !flooded) {
          b.slow = 0.5;
          this.damage(h.owner, b, 2 * h.power, true);
        } else if (h.kind === "vog") {
          b.blind = 1;
          b.lock = null;
          if (!b.parts.includes("fire") && !b.parts.includes("water"))
            this.damage(h.owner, b, 3 * h.power, true);
        } else if (
          h.kind === "heatwave" ||
          (h.kind === "magma" && !flying && !flooded)
        ) {
          if (!b.parts.includes("fire") && !b.parts.includes("water"))
            this.damage(h.owner, b, 3 * h.power, true);
        }
      }
    }
    this.hazards = this.hazards.filter((h) => h.life > 0);
    for (const a of this.fighters) {
      if (!a.alive || !a.parts.includes("fire")) continue;
      for (const b of this.fighters)
        if (
          b.id !== a.id &&
          b.alive &&
          distance(a, b) < 30 &&
          !b.parts.includes("fire") &&
          !b.parts.includes("water")
        )
          this.damage(a, b, dt * 5, true);
    }
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    this.events = this.events.filter((e) => this.time - e.time < 1.4);
    const aliveTeams = new Set(
      this.fighters.filter((a) => a.alive && !a.echo).map((a) => a.team),
    );
    if (aliveTeams.size < 2) {
      this.finished = true;
      this.result =
        aliveTeams.size === 0
          ? "draw"
          : aliveTeams.has(0)
            ? "victory"
            : "defeat";
    }
  }
}
