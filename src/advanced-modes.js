import {
  ELEMENTS,
  LEVEL_TWO,
  LEVEL_THREE,
  makeFighter,
  recipe,
  combination,
  nameOf,
} from "./combat.js";
export const GAUNTLET_MODES = ["gauntlet", "gauntlet-team"];
export const isGauntlet = (g) => GAUNTLET_MODES.includes(g.mode);
const pick = (g, list) =>
  list[Math.min(list.length - 1, Math.floor(g.random() * list.length))];
export function initializeAdvanced(g, { element, size, players }) {
  if (g.mode === "rush") {
    g.nextShardAt = 8;
    for (let i = 0; i < 6; i++) spawnShard(g);
  }
  if (g.mode === "roulette") {
    g.nextShuffleAt = 25;
    g.nextForms = null;
  }
  if (isGauntlet(g)) {
    const count = g.mode === "gauntlet" ? 1 : Math.max(2, Math.min(4, size));
    g.fighters = Array.from({ length: count }, (_, i) =>
      makeFighter(
        i ? `ally-${i}` : "player",
        i ? ["air", "light", "earth"][i - 1] : element,
        0,
        280,
        255 + i * 75,
      ),
    );
    for (const a of g.fighters) {
      a.kills = 0;
      a.deaths = 0;
    }
    g.player = g.fighters[0];
    g.wave = 0;
    g.waveRoom = 0;
    g.waveDirection = 1;
    g.waveTravel = false;
    g.intermission = false;
    g.finalWave = false;
    nextWave(g);
  }
}
export function spawnShard(g) {
  const available = Object.keys(ELEMENTS).filter((e) =>
    g.fighters.some(
      (a) =>
        a.alive && !a.echo && combination(a.parts, [e]) && !a.parts.includes(e),
    ),
  );
  if (!available.length) return;
  const parts = [pick(g, available)];
  // Distribute shards across center lanes so neither spawn owns every pickup.
  const spots = g.map?.shardSpots || [
    { x: 390, y: 220 },
    { x: 630, y: 220 },
    { x: 510, y: 290 },
    { x: 390, y: 480 },
    { x: 630, y: 480 },
    { x: 510, y: 410 },
    { x: 280, y: 350 },
    { x: 745, y: 350 },
  ];
  const clear = spots.filter((p) =>
    g.tokens.every((t) => Math.hypot(t.x - p.x, t.y - p.y) > 45),
  );
  if (!clear.length) return;
  g.tokens.push({
    ...pick(g, clear),
    parts,
    neutral: true,
    shard: true,
    souls: [],
    bornAt: g.time,
    expiresAt: g.time + 32,
    portalCooldown: 0.3,
  });
}
export function updateAdvanced(g) {
  if (g.mode === "rush") {
    g.tokens = g.tokens.filter((t) => !t.shard || t.expiresAt > g.time);
    if (g.time >= g.nextShardAt) {
      g.nextShardAt += 8;
      if (g.tokens.filter((t) => t.shard).length < 8) {
        spawnShard(g);
        spawnShard(g);
      }
    }
  }
  if (g.mode === "roulette") {
    if (!g.nextForms && g.time >= g.nextShuffleAt - 5) {
      const pool = [...Object.keys(ELEMENTS), ...LEVEL_TWO, ...LEVEL_THREE];
      g.nextForms = Object.fromEntries(
        g.fighters
          .filter((a) => !a.echo)
          .map((a) => [
            a.id,
            pick(
              g,
              pool.filter((e) => e !== a.element),
            ),
          ]),
      );
    }
    if (g.time >= g.nextShuffleAt) {
      for (const a of g.fighters.filter((a) => !a.echo)) {
        const form = g.nextForms?.[a.id];
        if (!form) continue;
        const previous = { ...a };
        const fresh = makeFighter(a.id, form, a.team, a.x, a.y);
        // Health, incoming status, cooldowns and statistics survive; old forms' powers do not.
        Object.assign(a, fresh, {
          alive: previous.alive,
          respawnAt: previous.respawnAt,
          spawn: { ...previous.spawn, element: form },
          hp: previous.hp,
          maxHp: previous.maxHp,
          kills: previous.kills,
          deaths: previous.deaths,
          fx: previous.fx,
          fy: previous.fy,
          attackCd: previous.attackCd,
          abilityCd: previous.abilityCd,
          utilityCd: previous.utilityCd,
          blind: previous.blind,
          whiteout: previous.whiteout,
          sabotaged: previous.sabotaged,
          prisonHp: previous.prisonHp,
          venom: previous.venom,
          venomSource: previous.venomSource,
          lastDamager: previous.lastDamager,
          lastDamagedAt: previous.lastDamagedAt,
          dimension: previous.dimension,
          transit: previous.transit,
          portalCooldown: previous.portalCooldown,
          spawnFlash: 0.65,
        });
        // Remove ad-hoc properties left by the former elemental (including soul ownership).
        for (const key of [
          "demotedBase",
          "fusedInto",
          "chargeForm",
          "executingForm",
          "portalRoute",
          "aiPlan",
          "searchSpot",
          "lastSeen",
        ])
          delete a[key];
        g.pending = g.pending.filter((p) => p.who !== a);
        g.cue("shatter", a, "#f3d28e");
      }
      g.nextShuffleAt += 25;
      g.nextForms = null;
    }
  }
}
export function fusionScore(g, a, oldTier) {
  if (g.mode !== "rush" || a.echo) return;
  const tier = a.parts.length,
    highest = a.highestTier || oldTier;
  if (tier > highest) {
    g.scores[a.team] += tier === 3 ? 5 : 3;
    a.highestTier = tier;
  }
}
export function rewardChoices(g) {
  if (!isGauntlet(g) || !g.intermission) return [];
  const a = g.player;
  const shards = Object.keys(ELEMENTS).filter(
    (e) => !a.parts.includes(e) && combination(a.parts, [e]),
  );
  return [
    ...shards.map((e) => ({
      id: `shard:${e}`,
      title: `${nameOf(e)} shard`,
      description: `Evolve into ${nameOf(combination(a.parts, [e]))}.`,
    })),
    {
      id: "heal",
      title: "Healing",
      description: "Restore the whole team to full health.",
    },
    {
      id: "upgrade",
      title: "Battle surge",
      description: "+25% damage and +15% movement for the next wave.",
    },
  ];
}
export function chooseReward(g, id) {
  if (
    g.finished ||
    g.rewardRemaining <= 0 ||
    !rewardChoices(g).some((r) => r.id === id)
  )
    return false;
  g.rewardSelection = id;
  return true;
}
export function advanceReward(g, dt) {
  if (
    g.finished ||
    !isGauntlet(g) ||
    !g.intermission ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return;
  g.rewardRemaining = Math.max(0, g.rewardRemaining - dt);
  if (g.rewardRemaining > 1e-9) return;
  const choices = rewardChoices(g);
  const id =
    choices.find((r) => r.id === g.rewardSelection)?.id || choices[0]?.id;
  if (id) applyReward(g, id);
}
function applyReward(g, id) {
  const team = g.fighters.filter((a) => a.team === 0 && !a.echo);
  if (id.startsWith("shard:")) {
    const part = id.slice(6);
    g.applyFusion(g.player, [part], { burst: false });
    g.player.nativeParts = [...g.player.parts];
    for (const a of team.filter((a) => a !== g.player)) {
      const compatible = Object.keys(ELEMENTS).filter(
        (e) => !a.parts.includes(e) && combination(a.parts, [e]),
      );
      if (compatible.length) {
        g.applyFusion(a, [pick(g, compatible)], { burst: false });
        a.nativeParts = [...a.parts];
      }
    }
  } else if (id === "heal") for (const a of team) a.hp = a.maxHp;
  else
    for (const a of team) {
      a.waveDamage = 1.25;
      a.waveSpeed = 1.15;
    }
  g.intermission = false;
  g.rewardRemaining = 0;
  g.rewardSelection = null;
  g.waveTravel = true;
  if (g.waveRoom === 2) g.waveDirection = -1;
  else if (g.waveRoom === 0) g.waveDirection = 1;
  g.nextWaveRoom = g.waveRoom + g.waveDirection;
  const room = g.map.rooms[g.nextWaveRoom];
  g.waveRally = {
    x: room.x + (g.waveDirection > 0 ? 155 : room.w - 155),
    y: 500,
  };
  g.map.activeRoom = null;
  g.map.travelRooms = [g.waveRoom, g.nextWaveRoom].sort((a, b) => a - b);
  g.fighters = team;
  clearWaveEffects(g);
  return true;
}
function clearWaveEffects(g) {
  g.tokens = [];
  g.projectiles = [];
  g.hazards = [];
  g.waves = [];
  g.pending = [];
  g.effects = [];
  g.portals.portals = [];
  g.portals.placing = null;
}
export function advanceWaveTravel(g, dt, input, runAI = true) {
  g.time += dt;
  const team = g.fighters.filter((a) => a.team === 0 && !a.echo && a.alive);
  for (const a of team)
    for (const key of [
      "boost",
      "flash",
      "reflect",
      "spawnFlash",
      "reveal",
      "hurtReveal",
    ])
      a[key] = Math.max(0, (a[key] || 0) - dt);
  g.move(g.player, input.x, input.y, dt);
  for (const a of team) {
    if (a === g.player || !runAI) continue;
    const gap = Math.hypot(a.x - g.player.x, a.y - g.player.y);
    const playerArrived = g.map.inRoom(g.player, g.nextWaveRoom, 70);
    // Stay with the player through the corridor, then assemble inside the room.
    if (playerArrived) g.moveToward(a, g.waveRally, dt);
    else if (gap > 90) g.moveToward(a, g.player, dt);
    else g.move(a, 0, 0, dt);
  }
  if (team.every((a) => g.map.inRoom(a, g.nextWaveRoom, 70))) {
    g.waveRoom = g.nextWaveRoom;
    g.map.activeRoom = g.waveRoom;
    g.map.travelRooms = null;
    g.waveTravel = false;
    nextWave(g);
  }
}
export function nextWave(g) {
  g.intermission = false;
  g.rewardRemaining = 0;
  g.rewardSelection = null;
  g.wave++;
  const team = g.fighters.filter((a) => a.team === 0 && !a.echo);
  g.finalWave = team.some((a) => a.parts.length >= 3);
  const tier = g.wave < 3 ? 1 : g.wave < 5 ? 2 : 3;
  const pool =
    tier === 1 ? Object.keys(ELEMENTS) : tier === 2 ? LEVEL_TWO : LEVEL_THREE;
  const count = g.finalWave ? 1 : Math.min(7, g.wave + team.length);
  const enemies = Array.from({ length: count }, (_, i) => {
    const a = makeFighter(
      `wave-${g.wave}-${i}`,
      g.finalWave ? "invincible" : pick(g, pool),
      1,
      g.map.rooms[g.waveRoom].x +
        (g.waveDirection > 0 ? 640 : 160) +
        (i % 2) * 45,
      500 + (i - (count - 1) / 2) * 65,
    );
    a.hp = a.maxHp = g.finalWave
      ? Math.max(
          180,
          team.reduce((n, b) => n + b.maxHp, 0),
        )
      : 60 + Math.min(90, (g.wave - 1) * 9);
    a.kills = 0;
    a.deaths = 0;
    return a;
  });
  g.fighters = [...team, ...enemies];
  if (g.wave === 1) g.placeMapFighters();
  for (const a of team) {
    a.vx = a.vy = 0;
    a.aiPlan = a.portalRoute = a.lastSeen = a.searchSpot = null;
    a.spawn = { x: a.x, y: a.y, element: a.element };
  }
  clearWaveEffects(g);
}
export function advancedEnd(g) {
  if (g.mode === "roulette") {
    const players = g.fighters.filter((a) => !a.echo);
    if (g.time < 180) return false;
    const high = Math.max(...players.map((a) => a.kills || 0));
    const leaders = players.filter((a) => (a.kills || 0) === high);
    return g.finish(
      leaders.length === 1 ? leaders[0].team : null,
      `Most eliminations · ${high} kills`,
    );
  }
  if (g.mode === "rush") {
    if (g.time < 180) return false;
    return g.finish(
      g.scores[0] === g.scores[1] ? null : g.scores[0] > g.scores[1] ? 0 : 1,
      "Fusion Rush points decided the match",
    );
  }
  if (!isGauntlet(g)) return null;
  const team = g.fighters.filter((a) => a.team === 0 && !a.echo);
  if (!team.some((a) => a.alive))
    return g.finish(1, `Run ended at wave ${g.wave}`);
  if (
    g.intermission ||
    g.waveTravel ||
    g.fighters.some((a) => a.team === 1 && a.alive && !a.echo)
  )
    return false;
  if (g.finalWave)
    return g.finish(0, `Final boss defeated · ${g.wave} waves cleared`);
  g.intermission = true;
  g.rewardRemaining = 7;
  g.rewardSelection = null;
  for (const a of team) {
    if (!a.alive) {
      a.alive = true;
      a.ghost = false;
      a.hp = a.maxHp * 0.5;
    }
    a.waveDamage = a.waveSpeed = 1;
    a.charging = false;
    a.shield = 0;
    a.burst = 0;
    a.blink = null;
    a.abilityCd = a.utilityCd = a.attackCd = 0;
    a.dimension = a.transit = null;
    Object.assign(a, g.map.nearest(a, 24));
    a.vx = a.vy = a.knockX = a.knockY = 0;
    for (const key of [
      "blind",
      "whiteout",
      "venom",
      "venomTint",
      "burn",
      "stagger",
      "prisonHp",
      "slow",
      "hitReact",
      "swing",
      "clash",
      "charge",
    ])
      a[key] = 0;
    a.chasmReady = false;
    a.aiPlan = a.portalRoute = a.lastSeen = a.searchSpot = null;
  }
  g.pending = [];
  return false;
}
