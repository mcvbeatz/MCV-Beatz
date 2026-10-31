import { inWorld } from "./portals.js";

// Healing charges from power 1 to 2.6 and restores 23 HP per power.
export const WAR_HEAL = 23 * 2.6;
export function initializeWar(g) {
  if (g.mode !== "war") return;
  g.healthDrops = [];
  g.nextHealthDropAt = 10;
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
  while (g.time + 1e-9 >= g.nextHealthDropAt) {
    for (const base of g.warBases) {
      if (base.element === "light") continue;
      const index = Math.round(g.nextHealthDropAt / 10) - 1;
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
    g.nextHealthDropAt += 10;
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
      recipient.hp = Math.min(recipient.maxHp, recipient.hp + WAR_HEAL);
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
