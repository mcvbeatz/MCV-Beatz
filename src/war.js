import { ELEMENTS, combination } from "./combat.js";
import { inWorld, segmentDistance } from "./portals.js";

export const WAR_DROP_INTERVAL = 7;
// Healing charges from power 1 to 2.6 and restores 23 HP per power.
export const WAR_HEAL = 23 * 2.6;
export function initializeWar(g) {
  if (g.mode !== "war") return;
  g.healthDrops = [];
  g.warDeathStreaks = {};
  g.spikeTraps =
    g.mapId === "temple"
      ? [
          [700, 470],
          [1024, 470],
          [1348, 470],
          [810, 680],
          [1190, 680],
          [700, 890],
          [1024, 890],
          [1348, 890],
          [920, 570],
          [1130, 790],
        ].map(([x, y], i) => ({
          id: i,
          kind: "spike",
          x,
          y,
          r: 26,
          knownBy: new Set(),
          nextHit: new Map(),
          triggeredAt: -Infinity,
        }))
      : [];
  g.warTrapPositions = new Map();
  g.nextHealthDropAt = WAR_DROP_INTERVAL;
  g.warBases = [0, 1].map((team) => ({
    team,
    element: g.warElements[team],
    ...(g.map ? g.map.teamSpawn(team, 0, 1) : { x: team ? 789 : 235, y: 365 }),
  }));
  if (!g.map) {
    for (const base of g.warBases) {
      const members = g.fighters.filter((a) => a.team === base.team);
      members.forEach((a, i) => {
        a.x = base.x;
        a.y = base.y + (i - (members.length - 1) / 2) * 60;
        a.spawn = { x: a.x, y: a.y, element: a.element };
      });
    }
  }
}
export function updateWar(g, dt) {
  if (g.mode !== "war") return;
  for (const a of g.fighters) checkWarChasms(g, a);
  updateWarTraps(g);
  while (g.time + 1e-9 >= g.nextHealthDropAt) {
    for (const base of g.warBases) {
      if (base.element === "light") continue;
      const index = Math.round(g.nextHealthDropAt / WAR_DROP_INTERVAL) - 1;
      const angle = index * 2.4;
      const position = g.floorPoint({
        x: base.x + Math.cos(angle) * 30,
        y: base.y + Math.sin(angle) * 30,
      });
      g.healthDrops.push({
        ...position,
        team: base.team,
        bornAt: g.nextHealthDropAt,
      });
    }
    g.nextHealthDropAt += WAR_DROP_INTERVAL;
  }
  for (const drop of g.healthDrops) {
    const recipient = g.fighters.find(
      (a) =>
        a.alive &&
        !a.echo &&
        inWorld(a) &&
        a.team === drop.team &&
        a.hp < a.maxHp &&
        Math.hypot(a.x - drop.x, a.y - drop.y) <= 27,
    );
    if (recipient) {
      g.restoreHealth(recipient, WAR_HEAL);
      g.cue("heal", recipient, "#c9ebbc");
      drop.consumed = true;
    }
  }
  g.healthDrops = g.healthDrops.filter((drop) => !drop.consumed);
  if (g.mapId === "volcano") {
    for (const a of g.fighters) {
      if (!a.alive || !inWorld(a) || a.element !== "water") continue;
      // Environmental heat is exactly 1 HP/second, independent of defenses.
      a.hp = Math.max(0, a.hp - dt);
      if (a.hp <= 0) g.fell(a);
    }
  }
}
export function checkWarChasms(g, a, previous = a) {
  if (
    g.mode !== "war" ||
    !a.alive ||
    !inWorld(a) ||
    g.flying(a) ||
    g.countingDown
  )
    return false;
  const hole = g.map?.chasms?.find(
    (h) => segmentDistance(h, previous, a) <= h.r + 10,
  );
  if (!hole) return false;
  // Keep the recorded fall on the swept path beside this opening.
  // This also catches fast dashes and knockback that cross the entire hole.
  const dx = a.x - previous.x,
    dy = a.y - previous.y;
  const length2 = dx * dx + dy * dy;
  const t = length2
    ? Math.max(
        0,
        Math.min(
          1,
          ((hole.x - previous.x) * dx + (hole.y - previous.y) * dy) / length2,
        ),
      )
    : 0;
  a.x = previous.x + dx * t;
  a.y = previous.y + dy * t;
  g.fell(a, { terrain: hole });
  return !a.alive;
}
export function warRecoveryTarget(g, a) {
  if (g.mode !== "war" || !a.alive || a.ghost || a.hp >= a.maxHp * 0.65)
    return null;
  return (
    g.healthDrops
      .filter((d) => d.team === a.team)
      .sort(
        (b, c) =>
          Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(a.x - c.x, a.y - c.y),
      )[0] || null
  );
}

// Streaks belong to the match, so a fighter's normal respawn reset cannot erase them.
export function recordWarDeath(g, victim, killer) {
  if (g.mode !== "war") return;
  if (killer && killer.team !== victim.team) g.warDeathStreaks[killer.id] = 0;
  const streak = (g.warDeathStreaks[victim.id] || 0) + 1;
  g.warDeathStreaks[victim.id] = streak;
  if (streak % 2 !== 0) return;
  const base = g.warBases[victim.team];
  const pool = Object.keys(ELEMENTS).filter((e) =>
    combination([base.element], [e]),
  );
  const part =
    pool[Math.min(pool.length - 1, Math.floor(g.random() * pool.length))];
  if (!part) return;
  g.dropToken({
    ...g.floorPoint({ x: base.x, y: base.y + 75 }, 24),
    team: victim.team,
    parts: [part],
    souls: [],
    warBonus: true,
    bornAt: g.time,
    portalCooldown: 0.3,
  });
}
export function canSeeWarTrap(g, fighter, trap) {
  return (
    g.warElements?.[fighter.team] === "dark" || trap.knownBy.has(fighter.id)
  );
}
function updateWarTraps(g) {
  if (!g.spikeTraps.length) return;
  for (const a of g.fighters) {
    if (!a.alive || !inWorld(a)) {
      g.warTrapPositions.delete(a.id);
      continue;
    }
    const previous = g.warTrapPositions.get(a.id) || a;
    const swept = Math.hypot(previous.x - a.x, previous.y - a.y) <= 80;
    for (const trap of g.spikeTraps) {
      const gap = swept
        ? segmentDistance(trap, previous, a)
        : Math.hypot(a.x - trap.x, a.y - trap.y);
      if (gap > trap.r + 8) continue;
      trap.knownBy.add(a.id);
      if (g.time < (trap.nextHit.get(a.id) ?? -Infinity)) continue;
      trap.nextHit.set(a.id, g.time + 1);
      trap.triggeredAt = g.time;
      // Neutral mechanical damage affects either army, including fused fighters.
      a.hp = Math.max(0, a.hp - 18);
      a.hitReact = 0.24;
      a.hitDx = 0;
      a.hitDy = -1;
      a.hurtReveal = 0.15;
      if (a.hp <= 0) {
        g.fell(a);
        break;
      }
    }
    g.warTrapPositions.set(a.id, { x: a.x, y: a.y });
  }
}
