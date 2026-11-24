import { inWorld } from "./portals.js";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const FLOOD_WATER_SPEED = 1.25;
// Mutates only the supplied actor's scalar movement fields. World/map state is
// read-only. Combat consequences and aim locks deliberately remain in Combat.
export function integrateMovement(game, a, dx, dy, dt) {
  if (game.countingDown || (!a.alive && !a.ghost) || !inWorld(a)) return false;
  if (a.blink && Math.hypot(a.knockX, a.knockY) > 1) a.blink = null;
  const shocked = game.isShocked(a);
  if (a.prisonHp > 0 || a.blink || shocked) {
    a.vx = a.vy = a.knockX = a.knockY = a.movingTime = 0;
    // A trapped burst keeps its animation and action duration, but cannot move.
    if (a.blink || shocked) a.burst = 0;
    a.gaitDistance = 0;
    return false;
  }
  const old = { x: a.x, y: a.y };
  const length = Math.hypot(dx, dy),
    magnitude = Math.min(1, length);
  if (length) {
    dx /= length;
    dy /= length;
  }
  const movementHealth =
    game.mode === "corruption" || a.zombieEnemy ? (a.hp / a.maxHp) * 120 : a.hp;
  const swimming =
    a.parts.includes("water") &&
    game.hazards.some(
      (h) =>
        h.kind === "flood" && h.life > 0 && inWorld(h) && distance(a, h) <= h.r,
    );
  let speed =
    150 *
    (swimming ? FLOOD_WATER_SPEED : 1) *
    (a.waveSpeed || 1) *
    (a.ghost
      ? 1.1
      : movementHealth < 40
        ? 0.55 + (0.45 * movementHealth) / 40
        : 1) *
    (game.flying(a) ? 1.28 : 1) *
    (a.boost > 0 ? 1.7 : 1) *
    (a.charging ? 0.65 : 1) *
    (a.slow > 0 ? 0.48 : 1) *
    (a.shield ? 0.32 : 1) *
    (a.element === "invincible" ? 0.85 : 1);
  if (game.mode === "turnpike")
    speed *= (game.map.onTrack(a) ? 1 : 0.18) * (a.ghost ? 0.5 : 1);
  const blend = game.flying(a) ? Math.min(1, dt * 4) : 1;
  a.vx += (dx * speed * magnitude - a.vx) * blend;
  a.vy += (dy * speed * magnitude - a.vy) * blend;
  if (a.burst > 0) {
    const burstSpeed =
      game.mode === "turnpike" && !game.map.onTrack(a) ? 650 * 0.18 : 650;
    a.vx = a.burstX * burstSpeed;
    a.vy = a.burstY * burstSpeed;
  }
  if (game.map)
    game.map.move(
      a,
      a.x + (a.vx + a.knockX) * dt,
      a.y + (a.vy + a.knockY) * dt,
    );
  else {
    a.x = clamp(a.x + (a.vx + a.knockX) * dt, 135, 889);
    a.y = clamp(a.y + (a.vy + a.knockY) * dt, 175, 560);
  }
  a.knockX *= Math.exp(-7 * dt);
  a.knockY *= Math.exp(-7 * dt);
  a.movingTime =
    (length || a.burst > 0) && distance(old, a) > 0.05 ? a.movingTime + dt : 0;
  // Accumulate only voluntary ground travel, not knockback, blocked input or dashes.
  const moved = distance(old, a);
  a.gaitDistance =
    length && moved > 0.05 && a.burst <= 0
      ? ((a.gaitDistance || 0) + Math.min(moved, speed * magnitude * dt)) % 75
      : 0;
  if (length) {
    a.fx = dx;
    a.fy = dy;
  }
  return true;
}
