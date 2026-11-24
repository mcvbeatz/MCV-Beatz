import { integrateMovement } from "./movement-physics.js";
import { inWorld } from "./portals.js";
export { MOVEMENT_CAPABILITY as MOVEMENT_PREDICTION } from "./movement-ack.js";
export const PREDICTION_LIMITS = Object.freeze({
  remoteInterpolationMs: 100,
  maxHistory: 96,
  maxReplaySeconds: 0.5,
  staleMs: 500,
  maxStep: 1 / 30,
  softCorrection: 24,
  snapDistance: 70,
  correctionSeconds: 0.07,
  transitionMargin: 45,
});
export function predictionRequested() {
  return (
    globalThis.__FUSION_PREDICTION__ !== false &&
    new URLSearchParams(globalThis.location?.search || "").get("prediction") !==
      "0"
  );
}
export const PRESENTATION_FIELDS = [
  "x",
  "y",
  "vx",
  "vy",
  "fx",
  "fy",
  "movingTime",
  "gaitDistance",
];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function predictionSafe(g, a) {
  if (
    !a ||
    g.finished ||
    g.countingDown ||
    g.gridCelebration ||
    g.intermission ||
    g.waveTravel ||
    g.dungeon?.reward ||
    (!a.alive && !a.ghost) ||
    !inWorld(a)
  )
    return false;
  if (
    a.burst > 0 ||
    a.blink ||
    a.prisonHp > 0 ||
    a.teleportArrival > 0 ||
    Math.hypot(a.knockX || 0, a.knockY || 0) > 1 ||
    g.isShocked(a)
  )
    return false;
  const margin = PREDICTION_LIMITS.transitionMargin;
  if (
    (g.portals?.portals || []).some(
      (p) => distance(a, p) < (p.r || 21) + margin,
    )
  )
    return false;
  if (
    !g.flying(a) &&
    [
      ...(g.hazards || []).filter((h) =>
        ["chasm", "quicksand"].includes(h.kind),
      ),
      ...(g.map?.chasms || []),
    ].some((h) => distance(a, h) < (h.r || 40) + margin)
  )
    return false;
  return true;
}
const identity = (g, a, context) =>
  JSON.stringify([
    context,
    a.id,
    a.element,
    a.parts,
    a.alive,
    !!a.ghost,
    a.respawnAt,
    a.dimension,
    a.transit,
    a.portal,
  ]);
export class MovementPrediction {
  constructor(diagnostics) {
    this.diagnostics = diagnostics;
    this.nextSeq = 0;
    this.enabled = false;
    this.clear();
  }
  clear() {
    this.history = [];
    this.current = null;
    this.state = null;
    this.offset = { x: 0, y: 0 };
    this.lastStep = -1;
    this.key = null;
    this.epoch = null;
    this.game = null;
    this.suspended = false;
  }
  setInput(x, y) {
    if (!this.current || this.current.x !== x || this.current.y !== y)
      this.current = this.newInput(x, y);
  }
  newInput(x, y) {
    const entry = { seq: ++this.nextSeq, x, y, dt: 0, sent: false };
    this.history.push(entry);
    if (this.history.length > PREDICTION_LIMITS.maxHistory) {
      this.history.shift();
      this.suspended = true;
    }
    return entry;
  }
  command() {
    if (this.current.sent)
      this.current = this.newInput(this.current.x, this.current.y);
    this.current.sent = true;
    return { seq: this.current.seq, x: this.current.x, y: this.current.y };
  }
  simulate(actor, seconds, input) {
    let remaining = seconds;
    while (remaining > 1e-8) {
      const dt = Math.min(PREDICTION_LIMITS.maxStep, remaining);
      // Server ages these before voluntary movement. Never predict ability casts.
      if (!this.game.lobby)
        for (const key of ["boost", "slow"])
          actor[key] = Math.max(0, (actor[key] || 0) - dt);
      if (!predictionSafe(this.game, actor)) return false;
      integrateMovement(this.game, actor, input.x, input.y, dt);
      remaining -= dt;
    }
    return true;
  }
  advance(dt, now = performance.now()) {
    if (!this.enabled || !this.state || !this.current) return;
    if (
      now - this.receivedAt > PREDICTION_LIMITS.staleMs ||
      this.history.reduce((n, e) => n + e.dt, 0) >
        PREDICTION_LIMITS.maxReplaySeconds
    ) {
      this.suspended = true;
      this.offset = { x: 0, y: 0 };
      return;
    }
    dt = Math.max(0, Math.min(0.04, dt));
    this.current.dt += dt;
    if (this.suspended || !predictionSafe(this.game, this.game.player)) return;
    if (!this.simulate(this.state, dt, this.current)) {
      this.suspended = true;
      this.offset = { x: 0, y: 0 };
      return;
    }
    const decay = Math.exp(-dt / PREDICTION_LIMITS.correctionSeconds);
    this.offset.x *= decay;
    this.offset.y *= decay;
  }
  reconcile(game, ack, context, now = performance.now()) {
    this.game = game;
    if (!this.enabled || !Array.isArray(ack)) return;
    const [seq, applied, step, epoch] = ack;
    const key = identity(game, game.player, context);
    if (key === this.key && epoch === this.epoch && step <= this.lastStep)
      return;
    const started = performance.now(),
      old = this.presentation(),
      changed = key !== this.key || epoch !== this.epoch;
    this.receivedAt = now;
    this.lastStep = step;
    this.epoch = epoch;
    this.key = key;
    const safe = predictionSafe(game, game.player);
    this.history = this.history.filter((e) => e.seq >= seq);
    let remaining = 0;
    const actor = { ...game.player };
    for (const e of this.history)
      remaining += e.seq === seq ? Math.max(0, e.dt - applied) : e.dt;
    if (changed || !safe || remaining > PREDICTION_LIMITS.maxReplaySeconds) {
      this.history = [];
      this.current = null;
    } else
      for (const e of this.history) {
        if (
          !this.simulate(
            actor,
            e.seq === seq ? Math.max(0, e.dt - applied) : e.dt,
            e,
          )
        ) {
          Object.assign(actor, game.player);
          this.history = [];
          this.current = null;
          break;
        }
      }
    this.state = actor;
    this.suspended = !safe;
    this.offset = { x: 0, y: 0 };
    const error = old ? distance(old, actor) : 0;
    if (old && !changed && safe) {
      this.diagnostics?.observe("predictionError", error);
      if (error > 0.25) this.diagnostics?.count("predictionCorrections");
      if (
        error <= PREDICTION_LIMITS.softCorrection &&
        (!game.map?.lineClear || game.map.lineClear(actor, old, 13))
      )
        this.offset = { x: old.x - actor.x, y: old.y - actor.y };
      else if (error > PREDICTION_LIMITS.softCorrection)
        this.diagnostics?.count("predictionSnaps");
    }
    this.diagnostics?.observe("unacknowledgedInputs", this.history.length);
    this.diagnostics?.observe("reconcileMs", performance.now() - started);
  }
  presentation() {
    if (!this.enabled || !this.state || this.suspended) return null;
    const p = {};
    for (const key of PRESENTATION_FIELDS) p[key] = this.state[key];
    p.x += this.offset.x;
    p.y += this.offset.y;
    if (
      this.game?.map?.lineClear &&
      !this.game.map.lineClear(this.state, p, 13)
    ) {
      p.x = this.state.x;
      p.y = this.state.y;
    }
    return p;
  }
}
