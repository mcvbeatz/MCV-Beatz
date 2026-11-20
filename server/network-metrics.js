import { performance, monitorEventLoopDelay } from "node:perf_hooks";

// Aggregate-only, bounded diagnostics. Socket bytes exclude TLS/proxy/IP overhead.
export class NetworkMetrics {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.sockets = new Map();
    this.active = new Set();
    this.loop = enabled ? monitorEventLoopDelay({ resolution: 20 }) : null;
    this.loop?.enable();
    this.reset();
  }
  reset() {
    this.started = performance.now();
    this.cpu = process.cpuUsage();
    this.utilization = performance.eventLoopUtilization();
    this.counts = {};
    this.samples = {};
    this.loop?.reset();
    for (const ws of this.sockets.keys())
      this.sockets.set(ws, ws._socket?.bytesWritten || 0);
  }
  add(key, value = 1) {
    if (this.enabled) this.counts[key] = (this.counts[key] || 0) + value;
  }
  observe(key, value) {
    if (!this.enabled) return;
    const s = (this.samples[key] ||= { n: 0, sum: 0, max: 0, values: [] });
    s.values[s.n % 1024] = value;
    s.n++;
    s.sum += value;
    s.max = Math.max(s.max, value);
  }
  track(ws) {
    if (this.enabled) this.sockets.set(ws, ws._socket?.bytesWritten || 0);
  }
  setActive(ws, active) {
    this.collect(ws);
    if (active && this.enabled) this.active.add(ws);
    else this.active.delete(ws);
  }
  collect(ws, remove = false) {
    if (!this.sockets.has(ws)) return;
    const bytes = ws._socket?.bytesWritten || this.sockets.get(ws);
    const delta = Math.max(0, bytes - this.sockets.get(ws));
    this.add("wireBytes", delta);
    this.add(
      this.active.has(ws) ? "roomWireBytes" : "directoryWireBytes",
      delta,
    );
    if (remove) {
      this.sockets.delete(ws);
      this.active.delete(ws);
    } else this.sockets.set(ws, bytes);
  }
  report() {
    for (const ws of this.sockets.keys()) this.collect(ws);
    const seconds = (performance.now() - this.started) / 1000;
    const cpu = process.cpuUsage(this.cpu);
    const timings = Object.fromEntries(
      Object.entries(this.samples).map(([key, s]) => {
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
    );
    return {
      seconds,
      ...this.counts,
      timings,
      wireBytesPerPlayerMinute:
        ((this.counts.roomWireBytes || 0) * 60) /
        (this.counts.playerSeconds || 1),
      snapshotsPerSecond:
        (this.counts.snapshots || 0) / (this.counts.roomSeconds || 1),
      cpuMs: (cpu.user + cpu.system) / 1000,
      cpuMsPerSecond: (cpu.user + cpu.system) / 1000 / seconds,
      eventLoopUtilization: performance.eventLoopUtilization(this.utilization)
        .utilization,
      eventLoopDelayMs: this.loop
        ? {
            mean: this.loop.mean / 1e6 || 0,
            p95: this.loop.percentile(95) / 1e6,
            max: this.loop.max / 1e6,
          }
        : null,
    };
  }
  close() {
    this.loop?.disable();
    this.sockets.clear();
    this.active.clear();
  }
}
