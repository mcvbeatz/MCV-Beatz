// Connected polar maze. Rendering, collision, navigation and portals share this geometry.
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function pointDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l = dx * dx + dy * dy;
  const t = l ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function createCorruptionMap() {
  const map = {
    kind: "corruption",
    name: "The Umbral Labyrinth",
    width: 2048,
    height: 1360,
    cx: 1024,
    cy: 680,
    radius: 608,
    wallWidth: 12,
  };
  const sectors = 16,
    rings = 5,
    center = rings * sectors,
    step = TAU / sectors;
  const point = (r, t) => ({
    x: map.cx + Math.cos(t) * r,
    y: map.cy + Math.sin(t) * r,
  });
  const cells = Array.from({ length: center }, (_, id) =>
    point(176 + Math.floor(id / sectors) * 96, ((id % sectors) + 0.5) * step),
  );
  cells.push({ x: map.cx, y: map.cy });
  const graph = cells.map(() => new Set());
  let seed = 172617;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const adjacent = (id) => {
    if (id === center) return Array.from({ length: sectors }, (_, i) => i);
    const row = Math.floor(id / sectors),
      col = id % sectors;
    return [
      row * sectors + ((col + 1) % sectors),
      row * sectors + ((col + sectors - 1) % sectors),
      row ? id - sectors : center,
      ...(row < rings - 1 ? [id + sectors] : []),
    ];
  };
  const link = (a, b) => {
    graph[a].add(b);
    graph[b].add(a);
  };
  const visited = new Set([center]),
    stack = [center];
  while (stack.length) {
    const a = stack.at(-1),
      next = adjacent(a).filter((b) => !visited.has(b));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const b = next[Math.floor(random() * next.length)];
    link(a, b);
    visited.add(b);
    stack.push(b);
  }
  // A few loops provide escape choices instead of a single forced corridor.
  for (let a = 0; a < center; a++)
    for (const b of adjacent(a)) if (b > a && random() < 0.16) link(a, b);
  const walls = [],
    segments = [];
  const segment = (a, b) =>
    segments.push({
      a,
      b,
      left: Math.min(a.x, b.x),
      right: Math.max(a.x, b.x),
      top: Math.min(a.y, b.y),
      bottom: Math.max(a.y, b.y),
    });
  const arc = (r, start, end) => {
    walls.push({ kind: "arc", r, start, end });
    const n = Math.ceil(((end - start) * r) / 20);
    for (let i = 0; i < n; i++)
      segment(
        point(r, start + ((end - start) * i) / n),
        point(r, start + ((end - start) * (i + 1)) / n),
      );
  };
  for (let row = 0; row < rings; row++)
    for (let col = 0; col < sectors; col++) {
      const id = row * sectors + col,
        inner = row ? id - sectors : center;
      if (!graph[id].has(inner))
        arc(128 + row * 96, col * step, (col + 1) * step);
      const next = row * sectors + ((col + 1) % sectors);
      if (!graph[id].has(next)) {
        const a = point(128 + row * 96, (col + 1) * step),
          b = point(224 + row * 96, (col + 1) * step);
        walls.push({ kind: "line", a, b });
        segment(a, b);
      }
    }
  arc(map.radius, 0, TAU);
  map.cells = cells;
  map.graph = graph;
  map.walls = walls;
  map.segments = segments;
  map.bounds = {
    left: map.cx - map.radius,
    top: map.cy - map.radius,
    width: map.radius * 2,
    height: map.radius * 2,
  };
  map.cellAt = (p) => {
    const r = distance(p, { x: map.cx, y: map.cy });
    if (r < 128) return center;
    const angle = (Math.atan2(p.y - map.cy, p.x - map.cx) + TAU) % TAU;
    return (
      clamp(Math.floor((r - 128) / 96), 0, rings - 1) * sectors +
      (Math.floor(angle / step) % sectors)
    );
  };
  map.walkable = (p, r = 13) => {
    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      distance(p, { x: map.cx, y: map.cy }) > map.radius - map.wallWidth / 2 - r
    )
      return false;
    const margin = map.wallWidth / 2 + r;
    return !segments.some(
      (s) =>
        p.x >= s.left - margin &&
        p.x <= s.right + margin &&
        p.y >= s.top - margin &&
        p.y <= s.bottom + margin &&
        pointDistance(p, s.a, s.b) < margin,
    );
  };
  map.lineClear = (a, b, r = 0) => {
    const limit = map.radius - map.wallWidth / 2 - r,
      origin = { x: map.cx, y: map.cy };
    if (distance(a, origin) > limit || distance(b, origin) > limit)
      return false;
    const margin = map.wallWidth / 2 + r;
    const cross = (a, b, p) =>
      (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    for (const s of segments) {
      if (
        Math.max(a.x, b.x) < s.left - margin ||
        Math.min(a.x, b.x) > s.right + margin ||
        Math.max(a.y, b.y) < s.top - margin ||
        Math.min(a.y, b.y) > s.bottom + margin
      )
        continue;
      if (
        cross(a, b, s.a) * cross(a, b, s.b) < 0 &&
        cross(s.a, s.b, a) * cross(s.a, s.b, b) < 0
      )
        return false;
      if (
        Math.min(
          pointDistance(a, s.a, s.b),
          pointDistance(b, s.a, s.b),
          pointDistance(s.a, a, b),
          pointDistance(s.b, a, b),
        ) < margin
      )
        return false;
    }
    return true;
  };
  map.move = (a, x, y) => {
    const start = { x: a.x, y: a.y };
    const n = Math.max(1, Math.ceil(Math.hypot(x - a.x, y - a.y) / 7));
    const dx = (x - a.x) / n,
      dy = (y - a.y) / n;
    for (let i = 0; i < n; i++) {
      const next = { x: a.x + dx, y: a.y + dy };
      if (map.walkable(next)) {
        a.x = next.x;
        a.y = next.y;
      } else {
        if (map.walkable({ x: a.x + dx, y: a.y })) a.x += dx;
        if (map.walkable({ x: a.x, y: a.y + dy })) a.y += dy;
      }
    }
    return distance(start, a);
  };
  map.portalCells = [64, 72];
  map.portals = map.portalCells.map((id, i) => ({
    ...cells[id],
    id: `maze-${i}`,
    owner: "maze",
    r: 21,
    opensAt: 0,
    environment: true,
  }));
  const neighbors = (id, usePortals = true) => [
    ...graph[id],
    ...(usePortals && map.portalCells.includes(id)
      ? [map.portalCells[1 - map.portalCells.indexOf(id)]]
      : []),
  ];
  const paths = new Map();
  map.path = (from, to, usePortals = true) => {
    const start = typeof from === "number" ? from : map.cellAt(from),
      goal = typeof to === "number" ? to : map.cellAt(to);
    const key = `${start}:${goal}:${usePortals}`;
    if (paths.has(key)) return paths.get(key);
    const prev = new Map([[start, null]]),
      queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const a = queue[i];
      if (a === goal) break;
      for (const b of neighbors(a, usePortals))
        if (!prev.has(b)) {
          prev.set(b, a);
          queue.push(b);
        }
    }
    if (!prev.has(goal)) return [];
    const result = [];
    for (let at = goal; at !== null; at = prev.get(at)) result.push(at);
    result.reverse();
    paths.set(key, result);
    return result;
  };
  map.route = (a, target) => {
    if (map.lineClear(a, target, 14)) return target;
    const path = map.path(a, target),
      here = cells[path[0]];
    if (!here) return a;
    if (path.length === 1) return map.lineClear(a, target, 13) ? target : here;
    const next = cells[path[1]];
    if (map.portalCells.includes(path[0]) && map.portalCells.includes(path[1]))
      return here;
    return map.lineClear(a, next, 14) ? next : here;
  };
  map.safeExit = (portal, dx, dy) => {
    const angle = Math.atan2(dy, dx);
    for (let i = 0; i < 16; i++) {
      const p = {
        x: portal.x + Math.cos(angle + (i * TAU) / 16) * 38,
        y: portal.y + Math.sin(angle + (i * TAU) / 16) * 38,
      };
      if (map.walkable(p)) return p;
    }
    return { x: portal.x, y: portal.y };
  };
  map.spawn = (i, count) =>
    cells[3 * sectors + (Math.floor((i * sectors) / count) % sectors)];
  return map;
}
