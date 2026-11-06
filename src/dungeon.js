import {
  makeFighter,
  ELEMENTS,
  combination,
  nameOf,
  inWorld,
} from "./combat.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = (g, items) =>
  items[Math.min(items.length - 1, Math.floor(g.random() * items.length))];
export function initializeDungeon(g, element) {
  if (g.mode !== "dungeon") return;
  const p = makeFighter(
    "player",
    ELEMENTS[element] ? element : "fire",
    0,
    g.map.entry.x,
    g.map.entry.y,
  );
  p.kills = p.deaths = 0;
  p.spawn = { x: p.x, y: p.y, element: p.element };
  g.player = p;
  g.fighters = [p];
  g.healthDrops = [];
  g.dungeon = {
    defeated: [],
    reward: null,
    key: null,
    hasKey: false,
    doorOpen: false,
  };
  const centers = [
    [400, 1530],
    [625, 1660],
    [440, 870],
    [530, 650],
    [685, 1190],
    [1050, 1210],
    [1190, 1550],
    [1530, 1850],
    [1800, 1730],
    [2170, 1850],
    [2480, 1580],
    [2540, 1830],
    [2370, 1280],
    [2140, 850],
    [2530, 600],
  ];
  centers.forEach(([x, y], i) => {
    const kind =
      i < 3
        ? ["alligator", "snake", "wolf"][i]
        : pick(g, ["alligator", "snake", "wolf"]);
    const a = makeFighter(
      `monster-${i}`,
      "water",
      1,
      x + (g.random() - 0.5) * 65,
      y + (g.random() - 0.5) * 65,
    );
    Object.assign(a, {
      element: "beast",
      base: "beast",
      parts: [],
      nativeParts: [],
      forms: [],
      monsterKind: kind,
      skillsDisabled: true,
      hp: { alligator: 65, snake: 38, wolf: 48 }[kind],
      waveSpeed: { alligator: 0.72, snake: 0.85, wolf: 1.05 }[kind],
      waveDamage: 0.55,
      kills: 0,
      deaths: 0,
      dungeonSection: i >= 12 ? 1 : 0,
    });
    a.maxHp = a.hp;
    a.home = { x: a.x, y: a.y };
    g.fighters.push(a);
  });
  for (const [role, form, x, y, hp, section] of [
    ["water", "water", 1410, 1640, 210, 0],
    ["apparition", "apparition", 2400, 790, 240, 1],
    ["final", "terraformer", 1280, 450, 420, 2],
  ]) {
    const a = makeFighter(`dungeon-${role}`, form, 1, x, y);
    Object.assign(a, {
      dungeonRole: role,
      dungeonSection: section,
      hp,
      maxHp: hp,
      waveDamage: 0.9,
      waveSpeed: 0.9,
      home: { x, y },
      kills: 0,
      deaths: 0,
    });
    g.fighters.push(a);
  }
}
export function dungeonActorAvailable(g, a) {
  return (
    g.mode !== "dungeon" ||
    a.team === 0 ||
    !a.dungeonSection ||
    a.dungeonSection <= g.map.dungeonStage
  );
}
export function dungeonFelled(g, a) {
  if (g.mode !== "dungeon" || a.team === 0 || a.echo) return;
  if (a.monsterKind) {
    g.healthDrops.push({ id: a.id, x: a.x, y: a.y, heal: 32, bornAt: g.time });
    return;
  }
  if (!a.dungeonRole || g.dungeon.defeated.includes(a.dungeonRole)) return;
  g.dungeon.defeated.push(a.dungeonRole);
  if (a.dungeonRole === "final") return;
  g.dungeon.reward = { boss: a.dungeonRole, x: a.x, y: a.y };
  if (a.dungeonRole === "apparition")
    g.dungeon.key = {
      ...g.map.nearest({ x: a.x + 36, y: a.y }, 24),
      collected: false,
    };
  // Finish the encounter cleanly so the player can make an unhurried choice.
  g.player.charging = false;
  g.player.charge = 0;
}
export function dungeonRewards(g) {
  if (!g.dungeon?.reward) return [];
  return Object.keys(ELEMENTS)
    .filter(
      (e) => !g.player.parts.includes(e) && combination(g.player.parts, [e]),
    )
    .map((e) => ({
      id: `shard:${e}`,
      title: `${nameOf(e)} token`,
      description: `Collect it to become ${nameOf(combination(g.player.parts, [e]))}.`,
    }));
}
export function chooseDungeonReward(g, id) {
  if (g.finished || !dungeonRewards(g).some((r) => r.id === id)) return false;
  const r = g.dungeon.reward;
  g.dropToken({
    x: r.x,
    y: r.y,
    parts: [id.slice(6)],
    team: 0,
    neutral: true,
    shard: true,
    souls: [],
    portalCooldown: 0.3,
    bornAt: g.time,
  });
  if (r.boss === "water") g.map.dungeonStage = 1;
  g.dungeon.reward = null;
  return true;
}
export function updateDungeon(g) {
  if (g.mode !== "dungeon" || !g.player.alive || !inWorld(g.player)) return;
  const p = g.player;
  g.healthDrops = g.healthDrops.filter((h) => {
    if (distance(p, h) > 30 || p.hp >= p.maxHp || !g.map.lineClear(p, h, 0))
      return true;
    g.restoreHealth(p, h.heal);
    g.cue("heal", p, "#92f5c8");
    return false;
  });
  const key = g.dungeon.key;
  if (
    key &&
    !key.collected &&
    distance(p, key) < 38 &&
    g.map.lineClear(p, key, 0)
  ) {
    key.collected = true;
    g.dungeon.hasKey = true;
    g.emitSound("key", p);
  }
  const gate = g.map.gates[1];
  if (
    g.dungeon.hasKey &&
    !g.dungeon.doorOpen &&
    distance(p, { x: gate.x + 80, y: gate.y + 85 }) < 140
  ) {
    g.dungeon.doorOpen = true;
    g.dungeon.hasKey = false;
    g.map.dungeonStage = 2;
    g.cue("portal", { x: gate.x, y: gate.y + 85 }, "#9affed");
  }
}
export function dungeonEnd(g) {
  if (g.mode !== "dungeon") return null;
  if (!g.player.alive) return g.finish(1, "Felled in the Drowned Vault");
  if (g.dungeon.defeated.includes("final"))
    return g.finish(0, "Dungeon cleared · Terraformer defeated");
  return false;
}
function toward(g, a, to, dt) {
  const next = g.map.route(a, to),
    d = distance(a, next);
  g.move(a, d > 3 ? (next.x - a.x) / d : 0, d > 3 ? (next.y - a.y) / d : 0, dt);
}
export function dungeonAI(g, a, dt) {
  if (g.mode !== "dungeon" || a.team === 0) return false;
  if (!dungeonActorAvailable(g, a)) {
    a.vx = a.vy = 0;
    return true;
  }
  if (a.prisonHp > 0) {
    g.strike(a);
    return true;
  }
  if (!a.home) return false; // summoned copies use their elemental AI
  const p = g.player,
    d = distance(a, p),
    leash = a.monsterKind ? 420 : 550;
  if (distance(a, a.home) > leash || d > leash + 120) {
    toward(g, a, a.home, dt);
    a.awake = false;
    return true;
  }
  if (d < (a.monsterKind ? 280 : 400) && g.map.lineClear(a, p)) a.awake = true;
  if (!a.awake) {
    if (!a.roam || g.time > a.roamUntil) {
      a.roam = g.map.nearest(
        {
          x: a.home.x + (g.random() - 0.5) * 130,
          y: a.home.y + (g.random() - 0.5) * 130,
        },
        24,
      );
      a.roamUntil = g.time + 3 + g.random() * 3;
    }
    toward(g, a, a.roam, dt);
    return true;
  }
  if (!a.monsterKind) return false;
  if (!g.canSee(a, p)) {
    g.move(a, 0, 0, dt);
    return true;
  }
  if (d > 45) toward(g, a, p, dt);
  else g.move(a, 0, 0, dt);
  if (d < 65 && g.map.lineClear(a, p)) g.strike(a);
  return true;
}
export function dungeonObjective(g) {
  if (!g.dungeon.defeated.includes("water")) return "FIND THE WATER WARDEN";
  if (!g.dungeon.defeated.includes("apparition"))
    return "UPPER WING OPEN · FIND APPARITION";
  if (!g.dungeon.key?.collected) return "COLLECT THE VAULT KEY";
  if (!g.dungeon.doorOpen) return "KEY FOUND · FIND THE VAULT DOOR";
  return "DEFEAT TERRAFORMER";
}
