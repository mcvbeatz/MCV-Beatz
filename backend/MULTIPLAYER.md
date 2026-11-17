# Multiplayer lobbies (v0.59)

The GitHub Pages site is the game client. It cannot run a persistent multiplayer server. `server/index.js` is a separate Node/WebSocket service that runs the existing combat engine and AI. Supabase verifies player sign-ins; it is not used as a high-frequency game simulation server.

Until a server URL is configured, Multiplayer opens a clearly labelled **AI-only lobby**. Guests also use AI-only lobbies. Online rooms require signing in; no guest progress is published automatically.

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

   Render supplies `PORT`. Set the health check path to `/health`. **Do not use a service-role key, database password, or user password.**
5. Deploy. Open `https://YOUR-SERVICE.onrender.com/health`; it should return `{"ok":true,"rooms":0}` when nobody is playing.
6. Set `multiplayerUrl` in [`public/app-config.json`](../public/app-config.json) to `wss://YOUR-SERVICE.onrender.com` (replace the example with the actual service hostname). Commit it and run `npm run deploy:pages` to publish that configuration with the game. Alternatively, send the deployed service URL to Codex to complete this step.
7. Sign in with two different accounts in separate browsers/devices. Both choose Multiplayer and the same mode. The lobby must say **Online lobby**, show both account names, and remove two AI seats. Move both players, change a form/cosmetic, and have the captain press Start. Both should see the same five-second countdown and match. Leave with the captain to check handoff. After a completed match, both should progress through the timed results and next countdown together.

For another host, use the same commands/environment variables and a public HTTPS/WSS endpoint that supports long-lived WebSockets. A container recipe is included at `server/Dockerfile` (build from the repository root).

## Local verification

`npm test` includes real two-client WebSocket integration tests. `npx playwright test test/browser/lobby.spec.js --workers=1` starts an isolated test server with test-only authentication and verifies two browser clients, captain handoff, controls, results/rematch synchronization and AI-only fallback. Production authentication always checks the session token against Supabase's `/auth/v1/user` endpoint.

For manual local play, set the server environment variables above, allow `http://localhost:5173,http://127.0.0.1:5173`, run `npm run start:server` and `npm run dev`, and temporarily set the client URL to `ws://localhost:8080`. Plain WebSockets are only allowed on localhost. Do not publish that local URL.

## Room behavior and operational limits

- Joining finds a waiting room for that mode or creates one. Every unused seat is AI-controlled. Matches already underway do not accept new joins; leaving changes that fighter to AI. One active connection is allowed per account.
- The first connected member is captain; departure transfers captaincy in arrival order. Only the captain changes supported player counts or starts the five-second countdown. Fixed-count modes keep their existing counts. War uses the captain's army, and modes with assigned forms retain those rules.
- The shared Colosseum lobby permits movement and cosmetic/form selection, but no attacks. Larger **battles** exclude the Colosseum. Equipped auras appear on characters; frames, titles and badges appear in the lobby roster/profile.
- After the existing victory celebration, results last 30 seconds: scoreboard, mastery and records each get ten seconds. Next can advance sooner. Staying automatically starts another five-second countdown with the same humans and AI seats. Change Mode, View Stats or Leave exits the room. Solo and Practice keep their existing untimed flow.
- Movement/abilities are intentions sent to the server; clients cannot submit health, positions or scores to the room. The server updates combat at 30 Hz and distributes snapshots at 10 Hz; visual interpolation smooths movement. Lost controls clear after 500 ms and disconnected seats revert to AI. Audio events are delivered once per snapshot.
- Rooms are held in memory. Deploys/restarts end active rooms. Start with one server instance; multiple independent instances do not share rooms. The default maximum is 12 concurrent rooms; capacity depends on hardware and mode, especially large Zombies runs. Load-test against the intended population before increasing it. This release does not include ranked matchmaking, invitations, reconnect-to-active-match, or cross-server room storage.
- Progression keeps the existing per-account/device fallback and idempotent completion IDs. Distinct players receive distinct match IDs even within one shared round. Existing client-submitted progression/cosmetic unlocks are **not cheat-proof**; this does not introduce a public competitive ranking guarantee.
- If the service is unavailable, the UI offers retry, an explicitly AI-only lobby, or return to modes. It never presents a local AI match as an online room.

## Troubleshooting

- **AI-only lobby:** sign in and check the deployed `app-config.json` has the correct `multiplayerUrl`.
- **Connection refused/failed:** check server logs and `/health`, the `wss://` hostname, WebSocket support, and `ALLOWED_ORIGINS`.
- **Session expired:** sign out/in; confirm server URL/key belong to this Supabase project.
- **People in separate rooms:** both must choose the same mode while there is space and before the countdown starts. Existing active/full rooms are not joinable.
- **Progress could not sync:** run the existing SQL migration/verification and inspect the account's fallback message. Lobby connectivity does not automatically configure progression tables.
