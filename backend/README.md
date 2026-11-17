# Hosted accounts and stats

The game works without an account backend. Guest progression is saved privately on the device; guest and Practice results are never submitted to the public leaderboard. Practice does not earn progression. Until configured, account forms and the leaderboard clearly show that the service is unavailable.

## Apply the current database update

For the configured project `nfkqhewaedmmqbxkxabg`, open **Supabase Dashboard → SQL Editor → New query**. Copy the **entire** [update-v058.sql](update-v058.sql) file and click **Run** as the project owner. This one script includes progression storage, repairs/creates the public leaderboard schema, corrects historical totals, and enables the confirmed Delete Account button. It works for both new and existing Fusion Throwdown databases and is safe to rerun.

The final result must show `leaderboard_ready`, `progression_ready`, and `deletion_ready` as **true**. A second result lists up to five public leaderboard rows; zero rows is valid if there are no accounts yet. Reload the game, sign in, and use **My Account → Retry sync**. Confirm the public leaderboard loads, then finish a Play match and check Stats/mastery after refreshing.

The original `supabase.sql` had an unterminated username-pattern string; it is fixed in this release. If that script previously failed before creating the account tables, the combined update creates them and backfills missing profiles from Auth users, keeping valid available usernames. It replaces only the leaderboard view (no account history is dropped), restores its expected columns/grants, and reloads the API schema cache.

The script subtracts recorded Dungeon/Zombies kills and all recorded Solo/Team Waves kills, deaths, wins and losses from public totals, preserving other historical totals. Per-match markers prevent repeat subtraction, including when the previous `session-stats.sql` correction already ran. Private progression receipts and earned cosmetics remain intact. Unrecorded historical events cannot be reconstructed.

Installing the deletion function does **not** delete anyone. It accepts no user ID and always uses `auth.uid()`; only authenticated callers may execute it. Deletion removes that Auth user and their cascading profile, leaderboard stats, match history and progression. The client clears only that account's local cache, retaining guest saves. Test this only with a disposable test account.

The existing publishable key supports ordinary authenticated gameplay, **not SQL administration**. No service-role key belongs in the game. This workspace has no Supabase admin connection, so hosted execution must be done in the project's SQL Editor. Local PostgreSQL validation is not a hosted migration.

Do not rerun the older `session-stats.sql` after this combined upgrade: it contains the older result RPC. Keep email confirmation enabled, and retain `https://mcvbeatz.github.io/MCV-Beatz/` as the Auth Site URL and allowed redirect. The public project URL/publishable key remain in `public/app-config.json`.

## Database regression checks

The optional test runner uses PostgreSQL through PGlite in a temporary directory, without adding a game dependency:

```sh
npm install --prefix /tmp/fusion-sql-validation --no-save @electric-sql/pglite
PGLITE_MODULE=/tmp/fusion-sql-validation/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-database-migration.mjs
```

It checks fresh, legacy and previously corrected databases, repeat safety, public view access, Waves exclusions, progression isolation, and authenticated self-deletion. Hosted Auth email flows still need a disposable-account check in Supabase.

Supabase Auth handles password hashing and recovery. The game never stores plaintext passwords; it only passes them to Auth over HTTPS and clears form fields. Session tokens use sessionStorage. Usernames and cumulative stats are public; email addresses and auth records are not exposed by the leaderboard.

These are authenticated **single-player AI-match stats**, submitted by the client, not an anti-cheat-protected competitive service. Before online ranked play, replace client-submitted outcomes with results from an authoritative match server. Online lobbies will require that server: 60-second countdown, immediate start when everyone readies, and AI takeover of disconnected seats after play starts. No online lobby is simulated by the current release.

Set `introVideo` in `public/app-config.json` to a deployed relative video path, such as `intro.mp4`, once the user's logo video is supplied. The intro plays inline, supports skipping/tap-to-play when autoplay is blocked, and opens Home on completion or playback failure. Without a video it opens Home immediately.
