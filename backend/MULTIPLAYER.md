# Multiplayer lobbies (v0.62)

The GitHub Pages site is the game client. It cannot run a persistent multiplayer server. `server/index.js` is a separate Node/WebSocket service that runs the existing combat engine and AI. Supabase verifies account sign-ins; guests receive temporary server identities. Supabase is not used as a high-frequency game simulation server.

The client is configured for `wss://mcv-beatz.onrender.com`. Deploy the latest `main` commit to that Render service (automatic deployment or **Manual Deploy → Deploy latest commit**). `/health` now reports `protocolVersion: 4`; the client asks for a server update if an older protocol responds.

Guests and signed-in players share the same online rooms. Guests receive a server-issued random identity and display name (for example, Guest A19E42); supplied account IDs or usernames are ignored. An invalid supplied sign-in token is rejected rather than downgraded to guest access. Guest matches have a temporary scoreboard, but save no new statistics, mastery XP, achievements, or rewards. Existing local saves and settings are preserved. Signed-in accounts retain their account storage and synchronization. There is no AI-only lobby choice or silent local fallback.

After selecting a mode, the menu contains **Create Lobby** and **Join Lobby**, with **Sign in** centered underneath for guests. Join Lobby opens the captain-named room list. Quick Match joins a waiting room or creates one if none has space.
## Owner setup — Render example

1. Push this release to `mcvbeatz/MCV-Beatz` on `main`.
2. If account setup is not already complete, run [`update-v058.sql`](update-v058.sql) in this project's **Supabase → SQL Editor** and follow the verification queries in [README.md](README.md). Keep authentication Site URL and redirect URL at `https://mcvbeatz.github.io/MCV-Beatz/`. No new lobby SQL migration is required.
3. At Render, select **New → Web Service**, connect this GitHub repository, and select `main`. Use **Node**, a blank root directory, build command `npm ci --omit=dev`, and start command `npm run start:server`. Select a region near your players and one instance. An always-on instance avoids a cold start while players join; hosting charges depend on the plan you choose.
4. Add these environment variables to that service:

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | `https://nfkqhewaedmmqbxkxabg.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | The existing `sb_publishable_…` project key from Supabase's API settings |
   | `ALLOWED_ORIGINS` | `https://mcvbeatz.github.io` (origin only, **no path or trailing slash**) |
   | `NODE_VERSION` | `22` |

   The Supabase variables are required for account sign-in; the server can host guest rooms without them. Render supplies `PORT`. Set the health check path to `/health`. **Do not use a service-role key, database password, or user password.**
5. Deploy. Open `https://YOUR-SERVICE.onrender.com/health`; it should return `{"ok":true,"rooms":0,"protocolVersion":4}` when nobody is playing.
6. Set `multiplayerUrl` in [`public/app-config.json`](../public/app-config.json) to `wss://YOUR-SERVICE.onrender.com` (replace the example with the actual service hostname). Commit it and run `npm run deploy:pages` to publish that configuration with the game. Alternatively, send the deployed service URL to Codex to complete this step.
7. Open separate browsers/devices (guests or different signed-in accounts). Both choose Multiplayer and the same mode. One clicks **Create Lobby**; the other clicks **Join Lobby**, then **Join** next to the captain’s username. Repeat with a signed-out browser to verify guest access. The lobby must say **Online lobby**, show both account names, and remove two AI seats. Move both players, change a form/cosmetic, and have the captain press Start. Both should see the same five-second countdown and match. Leave with the captain to check handoff. After a completed match, each player can page through results manually. After 30 seconds both return to the lobby; the captain must press START again.

For another host, use the same commands/environment variables and a public HTTPS/WSS endpoint that supports long-lived WebSockets. A container recipe is included at `server/Dockerfile` (build from the repository root).

## Local verification

`npm test` includes real two-client WebSocket integration tests. `npx playwright test test/browser/lobby.spec.js test/browser/guest-teams.spec.js --workers=1` starts an isolated test server with test-only authentication and verifies two browser clients, captain handoff, controls, results/rematch synchronization, guest access, team choices and signed-in-only progression. Production account authentication always checks the session token against Supabase's `/auth/v1/user` endpoint.

For manual local play, set the server environment variables above, allow `http://localhost:5173,http://127.0.0.1:5173`, run `npm run start:server` and `npm run dev`, and temporarily set the client URL to `ws://localhost:8080`. Plain WebSockets are only allowed on localhost. Do not publish that local URL.

## Room behavior and operational limits

- Selecting a Multiplayer mode opens a live list of waiting rooms with captain usernames and occupied/total seats. Create Lobby always creates a separate room; Join targets the chosen room and rejects stale/full rooms without silently creating a new one. Quick Match alone automatically joins an available room or creates one if none has space. Every unused seat is AI-controlled. Matches already underway do not accept new joins; leaving changes that fighter to AI. One active connection is allowed per account.
- The first connected member is captain; departure transfers captaincy in arrival order. Limits default to the highest supported count. Reducing below the current human count requires selecting exactly the excess players (never the captain) and confirming; the server validates the whole change before applying it. Removed players return to the lobby browser with an explanation. Alternatively the captain can choose a higher limit or keep the current limit. Only the captain changes supported player counts or starts the shared five-second countdown. Other players press START to display Ready! above their character. Fixed-count modes keep their existing counts. War shows each assigned army in the lobby; only the captain can change their own army. Gridiron (Earth), Turnpike (Air), Survive the Night (Light), and Zombies (Ice) override defaults for everyone and disable elemental selection.
- Jade Team and Ember Team buttons sit on the middle of the lobby floor for Team Death Match, War, Capture the Flag, Fusion Rush and Gridiron. They replace AI seats with the switching player and lock when a team reaches half the room’s human capacity. Selection is server-validated and persists into the match and subsequent rounds. Capacity reductions cannot overfill a retained team. Cooperative, solo-style, and randomly assigned-team modes do not show the buttons.
- Names appear above health bars in the lobby and match, following the same visibility rules as the bars. Ready! appears above the name.
- The shared Colosseum lobby permits movement and cosmetic/form selection, but no attacks. Larger **battles** exclude the Colosseum. Equipped auras appear on characters; frames, titles and badges appear in the lobby roster/profile.
- After the existing victory celebration, results last 30 seconds. Next/Previous are entirely manual; pages never advance themselves. The deadline returns the same players to the lobby without starting a match. Only captain START begins the next five-second countdown. A **Last Results** button at the top left lets each participant review their latest session’s scoreboard, XP and honors without processing rewards again. It remains available until they leave the lobby; review closes when the captain starts the next round. Change Mode, View Stats or Leave exits the room. Solo and Practice keep their existing untimed flow.
- Movement/abilities are intentions sent to the server; clients cannot submit health, positions or scores to the room. The server updates combat at 30 Hz and distributes snapshots at 10 Hz; visual interpolation smooths movement. Lost controls clear after 500 ms and disconnected seats revert to AI. Audio events are delivered once per snapshot.
- Rooms are held in memory. Deploys/restarts end active rooms. Start with one server instance; multiple independent instances do not share rooms. The default maximum is 12 concurrent rooms; capacity depends on hardware and mode, especially large Zombies runs. Load-test against the intended population before increasing it. This release does not include ranked matchmaking, invitations, reconnect-to-active-match, or cross-server room storage.
- Signed-in progression keeps the existing per-account/device fallback and idempotent completion IDs. Guest sessions never call progression completion or account-stat writes; their match report is kept in memory only. Distinct players receive distinct match IDs even within one shared round. Existing client-submitted progression/cosmetic unlocks are **not cheat-proof**; this does not introduce a public competitive ranking guarantee.
- If the service is unavailable, the UI offers retry or return to modes. It does not create a private local lobby.

## Troubleshooting

- **Cannot connect:** check the deployed `app-config.json` has the correct `multiplayerUrl` and that Render is running protocol 4. Guests do not need to sign in.
- **Connection refused/failed:** check server logs and `/health`, the `wss://` hostname, WebSocket support, and `ALLOWED_ORIGINS`.
- **Session expired:** sign out/in; confirm server URL/key belong to this Supabase project.
- **People in separate rooms:** both must choose the same mode while there is space and before the countdown starts. Existing active/full rooms are not joinable.
- **Progress could not sync:** run the existing SQL migration/verification and inspect the account's fallback message. Lobby connectivity does not automatically configure progression tables.
