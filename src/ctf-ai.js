import { inWorld } from "./portals.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Objectives are reconsidered as defenders move or fall. Only visible rivals
// inform combat assignments; flag possession itself remains public information.
export function ctfObjective(g, a) {
  a.ctfTarget = null;
  const own = g.flags[a.team],
    enemy = g.flags[1 - a.team];
  const choose = (role, goal, target = null) => {
    a.ctfRole = role;
    a.ctfTarget = target?.id || null;
    return goal;
  };
  if (enemy.carrier === a.id)
    return choose("return", own.dropped ? own : own.home);
  const thief = g.fighters.find(
    (b) => b.id === own.carrier && b.alive && inWorld(b),
  );
  if (thief) return choose("recover", thief, thief);
  if (own.dropped) return choose("recover", own);
  const squad = g.fighters.filter(
    (b) => b.team === a.team && !b.echo && b.alive && inWorld(b),
  );
  const visible = g.enemies(a);
  const defender = squad.length > 1 ? squad.at(-1) : null;
  if (a === defender) {
    const intruder = visible
      .filter((b) => distance(b, own.home) < 230)
      .sort((b, c) => distance(b, own.home) - distance(c, own.home))[0];
    return choose(
      "defend",
      intruder ||
        g.floorPoint({ x: own.home.x + (a.team ? -65 : 65), y: own.home.y }),
      intruder,
    );
  }
  const carrier = g.fighters.find(
    (b) => b.id === enemy.carrier && b.alive && inWorld(b),
  );
  if (carrier) {
    const threat = visible
      .filter((b) => distance(b, carrier) < 230)
      .sort(
        (b, c) =>
          distance(b, carrier) + b.hp * 0.4 - distance(c, carrier) - c.hp * 0.4,
      )[0];
    if (threat) return choose("escort", threat, threat);
    const d = distance(carrier, own.home) || 1;
    const lane = squad.indexOf(a) % 2 ? -45 : 45;
    return choose(
      "escort",
      g.floorPoint({
        x:
          carrier.x +
          ((own.home.x - carrier.x) / d) * 80 -
          ((own.home.y - carrier.y) / d) * lane,
        y:
          carrier.y +
          ((own.home.y - carrier.y) / d) * 80 +
          ((own.home.x - carrier.x) / d) * lane,
      }),
    );
  }
  const guards = visible.filter((b) => distance(b, enemy) < 210);
  const attackers = squad.filter((b) => b !== defender);
  // One runner exploits the other attackers drawing the guards away. When the
  // flag is exposed, everyone advances instead of chasing displaced defenders.
  const runner = attackers[0];
  const guard = guards.sort(
    (b, c) => distance(a, b) + b.hp * 0.8 - distance(a, c) - c.hp * 0.8,
  )[0];
  if (guard && a !== runner && distance(a, enemy) < 430)
    return choose("assault", guard, guard);
  return choose("steal", enemy);
}

// A committed weighted graph route varies approaches without random steering
// every frame. Previous attempts and teammates' reserved corridors cost more.
function planRoute(g, a, goal, key) {
  const map = g.map,
    start = map.cellAt(a),
    end = map.cellAt(goal);
  g.ctfRouteHistory ||= new Map();
  const previous = g.ctfRouteHistory.get(a.id) || [];
  const used = new Set(previous);
  const reserved = new Set(
    g.fighters
      .filter((b) => b !== a && b.alive && b.team === a.team)
      .flatMap((b) => b.ctfRoute?.cells || []),
  );
  const avoid = a.ctfRole === "steal" || a.ctfRole === "return";
  const rivals = g.enemies(a);
  const costs = map.cells.map(
    (point, id) =>
      1 +
      g.random() * 1.5 +
      (used.has(id) ? 2.5 : 0) +
      (reserved.has(id) ? 1.2 : 0) +
      (avoid
        ? rivals.reduce((n, b) => n + (distance(point, b) < 160 ? 4 : 0), 0)
        : 0),
  );
  const best = new Map([[start, 0]]),
    parent = new Map(),
    open = new Set([start]);
  while (open.size) {
    const cell = [...open].reduce((b, c) =>
      best.get(b) <= best.get(c) ? b : c,
    );
    open.delete(cell);
    if (cell === end) break;
    for (const next of map.graph[cell]) {
      const cost = best.get(cell) + costs[next];
      if (cost >= (best.get(next) ?? Infinity)) continue;
      best.set(next, cost);
      parent.set(next, cell);
      open.add(next);
    }
  }
  const cells = [];
  if (best.has(end))
    for (let at = end; at !== undefined; at = parent.get(at)) cells.unshift(at);
  if (a.ctfRole === "steal" && cells.length > 1)
    g.ctfRouteHistory.set(a.id, [...cells]);
  return {
    key,
    cells,
    started: g.time,
    sample: { x: a.x, y: a.y },
    checkAt: g.time + 2,
  };
}
export function ctfWaypoint(g, a, goal) {
  const map = g.map;
  if (!map?.graph) return goal;
  const key = `${a.ctfRole}:${map.cellAt(goal)}`;
  let route = a.ctfRoute;
  if (route && g.time >= route.checkAt) {
    if (distance(a, route.sample) < 12 && distance(a, goal) > 30) route = null;
    else {
      route.sample = { x: a.x, y: a.y };
      route.checkAt = g.time + 2;
    }
  }
  if (!route || route.key !== key || !route.cells.includes(map.cellAt(a)))
    route = a.ctfRoute = planRoute(g, a, goal, key);
  while (route.cells.length > 1 && distance(a, map.cells[route.cells[1]]) < 22)
    route.cells.shift();
  if (route.cells.length <= 1) return map.route(a, goal);
  // Follow the chosen graph edges; do not shortcut back onto the default path.
  const here = map.cells[route.cells[0]],
    next = map.cells[route.cells[1]];
  return map.lineClear(a, next, 14) ? next : map.route(a, here);
}

const occupiesFloor = (a) => a.alive && !a.ghost && !a.blink && inWorld(a);
const contactPair = (a, b) =>
  a.team !== b.team && (a.parts.includes("fire") || b.parts.includes("fire"));
const bodyGap = (a, b) => {
  if (a.team !== b.team) return contactPair(a, b) ? 28 : 52;
  // Teammates meeting head-on need room to pass in the maze's narrow lanes.
  const opposite =
    a.ctfHeading &&
    b.ctfHeading &&
    a.ctfHeading.x * b.ctfHeading.x + a.ctfHeading.y * b.ctfHeading.y < -0.3;
  return opposite ? 48 : 66;
};
function away(g, a, b) {
  const d = distance(a, b);
  if (d > 0.01) return { x: (a.x - b.x) / d, y: (a.y - b.y) / d, d };
  // Coincident spawns need nonzero, opposing directions, not random jitter.
  const i = g.fighters.indexOf(a),
    j = g.fighters.indexOf(b);
  const angle = (Math.min(i, j) * 7 + Math.max(i, j) * 13) * 2.39996;
  const sign = i < j ? 1 : -1;
  return { x: Math.cos(angle) * sign, y: Math.sin(angle) * sign, d: 0 };
}
export function ctfMove(g, a, goal, dt) {
  const waypoint = ctfWaypoint(g, a, goal);
  let dx = waypoint.x - a.x,
    dy = waypoint.y - a.y;
  const length = Math.hypot(dx, dy),
    nx = dx / (length || 1),
    ny = dy / (length || 1);
  a.ctfHeading = { x: nx, y: ny };
  dx /= Math.max(30, length);
  dy /= Math.max(30, length);
  // Fight from striking distance instead of aiming at the opponent's center.
  if (
    a.ctfTarget &&
    goal.id === a.ctfTarget &&
    distance(a, goal) < bodyGap(a, goal) + 7 &&
    g.map.lineClear(a, goal)
  )
    dx = dy = 0;
  for (const b of g.fighters) {
    if (b === a || !occupiesFloor(b) || !g.map.lineClear(a, b)) continue;
    const v = away(g, a, b),
      clearance = bodyGap(a, b) + 22;
    if (v.d >= clearance) continue;
    // One teammate keeps the route while followers yield. Symmetric steering
    // otherwise deadlocks two bots around the same narrow-corridor waypoint.
    const leads =
      b.team === a.team &&
      b.id !== "player" &&
      g.fighters.indexOf(a) < g.fighters.indexOf(b);
    const pressure = ((clearance - v.d) / clearance) * (leads ? 0.15 : 3);
    dx += v.x * pressure;
    dy += v.y * pressure;
    // Keep right when a peer blocks the corridor; opposite travel directions
    // choose opposite sides, while followers give the leader room.
    const ahead = -v.x * nx - v.y * ny;
    if (a.team === b.team && length > 10 && ahead > 0.45) {
      dx += ny * pressure * 0.65;
      dy -= nx * pressure * 0.65;
    }
  }
  g.move(a, dx, dy, dt);
}

// Resolve the small overlaps left after every fighter has moved. Only bots
// yield: the player's position, immobilization, and maze walls remain intact.
export function separateCTF(g, dt) {
  if (g.mode !== "ctf" || !g.map || !(dt > 0)) return;
  const living = g.fighters.filter(occupiesFloor);
  const budget = new Map(
    living.map((a) => [
      a,
      a.id !== "player" && a.prisonHp <= 0 && !g.isShocked(a)
        ? Math.min(12, dt * 200)
        : 0,
    ]),
  );
  const nudge = (a, b, x, y, amount) => {
    const step = Math.min(amount, budget.get(a));
    if (!(step > 0)) return;
    const old = { x: a.x, y: a.y },
      gap = distance(a, b);
    for (const turn of [
      0,
      Math.PI / 4,
      -Math.PI / 4,
      Math.PI / 2,
      -Math.PI / 2,
    ]) {
      const p = {
        x: a.x + (x * Math.cos(turn) - y * Math.sin(turn)) * step,
        y: a.y + (x * Math.sin(turn) + y * Math.cos(turn)) * step,
      };
      if (
        distance(p, b) <= gap + 0.001 ||
        !g.map.walkable(p) ||
        !g.map.lineClear(a, p, 13)
      )
        continue;
      g.map.move(a, p.x, p.y);
      budget.set(a, budget.get(a) - distance(old, a));
      return;
    }
  };
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < living.length; i++)
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i],
          b = living[j],
          v = away(g, a, b),
          overlap = bodyGap(a, b) - v.d;
        if (overlap <= 0.01 || !g.map.lineClear(a, b)) continue;
        const aMoves = budget.get(a) > 0,
          bMoves = budget.get(b) > 0;
        if (aMoves) nudge(a, b, v.x, v.y, overlap / (bMoves ? 2 : 1));
        if (bMoves) {
          const next = away(g, b, a);
          nudge(b, a, next.x, next.y, Math.max(0, bodyGap(a, b) - next.d));
        }
      }
}
