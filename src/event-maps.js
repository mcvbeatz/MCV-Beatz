import { createCorruptionMap } from "./corruption-map.js";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function openMap(kind, name, width, height, floor) {
  const map = {
    kind,
    name,
    width,
    height,
    cx: width / 2,
    cy: height / 2,
    bounds: { left: 0, top: 0, width, height },
    shapes: [floor],
    portals: [],
  };
  map.walkable = (p, r = 13) =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= floor.x + r &&
    p.x <= floor.x + floor.w - r &&
    p.y >= floor.y + r &&
    p.y <= floor.y + floor.h - r;
  map.nearest = (p, r = 13) => ({
    x: clamp(
      Number.isFinite(p.x) ? p.x : map.cx,
      floor.x + r,
      floor.x + floor.w - r,
    ),
    y: clamp(
      Number.isFinite(p.y) ? p.y : map.cy,
      floor.y + r,
      floor.y + floor.h - r,
    ),
  });
  map.move = (a, x, y) => {
    const before = { x: a.x, y: a.y };
    Object.assign(a, map.nearest({ x, y }));
    return distance(a, before);
  };
  map.lineClear = (a, b, r = 0) => map.walkable(a, r) && map.walkable(b, r);
  map.route = (_a, b) => map.nearest(b);
  map.safeExit = (p, dx, dy) =>
    map.nearest({ x: p.x + dx * 38, y: p.y + dy * 38 });
  map.spawn = (i) => ({ x: map.cx, y: map.cy + (i - 3.5) * 35 });
  map.teamSpawn = (team, i) => ({
    x: team ? width - 500 : 500,
    y: 350 + i * 130,
  });
  map.flagHomes = [
    { x: floor.x + 90, y: map.cy },
    { x: floor.x + floor.w - 90, y: map.cy },
  ];
  return map;
}
export function createEvergreenMap() {
  const map = createCorruptionMap({
    portals: false,
    layoutSeed: 881923,
    // Marked upper-left, top and right-hand tree-wall openings.
    openings: [
      [41, 57],
      [60, 76],
      [63, 79],
      [48, 64],
    ],
  });
  map.kind = "evergreen";
  map.name = "The Evergreen Labyrinth";
  map.flagHomes = [map.cells[64], map.cells[72]].map((p) => ({ ...p }));
  map.teamSpawn = (team, i) => {
    const cell = team ? 72 : 64;
    const candidates = map.cells
      .map((p, id) => ({ p, length: map.path(cell, id).length }))
      .sort((a, b) => a.length - b.length);
    return { ...candidates[i].p };
  };
  return map;
}
export function createGridironMap() {
  const map = openMap("gridiron", "The Emerald Stadium", 1800, 1100, {
    x: 180,
    y: 220,
    w: 1440,
    h: 660,
  });
  map.endZones = [
    { x: 180, y: 220, w: 150, h: 660, team: 0 },
    { x: 1470, y: 220, w: 150, h: 660, team: 1 },
  ];
  return map;
}
export function createTurnpikeMap() {
  const map = openMap("turnpike", "The Cloudway Circuit", 2400, 1600, {
    x: 20,
    y: 20,
    w: 2360,
    h: 1560,
  });
  const controls = [
    [520, 1300],
    [1150, 1300],
    [1850, 1300],
    [2120, 1110],
    [1920, 910],
    [1590, 940],
    [1230, 820],
    [1360, 620],
    [1770, 500],
    [1910, 260],
    [1600, 160],
    [1270, 350],
    [1040, 430],
    [820, 240],
    [430, 240],
    [210, 500],
    [390, 810],
  ];
  const points = [];
  for (let i = 0; i < controls.length; i++) {
    const p0 = controls[(i + controls.length - 1) % controls.length],
      p1 = controls[i],
      p2 = controls[(i + 1) % controls.length],
      p3 = controls[(i + 2) % controls.length];
    for (let n = 0; n < 24; n++) {
      const t = n / 24;
      const axis = (k) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t);
      points.push({ x: axis(0), y: axis(1) });
    }
  }
  let length = 0;
  map.track = points.map((p, i) => {
    const next = points[(i + 1) % points.length],
      size = distance(p, next);
    const s = { ...p, next, size, at: length };
    length += size;
    return s;
  });
  map.trackLength = length;
  map.trackRadius = 76;
  map.trackAt = (progress) => {
    const s = ((progress % length) + length) % length;
    const segment = map.track.findLast((p) => p.at <= s) || map.track[0];
    const t = (s - segment.at) / segment.size;
    return {
      x: segment.x + (segment.next.x - segment.x) * t,
      y: segment.y + (segment.next.y - segment.y) * t,
      dx: (segment.next.x - segment.x) / segment.size,
      dy: (segment.next.y - segment.y) / segment.size,
    };
  };
  map.projectTrack = (p) => {
    let best = null;
    for (const s of map.track) {
      const dx = s.next.x - s.x,
        dy = s.next.y - s.y;
      const t = clamp(
        ((p.x - s.x) * dx + (p.y - s.y) * dy) / (s.size * s.size),
        0,
        1,
      );
      const x = s.x + dx * t,
        y = s.y + dy * t,
        gap = Math.hypot(p.x - x, p.y - y);
      if (!best || gap < best.gap)
        best = { x, y, gap, progress: s.at + t * s.size };
    }
    return best;
  };
  map.onTrack = (p) => map.projectTrack(p).gap <= map.trackRadius;
  map.checkpoints = Array.from({ length: 16 }, (_, i) =>
    map.trackAt((i * length) / 16),
  );
  map.spawn = (i) => {
    const p = map.trackAt(20 + Math.floor(i / 2) * 80);
    return {
      x: p.x - p.dy * ((i % 2) - 0.5) * 72,
      y: p.y + p.dx * ((i % 2) - 0.5) * 72,
    };
  };
  map.teamSpawn = (_team, i) => map.spawn(i);
  return map;
}
