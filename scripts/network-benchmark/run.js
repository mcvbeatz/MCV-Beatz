import { WireMeter } from "./wire-meter.js";
import { fork } from "node:child_process";
import { once } from "node:events";
import { WebSocket } from "ws";
import { writeFile } from "node:fs/promises";
import { SNAPSHOT_CODEC, SnapshotDecoder } from "../../src/snapshot-delta.js";
import { performance } from "node:perf_hooks";
const optimized = process.env.BENCH_TRANSPORT === "delta";
const seconds = Number(process.env.BENCH_SECONDS || 15);
const results = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, mode, players] of [
  ["1v1", "ffa", 2],
  ["4v4", "tdm", 8],
  ["5v5", "war", 10],
  ["Zombies", "zombies", 8],
]) {
  const child = fork(new URL("./server.js", import.meta.url), { silent: true });
  child.stderr.on("data", (b) => process.stderr.write(b));
  const next = () => once(child, "message").then(([m]) => m);
  const { port } = await next();
  const sockets = [];
  const sizes = [];
  const wireSizes = [];
  const intervals = [];
  const latencies = [];
  let measuring = false,
    last = 0;
  for (let i = 0; i < players; i++) {
    const decoder = new SnapshotDecoder();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(ws, "open");
    const wireMeter = new WireMeter(ws._socket, (bytes) => {
      if (measuring && i === 0) wireSizes.push(bytes);
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      wireMeter.message(msg.kind);
      if (msg.kind === "snapshot") decoder.receive(msg);
      if (msg.kind === "error") throw Error(msg.message);
      if (!measuring || i !== 0) return;
      if (msg.kind === "state" || msg.kind === "snapshot") {
        sizes.push(raw.length);
        const now = performance.now();
        if (last) intervals.push(now - last);
        last = now;
      }
    });
    ws.send(
      JSON.stringify({
        kind: "join",
        mode,
        guest: true,
        snapshotCodec: optimized ? SNAPSHOT_CODEC : undefined,
        element: i % 2 ? "water" : "fire",
      }),
    );
    await once(ws, "message");
    sockets.push(ws);
  }
  child.send({ kind: "start", players });
  await next();
  let n = 0;
  const inputs = setInterval(() => {
    n++;
    sockets.forEach((ws, i) => {
      const a = n * 0.04 + (i * Math.PI * 2) / players;
      ws.send(JSON.stringify({ kind: "move", x: Math.cos(a), y: Math.sin(a) }));
      if (n % 8 === 0) ws.send(JSON.stringify({ kind: "strike" }));
      if (n % 50 === 1) ws.send(JSON.stringify({ kind: "startCharge" }));
      if (n % 50 === 35 && mode !== "zombies")
        ws.send(JSON.stringify({ kind: "releaseCharge" }));
    });
  }, 50);
  const ping = setInterval(() => {
    const start = performance.now();
    sockets[0].ping();
    sockets[0].once("pong", () => {
      if (measuring) latencies.push(performance.now() - start);
    });
  }, 500);
  await wait(2000);
  child.send({ kind: "reset" });
  await next();
  measuring = true;
  await wait(seconds * 1000);
  measuring = false;
  child.send({ kind: "report" });
  const result = await next();
  clearInterval(inputs);
  clearInterval(ping);
  const stats = (v) => ({
    count: v.length,
    mean: v.reduce((a, b) => a + b, 0) / v.length,
    p95: [...v].sort((a, b) => a - b)[
      Math.max(0, Math.ceil(v.length * 0.95) - 1)
    ],
  });
  results.push({
    name,
    mode,
    players,
    transport: optimized ? "delta" : "legacy",
    compression: process.env.BENCH_COMPRESSION !== "0",
    compressionLevel: Number(process.env.WS_COMPRESSION_LEVEL || 6),
    ...result,
    client: {
      snapshotBytes: stats(sizes),
      wireSnapshotBytes: stats(wireSizes),
      snapshotIntervalMs: stats(intervals),
      websocketRttMs: stats(latencies),
    },
  });
  console.log(name, JSON.stringify(results.at(-1)));
  sockets.forEach((ws) => ws.close());
  child.send({ kind: "close" });
  await once(child, "exit");
}
await writeFile(
  process.env.BENCH_OUTPUT || "/tmp/network-benchmark.json",
  JSON.stringify(
    { date: new Date().toISOString(), node: process.version, seconds, results },
    null,
    2,
  ) + "\n",
);
