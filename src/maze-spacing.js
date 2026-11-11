import { inWorld, segmentDistance } from "./portals.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const neighbors = (map, id) => [
  ...map.graph[id],
  ...(map.portalCells.includes(id)
    ? map.portalCells.filter((other) => other !== id)
    : []),
];

// Reserve a different first corridor, then find a real route around the maze.
// Never send a pursuer down a dead end just to separate it from another Dark.
function branchPaths(map, start, first) {
  const paths = new Map([[first, [first]]]);
  const queue = [first];
  for (const cell of queue) {
    for (const next of neighbors(map, cell)) {
      if (next === start || paths.has(next)) continue;
      paths.set(next, [...paths.get(cell), next]);
      queue.push(next);
    }
  }
  return paths;
}
function clearance(map, point, rivals) {
  return Math.min(...rivals.map((b) => map.path(b, point).length - 1));
}
function safeStep(map, a, point, rivals) {
  // A nearby hunter must not gain striking distance because Light yields.
  return rivals.every(
    (b) =>
      !map.lineClear(a, b) ||
      distance(a, b) > 220 ||
      segmentDistance(b, a, point) >= distance(a, b) - 1,
  );
}
function routePlan(game, a, rivals) {
  const plan = a.mazeSpacing;
  if (!plan) return null;
  const map = game.map;
  if (plan.until <= game.time || plan.element !== a.element) {
    a.mazeSpacing = null;
    return null;
  }
  while (plan.cells.length && distance(a, map.cells[plan.cells[0]]) < 22)
    plan.cells.shift();
  if (!plan.cells.length) {
    a.mazeSpacing = null;
    return null;
  }
  if (
    a.team === 0 &&
    plan.cells.some(
      (id, step) => clearance(map, map.cells[id], rivals) <= step + 1,
    )
  ) {
    a.mazeSpacing = null;
    a.mazeGoal = null;
    a.mazeGoalUntil = 0;
    return a;
  }
  const point = map.route(a, map.cells[plan.cells[0]]);
  if (a.team === 0 && !safeStep(map, a, point, rivals)) {
    a.mazeSpacing = null;
    a.mazeGoal = null;
    a.mazeGoalUntil = 0;
    return a;
  }
  return point;
}

export function mazeSpacingRoute(game, a, goal, rivals) {
  const map = game.map;
  const committed = routePlan(game, a, rivals);
  if (committed) return committed;
  const index = game.fighters.indexOf(a);
  // The earlier fighter keeps its course; only the follower yields. This also
  // keeps AI allies from making a human player change their chosen direction.
  const peers = game.fighters.filter(
    (b, i) =>
      i < index &&
      b.alive &&
      !b.echo &&
      inWorld(b) &&
      b.team === a.team &&
      distance(a, b) < (a.team === 0 ? 64 : 32) &&
      map.lineClear(a, b),
  );
  if (!peers.length) return map.route(a, goal);

  const start = map.cellAt(a);
  const peerGoal = (peer) => (a.team === 0 ? peer.mazeGoal || goal : goal);
  const occupied = new Set(
    peers.map((peer) => {
      if (map.cellAt(peer) !== start) return map.cellAt(peer);
      return peer.mazeSpacing?.cells[0] ?? map.path(peer, peerGoal(peer))[1];
    }),
  );
  if (game.time >= (a.mazeSpacingRetry || 0)) {
    a.mazeSpacingRetry = game.time + 0.6;
    const options = [];
    const currentClearance = clearance(map, a, rivals);
    for (const first of neighbors(map, start)) {
      if (occupied.has(first)) continue;
      const paths = branchPaths(map, start, first);
      if (a.team === 1) {
        const path = paths.get(map.cellAt(goal));
        if (path) options.push({ path, score: -path.length });
      } else {
        if (clearance(map, map.cells[first], rivals) < currentClearance)
          continue;
        for (const [end, path] of paths) {
          // Reject corridors a hunter can intercept before Light reaches them.
          if (
            path.some(
              (id, step) => clearance(map, map.cells[id], rivals) <= step + 1,
            )
          )
            continue;
          const point = map.route(a, map.cells[first]);
          if (!safeStep(map, a, point, rivals)) continue;
          options.push({
            path,
            score: clearance(map, map.cells[end], rivals) - path.length * 0.3,
          });
        }
      }
    }
    const best = options.sort((b, c) => c.score - b.score)[0];
    if (best) {
      a.mazeSpacing = {
        cells: best.path,
        until: game.time + 8,
        element: a.element,
      };
      if (a.team === 0) {
        a.mazeGoal = map.cells[best.path.at(-1)];
        a.mazeGoalUntil = game.time + 8;
      }
      const route = routePlan(game, a, rivals);
      if (route) return route;
    }
  }

  // In a single corridor, choose a clear side lane while continuing pursuit or
  // escape. Check the whole segment so repulsion cannot push through a wall.
  const forward = map.route(a, goal);
  const dx = forward.x - a.x,
    dy = forward.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const peerPositions = peers.map((peer) => {
    const route = peer.mazeSpacing?.cells.length
      ? map.route(peer, map.cells[peer.mazeSpacing.cells[0]])
      : map.route(peer, peerGoal(peer));
    const length = distance(peer, route) || 1;
    return {
      x: peer.x + ((route.x - peer.x) / length) * 42,
      y: peer.y + ((route.y - peer.y) / length) * 42,
    };
  });
  let best = null,
    score = -Infinity;
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    const point = {
      x: a.x + Math.cos(angle) * 42,
      y: a.y + Math.sin(angle) * 42,
    };
    const progress = ((point.x - a.x) * dx + (point.y - a.y) * dy) / length;
    if (
      progress < 0 ||
      peers.some(
        (peer) => distance(point, peer) < Math.max(38, distance(a, peer)),
      ) ||
      !map.walkable(point, 14) ||
      !map.lineClear(a, point, 14) ||
      (a.team === 0 && !safeStep(map, a, point, rivals))
    )
      continue;
    const value =
      Math.min(...peerPositions.map((peer) => distance(point, peer))) +
      progress * 0.35;
    if (value > score) {
      best = point;
      score = value;
    }
  }
  return best || forward;
}
