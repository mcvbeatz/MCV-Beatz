# Elemental — The Colosseum

A playable, single-player combat prototype based on the supplied elemental fighting-game brief. Original canvas pixel characters and arena art; all six origins share one caped silhouette. Built with vanilla JavaScript, Canvas 2D and Vite. No backend, accounts, secrets, or remote assets are required at runtime.

## Run

Node.js 22.12+ (validated with 24.19) and npm are required.

```sh
cd /workspace/MCV-Beatz
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

Open the app in your local browser, select an origin and battle format, then press **Begin battle**. Cloud onboarding does not provide a public preview link. The development server binds to all interfaces. Public hosting uses the static production build described below.

```sh
npm test                # deterministic combat rules + AI match simulations
npm run test:browser    # actual Chromium interaction tests
npm run build          # production assets in dist/
npm run preview        # serve the production build
```

Browser tests use `/usr/bin/chromium`. Set `CHROMIUM_PATH` to another installed Chromium executable if needed. They start Vite if a server is not already running. Font files are bundled locally through Fontsource.

## Controls

| Input             | Action                                                            |
| ----------------- | ----------------------------------------------------------------- |
| WASD / arrows     | Move; diagonal speed is normalized                                |
| J                 | Strike; tap or hold to repeat at the attack cooldown              |
| Q                 | Toggle nearest-rival lock; movement remains independent of facing |
| Hold K, release K | Charge and cast the current form's main ability                   |
| L                 | Utility; Earth holds L for its shield                             |
| F                 | Fuse a nearby compatible ally token                               |
| Tab               | Cycle origin and accumulated fused forms                          |
| Esc / R           | Pause / restart with the selected setup                           |

The action buttons also support mouse/touch. Hold a point in the arena to move toward it on touch devices. Dialogs and loss of window focus pause active battles. Sound is optional and defaults off.

## Implemented combat foundation

- Duels, fused duels, and 2v2 / 3v3 / 4v4 AI team battles, with victory/defeat and restart.
- Directional close-range melee, lock-on strafing, friendly fire, health, low-health movement reduction, and airborne momentum.
- 100ms contested-strike window: mutual in-range, facing strikes deal quarter damage.
- Charging scales potency, with cooldowns. A hit pauses charge growth without losing accumulated charge; Dark sabotage cancels it.
- Six origins, individual main/utility abilities, and core passives: contact burn, burn resistance, hard skin, flight, water cooling magma, and Light bypassing shadow step.
- Same-element ability resistance and the supplied hierarchy, represented as directed edges (including the Fire/Earth cycle).
- Fallen ally tokens, all listed compatibility recipes, stacked origin passives, and switching between origin and fused forms.
- Blended colors, level-II highlights, and level-III glow on original caped sprites.
- In-game controls, element codex, fusion reference, and responsive UI.

## Initial tuning assumptions

These values were not specified in the brief and are deliberately centralized in `src/combat.js` for iteration:

| Rule                            | Initial value                                 |
| ------------------------------- | --------------------------------------------- |
| Health                          | 120                                           |
| Melee damage / reach / cooldown | 14 / 69 world units / 430ms                   |
| Attack windup / clash window    | 110ms / 100ms                                 |
| Lock-facing range               | 245 world units, covering abilities and melee |
| Full charge                     | 1.8 seconds; up to 2.6× potency               |
| Hit interruption                | 270ms pause in charge growth                  |
| Main / utility cooldown         | 4.5 / 7 seconds, shield 5 seconds on release  |
| Earth defense                   | 25% reduction                                 |
| Shield                          | 65 durability, maximum 3-second hold          |
| Hierarchy advantage             | 1.5×                                          |
| Fusion range / healing          | 85 world units / 30 HP                        |

Hydro pump's requested 2× against Fire stacks with Water's 1.5× hierarchy advantage. Melee has no same-element penalty. Friendly fire follows the same damage rules as rival hits. Flight stays active when switching forms if Air has been accumulated.

## Deliberately unfinished / prototype approximations

The requested game is larger than this first combat slice. The following are **not complete implementations of the full specification**:

- Online multiplayer, campaign/progression, final character art, environmental objects, doors and flammable scenery.
- Light's sacrifice, separately selectable Dark blindness, and optional third/fourth ability slots. Flash and sabotage currently apply blindness.
- Quicksand currently applies a fixed slow and damage; it does not yet build to immobilization or support rescuing trapped fighters.
- Spirit's Angel guard/realm is absent. Portal is explicitly a personal **Portal step**, not shared paired portals or portal-closure kills. Revival restores a nearby unclaimed ally token's fighter at half health.
- Flood is a temporary arena-wide hazard: it suppresses ground damage and defeats Fire; it does not simulate water flow, swimming, doors, or lightning. Rainbow is not yet implemented.
- Telekinesis pushes nearby fighters; it does not select and move arbitrary objects/projectiles. Flight is currently an accumulated Air passive, not a separate Gravity hold ability.
- Doppelgängers/minions are short-lived one-hit AI fighters. They can use basic origin actions; their behavior still needs specialization.
- Demonic Death currently consumes an enemy token. Targeted un-fusion, special death and universal resuscitation rules are pending.
- Divine currently has healing/status-clearing actions; passive invisibility and comprehensive immunity are pending.
- Multi-Dimensional has experimental projectile/phase actions because its abilities were unspecified.
- Reflect handles ability damage, including contact damage; projectile trajectory reversal is not visualized.
- Several fused forms use a generic projectile or timed utility as a first-pass combat placeholder. Full ability-specific balance and visual feedback remain to be developed.
- Lightning and Invincible appear in the requested hierarchy but have no supplied origin/recipe, so they are not playable forms.
- Fixed arena camera, decorative architecture, and no character-to-character collision or obstacles yet. The app is designed primarily for keyboard combat; touch is basic pointer movement plus buttons.

## Project layout

- `src/combat.js`: simulation, AI, damage, timing, abilities, tokens and compatibility.
- `src/render.js`: original pixel arena, caped avatars, effects and world-space feedback.
- `src/main.js`: input, HUD, match setup, dialogs, sound and animation loop.
- `src/style.css`, `src/icons.js`: responsive interface and original vector icons.
- `test/combat.test.js`: deterministic simulation tests.
- `test/browser/arena.spec.js`: Chromium gameplay smoke tests.

Combat is independent of the renderer and browser. Start future iterations with timing, reach, hit feedback and AI pacing before expanding the ability catalogue.

## Publish to GitHub Pages

The site is prepared for `mcvbeatz/MCV-Beatz`. Relative asset paths support the `/MCV-Beatz/` project URL. The `main` branch stores the source; `gh-pages` stores only built public assets.

With Git push access configured, run:

```sh
npm run deploy:pages
```

This runs the combat tests, builds the app, adds `.nojekyll`, and pushes a new `gh-pages` commit without changing the working branch or normal index. Existing publishing history is preserved; the script never force-pushes. Source changes should also be committed and pushed to `main` separately. Deployments are manual, not automatic on source pushes.

One-time GitHub configuration:

1. Open the repository's **Settings → Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Choose **gh-pages** and **/ (root)**, then **Save**.
4. Wait for GitHub's Pages deployment to finish. The expected public address is `https://mcvbeatz.github.io/MCV-Beatz/`.

The expected address is not proof of a live deployment. If Pages is unavailable, check the repository's visibility and GitHub plan. No need to make source code public solely for this script.
