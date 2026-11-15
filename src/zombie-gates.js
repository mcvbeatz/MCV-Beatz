import { inWorld } from "./portals.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const GATE_LOCK_SECONDS = 60,
  GATE_ESCAPE_SECONDS = 7;
export const zombieRoomAt = (g, p) =>
  g.map.rooms.findIndex(
    (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
  );
export function initializeZombieGates(g) {
  g.zombieGates = g.map.rooms.map((r, room) => ({
    room,
    x: r.x + r.w - 95,
    y: r.y + r.h - 95,
    state: "ready",
    blastAt: 0,
    unlockAt: 0,
    blastTime: -Infinity,
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
    unlockAt: g.time + GATE_LOCK_SECONDS + GATE_ESCAPE_SECONDS,
    owner: a.id,
  });
  g.emitSound("flash", gate);
  g.cue("portal", gate, "#8cefff");
  return true;
}
export function zombieSpawnBlocked(g, p) {
  const gate = g.zombieGates?.[zombieRoomAt(g, p)];
  return !!gate && gate.state !== "ready" && g.time < gate.unlockAt;
}
export function updateZombieGates(g) {
  for (const gate of g.zombieGates || []) {
    if (gate.state === "locked" && g.time >= gate.blastAt) {
      gate.state = "escape";
      gate.blastTime = gate.blastAt;
      const owner = g.fighters.find((a) => a.id === gate.owner) || null;
      for (const a of [...g.fighters])
        if (
          a.alive &&
          a.zombieEnemy &&
          inWorld(a) &&
          zombieRoomAt(g, a) === gate.room
        )
          g.fell(a, { killer: owner });
      g.emitSound("lightning", gate);
    }
    if (gate.state === "escape" && g.time >= gate.unlockAt)
      gate.state = "ready";
  }
}
export function zombieGateHint(g, a) {
  const near = g.zombieGates.find(
    (s) => distance(a, s) <= 110 && g.map.lineClear(a, s),
  );
  if (near?.state === "ready")
    return "ELECTRIC GATE · Tap the lever or press E. Locks room spawns for 60s, then clears Fire and grants 7s to escape.";
  const gate = g.zombieGates[zombieRoomAt(g, a)];
  if (gate?.state === "locked")
    return `ROOM SPAWN LOCK · ${Math.max(0, Math.ceil(gate.blastAt - g.time))}s until the electric blast. Existing Fire can still enter.`;
  if (gate?.state === "escape")
    return `ESCAPE WINDOW · ${Math.max(0, Math.ceil(gate.unlockAt - g.time))}s before room spawns resume. Move to another room.`;
  return "Find room levers: 60s spawn lock, then a Fire-clearing blast and 7s escape window.";
}
export function drawZombieGates(c, g, t) {
  for (const s of g.zombieGates) {
    const r = g.map.rooms[s.room],
      active = s.state === "locked" || s.state === "escape";
    const pulse = Math.max(0, 1 - (g.time - s.blastTime) / 1.1);
    c.save();
    if (active || pulse > 0) {
      c.strokeStyle = s.state === "escape" ? "#baffde" : "#75deff";
      c.globalAlpha = 0.55 + Math.sin(t * 5) * 0.12;
      c.lineWidth = 3;
      c.setLineDash([14, 10]);
      c.strokeRect(r.x + 18, r.y + 18, r.w - 36, r.h - 36);
      c.setLineDash([]);
      if (pulse > 0) {
        c.globalAlpha = pulse * 0.22;
        c.fillStyle = "#b1f5ff";
        c.fillRect(r.x, r.y, r.w, r.h);
        c.globalAlpha = pulse;
        c.lineWidth = 3;
        for (let i = 0; i < 7; i++) {
          c.beginPath();
          c.moveTo(s.x, s.y - 30);
          const x = r.x + 35 + ((r.w - 70) * i) / 6;
          c.lineTo(
            (s.x + x) / 2 + Math.sin(i * 9 + t * 12) * 35,
            r.y + r.h * 0.5,
          );
          c.lineTo(x, r.y + 25);
          c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
    c.translate(s.x, s.y);
    c.fillStyle = "#143c4a";
    c.strokeStyle = active
      ? "#9bf4ff"
      : s.state === "ready"
        ? "#d7c591"
        : "#67808a";
    c.lineWidth = 3;
    c.fillRect(-27, -55, 54, 62);
    c.strokeRect(-27, -55, 54, 62);
    c.fillStyle = active
      ? "#77edff"
      : s.state === "ready"
        ? "#f9d27a"
        : "#5c717c";
    c.beginPath();
    c.arc(0, -35, 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#d6e4df";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(0, -10);
    c.lineTo(s.state === "ready" ? -14 : 14, s.state === "ready" ? -31 : 0);
    c.stroke();
    c.fillStyle = s.state === "ready" ? "#f3c66c" : "#8cefff";
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
        : s.state === "escape"
          ? `ESCAPE · ${Math.ceil(s.unlockAt - g.time)}s`
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
