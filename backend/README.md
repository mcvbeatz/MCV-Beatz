# Hosted accounts and stats

The game works without an account backend. Guest and Practice results are never written or queued. Until configured, account forms and the leaderboard clearly show that the service is unavailable.

1. Create a Supabase project, enable email/password authentication and email confirmation, and configure an email sender for confirmation and password recovery.
2. Run `supabase.sql` in its SQL editor. This creates public usernames/stats, private match history, row-level security, and an authenticated, idempotent result RPC. Back up an existing database before applying migrations; this file is for a new project.
3. Set Site URL and allowed email redirect URL to `https://mcvbeatz.github.io/MCV-Beatz/` (also allow localhost for development).
4. Put the project HTTPS URL and **publishable/anon key** in `public/app-config.json`. Never put a secret/service-role key in the game.
5. Deploy. Test email verification, sign-in, recovery links, password update, sign-out, duplicate result submission, and isolation between two accounts.

Supabase Auth handles password hashing and recovery. The game never stores plaintext passwords; it only passes them to Auth over HTTPS and clears form fields. Session tokens use sessionStorage. Usernames and cumulative stats are public; email addresses and auth records are not exposed by the leaderboard.

These are authenticated **single-player AI-match stats**, submitted by the client, not an anti-cheat-protected competitive service. Before online ranked play, replace client-submitted outcomes with results from an authoritative match server. Online lobbies will require that server: 60-second countdown, immediate start when everyone readies, and AI takeover of disconnected seats after play starts. No online lobby is simulated by the current release.

Set `introVideo` in `public/app-config.json` to a deployed relative video path, such as `intro.mp4`, once the user's logo video is supplied. The intro plays inline, supports skipping/tap-to-play when autoplay is blocked, and opens Home on completion or playback failure. Without a video it opens Home immediately.
