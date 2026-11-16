# Progression and rewards (v0.57.0)

## Runtime and integration

`match-statistics.js` observes combat and objective events without changing gameplay. `progression.js` calculates XP and mastery; `records.js` aggregates statistics and dated bests; `rewards.js` defines achievements and functional cosmetics. `progression-storage.js` owns the private journal, migrations, idempotency, account separation and optional cloud sync. `progression-ui.js` / `progression.css` provide My Account and the results report. Existing `record_match` leaderboard writes remain separate; Dungeon and Zombies kills are excluded from public overall totals.

All 25 playable origins/fusions have independent mastery, Levels 1–20. My Account works for guests, with Overview, Stats, Elemental Mastery, Achievements and Cosmetics in vertical, full-width navigation. Leaderboard → My Stats exposes the same private detailed statistics without requiring sign-in. Elements & Fusions links to mastery. The three-page post-match report follows the existing celebration and music transition: mode scoreboard, animated mastery with portraits, then personal bests and unlocks. Next uses Selection audio. Practice returns to setup without results. Opening it again does not reprocess the match or resubmit data.

## XP attribution and limits

Central configuration: `XP`, `XP_CAPS`, `levelCost` in `src/progression.js`.

| Source | XP | Per-match action limit |
| --- | ---: | ---: |
| Complete eligible Play match | 25 | once |
| Win | 50 | once |
| Enemy elimination | 10 | 20 |
| Successful fusion | 30 | 3 |
| Boss defeated | 75 | 3 |
| Wave cleared | 15 | 10 |

Maximum reward is 740 XP per completed match, shared across all forms, including endless and respawn modes. Actual statistics are not capped. Only modes in `PLAY_MODES` qualify. Practice, tutorial, abandoned and unfinished matches never award XP, achievements, records or cosmetics. There is no time-based XP loop and no reward on ordinary respawn.

Completion and victory XP are divided by living simulation time in each actual **body form**. Switching the inherited ability selector does not create another elemental participant. Dead/ghost time does not earn another form participation; corridor travel does. With no measured active time, the starting form receives the participation award. Integer shares use largest-remainder allocation, so the sum is exact.

Elimination XP belongs to the player's body form when the elimination resolves, including kills credited to their summoned echo. Successful fusion XP belongs to the newly created fusion. Each source's capped pool is split proportionally to actual action counts per form. Nothing is also copied to inherited origins. Temporary racing and mode-driven forms receive participation XP while alive, but transformations are not automatically counted as successful fusions.

Dungeon bosses and completed waves are encounter/team objectives. The player receives credit for a cleared encounter even if a teammate makes the final hit. Boss-mode challengers receive boss credit when the actual boss falls; winning as the boss is a separate record. Final wave bosses give both a cleared-wave event and a boss event.

Level N requires `75 + 25*(N-1) + 5*(N-1)^2` XP to advance. XP is capped at the Level-20 threshold. Each form unlocks a bronze badge (5), silver profile frame (10), gold halo (15), and an animated master decoration with its exclusive title (20). These are equip/unequip choices, not placeholder items. Cosmetic badges, frames, titles and decorations appear on profiles and reports; halos also draw a decorative ring around the player in battle. They never enter combat calculations.

## Statistics semantics

- Health damage is the actual HP removed, excluding shield absorption and overkill. Damage received includes friendly fire and environmental damage. Damage dealt counts enemies only; reflected damage is credited to the reflector. Zombie damage uses the actual five-hit HP model. Direct lethal falls and CTF detonations include remaining HP lost.
- Eliminations/deaths follow the existing combat engine's counters, including its existing rebirth scoring semantics. Echo deaths do not count; echo kills credit their summoner. Gate blasts credit the switch owner, as existing gameplay does.
- Healing measures actual restored HP, excluding overheal, credited to the healer or spring owner. Pickups, drain, fusion healing and rebirth are self-healing; explicit revival and the selected wave healing reward credit their source. Automatic respawns, automatic wave recovery and form/health-cap changes are not healing actions.
- Duration uses the existing active game clock, excluding countdown, pause, reward-choice intermission and celebration. A wave is counted only once the wave's enemies have been cleared.
- Gridiron touchdowns credit the carrier, or the last passer when a loose/pass ball scores for that player's team. Interceptions require an opposing player's pass to be caught; loose ball pickups are not interceptions.
- CTF returns credit the first eligible teammate actually touching the dropped flag; captures credit the carrier. Flags stolen count successful enemy-flag pickups, including dropped enemy flags. Fusion Rush tokens count actual compatible pickups, not each inherited origin.
- Racing lap records require completed checkpoint circuits. Fastest race requires three completed laps, not a time-limit victory on partial laps.
- Survive the Night records cumulative living Light/Spirit time on the survivor team, including time after revival. Successful conversions count as an elimination/death for the two participants; initial random infection, environmental deaths and rebirth saves do not. Both Light and Dark eliminations count. Light-victory achievements require never having been converted; a revived former Dark does not qualify. Dark conversions count actual successful conversions, not rebirth saves.
- Fusion Rush points record actual tier-advancement points, not ordinary kill points. Roulette counts scheduled transformations while alive, not transformations while waiting to respawn.
- Mode wins, draws and losses remain separate. FFA best win percentage is the highest historical ratio across completed FFA matches. Each improved personal best retains its achievement date; ties do not replace dates.

Dungeon and Zombies eliminations are excluded from Overall Performance kills and its K/D numerator, while mode statistics, XP and achievements retain those eliminations. Wins, losses and deaths are unchanged. Local journals rebuild these totals automatically. The hosted migration below corrects historical public kills once without deleting match history. Detailed historical damage/objective/form data cannot be inferred from the old aggregate leaderboard and are not fabricated. The new records begin with matches completed after this update.

The session roster contains every original participant and survives deaths/respawns. PvE enemies and summoned copies are not player rows: Dungeon/Solo Waves show the user, while Team Waves/Zombies show the allied participants. Dungeon separately reports monsters defeated out of the 15 monsters and bosses defeated out of the three bosses. Racing places use final lap/checkpoint progress; tied progress shares a place, and no completed lap shows a dash. Boss damage/healing uses actual HP events for every participant.

New receipts add optional `statisticsVersion: 2`, `players` and `dungeonTotals` fields. Older receipts remain valid; missing per-player/objective history is not invented. Older Night survival records retain their measured interval, while new records measure cumulative Light time.

## Local saves and integrity

Versioned localStorage keys: `fusion-throwdown:progress:v1:guest` and `fusion-throwdown:progress:v1:account:<auth-user-id>`. Existing settings and leaderboard storage are untouched. Guest data never syncs or enters the public leaderboard. Signing in/out or changing accounts never silently merges saves. Each match is bound to the account/guest scope present when it began, even if authentication changes mid-match.

The immutable completed-match journal uses the existing random UUID match ticket. Duplicate completion returns the existing receipt. Records, XP and achievements are derived from unique receipts, not incremented by rendering. Permanent earned achievements/unlocks are also archived, so future rule changes or migrations cannot revoke already earned cosmetics. Equipped slots are validated against unlocked catalog entries.

Version 0 journals migrate to version 1. Malformed entries are rejected. Unreadable saves are backed up under `:recovery` where browser storage permits; future-version saves are not overwritten. Storage failures retain the session's progress and show a retry option. Browser storage clearing/private browsing/quota rules still apply. Match IDs are not evicted: avoiding duplicate rewards takes priority over silently dropping old receipts.

## Optional Supabase setup

The checked-in `public/app-config.json` points to the configured Supabase project using its public publishable key. The database scripts and Auth redirect settings must also be configured in that project. Guest/local progression remains fully functional without a backend.

1. For a **new project**, configure authentication and run `backend/supabase.sql` using `backend/README.md`. Do not rerun the initial schema against an existing account database.
2. For **both new and existing projects**, run **`backend/progression.sql`** in Supabase's SQL editor. It adds private `progression_matches` and `progression_preferences` tables and `save_progression_cosmetics`. It does not change/delete profiles, existing totals or leaderboard history.
3. For an **existing account database**, also run **`backend/session-stats.sql`**. It excludes Dungeon/Zombies kills from public overall totals, corrects old totals once, and replaces `record_match` without removing private history or other statistics. It is safe to rerun. New projects already include this behavior in `supabase.sql`.
4. Set the HTTPS project URL and public anon/publishable key in `public/app-config.json`, then build/deploy. Never embed service-role keys or passwords.
5. Verify with two separate test accounts: each can read only its own progression; guest results are absent; retrying the same match UUID creates one row; inserts for another user, row updates/deletes and anonymous reads are denied. Cosmetic writes verify the expected user ID even if the session changes during a request.
6. Sign in on a second browser to verify journal merging, equipped cosmetics, records and permanent unlocks. Disconnect/reconnect to verify local fallback and retry. No hosted credentials are needed for unit/browser tests, which use guest storage and a mock cloud transport.

Authenticated sync merges immutable receipts by ID, uploads missing receipts with conflict-ignore, and derives progression from the union. Cosmetic preferences use timestamp conflict resolution; earned unlocks merge monotonically. Own-account caches allow offline play. Sign-in, completed matches, equipment changes, reconnect and **Retry sync** initiate synchronization. Failed cloud writes do not erase local progress. A missing migration produces an actionable local-save status instead of blocking play.

RLS grants authenticated users read/append access only to their own match receipts; receipts cannot be updated or deleted by the client. Cosmetic preferences are private and written through an authenticated owner-checked RPC. Nothing here is added to public rankings. The client runs AI combat and submits its own results: authenticated records are **not cheat-proof**. A future competitive service needs authoritative match verification.

## Validation

Run `npm test`, `npm run build`, and `npx playwright test test/browser/session-results.spec.js test/browser/progression.spec.js test/browser/app-shell.spec.js test/browser/menu-polish.spec.js test/browser/event-modes.spec.js`.

Unit coverage includes XP boundaries/attribution/caps, fusions, actual HP/overheal, once-only achievements, cosmetic locks and persistence, min/max records, mode events, guest/account separation, malformed/future saves, permanent unlocks, cloud union/retry and offline fallback. Browser coverage exercises real navigation, post-match reports, refresh persistence, equip/unequip and phone scrolling in both orientations. Existing gameplay suites remain in place. Gridiron whistles use the existing SFX mixer, volume control and post-match stop behavior.
