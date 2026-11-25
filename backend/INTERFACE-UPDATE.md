# Account, settings, Quick Match and setup update

## Behavior

- My Account opens Sign in / Register for guests. Overview, Stats, Elemental Mastery, Achievements and Cosmetics are mounted only for signed-in users. Guest multiplayer remains available and existing saved data is retained.
- Manage Account uses Supabase's existing `auth.updateUser` API to update email or password. Email changes follow the project's confirmation policy. Password confirmation is checked before submission; fields are cleared afterward. SDK errors remain visible. Sign-out and the existing account deletion confirmation remain available.
- Quick Match requests the optional `quick` join action. The server first chooses an open multiplayer room with space across all modes; only if none exists does it create the randomly selected multiplayer mode. Explicit Create/Join and mode-specific `auto` matchmaking retain their behavior. Selection and joining happen within the same server handler so simultaneous requests do not reserve the same seat.
- Battle Settings uses the same settings renderer as the main menu. Solo/Practice pauses while it is open; online matches continue, the room stays connected, and local controls are neutralized. Closing resumes the prior solo state.
- Auto-Rotation uses the viewport's natural orientation, with no artificial rotation or fullscreen orientation lock. Fixed Portrait and Landscape retain the existing rotated-coordinate handling. Resize releases held controls.
- Ability Charging retains the existing `hold` / `tap` values and gameplay behavior. Ability Layout stores `standard` or `cluster`; it changes only button placement. Active buttons reflow when the form or acquired abilities change.
- Setup uses existing character artwork and combat skill definitions, with concise ability descriptions, passive traits and an elemental carousel. Comparison bars are editorial **play-style ratings**, not damage, defense or movement multipliers. Compatibility reflects actual reachable fusion recipes, capped at five for the display scale. No combat values were modified.

## Deployment

These changes are prepared in the repository; they have not been published as part of this update.

Deploy the new Render server before publishing the client so global Quick Match is available. Old clients still work with the updated server; protocol remains 4, delta snapshots and movement prediction are unchanged. A previous server rejects the new `quick` action rather than silently creating an unrelated room.

No new Render environment variables, Supabase tables, SQL migrations or authentication redirect settings are required. Existing Supabase email delivery/confirmation settings apply to Change email. Do not disable email verification to use this interface. Actual hosted email delivery cannot be verified by the local mocked-account tests.

Publish the tested Pages build using the existing deployment script when the release is approved. On an iPhone, rotate with Auto-Rotation selected (turn off iOS Portrait Orientation Lock), check the two ability layouts, open Settings during an online lobby, and confirm that the lobby remains connected after closing it.

## Verification

- `npm test`: 538 tests passed, including cross-mode Quick Match, full/started-room exclusion, and fallback room creation.
- 66 relevant Chromium browser scenarios passed across the regression suite and focused reruns. Coverage includes guest gating, managed account confirmations/errors, signed-in cosmetics, persisted settings, both orientations/layouts, 44-pixel modal controls, all 25 elemental profiles, two-client lobbies, music pause/resume, progression and camera/touch interactions.
- `npm run build`: production build passed.
- Browser account tests use a mock Supabase client; they do not send real email or change a real user's password. Physical iPhone testing and hosted email delivery remain owner-side checks after deployment approval.
