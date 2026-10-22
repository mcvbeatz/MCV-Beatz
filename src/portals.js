// Every mobile world entity uses the same portal lifecycle. Hidden travellers
// keep their state, but cannot collide, take damage, or age off-screen.
export const inWorld = (entity) =>
  !entity.dimension && !entity.transit && !entity.removed;
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l = dx * dx + dy * dy;
  const t = l
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export class PortalSystem {
  constructor(game) {
    this.game = game;
    this.portals = [];
    this.placing = null;
    this.nextId = 0;
  }
  owned(owner) {
    return this.portals.filter((p) => p.owner === owner.id);
  }
  begin(owner) {
    if (!owner.alive) return false;
    if (this.owned(owner).length >= 2) {
      this.game.cue("portal", owner, "#ffffff");
      return false;
    }
    this.placing = owner.id;
    return true;
  }
  place(owner, x, y, { autonomous = false } = {}) {
    if (
      (this.placing !== owner.id && !(autonomous && owner.aiControlled)) ||
      !owner.alive ||
      this.owned(owner).length >= 2
    )
      return false;
    if (x < 135 || x > 889 || y < 175 || y > 560) {
      this.game.cue("unavailable", { x, y }, "#dc9c85");
      return false;
    }
    if (this.portals.some((p) => Math.hypot(x - p.x, y - p.y) < 85)) {
      this.game.cue("unavailable", { x, y }, "#dc9c85");
      return false;
    }
    if (
      this.game.fighters.some(
        (a) =>
          (a.alive || a.ghost) &&
          inWorld(a) &&
          Math.hypot(a.x - x, a.y - y) < 40,
      )
    ) {
      this.game.cue("unavailable", { x, y }, "#dc9c85");
      return false;
    }
    const p = {
      id: ++this.nextId,
      owner: owner.id,
      x,
      y,
      r: 25,
      opensAt: this.game.time + 0.5,
    };
    owner.reveal = 0.45;
    this.portals.push(p);
    const pair = this.owned(owner);
    if (pair.length === 2 && this.placing === owner.id) this.placing = null;
    return true;
  }
  active(portal) {
    return this.game.time + 1e-9 >= portal.opensAt;
  }
  update() {
    for (const entity of this.travellers()) {
      if (!entity.dimension) continue;
      const entry = this.portals.find(
        (p) => p.id === entity.dimension.portal && this.active(p),
      );
      const exit =
        entry &&
        this.portals.find(
          (p) => p.owner === entry.owner && p !== entry && this.active(p),
        );
      if (exit)
        this.exit(entity, exit, entity.dimension.dx, entity.dimension.dy);
    }
  }
  travellers() {
    return [
      ...this.game.fighters.filter((a) => a.alive || a.ghost),
      ...this.game.tokens,
      ...this.game.projectiles,
      ...this.game.waves,
      ...this.game.hazards,
    ].filter((e) => !e.removed);
  }
  close(owner, id) {
    const portal = this.portals.find(
      (p) => p.id === id && p.owner === owner.id,
    );
    if (!portal) return false;
    owner.reveal = 0.45;
    for (const e of this.travellers()) {
      const trapped = e.dimension?.portal === id;
      const crossing =
        e.transit && (e.transit.entry === id || e.transit.exit === id);
      if (!trapped && !crossing) continue;
      if (e.hp !== undefined) {
        e.x = portal.x;
        e.y = portal.y;
        this.game.fell(e, { lost: trapped || e.ghost, killer: owner });
      } else {
        e.removed = true;
        if (e.owner && e.parts) {
          for (const soul of e.souls || [{ owner: e.owner }]) {
            const fallen = this.game.fighters.find((a) => a.id === soul.owner);
            if (fallen) {
              fallen.lost = true;
              fallen.ghost = false;
            }
          }
        }
      }
      e.dimension = null;
      e.transit = null;
    }
    this.portals = this.portals.filter((p) => p !== portal);
    this.game.effects.push({
      kind: "portal-close",
      x: portal.x,
      y: portal.y,
      color: "#ffffff",
      r: 70,
      life: 0.4,
      max: 0.4,
    });
    return true;
  }
  exit(e, p, dx, dy) {
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    // Choose an inward exit near the arena boundary rather than stranding a
    // fighter outside the playable floor.
    if (p.x + dx * 49 < 135 || p.x + dx * 49 > 889) dx = -dx;
    if (p.y + dy * 49 < 175 || p.y + dy * 49 > 560) dy = -dy;
    e.x = Math.max(135, Math.min(889, p.x + dx * 49));
    e.y = Math.max(175, Math.min(560, p.y + dy * 49));
    e.dimension = null;
    e.transit = null;
    e.portalCooldown = 0.55;
    e.lastX = e.x;
    e.lastY = e.y;
    if (e.kind === "sonic") {
      e.originX = e.x;
      e.originY = e.y;
      e.radius = 0;
      e.previousRadius = 0;
    }
    if (e.kind === "laser") e.trail = 0;
  }
  tick(e, dt, input) {
    e.portalCooldown = Math.max(0, (e.portalCooldown || 0) - dt);
    if (e.transit) {
      e.transit.time -= dt;
      if (e.transit.time <= 0) {
        const p = this.portals.find((p) => p.id === e.transit.exit);
        if (p) this.exit(e, p, e.transit.dx, e.transit.dy);
      }
      return true;
    }
    if (!e.dimension) return false;
    const d = e.dimension;
    d.age += dt;
    const p = this.portals.find((p) => p.id === d.portal);
    if (!p) return true;
    if (e.hp !== undefined) {
      let dx = input?.x || 0,
        dy = input?.y || 0;
      if (e.id !== "player" && d.age > 0.45) {
        dx = -d.dx;
        dy = -d.dy;
      }
      const len = Math.hypot(dx, dy);
      if (len) {
        dx /= Math.max(1, len);
        dy /= Math.max(1, len);
        d.depth = Math.max(
          0,
          Math.min(80, d.depth + (dx * d.dx + dy * d.dy) * 150 * dt),
        );
      }
      if (d.depth <= 0) this.exit(e, p, -d.dx, -d.dy);
    }
    return true;
  }
  enter(e, previous) {
    if (!inWorld(e) || e.portalCooldown > 0) return false;
    const p = this.portals.find(
      (p) => this.active(p) && segmentDistance(p, previous, e) <= p.r,
    );
    if (!p) return false;
    const dx = e.x - previous.x,
      dy = e.y - previous.y;
    const len = Math.hypot(dx, dy);
    const dirX = len ? dx / len : e.fx || 1,
      dirY = len ? dy / len : e.fy || 0;
    const exit = this.portals.find(
      (q) => q.owner === p.owner && q.id !== p.id && this.active(q),
    );
    e.x = p.x;
    e.y = p.y;
    if (exit)
      e.transit = {
        entry: p.id,
        exit: exit.id,
        time: 0.18,
        dx: dirX,
        dy: dirY,
      };
    else e.dimension = { portal: p.id, depth: 30, dx: dirX, dy: dirY, age: 0 };
    if (e.hp !== undefined) {
      e.vx = e.vy = 0;
      e.blink = null;
      e.lock = null;
    }
    return true;
  }
}
