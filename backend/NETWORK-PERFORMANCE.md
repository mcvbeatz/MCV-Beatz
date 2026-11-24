# Multiplayer transport and performance

For the prepared client-side movement update, see [prediction measurements, compatibility and owner instructions](MOVEMENT-PREDICTION.md). The owner approved that update for deployment on 2026-11-24; the v0.63 transport measurements below describe the preceding release.

## Compatibility and deployment

Gameplay protocol remains **4**. `json-delta-v1` is a negotiated, optional transport extension; it is not a new combat protocol. New clients advertise `snapshotCodec` in their first browse/join request. The server replies with a private `identity` message followed by shared `snapshot` frames. Old protocol-4 clients receive their original `state` messages. New clients also accept the old server's `state` messages. Mixed rooms are supported (they require both graph formats, so update browsers to get the full benefit).

Deploy the server source to the existing Render Node Web Service (`npm ci`, `npm run start:server`), then deploy the Vite build to GitHub Pages. No database migration, paid Render feature, additional service, or new dependency is needed. Existing Supabase and `ALLOWED_ORIGINS` settings remain unchanged. `/health` should report `protocolVersion: 4` and `snapshotCodec: "json-delta-v1"`. Restarting Render still ends in-memory rooms; deploy between sessions. Reload clients after deployment. Older cached protocol-4 clients continue to work.

## Lossless updates

- Combat stays authoritative at 30 Hz; room snapshots remain every third tick (approximately 10 Hz). No positions, precision, health, effects, abilities, AI, collision data, objective state, progression, or match rules are removed or approximated.
- Previously, each update traversed the entire game graph, renumbered objects in traversal order, and serialized the full result separately for every recipient. Adding a projectile could shift subsequent references. Static settings, names, cosmetics, accumulated statistics, and unchanged collections were repeatedly transmitted.
- Optimized rooms assign stable graph references, reclaim unreachable references, and send only changed JSON fields/array entries. Unchanged values are sent initially and whenever they change. Root changes, array removals, sets, maps, cycles, and deleted fields are preserved. The renderer receives the same complete reconstructed graph.
- JSON serialization/diffing happens once per room snapshot; clients share the resulting string. Each connection still has its own WebSocket compression stream and authorization/room membership. If a delta is larger than a full snapshot, the server sends the full snapshot.
- Every frame has a transport ID; deltas name their base. Clients ignore duplicates/late frames and request a full snapshot when a base is missing. Joins and reconnects start from a full snapshot. Backpressured sockets skip obsolete updates; the next send is a full current snapshot. At most one snapshot write is pending per socket, with a 256 KiB buffered limit. Recovery requests are rate limited.
- WebSocket/TCP normally delivers ordered, reliable messages. Recovery also handles deliberate skipped writes and application-level loss/delay. It does not add reconnect-to-active-match: the existing departure-to-AI and lobby-rejoin behavior remains.
- Existing draw-only fighter interpolation stays at 100 ms, including teleport/respawn snapping. Input handling, stale-input release, and authoritative hit tests are unchanged. A delayed network cannot be made latency-free by interpolation.

## Render Free diagnostics

Set `NETWORK_DIAGNOSTICS=1` on Render to enable:

- One aggregate JSON log per minute (no snapshots, account IDs, names, tokens, or individual inputs).
- `GET /network-metrics`: current aggregate window; no authentication data and no endpoint to mutate/reset statistics. Leave diagnostics off if you don't want operational totals publicly visible.
- Serialized bytes, snapshot bytes, outbound socket bytes, player-seconds, room-seconds, snapshots/second, bytes/player/minute, keyframes, deltas, skipped sends, recovery counts.
- Mean/p95/max per-room combat, graph packing, JSON serialization, delta encoding, total server tick, and send-completion durations; process CPU time; event-loop utilization and event-loop delay.

Samples are bounded to 1,024 per timing: mean/max cover the reporting window and p95 covers the latest samples. The event-loop monitor uses 20 ms resolution; its delay histogram includes this sampling interval, not just excess blocking. `sendCompletionMs` includes asynchronous compression/write waiting and is **not** CPU time. Process CPU includes compression worker work and excludes benchmark clients.

Socket byte counts use Node's `bytesWritten`, including WebSocket framing and negotiated compression. They exclude Render's TLS/proxy/TCP/IP overhead and are **not a claim to reproduce Render billing exactly**. JSON byte counts are measured before WebSocket compression. Player-minute rates use room-socket bytes and integrated connected player time, rather than assuming a fixed population. Directory-only traffic is counted separately in `directoryWireBytes`; `wireBytes` remains the total.

Compression is enabled by default, with context takeover and zlib level 6. `WS_COMPRESSION=0` disables it for comparison; `WS_COMPRESSION_LEVEL=1` through `9` changes the level. Avoid disabling compression merely because deltas are smaller: measure the actual wire cost first. The 1,024-byte threshold does not guarantee small frames avoid compression when context takeover is negotiated.

In browser developer tools:

```js
__app.lobby.diagnostics.report()
__app.lobby.diagnostics.reset()
```

This exposes aggregate received JSON bytes, snapshot cadence/age, receive-processing time, rendering time/FPS, resync count, and application ping round-trip time. Timing samples are bounded to the latest 256 values for percentiles. Counters are local and contain no player information; nothing is uploaded or logged automatically. Ping runs once every five seconds while connected. FPS measures visible battle/lobby animation frames; background-tab throttling and hardware affect it. Browser APIs do not expose compressed WebSocket payload size reliably; use server socket metrics for wire bytes.

## Repeatable measurements

```sh
# Baseline protocol-4 full snapshots, current optimized deltas, and compression cost
BENCH_TRANSPORT=legacy BENCH_OUTPUT=/tmp/before.json node scripts/network-benchmark/run.js
BENCH_TRANSPORT=delta BENCH_OUTPUT=/tmp/after.json node scripts/network-benchmark/run.js
BENCH_TRANSPORT=delta BENCH_COMPRESSION=0 BENCH_OUTPUT=/tmp/uncompressed.json node scripts/network-benchmark/run.js
WS_COMPRESSION_LEVEL=1 BENCH_TRANSPORT=delta BENCH_OUTPUT=/tmp/level1.json node scripts/network-benchmark/run.js

# In another terminal first: npm run dev -- --port 5173
node scripts/network-benchmark/browser.js
```

Each network case runs its server in a separate child process, opens real WebSocket connections, warms up for two seconds, and measures 15 seconds by default (`BENCH_SECONDS` overrides). Cases are 1v1 FFA, 4v4 Team Death Match, 5v5 War, and eight-player Zombies seeded with 100 enemies in the boss room. Competitive clients send movement, strikes, and charged abilities; Zombies uses the game's existing AI for cooperative seats to sustain the fight. Random initialization is seeded, but real-time scheduling and AI evolution mean runs are not identical traces. Results include final phase and actor count. The benchmark also parses actual WebSocket frame boundaries before decompression to measure transmitted snapshot sizes directly. Do not compare a completed idle run to active combat without noting it.

Browser measurements use the real illustrated Canvas game at 1280×720 in headless Chromium, one rendered client plus the remaining WebSocket clients, both legacy and delta transports, three seconds warm-up and ten seconds sampling per case. Browser/driver/server processes share the local test host. These are local microbenchmarks, not WAN/mobile or Render capacity guarantees. Repeat under actual production load using the diagnostics above.

Automated tests cover complete graph equivalence in every multiplayer mode, changing references/arrays/maps/sets, bounded reference reuse, duplicates, loss, delayed frames, full recovery, mixed old/new clients, multiple real sockets, authoritative movement, reconnects, disabled diagnostics, and two real browser clients in landscape and portrait.

## Measured results — 20 November 2026

Local Linux x64, AMD EPYC 9V74 host, Node 24.19.0; one room at a time, real WebSockets on loopback. The baseline uses the original protocol-4 full-state/per-recipient serialization path in the instrumented server. Each primary sample is 15 seconds after a two-second warm-up. Both baseline and optimized runs remained in battle; Zombies ended with 111 actors. A second run of each format and the raw data are retained below. Scheduling/AI and host load vary; these are observations, not statistical confidence intervals or Render/WAN performance claims.

**Snapshot sizes and bandwidth.** JSON is the actual UTF-8 payload; wire size is measured directly from incoming WebSocket frames before decompression, including frame headers and excluding control frames. Server socket totals independently measure all outbound bytes. MB means 1,000,000 bytes. Steady-state sampling excludes the initial full snapshot; resynchronization still sends a full snapshot when needed.

| Scenario | JSON bytes/update before → after | Wire bytes/update before → after | MB/player/min before → after | Wire reduction |
|---|---:|---:|---:|---:|
| 1v1 | 6,742 → 1,615 | 309 → 249 | 0.187 → 0.151 | 19.4% |
| 4v4 | 21,965 → 4,086 | 1,015 → 671 | 0.612 → 0.405 | 33.8% |
| 5v5 | 27,599 → 4,903 | 1,325 → 889 | 0.800 → 0.537 | 32.9% |
| Zombies | 220,059 → 37,157 | 21,121 → 8,024 | 12.749 → 4.840 | 62.0% |

The eight-client Zombies baseline sent about **102 MB/minute per room**, versus about **39 MB/minute** after optimization. That makes a 106 MB traffic report plausible after a short large-Zombies test, but does not prove which mode or connection count caused the reported Render usage. Compression was already enabled: this was not simply an uncompressed-WebSocket problem.

**Server processing.** CPU is whole server-process user+system CPU milliseconds per wall-clock second, including compression workers. Tick time includes combat and snapshot work on the main thread. Event-loop delay uses the 20 ms sampling resolution described above.

| Scenario | CPU ms/s before → after | CPU change | Tick p95 ms before → after | Event-loop delay p95 ms before → after |
|---|---:|---:|---:|---:|
| 1v1 | 32.0 → 38.8 | +21.2% | 0.71 → 1.07 | 20.69 → 20.74 |
| 4v4 | 75.5 → 64.3 | -14.9% | 2.37 → 1.77 | 20.82 → 20.77 |
| 5v5 | 88.2 → 80.8 | -8.4% | 3.29 → 2.09 | 20.86 → 20.81 |
| Zombies | 391.9 → 264.2 | -32.6% | 19.89 → 11.99 | 33.85 → 27.16 |

The 1v1 delta calculation costs slightly more CPU than sending two small full snapshots; its bandwidth still improves. In larger rooms, one shared encoding replaces repeated per-recipient serialization, and smaller messages reduce compression work. For Zombies, baseline JSON serialization averaged approximately 0.99 ms **per recipient per snapshot** (eight recipients); optimized encoding averaged 4.44 ms **once per room snapshot**. Stable graph packing also fell from approximately 2.76 to 1.86 ms per snapshot. Compression remains per connection because WebSocket context history belongs to each connection; compressed payloads are not incorrectly reused across sockets.

**Cadence, latency and rendering.** Server snapshots stayed approximately 10 Hz; combat stays 30 Hz. RTT here is WebSocket ping round trip on loopback, not input-to-photon delay or Internet latency. Browser FPS uses the actual Canvas game, software-rendered headless Chromium at 1280×720, audio muted equally for both formats. It uses a separate ten-second browser run and different movement workload from the server bandwidth run.

| Scenario | Snapshots/s before → after | Socket RTT p95 ms before → after | Browser FPS before → after | Browser receive mean ms before → after |
|---|---:|---:|---:|---:|
| 1v1 | 10.06 → 10.07 | 0.57 → 2.75 | 59.7 → 59.0 | 0.68 → 0.75 |
| 4v4 | 10.05 → 10.06 | 1.93 → 0.89 | 59.3 → 59.2 | 0.83 → 0.91 |
| 5v5 | 10.06 → 10.06 | 0.72 → 0.82 | 59.0 → 58.7 | 0.96 → 0.88 |
| Zombies | 10.06 → 10.05 | 17.22 → 12.93 | 58.2 → 59.5 | 3.45 → 3.22 |

FPS remained roughly 58–60; this does not establish a significant FPS improvement. Latency is noisy: in the repeat run, 4v4 p95 RTT increased from 0.99 to 3.10 ms. Browser application ping means were also mixed; Zombies increased from 16.15 to 21.45 ms despite lower server processing and traffic. **No general WAN-latency improvement is claimed.** All eight browser benchmark cases completed without page errors or spontaneous resyncs. Large endless populations, several simultaneous rooms, mobile hardware, and the actual Render host need their own load measurements.

**Compression comparison (optimized transport).** Separate samples with the same scenarios:

| Scenario | Level 6 MB/player/min; CPU ms/s | Level 1 MB/player/min; CPU ms/s | Compression off MB/player/min; CPU ms/s |
|---|---:|---:|---:|
| 1v1 | 0.151; 38.8 | 0.182; 29.5 | 0.979; 23.3 |
| 4v4 | 0.405; 64.3 | 0.497; 55.0 | 2.461; 42.0 |
| 5v5 | 0.537; 80.8 | 0.651; 73.4 | 2.997; 50.6 |
| Zombies | 4.840; 264.2 | 5.757; 240.8 | 22.368; 192.9 |

Disabling compression reduced CPU but increased traffic approximately 4.6–6.5×. Level 1 reduced compression completion time but increased traffic, and whole-process CPU savings varied by scenario. Level 6 remains the default because bandwidth is the reported concern; the environment override allows a measured CPU/bandwidth tradeoff on Render.

Raw aggregate measurements (no player data):

- [before](benchmarks/2026-11-20-before.json)
- [after](benchmarks/2026-11-20-after.json)
- [uncompressed](benchmarks/2026-11-20-uncompressed.json)
- [level1](benchmarks/2026-11-20-level1.json)
- [browser](benchmarks/2026-11-20-browser.json)
- [before-repeat](benchmarks/2026-11-20-before-repeat.json)
- [after-repeat](benchmarks/2026-11-20-after-repeat.json)

## Release verification

- `npm test`: 524 passed, including real multi-client transport and diagnostics tests. The strengthened all-mode legacy-equivalence test also passed after its final assertion was added.
- `npm run build`: passed.
- Relevant Playwright suite: 45 passed initially; its remaining Roulette check expected an internal hyphenated ID instead of the existing display name. The test now verifies both the actual form ID and canonical display name, and passed on rerun (46 checked scenarios total). The new two-browser loss/delay/duplicate recovery test passed in landscape and portrait.
- Eight browser performance runs completed without page errors. Aggregate measurements are linked above.
- Hosted `https://mcv-beatz.onrender.com/health` could not be verified from this workspace: the outbound proxy returned HTTP 403 while opening the tunnel. Use `/health` and optional `/network-metrics` from your browser after Render deploys the source update. No live Render CPU/bandwidth or WAN improvement has been asserted.
