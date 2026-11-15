import { inWorld } from "./portals.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const GATE_LOCK_SECONDS = 60,
  GATE_ESCAPE_SECONDS = 7,
  GATE_OVERHEAT_SECONDS = 60;
export const zombieRoomAt = (g, p) =>
  g.map.rooms.findIndex(
    (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
  );
export function initializeZombieGates(g) {
  g.zombieSpawnResumeAt = 0;
  g.zombieBlastTime = -Infinity;
  g.zombieGates = g.map.rooms.map((r, room) => ({
    room,
    x: r.x + r.w - 95,
    y: r.y + r.h - 95,
    state: "ready",
    blastAt: 0,
    unlockAt: 0,
    owner: null,
  }));
}
export function zombieGateAt(g, p) {
  return g.mode === "zombies"
    ? g.zombieGates.find(
        (s) => Math.abs(p.x - s.x) < 42 && p.y > s.y - 65 && p.y < s.y + 20,
      )
    : null;
}
export function pullZombieGate(g, a, gate = null) {
  if (
    g.mode !== "zombies" ||
    g.finished ||
    g.countingDown ||
    !a?.alive ||
    a.team !== 0 ||
    !inWorld(a) ||
    a.ghost ||
    a.blink ||
    a.prisonHp > 0 ||
    a.stagger > 0
  )
    return false;
  gate ||= g.zombieGates
    .filter(
      (s) =>
        s.state === "ready" && distance(a, s) <= 110 && g.map.lineClear(a, s),
    )
    .sort((s, t) => distance(a, s) - distance(a, t))[0];
  if (
    !gate ||
    !g.zombieGates.includes(gate) ||
    gate.state !== "ready" ||
    distance(a, gate) > 110 ||
    !g.map.lineClear(a, gate)
  )
    return false;
  Object.assign(gate, {
    state: "locked",
    blastAt: g.time + GATE_LOCK_SECONDS,
    unlockAt: g.time + GATE_LOCK_SECONDS + GATE_OVERHEAT_SECONDS,
    owner: a.id,
  });
  g.emitSound("flash", gate);
  g.cue("portal", gate, "#8cefff");
  return true;
}
export function zombieSpawnBlocked(g, p) {
  if (g.time < g.zombieSpawnResumeAt) return true;
  const gate = g.zombieGates?.[zombieRoomAt(g, p)];
  return !!gate && gate.state === "locked" && g.time < gate.blastAt;
}
export function updateZombieGates(g) {
  for (const gate of g.zombieGates || []) {
    if (gate.state === "locked" && g.time >= gate.blastAt) {
      gate.state = "overheated";
      g.zombieBlastTime = g.time;
      g.zombieSpawnResumeAt = Math.max(
        g.zombieSpawnResumeAt,
        g.time + GATE_ESCAPE_SECONDS,
      );
      gate.unlockAt = g.time + GATE_OVERHEAT_SECONDS;
      g.zombies.credit = 0;
      const owner = g.fighters.find((a) => a.id === gate.owner) || null;
      for (const a of [...g.fighters])
        if (a.alive && a.zombieEnemy) g.fell(a, { killer: owner });
      g.emitSound("lightning", gate);
    }
    if (gate.state === "overheated" && g.time >= gate.unlockAt)
      gate.state = "ready";
  }
}
export function zombieGateHint(g, a) {
  if (g.time < g.zombieSpawnResumeAt)
    return `ESCAPE WINDOW · ${Math.ceil(g.zombieSpawnResumeAt - g.time)}s · All Fire spawns paused. Used switches are overheating; move to another room.`;
  const near = g.zombieGates.find(
    (s) => distance(a, s) <= 110 && g.map.lineClear(a, s),
  );
  if (near?.state === "ready")
    return "ELECTRIC GATE · Tap the lever or press E. Locks room spawns for 60s, then clears all Fire across the map. 7s escape window; switch overheats for 60s.";
  const gate = g.zombieGates[zombieRoomAt(g, a)];
  if (gate?.state === "locked")
    return `ROOM SPAWN LOCK · ${Math.max(0, Math.ceil(gate.blastAt - g.time))}s until the electric blast. Existing Fire can still enter.`;
  if (gate?.state === "overheated")
    return `SWITCH OVERHEATING · ${Math.max(0, Math.ceil(gate.unlockAt - g.time))}s until ready. Move to another room.`;
  return "Find room levers: 60s spawn lock, then a map-wide Fire blast, 7s spawn pause and 60s switch cooldown.";
}
export function drawZombieGates(c, g, t) {
  const pulse = Math.max(0, 1 - (g.time - g.zombieBlastTime) / 1.1);
  if (pulse > 0) {
    c.save();
    const b = g.map.bounds;
    c.globalAlpha = pulse * 0.16;
    c.fillStyle = "#b1f5ff";
    c.fillRect(b.left, b.top, b.width, b.height);
    c.globalAlpha = pulse;
    c.strokeStyle = "#b1f5ff";
    c.lineWidth = 3;
    for (const r of g.map.rooms) {
      for (let i = 0; i < 5; i++) {
        const x = r.x + 35 + ((r.w - 70) * i) / 4;
        c.beginPath();
        c.moveTo(x, r.y + 25);
        c.lineTo(x + Math.sin(i * 9 + t * 12) * 45, r.y + r.h * 0.5);
        c.lineTo(x, r.y + r.h - 25);
        c.stroke();
      }
    }
    c.restore();
  }
  for (const s of g.zombieGates) {
    const r = g.map.rooms[s.room],
      active = s.state === "locked",
      hot = s.state === "overheated";
    c.save();
    if (active) {
      c.strokeStyle = "#75deff";
      c.globalAlpha = 0.55 + Math.sin(t * 5) * 0.12;
      c.lineWidth = 3;
      c.setLineDash([14, 10]);
      c.strokeRect(r.x + 18, r.y + 18, r.w - 36, r.h - 36);
      c.setLineDash([]);
    }
    c.globalAlpha = 1;
    c.translate(s.x, s.y);
    if (hot) {
      c.strokeStyle = "#ffb77b";
      c.globalAlpha = 0.55;
      c.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(i * 15, -60);
        c.bezierCurveTo(
          i * 15 + 12 * Math.sin(t * 3 + i),
          -73,
          i * 15 - 10,
          -83,
          i * 15,
          -95,
        );
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    c.fillStyle = hot ? "#6d2d1e" : "#143c4a";
    c.strokeStyle = active
      ? "#9bf4ff"
      : s.state === "ready"
        ? "#d7c591"
        : "#ff955b";
    c.lineWidth = 3;
    c.fillRect(-27, -55, 54, 62);
    c.strokeRect(-27, -55, 54, 62);
    c.fillStyle = active
      ? "#77edff"
      : s.state === "ready"
        ? "#f9d27a"
        : "#ff7043";
    c.beginPath();
    c.arc(0, -35, 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#d6e4df";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(0, -10);
    c.lineTo(s.state === "ready" ? -14 : 14, s.state === "ready" ? -31 : 0);
    c.stroke();
    c.fillStyle = hot ? "#ff955b" : s.state === "ready" ? "#f3c66c" : "#8cefff";
    c.beginPath();
    c.arc(
      s.state === "ready" ? -14 : 14,
      s.state === "ready" ? -31 : 0,
      7,
      0,
      Math.PI * 2,
    );
    c.fill();
    c.font = "bold 12px sans-serif";
    c.textAlign = "center";
    const label =
      s.state === "locked"
        ? `SPAWN LOCK · ${Math.ceil(s.blastAt - g.time)}s`
        : hot
          ? `OVERHEATING · ${Math.ceil(s.unlockAt - g.time)}s`
          : distance(g.player, s) <= 110
            ? "PULL SWITCH · TAP / E"
            : "ELECTRIC GATE";
    const w = c.measureText(label).width;
    c.fillStyle = "#09242de8";
    c.fillRect(-w / 2 - 7, 12, w + 14, 22);
    c.fillStyle = "#e3faff";
    c.fillText(label, 0, 27);
    c.restore();
  }
}
