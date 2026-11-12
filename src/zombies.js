import { makeFighter, distance, inWorld } from "./combat.js";
export const ZOMBIE_ABILITIES = [
  ["vog", "Vog", "smoke", "ability", 7],
  ["quicksand", "Quicksand", "mud", "ability", 4.5],
  ["teleport", "Teleport", "multi-dimensional", "passive", 0],
  ["lightning", "Lightning strikes", "lightning", "ability", 3],
  ["flood", "Flood", "cloud", "utility", 7],
  ["portals", "Portals", "spirit", "utility", 0],
  ["explosion", "Explosion", "invincible", "ability", 4.5],
  ["revival", "Revival", "spirit", "ability", 4.5],
  ["rebirth", "Rebirth", "phoenix", "passive", 0],
  ["telekinesis", "Telekinesis", "gravity", "ability", 4.5],
  ["shield", "Rock shield", "earth", "utility", 5],
  ["burst", "Speed burst", "blaze", "utility", 0],
  ["invisibility", "Invisibility", "divine", "passive", 0],
  ["healing", "Healing", "light", "ability", 4.5],
  ["chasm", "Chasm", "terraformer", "ability", 8],
  ["prison", "Stone prison", "terraformer", "utility", 7],
  ["spring", "Life spring", "sanctuary", "ability", 0],
].map(([id, name, form, kind, cooldown]) => ({
  id,
  name,
  form,
  kind,
  cooldown,
}));
export const zombieAbility = (id) => ZOMBIE_ABILITIES.find((s) => s.id === id);
export const zombieAllows = (a, form, kind) =>
  a.zombieSkills?.some((id) => {
    const s = zombieAbility(id);
    return s.form === form && s.kind === kind;
  }) || false;
export function initializeZombies(g, players) {
  if (g.mode !== "zombies") return;
  g.map.dungeonStage = 2;
  g.map.name = "The Drowned Vault · Zombies";
  g.fusionEnabled = false;
  g.friendlyFire = false;
  g.respawnDelay = null;
  g.timeLimit = null;
  const count = Math.max(2, Math.min(8, Math.floor(players) || 4));
  g.fighters = Array.from({ length: count }, (_, i) => {
    const p = g.map.nearest(
      { x: 300 + (i % 4) * 90, y: 1740 + Math.floor(i / 4) * 100 },
      24,
    );
    const a = makeFighter(i ? `ally-${i}` : "player", "ice", 0, p.x, p.y);
    Object.assign(a, {
      kills: 0,
      deaths: 0,
      zombieSkills: [],
      zombieCooldowns: {},
      zombieSelected: "ice",
      forms: ["ice"],
      form: 0,
    });
    return a;
  });
  g.player = g.fighters[0];
  g.healthDrops = [];
  g.zombies = { kills: 0, rate: 1, credit: 0, nextId: 0, spawned: 0 };
  const rooms = [1, 2, 3, 5];
  g.zombieDrops = ZOMBIE_ABILITIES.map((s, i) => {
    const room = rooms[i % 4],
      r = g.map.rooms[room],
      slot = Math.floor(i / 4);
    return {
      id: s.id,
      room,
      x: r.x + 120 + (slot % 3) * 150,
      y: r.y + 170 + Math.floor(slot / 3) * 190,
    };
  });
  refreshZombieTeams(g);
}
export function refreshZombieTeams(g) {
  if (g.mode !== "zombies") return;
  g.zombieTeams = [[], []];
  for (const a of g.fighters) if (a.alive) g.zombieTeams[a.team].push(a);
}
export function spawnZombie(g) {
  const r = g.map.rooms[4],
    margin = 28;
  const perimeter = 2 * (r.w + r.h - 4 * margin);
  let n = ((g.random() + g.zombies.nextId * 0.61803398875) % 1) * perimeter;
  const w = r.w - margin * 2,
    h = r.h - margin * 2;
  let x, y;
  if (n < w) {
    x = r.x + margin + n;
    y = r.y + margin;
  } else if ((n -= w) < h) {
    x = r.x + r.w - margin;
    y = r.y + margin + n;
  } else if ((n -= h) < w) {
    x = r.x + r.w - margin - n;
    y = r.y + r.h - margin;
  } else {
    n -= w;
    x = r.x + margin;
    y = r.y + r.h - margin - n;
  }
  const p = g.map.nearest({ x, y }, 20);
  const a = makeFighter(`zombie-${g.zombies.nextId++}`, "fire", 1, p.x, p.y);
  Object.assign(a, {
    zombieEnemy: true,
    hp: 2,
    maxHp: 2,
    kills: 0,
    deaths: 0,
    zombieTicks: {},
    spawnFlash: 0.5,
  });
  a.zombieNextStep = g.time + (g.zombies.nextId % 8) * 0.02;
  g.fighters.push(a);
  g.zombies.spawned++;
  g.zombieTeams[1].push(a);
  return a;
}
export function beginZombiesFrame(g, dt) {
  if (g.mode !== "zombies") return;
  // Remove spent enemies, retaining fallen allies for Revival and scorekeeping.
  g.fighters = g.fighters.filter((a) => !a.zombieEnemy || a.alive);
  refreshZombieTeams(g);
  g.zombies.credit += g.zombies.rate * dt;
  while (g.zombies.credit >= 1 - 1e-9) {
    g.zombies.credit -= 1;
    spawnZombie(g);
  }
  for (const a of g.zombieTeams[1]) {
    a.zombieFar =
      inWorld(a) &&
      g.zombieTeams[0].every(
        (b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 > 640 ** 2,
      );
  }
}
export function zombieFelled(g, a) {
  if (g.mode !== "zombies") return;
  a.zombieTeleportReady = false;
  if (!a.zombieEnemy) return;
  g.zombies.kills++;
  g.zombies.rate = 1 + g.zombies.kills;
  if (g.random() < 0.3)
    g.healthDrops.push({
      id: a.id,
      x: a.x,
      y: a.y,
      heal: 59.8,
      bornAt: g.time,
    });
}
export function zombieDamage(
  g,
  a,
  b,
  amount,
  ability,
  source,
  reflectable,
  terrain = null,
) {
  if (!b.zombieEnemy || amount <= 0) return null;
  // Contact drain is a continuing effect, not sixty separate hits per second.
  if (ability && !reflectable && source === "ice") {
    const key = a.id + ":" + source;
    if ((b.zombieTicks[key] ?? -Infinity) > g.time) return 0;
    b.zombieTicks[key] = g.time + 1;
  }
  b.hp = Math.max(0, b.hp - 1);
  b.lastDamager = a;
  b.lastDamagedAt = g.time;
  b.flash = 0.16;
  b.hitReact = 0.24;
  if (b.hp === 0) g.fell(b, { killer: a, terrain });
  return 1;
}
export function updateZombies(g) {
  if (g.mode !== "zombies") return;
  const allies = g.fighters.filter(
    (a) => a.team === 0 && a.alive && inWorld(a),
  );
  for (const a of allies) {
    for (const d of g.zombieDrops) {
      if (
        d.owner ||
        a.zombieSkills.length >= 3 ||
        distance(a, d) > 30 ||
        !g.map.lineClear(a, d)
      )
        continue;
      a.zombieSkills.push(d.id);
      d.owner = a.id;
      g.emitSound("token", a);
      g.cue("heal", a, "#b9efff");
    }
  }
  g.healthDrops = g.healthDrops.filter((h) => {
    const a = allies.find(
      (a) => a.hp < a.maxHp && distance(a, h) < 30 && g.map.lineClear(a, h),
    );
    if (!a) return true;
    g.restoreHealth(a, h.heal);
    return false;
  });
}
export function zombiesEnd(g) {
  if (g.mode !== "zombies") return null;
  if (g.fighters.some((a) => a.team === 0 && a.alive)) return false;
  return g.finish(
    1,
    `Survived ${Math.floor(g.time)} seconds · ${g.zombies.kills} Fire defeated`,
  );
}
export function useZombieAbility(g, a, id, hold = true, point = null) {
  const s = zombieAbility(id);
  if (g.mode !== "zombies" || !s || !a.zombieSkills.includes(id)) return false;
  if (!hold) {
    if (id === "shield" && a.shield) {
      g.utility(a, false, "earth");
      a.zombieCooldowns[id] = g.time + 5;
      a.utilityCd = 0;
    }
    return false;
  }
  if (
    !a.alive ||
    !inWorld(a) ||
    g.finished ||
    g.countingDown ||
    a.stagger > 0 ||
    g.time < (a.zombieCooldowns[id] || 0)
  )
    return false;
  if (id === "rebirth" || id === "invisibility") return false;
  if (id === "teleport") {
    if (!point) {
      a.zombieTeleportReady = true;
      a.charging = false;
      return true;
    }
    return g.teleport(a, point.x, point.y);
  }
  if (id === "chasm" && !point) {
    a.chasmReady = true;
    a.charging = false;
    return true;
  }
  const cds = [a.abilityCd, a.utilityCd];
  a.abilityCd = a.utilityCd = 0;
  let used = false;
  try {
    if (id === "chasm") used = g.placeChasm(a, point.x, point.y);
    else if (s.kind === "utility") used = g.utility(a, true, s.form);
    else used = g.cast(a, 2.6, s.form);
  } finally {
    [a.abilityCd, a.utilityCd] = cds;
  }
  if (used !== false) {
    if (id !== "shield") a.zombieCooldowns[id] = g.time + s.cooldown;
    a.charging = false;
    a.charge = 0;
    a.chargeForm = null;
    return true;
  }
  return false;
}
function travel(g, a, to, dt) {
  if (
    !a.zombieWaypoint ||
    g.time >= (a.zombieRouteAt || 0) ||
    distance(a, a.zombieWaypoint) < 15
  ) {
    const cache = (g.zombieRouteCache ??= new Map());
    const key = `${Math.floor(a.x / 64)},${Math.floor(a.y / 64)}:${Math.floor(to.x / 64)},${Math.floor(to.y / 64)}`;
    const saved = cache.get(key);
    if (
      a.zombieEnemy &&
      saved &&
      saved.until > g.time &&
      g.map.lineClear(a, saved.point, 14)
    )
      a.zombieWaypoint = saved.point;
    else {
      a.zombieWaypoint = g.map.route(a, to);
      if (a.zombieEnemy)
        cache.set(key, { point: a.zombieWaypoint, until: g.time + 0.8 });
    }
    if (cache.size > 2048) cache.clear();
    a.zombieRouteAt = g.time + 0.25;
  }
  const p = a.zombieWaypoint,
    d = distance(a, p);
  g.move(a, d > 5 ? p.x - a.x : 0, d > 5 ? p.y - a.y : 0, dt);
}
export function zombieAI(g, a, dt) {
  if (g.mode !== "zombies") return false;
  a.aiControlled = true;
  if (a.prisonHp > 0) {
    if (a.zombieSkills?.includes("teleport")) {
      const p = g.map.nearest({ x: a.x + 130, y: a.y });
      useZombieAbility(g, a, "teleport");
      if (useZombieAbility(g, a, "teleport", true, p)) return true;
    }
    if (a.zombieSkills?.includes("burst")) useZombieAbility(g, a, "burst");
    g.strike(a);
    return true;
  }
  let target = null,
    d = Infinity;
  for (const b of g.enemies(a)) {
    const gap = distance(a, b);
    if (gap < d) {
      target = b;
      d = gap;
    }
  }
  if (a.zombieEnemy) {
    if (target) {
      a.zombieMemory = { x: target.x, y: target.y };
      travel(g, a, target, dt);
    } else if (a.zombieMemory) travel(g, a, a.zombieMemory, dt);
    else g.move(a, 0, 0, dt);
    if (target && d < 69 && g.map.lineClear(a, target)) g.strike(a, target);
    if (target && d < 300 && g.map.lineClear(a, target)) {
      a.fx = (target.x - a.x) / (d || 1);
      a.fy = (target.y - a.y) / (d || 1);
      if (a.charging && a.charge > 0.6) g.releaseCharge(a);
      else if (!a.charging && a.abilityCd <= 0) g.startCharge(a, "fire");
    } else if (a.charging) g.releaseCharge(a);
    return true;
  }
  const leader =
    g.player.alive && inWorld(g.player)
      ? g.player
      : g.zombieTeams[0].find(inWorld);
  const drop =
    a.zombieSkills.length < 3
      ? g.zombieDrops
          .filter(
            (d) =>
              !d.owner &&
              distance(a, d) < 320 &&
              (!leader || distance(leader, d) < 500),
          )
          .sort((b, c) => distance(a, b) - distance(a, c))[0]
      : null;
  if (drop && d > 160) travel(g, a, drop, dt);
  else if (target && d < 180) {
    const point = g.map.nearest({
      x: a.x + ((a.x - target.x) / (d || 1)) * 100,
      y: a.y + ((a.y - target.y) / (d || 1)) * 100,
    });
    travel(g, a, point, dt);
  } else if (leader && distance(a, leader) > 130) travel(g, a, leader, dt);
  else g.move(a, 0, 0, dt);
  for (const id of a.zombieSkills) {
    if (id === "healing" && g.zombieTeams[0].some((b) => b.hp < b.maxHp - 30))
      useZombieAbility(g, a, id);
    else if (id === "revival" && g.revivalTarget(a)) useZombieAbility(g, a, id);
    else if (id === "spring" && a.hp < a.maxHp - 35) useZombieAbility(g, a, id);
    else if (id === "shield") {
      if (d < 90) useZombieAbility(g, a, id);
      else if (a.shield) useZombieAbility(g, a, id, false);
    } else if (id === "burst" && d < 150) useZombieAbility(g, a, id);
    else if (id === "chasm" && target && d < 330)
      useZombieAbility(g, a, id, true, target);
    else if (
      [
        "vog",
        "quicksand",
        "lightning",
        "flood",
        "explosion",
        "telekinesis",
        "prison",
      ].includes(id) &&
      target &&
      d < ({ explosion: 150, vog: 180, quicksand: 180 }[id] || 300)
    )
      useZombieAbility(g, a, id);
    else if (id === "teleport" && target && d < 120) {
      useZombieAbility(g, a, id);
      useZombieAbility(
        g,
        a,
        id,
        true,
        g.map.nearest({
          x: a.x + ((a.x - target.x) / (d || 1)) * 160,
          y: a.y + ((a.y - target.y) / (d || 1)) * 160,
        }),
      );
    } else if (
      id === "portals" &&
      target &&
      d < 180 &&
      !g.portals.owned(a).length
    ) {
      const placing = g.portals.placing;
      useZombieAbility(g, a, id);
      const back = g.map.nearest(
        {
          x: a.x + ((a.x - target.x) / (d || 1)) * 300,
          y: a.y + ((a.y - target.y) / (d || 1)) * 300,
        },
        30,
      );
      const entry = g.map.nearest({ x: a.x + 60, y: a.y }, 30);
      for (const p of [entry, back])
        g.portals.place(a, p.x, p.y, { autonomous: true });
      if (g.portals.owned(a).length < 2)
        for (const p of g.portals.owned(a)) g.portals.close(a, p.id);
      g.portals.placing = placing;
    }
  }
  if (target && d < 360 && g.map.lineClear(a, target)) {
    a.fx = (target.x - a.x) / d || 1;
    a.fy = (target.y - a.y) / d || 0;
    if (!a.charging && !a.shield) g.startCharge(a, "ice");
    if (d < 69) g.strike(a, target);
  } else if (a.charging) g.releaseCharge(a);
  return true;
}
export function drawZombies(c, g, t) {
  if (g.mode !== "zombies") return;
  for (const d of g.zombieDrops) {
    if (d.owner) continue;
    const s = zombieAbility(d.id),
      y = d.y + Math.sin(t * 2 + d.x) * 3;
    c.save();
    c.translate(d.x, y);
    c.shadowColor = "#b0eaff";
    c.shadowBlur = 12;
    c.fillStyle = "#174c65";
    c.strokeStyle = "#b5f3ff";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -23);
    c.lineTo(21, 0);
    c.lineTo(0, 23);
    c.lineTo(-21, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = "#ecfbff";
    c.textAlign = "center";
    c.font = "bold 19px sans-serif";
    c.fillText("+", 0, 7);
    c.font = "bold 13px sans-serif";
    c.fillStyle = "#082635dd";
    const w = c.measureText(s.name).width;
    c.fillRect(-w / 2 - 7, 28, w + 14, 21);
    c.fillStyle = "#d7faff";
    c.fillText(s.name, 0, 43);
    c.restore();
  }
}
