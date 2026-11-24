# Movement prediction — implementation and approval guide

**Deployment approved by the owner on 2026-11-24.** The implementation was reviewed as commit `dfbb981`. The approval authorizes publishing the source and Pages client. Confirm the running Render version with `/health` as described below; a Git push alone is not proof that Render has finished deploying.

## Architecture and authority

The inspected baseline was commit `3b00f78`: 30 Hz authoritative room ticks, snapshots every third tick (~10 Hz), movement intentions about every 45 ms, protocol 4 with negotiated `json-delta-v1`, and 100 ms interpolation for every fighter. This was verified in source and measured before changing movement. The existing Render endpoint could not be measured from this workspace; the controlled tests below are local browser/proxy tests, not live Render or physical-iPhone measurements.

1. The browser requests optional `movement-v1` alongside `json-delta-v1`. The server explicitly acknowledges the capability. Without agreement, the client keeps the authoritative/interpolated path. Old protocol-4 clients and servers remain supported. No protocol bump or coordinated outage is required.
2. Local input updates a separate predicted actor immediately on the next game animation frame. Outgoing messages remain intentions (`x`, `y`) plus an integer sequence. The existing 45 ms send cadence remains; releasing the stick sends zero promptly. Pending input changes can be shown locally before the next send.
3. The server validates monotonic integer sequences and finite axes, clamps movement input, and advances its existing combat simulation. It does not accept client positions, velocity, elapsed time, damage or scores. After a simulation step, each negotiated member gets a compact acknowledgment `[sequence, appliedSeconds, serverStep, neutralEpoch]`. This acknowledges consumed simulation input, not merely packet receipt. Earlier superseded intentions are intentionally retired.
4. On a snapshot, prediction starts from the real authoritative actor. It discards older inputs and replays only the unapplied duration of the acknowledged sequence and later intentions. Applied duration and step come from the server; no synchronized client/server clocks are required. Duplicate/older acknowledgments cannot repeat replay.
5. Small safe corrections retain the previous visual position and decay the offset over time. Large changes, blocked correction paths, changed actor/form/life/phase, and unsafe movement reset to authority. Prediction stops during a stale update stream and recovers from a fresh full/delta snapshot.
6. Rendering uses cached presentation objects inheriting read-only combat data. **It never temporarily moves authoritative fighter objects.** Local body, animation motion and camera read the same presentation. Remote fighters retain 100 ms interpolation; respawns, teleports, form changes, large displacements and paths crossing walls snap. Existing hit tests, interactions and world-space targeting still run against authoritative state.

The exact scalar movement calculation was extracted from `Combat.move` into `movement-physics.js`. Server-only aim locking, swept chasm deaths, attacks, portal entry, token collection, objective scoring and other consequences stay in the combat engine. Offline and Practice still use the same server-side wrapper and formulas. No damage, health, cooldown, AI, map, progression, cosmetic or audio rules were changed.

## What is predicted

| Movement/effect | Behavior |
|---|---|
| Ordinary keyboard/joystick movement | Immediate local voluntary movement, then reconciliation |
| Normal flight | Same acceleration/inertia; releasing flight retains its intentional inertia |
| Known boosts/Tailwind, slow, health penalties, wave speed | Existing scalar factors, using confirmed authoritative statuses; boost/slow timers age on the copy |
| Rock Shield and charging | Confirmed movement penalties; ability activation and charge/cooldown validation remain server-only |
| Water in Flood | Same flood-region speed check; no predicted healing, hazard removal or damage |
| Shadow Step | Ordinary movement during the confirmed dodge status; dodge/hit outcomes remain server-only |
| Racing | Same on/off-track speed and confirmed ghost/form factors; laps, items and respawns remain server-only |
| Walls and map boundaries | Same map movement/collision geometry on the separate actor; no client-authoritative collision outcome |
| Speed Burst dash, knockback, teleport windup/arrival | Authoritative movement; prediction suspends while those states are known |
| Portals and dimension/transit | Authoritative; prediction also suspends near known entrances |
| Stone Prison, electrical contact shock | Authoritative immobilization; no predicted escape or ability effect |
| Grounded movement near chasms/quicksand | Conservative authoritative fallback, including otherwise immune grounded forms |
| Gust/pushes, new hazards, damage and movement-changing interactions | Server determines them; received boosts may subsequently affect ordinary prediction |
| Death, revival/respawn, transformations | Reset from authoritative identity/life/form state; never predict the transition |
| Countdown, wave travel/rewards, touchdown celebration, results | Authoritative presentation |

A status arriving late can still cause a correction. This is unavoidable without speculating about combat. Combat, ability execution, opponents and objectives still have network latency; this update specifically improves local voluntary movement.

## Bounds and correction settings

`PREDICTION_LIMITS` centralizes limits: at most 96 input segments, at most 0.5 seconds replay, and a 500 ms stale-snapshot cutoff. Simulation substeps are at most 1/30 second. Small corrections up to 24 world units decay with a 70 ms time constant only when the correction segment is clear. Larger corrections snap; remote interpolation snaps at 70 units. Portal/hole approach fallback uses a 45-unit margin. These are presentation choices, not changes to movement speed or collision rules.

The ordinary latency trials observed errors below these soft-correction bounds; jitter and gameplay transitions can exceed them. World units are not screen pixels: camera zoom determines the visible distance. Reconciliation does not add its visual correction offset back into the movement simulation, preventing feedback drift. Actor/form changes and neutral-input epochs clear inappropriate history. Prediction and correction work are bounded even if snapshots stop arriving.

## Diagnostics and controlled comparisons

- `?prediction=0` disables requesting prediction; reload/rejoin to compare. It does not change authority or the game's rules.
- `?netdebug=1` enables an explicit developer-only, read-only overlay. It shows negotiated ON/OFF/fallback, RTT, FPS, snapshot rate, input-to-draw estimate, correction error, queue length and resyncs. It is absent from normal gameplay and Settings.
- Optional console: `__app.lobby.diagnostics.report()` and `.reset()`. Prediction internals: `__app.lobby.prediction.enabled` and `.history.length`. `window.__FUSION_PREDICTION__ = false` **before connecting** is another test-only opt-out.
- New bounded aggregate timings: reconciliation ms, prediction error mean/max/p95, input queue length, input-to-draw estimate, correction/snap counts. Existing RTT, snapshot cadence/age, receive time, FPS, server tick/event-loop and actual wire-byte metrics remain.
- Diagnostic input-to-draw is a best-effort movement-start estimate, not touch hardware latency or photon timing. No input payloads, tokens, identities or positions are emitted in logs or reports. Necessary prediction history stays bounded in memory.
- `NETWORK_DIAGNOSTICS=1` still enables aggregate minute logs and `/network-metrics` on Render Free. No individual-player or per-snapshot logging was added.

The browser harness uses real WebSockets through an ordered application-message proxy with 0/40/80/150/250 ms added RTT, deterministic jitter, dropped application snapshots and temporary delivery stalls. This does **not** simulate TCP congestion or radio conditions. It hooks the actual renderer and measures the first drawn displacement greater than 0.3 world units **in the requested direction**, relative to the last drawn position. Hardware sampling, compositor/scanout and physical display latency are not measured. Flight inertia and server-driven displacements must not be mistaken for an input response.

The initial baseline was captured before source changes. Final A/B runs use prediction disabled/enabled in the same build to isolate the feature; both preserve 100 ms remote/authoritative interpolation. Each network condition attempts four alternating movement starts. Missing responses during an outage are reported as missing observations, not assigned an invented zero or latency. Mode samples contain real AI and gameplay interactions and are not guaranteed stationary or equivalent combat traces. Renderer work and local proxy overhead are shared with the test host; only the separate existing network benchmark isolates server-process CPU.

Commands (run Vite separately with `npm run dev -- --port 5173`):

```sh
PREDICTION=0 BENCH_OUTPUT=/tmp/off.json node scripts/prediction-benchmark/run.js
PREDICTION=1 BENCH_OUTPUT=/tmp/on.json node scripts/prediction-benchmark/run.js
PREDICTION=0 PREDICTION_MATRIX=1 BENCH_OUTPUT=/tmp/modes-off.json node scripts/prediction-benchmark/run.js
PREDICTION=1 PREDICTION_MATRIX=1 BENCH_OUTPUT=/tmp/modes-on.json node scripts/prediction-benchmark/run.js
BENCH_TRANSPORT=delta BENCH_PREDICTION=0 BENCH_OUTPUT=/tmp/wire-off.json npm run bench:network
BENCH_TRANSPORT=delta BENCH_PREDICTION=1 BENCH_OUTPUT=/tmp/wire-on.json npm run bench:network
```

## Owner deployment and verification instructions

The owner approved deployment on 2026-11-24. No Supabase changes are required. These steps describe publication and verification; follow the deployment status reported with the release to determine whether any manual Render action remains.

1. **Render:** after merging the approved working branch into `main`, open [Render Dashboard](https://dashboard.render.com/), select the **mcv-beatz** Web Service, then **Events**. If automatic deployment already shows the approved commit as Live, no manual deployment is needed. Otherwise click **Manual Deploy → Deploy latest commit**. A server restart ends in-memory rooms, so do this between sessions.
2. **GitHub Pages:** the new browser build must also be published. This repository publishes built files to `gh-pages`; merging source into `main` alone does not publish them. The existing `npm run deploy:pages` builds, tests and publishes them. I can perform this after approval. In GitHub, open **MCV-Beatz → Settings → Pages** and keep the current `gh-pages` source; do not change hosting settings or upload the source folder as the website. When I publish it for you, no additional manual Pages action is needed.
3. **Update order:** server first, then client is recommended. Updating together is not mandatory: old clients keep authoritative movement, and new clients fall back when the server does not advertise `movement-v1`.
4. **Health check:** open `https://mcv-beatz.onrender.com/health` in Safari/Chrome. After deployment it should include `"ok":true`, `"protocolVersion":4`, `"snapshotCodec":"json-delta-v1"`, and `"movementPrediction":"movement-v1"`. The room count varies. `movementPrediction:null` means prediction is disabled on the server. An absent field means the older server is still deployed.
5. **Environment variables:** none are required. Existing Supabase credentials, port and allowed origins stay unchanged. For live measurements, Render → service → **Environment → Add Environment Variable**, key `NETWORK_DIAGNOSTICS`, value `1`, then **Save, rebuild, and deploy** (wording may vary). Read aggregate reports under **Logs** after a minute of play. The same aggregates are at `/network-metrics`; leave diagnostics off if you do not want operational counts publicly accessible.
6. **Supabase:** no settings changes, authentication redirect changes, SQL scripts or database migrations are needed. Do not delete or migrate player data for this update.

### Confirm and compare on your iPhone after deployment

1. Open Safari and enter `https://mcvbeatz.github.io/MCV-Beatz/?netdebug=1`. Reload the page; using this new address helps bypass an old cached page without clearing saved settings or progress.
2. Choose **Multiplayer → Free For All → Create Lobby**. Wait for the room to load and the overlay to show **Prediction ON**. Move the stick: the character and following camera should start moving on the next rendered frame. Wait several seconds for RTT/FPS readings before judging a cold server startup.
3. Repeat at `https://mcvbeatz.github.io/MCV-Beatz/?netdebug=1&prediction=0`. The overlay should say **Prediction OFF**. Use the same Wi-Fi, elemental, mode and orientation. Try starting, stopping, reversing and running against a wall. Compare movement-start behavior separately from RTT: prediction does not shorten the network round trip.
4. Test portrait and landscape through the existing orientation setting. Try Air to check intentional flight inertia, Earth with Rock Shield, and a form with Speed Burst. The dash/teleport itself still waits for server confirmation; ordinary movement should resume correctly afterward.
5. Have a second device join through **Join Lobby** using a guest or a different account. The same signed-in account cannot occupy two simultaneous connections. Confirm the other device sees your real movement and that health, hits, scores and objectives agree.
6. Return to the ordinary game address to hide diagnostics. Reloading/leaving replaces your active-match seat with AI; it does not reconnect into that active match. Test A/B between rounds or in the lobby.

These automated mobile tests use Chromium touch emulation, **not physical iPhone Safari**. A real-device check remains necessary after approved deployment. Do not clear website data just to refresh: that can remove local settings/progress.

### If there is rubber-banding or another regression

- First retry with `?prediction=0` (or `?netdebug=1&prediction=0`) and rejoin. This is an immediate per-browser fallback, with no account changes.
- For a global fallback, open Render → service → **Environment**, add `MOVEMENT_PREDICTION=0`, save and deploy. New connections then use authoritative presentation. Restore `1` or remove the variable to re-enable it. This requires a restart and ends current rooms.
- Record the mode, elemental, orientation, approximate RTT/error/queue readings, and whether the problem also occurs with prediction OFF. A short screen recording can help. Do not send passwords or authentication tokens.
- If a full source rollback is necessary, use GitHub's revert workflow for the approved merge (or ask me to revert the feature commit), deploy that reverted `main` on Render, and republish the corresponding Pages build. The known previous source is `3b00f78` (v0.63.0); its published Pages commit is `2647c7155ecbe3f9d6a756fab5d53f2c9a9ad2f2`. Do not reset/force-push over unrelated later changes. Protocol-4 fallback permits either service to be rolled back first. No database rollback is involved.

## Measured results (2026-11-23)

These are short controlled trials on this Linux workspace, Node 24.19.0 and headless Chromium. They are not promises about Render Free, Safari, mobile radios or production load. The saved initial pre-change baselines are [network conditions](benchmarks/2026-11-23-prediction-before.json) and [modes](benchmarks/2026-11-23-prediction-modes-before.json). The original probe compared against authoritative coordinates, which can mistake existing interpolation/inertia for a response. The corrected final A/B probe uses the last rendered coordinates and movement direction; **the tables below use that corrected probe**. Pre-change samples are retained for transparency, not used to claim the final latency improvement.

### Controlled movement starts

Final raw trials: [prediction off](benchmarks/2026-11-23-prediction-final-latency-0.json), [prediction on](benchmarks/2026-11-23-prediction-final-latency-1.json). One human-controlled browser against AI in Free For All; four alternating starts per condition. Each entry is an observed mean. Added RTT is the proxy setting, not measured total RTT. Browser automation can deliver input close to a frame boundary; sub-frame averages do not mean the display refreshes in 1 ms.

| Added RTT / delivery condition | OFF input-to-draw ms | ON input-to-draw ms | Responses observed OFF / ON | ON mean / max correction error (world units) | FPS OFF / ON |
|---|---:|---:|---|---:|---:|
| 0 ms | 112.2 | 1.2 | 4/4 / 4/4 | 0.31 / 5.08 | 59.2 / 59.4 |
| 40 ms | 131.9 | 1.4 | 4/4 / 4/4 | 0.45 / 5.16 | 59.8 / 59.4 |
| 80 ms | 193.7 | 2.5 | 4/4 / 4/4 | 0.62 / 5.08 | 59.4 / 59.0 |
| 150 ms | 233.5 | 1.1 | 4/4 / 4/4 | 0.47 / 4.99 | 59.2 / 59.0 |
| 250 ms | 330.2 | 1.9 | 4/4 / 4/4 | 0.72 / 5.29 | 59.0 / 58.2 |
| 150 ms + ±50 ms message jitter | 243.1 | 1.7 | 4/4 / 4/4 | 2.44 / 12.51 | 59.6 / 59.0 |
| 80 ms + dropped snapshots / 250 ms stalls | 341.0 | 1.1 | 2/4 / 4/4 | 0.84 / 5.05 | 59.4 / 59.2 |

At the five steady latency settings, local response measured 1.1–2.5 ms versus 112.2–330.2 ms. Measured ping RTT remained subject to the same network delay; prediction does not reduce RTT. These short trials collected only one ping per condition, so no statistically strong RTT comparison is claimed. Snapshot delivery stayed approximately 10 Hz. Mean reconciliation work was 0.050–0.124 ms in these steady FFA trials. Mean errors were 0.31–0.72 world units, maxima 4.99–5.29 units across these steady FFA trials (the raw data provides exact values). No prediction snaps were counted in these FFA trials. Corrections above 0.25 units occurred 10–17 times per roughly five-second steady trial, handled by small smooth offsets rather than hard snaps.

The disrupted ON run recovered four missing delta bases and observed all four movement starts; the OFF run observed only two. This is one delivery schedule, not evidence that prediction can hide arbitrary outages. During an earlier pilot, safety fallback delayed starts by hundreds of milliseconds. Beyond the 500 ms stale cutoff or replay budget, immediate local response is intentionally surrendered until a current snapshot arrives.

### Mode comparisons at 150 ms added RTT

Raw trials: [off](benchmarks/2026-11-23-prediction-final-modes-0.json), [on](benchmarks/2026-11-23-prediction-final-modes-1.json). Actual AI/gameplay remained active. These are movement smoke/performance checks, not identical combat replays or a claim that every ability becomes immediate.

| Mode | OFF mean input-to-draw ms | ON mean input-to-draw ms | Responses OFF / ON | FPS OFF / ON | ON mean reconciliation ms |
|---|---:|---:|---|---:|---:|
| Team Death Match | 254.0 | 2.8 | 4/4 / 4/4 | 59.2 / 59.0 | 0.116 |
| Free For All | 237.7 | 1.8 | 4/4 / 4/4 | 59.4 / 59.0 | 0.082 |
| War | 248.7 | 1.3 | 4/4 / 4/4 | 58.8 / 58.2 | 0.137 |
| Fusion Rush | 183.9 | 122.5 | 3/4 / 4/4 | 59.4 / 57.0 | 0.060 |
| Capture the Flag | 285.0 | 1.8 | 4/4 / 4/4 | 54.6 / 58.2 | 0.176 |
| Gridiron | 250.8 | 3.4 | 4/4 / 4/4 | 59.6 / 58.8 | 0.104 |
| Turnpike Racing | 332.8 | 20.8 | 4/4 / 4/4 | 59.8 / 60.0 | 0.226 |
| Zombies | 220.4 | 3.2 | 4/4 / 4/4 | 59.8 / 58.6 | 0.078 |

Fusion Rush retained two slow responses (217 and 268 ms) during this interactive trial; one OFF response was missing. It therefore does **not** meet a next-frame response target consistently in this run. The harness does not record the intervening private action trace, so the particular transition responsible cannot be established from these aggregates. Flight's intentional acceleration/reversal makes Turnpike's displacement threshold take roughly 19–24 ms even with immediate prediction. Neither result justifies changing gameplay physics. FPS varies with scene and workload; no FPS improvement is claimed. The 57 FPS Rush result merits physical-device checks alongside the other modes.

### Isolated server and wire overhead

The existing benchmark ran a separate server process for 15 seconds per scenario after warmup, using compressed delta snapshots, zlib level 6 and all clients enabled/disabled. Actual outbound socket bytes include WebSocket framing/compression, **not** TLS, TCP/IP or Render's billing overhead. JSON sizes are before compression. These are single short paired runs; random combat and scheduling add variation, so CPU differences are observations, not proven causal costs or improvements.

Raw results: [off](benchmarks/2026-11-23-prediction-wire-0.json), [on](benchmarks/2026-11-23-prediction-wire-1.json).

| Scenario | Mean JSON snapshot bytes OFF → ON | Outbound bytes/player/min OFF → ON | Wire change | Server CPU ms/s OFF → ON | Mean tick ms OFF → ON | p95 tick ms OFF → ON |
|---|---:|---:|---:|---:|---:|---:|
| 1v1 | 1,622 → 1,726 | 150,587 → 158,086 | +5.0% | 45.7 → 40.2 | 0.542 → 0.463 | 1.124 → 1.249 |
| 4v4 | 4,109 → 4,459 | 407,427 → 440,517 | +8.1% | 74.3 → 77.6 | 0.695 → 0.773 | 1.989 → 2.226 |
| 5v5 | 4,922 → 5,448 | 538,917 → 575,642 | +6.8% | 87.5 → 93.6 | 0.872 → 0.912 | 2.509 → 2.541 |
| Zombies | 37,070 → 37,698 | 4,841,791 → 4,865,799 | +0.5% | 272.3 → 295.3 | 4.640 → 5.242 | 12.342 → 13.768 |

Mean actual compressed snapshot frame sizes were 249 → 261 bytes (1v1), 674 → 729 (4v4), 893 → 953 (5v5), and 8,011 → 8,060 (Zombies, 111 fighters at the end of each run). Client frame parsing and server socket-byte counters independently measured transmitted traffic.

The acknowledgment extension added 0.5–8.1% observed outbound traffic in these scenarios; it did not undo the delta transport savings. Snapshot rates remained 10.00–10.08 Hz. Event-loop delay p95 was about 20.7–20.9 ms in ordinary scenarios and 26.4 → 27.6 ms for Zombies; this monitor has a 20 ms sampling floor, so these are not 20 ms of excess blocking. Zombie tick p95 remained under 14 ms in these runs, below the nominal 33.3 ms step budget; occasional larger spikes still occurred. No server CPU reduction is claimed. Shared room encoding, compression settings, graph identity and backpressure behavior were preserved.

The baseline supports a combination of network round-trip and snapshot/presentation scheduling as a source of local input delay: even near-zero added delay had ~112 ms response, and added RTT increased it. Typical measured server ticks and browser frames were well below that delay in this controlled environment. This does **not** diagnose Render cold starts, regional distance, production load or any particular user's connection; use live diagnostics after an approved deployment to evaluate those.


### Existing browser performance benchmark

`npm run bench:network:browser` also completed all eight legacy/delta scenarios with no browser errors. [Raw current-build results](benchmarks/2026-11-24-prediction-browser-compatibility.json). This exercises legacy fallback and the normal delta client with prediction; it is **not** a prediction-only A/B comparison because the transports differ. One rendered browser plus WebSocket peers, 1280×720, ten-second sample after warmup:

| Scenario | Legacy fallback FPS | Delta + local prediction FPS | Legacy receive ms | Delta receive ms |
|---|---:|---:|---:|---:|
| 1v1 | 56.4 | 58.6 | 0.852 | 0.751 |
| 4v4 | 58.2 | 58.2 | 0.949 | 0.951 |
| 5v5 | 57.5 | 58.8 | 1.051 | 0.865 |
| Zombies | 52.6 | 56.1 | 3.938 | 3.848 |

## Verification and remaining limits

- `npm test`: **534 passed**, including the existing combat/ability/map/progression/protocol tests and new sequence, replay, correction, bounded-history, authority and negotiation tests.
- `npm run build`: **passed**. This result was recorded before approval; publication was deliberately deferred until the owner approved it.
- Relevant existing Playwright suites: **46 passed** across `app-shell`, `guest-teams`, `lobby-results-scroll`, `lobby`, `navigation-camera`, `network-performance`, `progression` and `session-results`.
- New Playwright suite: **11 passed**. Covers all eight requested modes with two simultaneous human-controlled clients, landscape keyboard plus portrait touch, delayed/jittered WebSockets, remote/server synchronization, release, mixed negotiation, reconnect, developer comparison URLs, and server-directed knockback/teleport/death/form corrections.
- The first combined browser run found a new test-fixture problem: the Rush assertion dereferenced a null prediction while a legitimate server-only effect suspended it. The final test uses a seeded real roster/map/AI and waits for the ordinary-movement precondition; it keeps the original movement assertions. A separate test verifies unsafe authoritative transitions. Live-AI benchmark results were **not** replaced by the seeded test results.
- The added correction unit test initially assumed the Colosseum had a map object; it has null geometry. The fixture now explicitly supplies the blocked-line geometry it is testing. No production behavior or existing test expectation was weakened to resolve either fixture issue.
- Existing missing/duplicate/out-of-order snapshot recovery tests passed with prediction enabled. No new dependencies or database scripts were introduced.

Physical iPhone Safari, real Render regional latency/cold starts, long multiplayer soak sessions and severely congested networks were not tested here. The matrix is targeted coverage, not every elemental/ability × mode × network condition combination. High-latency attacks and ability execution remain authoritative and therefore still have delay. Status effects that arrive late can require visible corrections. Prediction deliberately falls back near ambiguous transitions or after a stale update stream. Correction error measures distance from the previous presented position to the newly replayed position at snapshot receipt; it is not RTT or an authoritative hitbox discrepancy. No client-submitted statistic is made cheat-proof by this feature, and no competitive trust model was changed.

Reconciliation errors were measured in world units, not device pixels; visible impact depends on camera zoom. The tests verify bounded replay and settling after release, but do not establish that all long sessions will be free of rubber-banding. Use the documented per-browser comparison and global server rollback if live testing identifies a regression.

## File inventory

Modified:

- `server/index.js`: optional capability agreement, rollback flag and health response.
- `src/lobby-room.js`: validate sequences, acknowledge simulated intentions, exclude internal tracking from snapshots.
- `src/lobby-client.js`: capability request, sequenced intentions, immediate local input, release and connection lifecycle.
- `src/combat.js`: delegate unchanged scalar movement to the shared helper; keep consequences authoritative.
- `src/app-shell.js`: reconcile reconstructed snapshots and connect local input/presentation.
- `src/network-presentation.js`: separate local/remote drawing objects, safe interpolation and displacement snapping.
- `src/network-diagnostics.js`: bounded aggregate input-to-draw, prediction/reconciliation counters and timings.
- `src/main.js`: input timing hooks, opt-in diagnostic overlay, prepared version label.
- `scripts/network-benchmark/run.js`: optional negotiated prediction traffic in the existing wire/CPU benchmark.
- `package.json`, `package-lock.json`, `index.html`: prepared v0.64.0 version; dependency versions unchanged.
- `README.md`, `backend/NETWORK-PERFORMANCE.md`: prepared-release notes and documentation links.

Added:

- `src/movement-physics.js`: shared existing movement formulas and map integration.
- `src/movement-ack.js`: compact optional protocol extension and authoritative step acknowledgment.
- `src/movement-prediction.js`: local state, input history, safety gates, replay and correction policy.
- `src/network-debug-panel.js`: developer URL overlay; no ordinary menu/settings changes.
- `scripts/prediction-benchmark/link.js`, `scripts/prediction-benchmark/run.js`: controlled WebSocket delivery and renderer measurements.
- `test/movement-prediction.test.js`, `test/movement-network.test.js`, `test/browser/movement-prediction.spec.js`: automated coverage described above.
- `backend/MOVEMENT-PREDICTION.md`: this implementation, measurements and owner guide.
- `backend/benchmarks/2026-11-24-prediction-browser-compatibility.json`: current-build existing browser benchmark.
- `backend/benchmarks/2026-11-23-prediction-*.json`: initial baseline plus final latency, mode and isolated wire/CPU A/B aggregates. They contain no account identities, tokens or input histories.

No changes were made to `src/multiplayer-protocol.js` or `src/snapshot-delta.js`: their existing graph reconstruction, negotiated delta codec and protocol-4 compatibility remain in use. No assets, audio tracks, account schemas, gameplay balance or progression rewards were changed.
