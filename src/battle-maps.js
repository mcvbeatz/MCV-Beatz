// Shared floor geometry for rendering, placement, collision and AI navigation.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const BATTLE_MAP_IDS = ["garden", "tower"];
export function createBattleMap(
  id = BATTLE_MAP_IDS[Math.floor(Math.random() * 2)],
) {
  if (!BATTLE_MAP_IDS.includes(id))
    throw new Error(`Unknown battle map: ${id}`);
  const garden = id === "garden";
  const map = {
    kind: id,
    name: garden ? "The Crosswater Garden" : "The Astral Tower",
    width: 2048,
    height: 1360,
    cx: 1024,
    cy: 680,
    // Both floors have approximately the maze's 1.16 million square units.
    bounds: garden
      ? { left: 336, top: 0, width: 1376, height: 1360 }
      : { left: 110, top: 0, width: 1890, height: 1360 },
    shapes: garden
      ? [
          { x: 416, y: 355, w: 1216, h: 650 },
          { x: 699, y: 72, w: 650, h: 1216 },
        ]
      : [
          { x: 760, y: 680, r: 545 },
          { x: 1680, y: 680, r: 250 },
          { x: 1200, y: 590, w: 400, h: 180 },
        ],
    portals: [],
  };
  // A body must fit wholly inside a component. Components overlap generously,
  // so the seams are continuous while bodies cannot clip the re-entrant edges.
  map.walkable = (p, r = 13) =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    map.shapes.some((s) =>
      s.r
        ? distance(p, s) <= s.r - r
        : p.x >= s.x + r &&
          p.x <= s.x + s.w - r &&
          p.y >= s.y + r &&
          p.y <= s.y + s.h - r,
    );
  map.nearest = (p, r = 13) => {
    if (map.walkable(p, r)) return { x: p.x, y: p.y };
    return map.shapes
      .map((s) => {
        if (!s.r)
          return {
            x: clamp(p.x, s.x + r, s.x + s.w - r),
            y: clamp(p.y, s.y + r, s.y + s.h - r),
          };
        const d = distance(p, s) || 1,
          scale = Math.min(1, (s.r - r - 0.01) / d);
        return { x: s.x + (p.x - s.x) * scale, y: s.y + (p.y - s.y) * scale };
      })
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
  };
  map.lineClear = (a, b, r = 13) => {
    // Exact segment coverage by the union of the eroded convex components.
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length2 = dx * dx + dy * dy;
    if (!length2) return map.walkable(a, r);
    const intervals = [];
    for (const s of map.shapes) {
      let lo = 0,
        hi = 1;
      if (s.r) {
        const x = a.x - s.x,
          y = a.y - s.y;
        const dot = x * dx + y * dy;
        const disc = dot * dot - length2 * (x * x + y * y - (s.r - r) ** 2);
        if (disc < 0) continue;
        lo = Math.max(0, (-dot - Math.sqrt(disc)) / length2);
        hi = Math.min(1, (-dot + Math.sqrt(disc)) / length2);
      } else {
        for (const [start, delta, min, max] of [
          [a.x, dx, s.x + r, s.x + s.w - r],
          [a.y, dy, s.y + r, s.y + s.h - r],
        ]) {
          if (!delta) {
            if (start < min || start > max) hi = -1;
          } else {
            const t1 = (min - start) / delta,
              t2 = (max - start) / delta;
            lo = Math.max(lo, Math.min(t1, t2));
            hi = Math.min(hi, Math.max(t1, t2));
          }
        }
      }
      if (hi >= lo) intervals.push([lo, hi]);
    }
    let covered = 0;
    for (const [lo, hi] of intervals.sort((a, b) => a[0] - b[0])) {
      if (lo > covered + 1e-9) return false;
      covered = Math.max(covered, hi);
      if (covered >= 1 - 1e-9) return true;
    }
    return false;
  };
  map.move = (a, x, y) => {
    const start = { x: a.x, y: a.y };
    const steps = Math.max(1, Math.ceil(distance(a, { x, y }) / 6));
    const dx = (x - a.x) / steps,
      dy = (y - a.y) / steps;
    for (let i = 0; i < steps; i++) {
      if (map.walkable({ x: a.x + dx, y: a.y + dy })) {
        a.x += dx;
        a.y += dy;
      } else {
        if (map.walkable({ x: a.x + dx, y: a.y })) a.x += dx;
        if (map.walkable({ x: a.x, y: a.y + dy })) a.y += dy;
      }
    }
    return distance(start, a);
  };
  const nodes = garden
    ? [
        [735, 391],
        [1313, 391],
        [735, 969],
        [1313, 969],
        [1024, 680],
      ]
    : [
        [760, 680],
        [1240, 630],
        [1240, 730],
        [1490, 630],
        [1490, 730],
        [1680, 680],
      ];
  map.nodes = nodes.map(([x, y]) => ({ x, y }));
  const edges = map.nodes.map((a) =>
    map.nodes.map((b) => (map.lineClear(a, b, 18) ? distance(a, b) : Infinity)),
  );
  map.route = (from, to) => {
    const goal = map.nearest(to, 18);
    if (map.lineClear(from, goal)) return goal;
    const costs = map.nodes.map((n) =>
      map.lineClear(from, n) ? distance(from, n) : Infinity,
    );
    const first = map.nodes.map((_, i) => i),
      visited = new Set();
    let best = Infinity,
      result = from;
    for (let k = 0; k < nodes.length; k++) {
      let i = -1;
      for (let j = 0; j < nodes.length; j++)
        if (!visited.has(j) && (i < 0 || costs[j] < costs[i])) i = j;
      if (i < 0 || !Number.isFinite(costs[i])) break;
      visited.add(i);
      const total = costs[i] + distance(map.nodes[i], goal);
      if (total < best && map.lineClear(map.nodes[i], goal)) {
        best = total;
        result = map.nodes[first[i]];
      }
      for (let j = 0; j < nodes.length; j++) {
        const cost = costs[i] + edges[i][j];
        if (cost < costs[j]) {
          costs[j] = cost;
          first[j] = first[i];
        }
      }
    }
    return { x: result.x, y: result.y };
  };
  map.safeExit = (portal, dx, dy) => {
    const angle = Math.atan2(dy, dx);
    for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const p = {
        x: portal.x + Math.cos(angle + turn) * 49,
        y: portal.y + Math.sin(angle + turn) * 49,
      };
      if (map.lineClear(portal, p)) return p;
    }
    return map.nearest(portal);
  };
  map.teamSpawn = (team, i, count) => ({
    x: garden ? (team === 0 ? 560 : 1488) : team === 0 ? 460 : 1700,
    y: 680 + (i - (count - 1) / 2) * 56,
  });
  map.spawn = (i, count) => {
    if (garden) {
      const angle = Math.PI + (i * Math.PI * 2) / count;
      return map.nearest(
        { x: 1024 + Math.cos(angle) * 485, y: 680 + Math.sin(angle) * 485 },
        36,
      );
    }
    if (i >= Math.ceil(count * 0.75))
      return { x: 1680, y: 610 + (i - Math.ceil(count * 0.75)) * 100 };
    const angle = Math.PI + (i * Math.PI * 2) / Math.ceil(count * 0.75);
    return { x: 760 + Math.cos(angle) * 380, y: 680 + Math.sin(angle) * 380 };
  };
  map.flagHomes = garden
    ? [
        { x: 500, y: 680 },
        { x: 1548, y: 680 },
      ]
    : [
        { x: 380, y: 680 },
        { x: 1820, y: 680 },
      ];
  map.capturePoints = garden
    ? [
        { x: 590, y: 680 },
        { x: 1024, y: 245 },
        { x: 1458, y: 680 },
        { x: 1024, y: 1115 },
      ]
    : [
        { x: 650, y: 355 },
        { x: 650, y: 1005 },
        { x: 1190, y: 680 },
        { x: 1750, y: 680 },
      ];
  map.shardSpots = garden
    ? [
        [1024, 275],
        [1024, 1085],
        [800, 500],
        [1248, 500],
        [800, 860],
        [1248, 860],
        [1024, 610],
        [1024, 750],
      ]
    : [
        [650, 360],
        [650, 1000],
        [1000, 450],
        [1000, 910],
        [1300, 680],
        [1480, 680],
        [1680, 540],
        [1680, 820],
      ];
  map.shardSpots = map.shardSpots.map(([x, y]) => ({ x, y }));
  return map;
}
