// Bounded, local-only counters. No identities, inputs, tokens, or snapshot bodies.
export class ClientNetworkDiagnostics {
  constructor() {
    this.reset();
  }
  reset() {
    this.started = performance.now();
    this.values = {};
    this.counts = {};
    this.inputAt = null;
    this.lastDraw = null;
    this.bytes = 0;
    this.snapshots = 0;
    this.frames = 0;
    this.frameSeconds = 0;
    this.resyncs = 0;
    this.lastSnapshot = null;
  }
  inputEvent() {
    this.inputEventAt = performance.now();
  }
  armMovement() {
    this.inputAt = this.inputEventAt ?? performance.now();
  }
  drawPosition(p) {
    if (
      this.inputAt !== null &&
      this.lastDraw &&
      Math.hypot(p.x - this.lastDraw.x, p.y - this.lastDraw.y) > 0.25
    ) {
      this.observe("inputToDrawMs", performance.now() - this.inputAt);
      this.inputAt = null;
    }
    this.lastDraw = { x: p.x, y: p.y };
  }
  count(key) {
    this.counts[key] = (this.counts[key] || 0) + 1;
  }
  observe(key, value) {
    const s = (this.values[key] ||= { n: 0, sum: 0, max: 0, values: [] });
    s.values[s.n % 256] = value;
    s.n++;
    s.sum += value;
    s.max = Math.max(s.max, value);
  }
  snapshot(bytes) {
    const now = performance.now();
    if (this.lastSnapshot !== null)
      this.observe("snapshotIntervalMs", now - this.lastSnapshot);
    this.lastSnapshot = now;
    this.snapshots++;
    this.bytes += bytes;
  }
  frame(seconds, renderMs) {
    if (seconds > 0 && seconds < 1) {
      this.frames++;
      this.frameSeconds += seconds;
    }
    this.observe("renderMs", renderMs);
  }
  report() {
    const seconds = (performance.now() - this.started) / 1000;
    return {
      seconds,
      counters: { ...this.counts },
      receivedJsonBytes: this.bytes,
      receivedJsonBytesPerMinute: (this.bytes * 60) / seconds,
      snapshotsPerSecond: this.snapshots / seconds,
      renderFps: this.frames / (this.frameSeconds || 1),
      snapshotAgeMs:
        this.lastSnapshot === null
          ? null
          : performance.now() - this.lastSnapshot,
      resyncs: this.resyncs,
      timings: Object.fromEntries(
        Object.entries(this.values).map(([key, s]) => {
          const v = [...s.values].sort((a, b) => a - b);
          return [
            key,
            {
              count: s.n,
              mean: s.sum / s.n,
              p95: v[Math.max(0, Math.ceil(v.length * 0.95) - 1)],
              max: s.max,
            },
          ];
        }),
      ),
    };
  }
}
