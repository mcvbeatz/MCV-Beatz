import { makeFighter, recipe, ELEMENTS, distance } from "./combat.js";
import { inWorld, segmentDistance } from "./portals.js";
export const EXPLOSION_RADIUS = 150;
export const RACE_ITEMS = [
  ["gravity", "Gravity x2"],
  ["prison", "Stone prison"],
  ["flash", "Flash"],
  ["tornado", "Tornado"],
  ["telekinesis", "Telekinesis"],
  ["randomizer", "Randomizer"],
  ["teleport", "Teleport"],
  ["lightning", "Lightning strikes"],
  ["fireball", "Fire ball"],
  ["laser", "Laser beam"],
  ["hydro", "Hydro pump"],
  ["portals", "Portals"],
  ["explosion", "Explosion"],
];
export const raceItemName = (id) =>
  RACE_ITEMS.find((p) => p[0] === id)?.[1] || "Ability pickup";
const pick = (g, list) =>
  list[Math.min(list.length - 1, Math.floor(g.random() * list.length))];
export function explosion(g, a, damage = true) {
  g.effects.push({
    kind: "fusion",
    x: a.x,
    y: a.y,
    color: "#ffe3a2",
    r: EXPLOSION_RADIUS,
    life: 0.65,
    max: 0.65,
  });
  g.emitSound("fireball", a);
  for (const b of [...g.fighters]) {
    if (
      b === a ||
      (g.mode === "zombies" && b.team === a.team) ||
      !b.alive ||
      !inWorld(b) ||
      distance(a, b) > EXPLOSION_RADIUS ||
      (g.map && !g.map.lineClear(a, b))
    )
      continue;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      d = Math.hypot(dx, dy) || 1;
    b.knockX += (dx / d || (b.team ? 1 : -1)) * 540;
    b.knockY += (dy / d) * 540;
    b.stagger = Math.max(b.stagger, 0.25);
    if (damage) g.damage(a, b, 5, true, false, "explosion", false, true);
  }
  return true;
}
export function ctfCarrierHit(g, source, target) {
  if (
    g.mode !== "ctf" ||
    source === target ||
    !g.flags.some((f) => f.carrier === target.id)
  )
    return false;
  // Drop before detonating so chained carrier explosions cannot recurse.
  for (const flag of g.flags)
    if (flag.carrier === target.id) {
      Object.assign(flag, {
        carrier: null,
        x: target.x,
        y: target.y,
        dropped: true,
      });
    }
  g.fell(target, { killer: source });
  explosion(g, target);
  return true;
}
export function initializeEvents(g) {
  if (!["gridiron", "turnpike"].includes(g.mode)) return;
  g.timeLimit = 180;
  g.respawnDelay = 5;
  g.fusionEnabled = false;
  g.friendlyFire = true;
  g.fighters = Array.from({ length: 8 }, (_, i) => {
    const team = g.mode === "gridiron" ? Math.floor(i / 4) : i;
    const element = g.mode === "gridiron" ? "earth" : "air";
    const p =
      g.mode === "gridiron" ? g.map.teamSpawn(team, i % 4) : g.map.spawn(i);
    const a = makeFighter(i ? `rival-${i}` : "player", element, team, p.x, p.y);
    a.spawn = { ...p, element };
    a.kills = a.deaths = 0;
    if (g.mode === "turnpike")
      Object.assign(a, {
        racing: true,
        raceLaps: 0,
        raceNext: 1,
        raceProgress: 0,
        raceItem: null,
        racePrevious: { ...p },
      });
    return a;
  });
  g.player = g.fighters[0];
  if (g.mode === "gridiron") {
    g.ball = { x: g.map.cx, y: g.map.cy, carrier: null, pickupAt: 0 };
    g.gridGravityOwners = [null, null];
  } else {
    g.raceDrops = [];
    g.nextRaceAbility = 2;
    g.nextRaceFire = 7;
    g.nextRaceHealth = 6;
    for (let i = 0; i < 12; i++)
      spawnRaceDrop(g, "ability", (g.map.trackLength * i) / 12 + 150);
  }
}
export function fumble(g, a) {
  if (g.ball?.carrier !== a.id) return;
  Object.assign(g.ball, {
    carrier: null,
    x: a.x,
    y: a.y,
    pickupAt: g.time + 0.12,
    lastCarrier: a.id,
    lastCarrierUntil: g.time + 0.9,
  });
  g.cue("shatter", a, "#efbd79");
}
export function gridironHit(g, a, target) {
  if (g.mode === "gridiron" && a !== target && !target.shield)
    fumble(g, target);
}
export function updateGridironEvolution(g) {
  if (g.mode !== "gridiron" || g.finished || g.scores[0] === g.scores[1])
    return;
  const team = g.scores[0] < g.scores[1] ? 0 : 1;
  if (g.gridGravityOwners[team]) return;
  const members = g.fighters.filter((a) => a.team === team);
  const deaths = Math.max(...members.map((a) => a.deaths || 0));
  const a = pick(
    g,
    members.filter((a) => (a.deaths || 0) === deaths),
  );
  g.gridGravityOwners[team] = a.id;
  a.element = "gravity";
  a.parts = recipe("gravity");
  a.nativeParts = [...a.parts];
  a.forms = [...a.parts, "gravity"];
  a.form = a.forms.indexOf("gravity");
  a.spawn.element = "gravity";
  a.charging = false;
  a.chargeForm = null;
  if (a.alive) g.cue("fusion", a, "#c59bff");
}
export function passTargets(g, a) {
  if (
    g.mode !== "gridiron" ||
    !a.alive ||
    !inWorld(a) ||
    g.ball.carrier !== a.id
  )
    return [];
  return g.fighters.filter(
    (b) =>
      b !== a &&
      b.team === a.team &&
      b.alive &&
      inWorld(b) &&
      !b.shield &&
      !b.blink &&
      g.map.lineClear(a, b),
  );
}
export function passGridiron(g, a, receiver = null) {
  if (
    g.finished ||
    g.countingDown ||
    a.prisonHp > 0 ||
    a.blink ||
    a.stagger > 0 ||
    g.ball?.pass
  )
    return false;
  const targets = passTargets(g, a);
  if (receiver ? !targets.includes(receiver) : !targets.length) return false;
  receiver ||= targets.sort((b, c) => distance(a, c) - distance(a, b))[0];
  const duration = Math.max(0.18, distance(a, receiver) / 750);
  Object.assign(g.ball, {
    x: a.x,
    y: a.y,
    carrier: null,
    pickupAt: g.time + duration,
    lastCarrier: a.id,
    lastCarrierUntil: g.time + duration + 0.3,
    pass: {
      from: a.id,
      target: receiver.id,
      x: a.x,
      y: a.y,
      toX: receiver.x,
      toY: receiver.y,
      start: g.time,
      duration,
    },
  });
  g.animateCast(a);
  return true;
}
function updatePassFlight(g) {
  const ball = g.ball,
    p = ball.pass;
  if (!p) return false;
  const progress = Math.min(1, Math.max(0, (g.time - p.start) / p.duration));
  const old = { x: ball.x, y: ball.y };
  ball.x = p.x + (p.toX - p.x) * progress;
  ball.y = p.y + (p.toY - p.y) * progress;
  const dx = ball.x - old.x,
    dy = ball.y - old.y,
    length2 = dx * dx + dy * dy;
  const catches = g.fighters
    .filter(
      (a) => a.id !== p.from && a.alive && inWorld(a) && !a.shield && !a.blink,
    )
    .map((a) => {
      const u = length2
        ? Math.max(
            0,
            Math.min(1, ((a.x - old.x) * dx + (a.y - old.y) * dy) / length2),
          )
        : 0;
      return {
        a,
        u,
        gap: Math.hypot(a.x - old.x - u * dx, a.y - old.y - u * dy),
      };
    })
    .filter((c) => c.gap < 26)
    .sort((a, b) => a.u - b.u || a.gap - b.gap);
  if (catches.length) {
    ball.carrier = catches[0].a.id;
    ball.x = catches[0].a.x;
    ball.y = catches[0].a.y;
    ball.pass = null;
    ball.pickupAt = g.time;
    return false;
  }
  if (progress >= 1) {
    ball.pass = null;
    ball.pickupAt = g.time;
    return false;
  }
  return true;
}

export function updateGridiron(g) {
  if (g.mode !== "gridiron") return;
  updateGridironEvolution(g);
  const ball = g.ball;
  if (updatePassFlight(g)) return;
  let carrier = g.fighters.find((a) => a.id === ball.carrier);
  if (carrier && (!carrier.alive || !inWorld(carrier))) {
    fumble(g, carrier);
    carrier = null;
  }
  if (carrier) {
    ball.x = carrier.x;
    ball.y = carrier.y;
  }
  const zone = g.map.endZones.find(
    (z) =>
      ball.x >= z.x &&
      ball.x <= z.x + z.w &&
      ball.y >= z.y &&
      ball.y <= z.y + z.h,
  );
  if (zone) {
    const team = 1 - zone.team;
    g.scores[team]++;
    if (g.suddenDeath) {
      g.finish(team, "Sudden-death touchdown");
      return;
    }
    updateGridironEvolution(g);
    for (const a of g.fighters) g.respawn(a);
    g.projectiles = [];
    g.hazards = [];
    g.waves = [];
    g.pending = [];
    const receivingTeam = g.fighters.filter((a) => a.team === zone.team);
    const kills = Math.max(...receivingTeam.map((a) => a.kills || 0));
    const receiver = pick(
      g,
      receivingTeam.filter((a) => (a.kills || 0) === kills),
    );
    Object.assign(ball, {
      x: receiver.x,
      y: receiver.y,
      carrier: receiver.id,
      pickupAt: g.time,
      lastCarrier: null,
      pass: null,
    });
    g.cue("heal", ball, "#f5d28b");
    return;
  }
  if (!carrier && g.time >= ball.pickupAt) {
    const candidates = g.fighters.filter(
      (a) =>
        a.alive &&
        inWorld(a) &&
        !a.shield &&
        !(a.id === ball.lastCarrier && g.time < ball.lastCarrierUntil) &&
        distance(a, ball) < 28,
    );
    const closest = Math.min(...candidates.map((a) => distance(a, ball)));
    carrier = pick(
      g,
      candidates.filter((a) => distance(a, ball) <= closest + 2),
    );
    if (carrier) {
      ball.carrier = carrier.id;
      g.emitSound("token", carrier);
    }
  }
}
export function eventEnd(g) {
  if (g.mode === "ctf") {
    const winner = g.scores.findIndex((score) => score >= 3);
    if (winner >= 0)
      return g.finish(
        winner,
        g.suddenDeath ? "Sudden-death capture" : "Three flags captured",
      );
    if (g.time < 180) return false;
    if (g.scores[0] === g.scores[1]) {
      g.suddenDeath = true;
      return false;
    }
    return g.finish(
      g.scores[0] > g.scores[1] ? 0 : 1,
      g.suddenDeath ? "Sudden-death capture" : "Most flags at three minutes",
    );
  }
  if (g.mode === "gridiron") {
    if (g.time < 180) return false;
    if (g.scores[0] === g.scores[1]) {
      g.suddenDeath = true;
      return false;
    }
    return g.finish(
      g.scores[0] > g.scores[1] ? 0 : 1,
      "Touchdowns at full time",
    );
  }
  if (g.mode === "turnpike") {
    const racers = [...g.fighters].sort(
      (a, b) => b.raceLaps - a.raceLaps || b.raceProgress - a.raceProgress,
    );
    if (!racers.some((a) => a.raceLaps >= 3) && g.time < 180) return false;
    const tied = racers.filter(
      (a) => Math.abs(a.raceProgress - racers[0].raceProgress) < 0.01,
    );
    return g.finish(
      tied.length === 1 ? racers[0].team : null,
      racers[0].raceLaps >= 3
        ? "Three laps complete"
        : "Farthest racer at three minutes",
    );
  }
  return null;
}
// Steer toward distinct tactical positions while keeping bodies apart. Exact
// overlaps get opposing, deterministic directions instead of a zero vector.
function gridironMove(g, a, goal, living, dt) {
  let dx = goal.x - a.x,
    dy = goal.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 4) dx = dy = 0;
  else {
    dx /= Math.max(30, length);
    dy /= Math.max(30, length);
  }
  const index = g.fighters.indexOf(a);
  for (const b of living) {
    if (b === a) continue;
    let x = a.x - b.x,
      y = a.y - b.y,
      d = Math.hypot(x, y);
    const clearance = b.team === a.team ? 82 : 64;
    if (d >= clearance) continue;
    if (d < 0.01) {
      const other = g.fighters.indexOf(b);
      const angle =
        (Math.min(index, other) * 7 + Math.max(index, other) * 13) * 2.39996;
      const sign = index < other ? 1 : -1;
      x = Math.cos(angle) * sign;
      y = Math.sin(angle) * sign;
      d = 1;
    }
    const pressure = ((clearance - d) / clearance) * 3;
    dx += (x / d) * pressure;
    dy += (y / d) * pressure;
  }
  g.move(a, dx, dy, dt);
}
// Take safe forward gains, or use any open receiver to escape pressure.
function gridironAIPass(g, a, rivals) {
  const pressured = rivals.filter((b) => distance(a, b) <= 130).length >= 2;
  const direction = a.team === 0 ? 1 : -1;
  const open = passTargets(g, a).filter(
    (b) =>
      !b.prisonHp &&
      (pressured || (b.x - a.x) * direction >= 100) &&
      rivals.every((rival) => {
        if (distance(b, rival) < 170) return false;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          length2 = dx * dx + dy * dy;
        const u = length2
          ? Math.max(
              0,
              Math.min(
                1,
                ((rival.x - a.x) * dx + (rival.y - a.y) * dy) / length2,
              ),
            )
          : 0;
        return Math.hypot(rival.x - a.x - u * dx, rival.y - a.y - u * dy) > 45;
      }),
  );
  const safety = (b) => Math.min(400, ...rivals.map((r) => distance(b, r)));
  const value = (b) =>
    safety(b) + (b.x - a.x) * direction * (pressured ? 0.2 : 1);
  open.sort((b, c) => value(c) - value(b));
  if (!open.length || !passGridiron(g, a, open[0])) return false;
  if (a.shield) g.utility(a, false, "earth");
  return true;
}
// Defenders aim for the ball's remaining flight path, rather than its old position.
function passIntercept(g, a) {
  const p = g.ball.pass,
    dx = p.toX - g.ball.x,
    dy = p.toY - g.ball.y,
    length2 = dx * dx + dy * dy;
  const u = length2
    ? Math.max(
        0,
        Math.min(1, ((a.x - g.ball.x) * dx + (a.y - g.ball.y) * dy) / length2),
      )
    : 1;
  const point = { x: g.ball.x + u * dx, y: g.ball.y + u * dy };
  const remaining = Math.max(0, p.start + p.duration - g.time);
  return distance(a, point) <= remaining * u * 150 + 26
    ? point
    : { x: p.toX, y: p.toY };
}
export function gridironAI(g, a, dt) {
  a.aiControlled = true;
  const living = g.fighters.filter((b) => b.alive && inWorld(b));
  const team = living.filter((b) => b.team === a.team);
  const slot = g.fighters.filter((b) => b.team === a.team).indexOf(a);
  const carrier = living.find((b) => b.id === g.ball.carrier);
  const pass = g.ball.pass;
  const passer = pass && g.fighters.find((b) => b.id === pass.from);
  const rivals = g.enemies(a);
  const nearest = [...rivals].sort(
    (b, c) => distance(a, b) - distance(a, c),
  )[0];
  const direction = a.team ? -1 : 1;
  let target = nearest,
    goal;
  if (!a.gridActionOrigin || distance(a, a.gridActionOrigin) > 30) {
    a.gridActionOrigin = { x: a.x, y: a.y };
    if (a.aiNeedChange || a.aiRepeat >= 3) {
      a.aiLastGesture = "reposition";
      a.aiRepeat = 0;
      a.aiNeedChange = false;
    }
  }
  const flank = (opponent) => {
    const angle = (slot * Math.PI) / 2 + Math.PI / 4 + (a.gridFlank || 0);
    return g.map.nearest({
      x: opponent.x + Math.cos(angle) * 52,
      y: opponent.y + Math.sin(angle) * 52,
    });
  };
  if (carrier === a && gridironAIPass(g, a, rivals)) return;
  if (g.ball.pass?.target === a.id) {
    // Stay at the receiving spot rather than chasing the ball's launch position.
    goal = { x: g.ball.pass.toX, y: g.ball.pass.toY };
  } else if (pass && passer?.team !== a.team) {
    const defenders = team.filter((b) => b.id !== "player");
    const interceptor = defenders.sort(
      (b, c) =>
        distance(b, passIntercept(g, b)) - distance(c, passIntercept(g, c)),
    )[0];
    target = living.find((b) => b.id === pass.target) || nearest;
    goal =
      interceptor === a
        ? passIntercept(g, a)
        : target
          ? flank(target)
          : { x: pass.toX, y: pass.toY };
  } else if (pass) {
    const receiver = living.find((b) => b.id === pass.target);
    goal = g.map.nearest({
      x: pass.toX - direction * 80,
      y: pass.toY + (slot - 1.5) * 90,
    });
    target = receiver
      ? rivals.sort((b, c) => distance(b, receiver) - distance(c, receiver))[0]
      : nearest;
  } else if (carrier === a) {
    goal = { x: a.team ? 260 : 1540, y: a.y };
  } else if (carrier && carrier.team !== a.team) {
    const defenders = team
      .filter((b) => b.id !== "player")
      .sort((b, c) => distance(b, carrier) - distance(c, carrier));
    const receivers = passTargets(g, carrier).sort((b, c) =>
      b.id.localeCompare(c.id),
    );
    const rank = defenders.indexOf(a);
    if (rank > 0 && receivers.length && distance(a, carrier) > 90) {
      target = receivers[(rank - 1) % receivers.length];
      const d = distance(target, carrier) || 1;
      goal = g.map.nearest({
        x: target.x + ((carrier.x - target.x) / d) * 38,
        y: target.y + ((carrier.y - target.y) / d) * 38,
      });
    } else {
      target = rivals.includes(carrier) ? carrier : nearest;
      goal = target ? flank(target) : g.ball;
    }
  } else if (carrier) {
    const escorts = team.filter((b) => b !== carrier);
    const rank = escorts.indexOf(a);
    const threats = rivals
      .filter((b) => distance(b, carrier) < 300)
      .sort((b, c) => distance(b, carrier) - distance(c, carrier));
    target = threats.length ? threats[rank % threats.length] : nearest;
    if (rank === escorts.length - 1) {
      const routes = [-170, 170].map((side) =>
        g.map.nearest({ x: carrier.x + direction * 230, y: carrier.y + side }),
      );
      routes.sort(
        (b, c) =>
          Math.min(500, ...rivals.map((r) => distance(c, r))) -
          Math.min(500, ...rivals.map((r) => distance(b, r))),
      );
      goal = routes[0];
    } else
      goal = threats.length
        ? flank(target)
        : g.map.nearest({
            x: carrier.x + direction * 100,
            y: carrier.y + (rank - 1) * 120,
          });
  } else {
    const collector = [...team].sort(
      (b, c) => distance(b, g.ball) - distance(c, g.ball),
    )[0];
    goal =
      collector === a
        ? g.ball
        : nearest && distance(a, nearest) < 260
          ? flank(nearest)
          : g.map.nearest({
              x: g.ball.x + direction * 85,
              y: g.ball.y + (slot - 1.5) * 100,
            });
  }
  if (a.shield && (carrier !== a || !nearest || distance(a, nearest) > 95))
    g.utility(a, false, "earth");
  if (carrier === a && nearest && distance(a, nearest) < 85 && a.utilityCd <= 0)
    g.utility(a, true, "earth");
  if (
    target &&
    carrier !== a &&
    !pass &&
    g.time >= (a.gridFlankAt || 0) &&
    (a.aiNeedChange || (distance(a, target) < 75 && !g.safeAttack(a, target)))
  ) {
    a.gridFlank = (a.gridFlank || 0) + Math.PI / 3;
    a.gridFlankAt = g.time + 0.7;
    goal = flank(target);
  }
  gridironMove(g, a, goal, living, dt);
  // autoLock prefers an opposing carrier in reach, also during strike resolution.
  const attackTarget = g.target(a) || target;
  if (
    attackTarget &&
    distance(a, attackTarget) <= 69 &&
    g.safeAttack(a, attackTarget)
  )
    g.strike(a, attackTarget);
  if (a.element === "gravity" && target && distance(a, target) < 300)
    g.telekinesis(a, target, target.x - a.x, target.y - a.y);
}
export function setRaceForm(a, element) {
  a.element = element;
  a.parts = recipe(element);
  a.nativeParts = [...a.parts];
  a.forms = [element];
  a.form = 0;
  a.charging = false;
  a.chargeForm = null;
  a.shield = 0;
  a.burst = 0;
  a.spawnFlash = 0.5;
}
export function raceFelled(g, a) {
  if (g.mode !== "turnpike") return;
  a.ghost = true;
  a.lost = false;
  a.raceBoostUntil = 0;
  a.raceTeleportReady = false;
  setRaceForm(a, "spirit");
}
export function raceSnapshot(g, a) {
  if (g.mode !== "turnpike") return {};
  const state = Object.fromEntries(
    Object.entries(a).filter(
      ([key]) => key.startsWith("race") || key === "racing",
    ),
  );
  state.racePrevious = { x: a.x, y: a.y };
  state.raceTeleportReady = false;
  a.spawn = { x: a.x, y: a.y, element: "air" };
  return state;
}
export function spawnRaceDrop(g, kind, progress) {
  const p = g.map.trackAt(progress);
  const lateral = (g.random() - 0.5) * 70;
  g.raceDrops.push({
    kind,
    item: kind === "ability" ? pick(g, RACE_ITEMS)[0] : null,
    x: p.x - p.dy * lateral,
    y: p.y + p.dx * lateral,
    expires: g.time + 22,
  });
}
export function updateRace(g) {
  if (g.mode !== "turnpike") return;
  const alive = g.fighters.filter((a) => a.alive && inWorld(a));
  for (const a of g.fighters) {
    if (!inWorld(a)) {
      a.racePrevious = { x: a.x, y: a.y };
      continue;
    }
    if (a.raceBoostUntil && g.time >= a.raceBoostUntil) {
      setRaceForm(a, a.racePreBoost || "air");
      a.raceBoostUntil = 0;
    }
    const projection = g.map.projectTrack(a);
    const previous = a.racePrevious || a;
    const gate = g.map.checkpoints[a.raceNext % 16];
    if (
      projection.gap <= g.map.trackRadius &&
      segmentDistance(gate, previous, a) <= g.map.trackRadius &&
      (a.x - previous.x) * gate.dx + (a.y - previous.y) * gate.dy > 0 &&
      distance(previous, a) < 250
    ) {
      a.raceNext++;
      if (a.raceNext > 16) {
        a.raceLaps++;
        a.raceNext = 1;
        g.cue("heal", a, "#f5e5aa");
      }
    }
    const completed = a.raceNext - 1,
      step = g.map.trackLength / 16;
    const local = Math.max(
      0,
      Math.min(step - 0.01, projection.progress - completed * step),
    );
    a.raceProgress = a.raceLaps * g.map.trackLength + completed * step + local;
    a.racePrevious = { x: a.x, y: a.y };
    if (!a.alive) continue;
    for (const drop of g.raceDrops) {
      if (drop.removed || distance(a, drop) > 28) continue;
      if (drop.kind === "ability") {
        if (a.raceItem) continue;
        a.raceItem = drop.item;
      } else if (drop.kind === "health") {
        if (a.hp >= a.maxHp) continue;
        g.restoreHealth(a, 59.8);
      } else {
        if (a.raceBoostUntil > g.time) continue;
        a.racePreBoost = a.element;
        setRaceForm(a, "blaze");
        a.raceBoostUntil = g.time + 7;
      }
      drop.removed = true;
      if (drop.kind !== "health") g.emitSound("token", a);
    }
  }
  for (const h of g.hazards.filter(
    (h) => h.kind === "randomizer" && h.life > 0 && g.time >= h.opensAt,
  )) {
    const touching = alive.filter((a) => distance(a, h) <= h.r);
    for (const a of touching)
      if (!h.occupants.has(a.id)) {
        if (a.parts.length > 1) {
          g.demote(a);
          a.forms = [a.element];
          a.form = 0;
        } else
          setRaceForm(
            a,
            pick(
              g,
              Object.keys(ELEMENTS).filter((e) => e !== a.element),
            ),
          );
        a.raceBoostUntil = 0;
      }
    h.occupants = new Set(touching.map((a) => a.id));
  }
  g.raceDrops = g.raceDrops.filter((d) => !d.removed && d.expires > g.time);
  if (g.time >= g.nextRaceAbility) {
    g.nextRaceAbility = g.time + 2 + g.random() * 2;
    for (let i = 0; i < 3; i++)
      spawnRaceDrop(g, "ability", g.random() * g.map.trackLength);
  }
  const racers = g.fighters.filter(inWorld);
  if (racers.length && g.time >= g.nextRaceFire) {
    g.nextRaceFire = g.time + 7 + g.random() * 4;
    const last = [...racers].sort((a, b) => a.raceProgress - b.raceProgress)[0];
    spawnRaceDrop(
      g,
      "fire",
      g.map.projectTrack(last).progress + 120 + g.random() * 100,
    );
  }
  if (alive.length && g.time >= g.nextRaceHealth) {
    g.nextRaceHealth = g.time + 6 + g.random() * 4;
    const lowest = [...alive].sort(
      (a, b) => a.hp / a.maxHp - b.hp / b.maxHp,
    )[0];
    if (lowest.hp < lowest.maxHp)
      spawnRaceDrop(
        g,
        "health",
        g.map.projectTrack(lowest).progress + 120 + g.random() * 100,
      );
  }
}
export function useRaceItem(g, a) {
  if (
    g.mode !== "turnpike" ||
    !a.alive ||
    !inWorld(a) ||
    !a.raceItem ||
    g.finished ||
    g.countingDown ||
    a.stagger > 0 ||
    g.time < (a.raceItemReadyAt || 0)
  )
    return false;
  const item = a.raceItem;
  if (item === "teleport") {
    a.raceTeleportReady = true;
    return true;
  }
  const cds = [a.abilityCd, a.utilityCd];
  a.raceCasting = true;
  a.abilityCd = a.utilityCd = 0;
  let used = false;
  try {
    if (item === "gravity") used = g.utility(a, true, "gravity");
    else if (item === "prison") used = g.utility(a, true, "terraformer");
    else if (item === "flash") used = g.utility(a, true, "light");
    else if (item === "tornado") used = g.cast(a, 1, "cloud");
    else if (item === "telekinesis") used = g.cast(a, 1, "gravity");
    else if (item === "lightning") used = g.cast(a, 1, "lightning");
    else if (item === "laser") used = g.cast(a, 1, "sun");
    else if (item === "hydro") used = g.cast(a, 1, "water");
    else if (item === "explosion") used = explosion(g, a);
    else if (item === "fireball") {
      g.projectile(a, 1, {
        kind: "flame",
        speed: 600,
        r: 17,
        damage: 20,
        life: 0.9,
      });
      g.emitSound("fireball", a);
      used = true;
    } else if (item === "randomizer") {
      g.area(a, 1, "randomizer", 66, 14);
      Object.assign(g.hazards.at(-1), {
        opensAt: g.time + 0.5,
        occupants: new Set(),
      });
      g.emitSound("death", a);
      used = true;
    } else if (item === "portals") {
      for (const p of g.portals.owned(a)) g.portals.close(a, p.id);
      used = g.portals.begin(a);
    }
  } finally {
    a.raceCasting = false;
    [a.abilityCd, a.utilityCd] = cds;
  }
  if (used !== false) {
    a.raceItem = null;
    a.raceItemReadyAt = g.time + 0.6;
    g.animateCast(a);
    return true;
  }
  return false;
}
export function raceAI(g, a, dt) {
  a.aiControlled = true;
  if (a.prisonHp > 0) {
    if (a.raceItem === "teleport") {
      useRaceItem(g, a);
      const p = g.map.trackAt(g.map.projectTrack(a).progress + 170);
      if (a.raceTeleportReady && g.teleport(a, p.x, p.y)) return;
    }
    if (a.element === "blaze") g.utility(a, true, "blaze");
    g.strike(a);
    return;
  }
  if (a.alive && a.element === "air" && a.utilityCd <= 0)
    g.utility(a, true, "air");
  const projection = g.map.projectTrack(a);
  const goal =
    projection.gap > g.map.trackRadius
      ? projection
      : g.map.trackAt(projection.progress + 75);
  g.move(a, goal.x - a.x, goal.y - a.y, dt);
  if (!a.alive) return;
  const rival = g.enemies(a).sort((b, c) => distance(a, b) - distance(a, c))[0];
  if (rival && distance(a, rival) < 69) g.strike(a, rival);
  if (a.element === "blaze" && !a.burst) g.utility(a, true, "blaze");
  if (
    a.raceItem &&
    (!rival ||
      distance(a, rival) < 400 ||
      ["teleport", "portals", "randomizer"].includes(a.raceItem))
  ) {
    const item = a.raceItem;
    useRaceItem(g, a);
    if (item === "teleport" && a.raceTeleportReady) {
      const p = g.map.trackAt(projection.progress + 170);
      g.teleport(a, p.x, p.y);
    }
    if (item === "portals" && g.portals.placing === a.id) {
      for (const offset of [80, 280]) {
        const p = g.map.trackAt(projection.progress + offset);
        g.portals.place(a, p.x, p.y, { autonomous: true });
      }
      if (g.portals.owned(a).length < 2) {
        for (const p of g.portals.owned(a)) g.portals.close(a, p.id);
      }
      g.portals.placing = null;
    }
  }
}
