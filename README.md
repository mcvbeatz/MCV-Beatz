# Elemental — The Colosseum · v0.2

A single-player elemental combat game with original caped pixel characters, AI battles, fusion and touch controls. Built with vanilla JavaScript, Canvas 2D and Vite. No server, accounts, secrets or external runtime assets are required.

**Public site:** https://mcvbeatz.github.io/MCV-Beatz/

## Playing on an iPhone

Open the site in Safari. Select a format and elemental, then enter the battle. Phone play fills the viewport in landscape, with a rotated landscape fallback when the device is held vertically. The controls are:

- **Bottom left:** analog movement stick, in any direction. Movement and skill buttons support simultaneous touches.
- **Bottom right:** Strike. The nearest opponent is automatically targeted when within melee range.
- **Bottom middle:** active skills. Hold the main skill to charge, then release. Earth’s Rock shield stays up while its button is held, until it breaks.
- **Across the top:** available ability sets. A Mirror can choose Earth, Light or Mirror; switching skills does not change its fused identity, passives or cooldowns.
- **Top right:** pause, fullscreen and return to setup.

The fullscreen button requests browser fullscreen where supported. On iOS versions that do not support element fullscreen, the game fills the available browser viewport. Safari’s **Share → Add to Home Screen** provides a standalone view without normal browser bars. A manifest and Apple standalone metadata are included; offline play is not implemented.

Keyboard controls remain available: **WASD/arrows** move, **J** strikes, **hold/release K** charges/casts, **L** uses the second skill, **Tab** cycles skill sets, **Esc** pauses, **R** restarts. There are no manual lock or fusion buttons. Arena taps are reserved for portal placement/closure or passive teleportation, not movement.

## Combat rules

- Duel, fused duel, and 2v2 / 3v3 / 4v4 team brawls against AI. Rivals draw a random element each battle; fused rivals draw from the nine level-II elements.
- Fused mode shows all nine level-II choices instead of the six origins.
- Automatic lock faces the nearest rival within **69 world units** while allowing independent movement. Blindness disrupts locking.
- Melee has a **110ms windup**, **430ms cooldown**, and **14 base damage**. Facing attacks contested within **100ms** deal quarter damage to both fighters. Friendly fire remains on.
- Low health reduces speed. Air passively flies faster with slower direction changes. Stick magnitude controls movement speed.
- Main skills charge for up to **1.8 seconds** and scale to **2.6×** potency. Hits interrupt charge growth for **270ms** without deleting stored power; Dark sabotage cancels charging.
- Same-element abilities deal half damage. The supplied hierarchy gives a **1.5×** advantage.
- Water ability damage to any Fire-bearing elemental is multiplied by **0.7**, a 30% reduction from v0.1. Against base Fire, Hydro pump’s combined multiplier changes from **3× to 2.1×**. Cloud’s original Flood instant-death interaction with Fire is unchanged.
- Rock shield has **65 durability**, blocks 360°, and renders a shell of rising rocks. It lasts as long as held, with no former 3-second timeout. Releasing or breaking it starts a 5-second cooldown.
- Sonic boom is an expanding fan-shaped wave, with damage falling off over distance. The Sun laser is a fast, piercing beam with swept collision, not a ball.

## Automatic fusion and passives

Only allied tokens are rendered. Touching a compatible token within **27 world units** fuses automatically, heals 30 HP, blends colors and creates a shockwave that briefly pushes all other on-field fighters away, including allies. Level II gains a shine; level III gains a glow.

Ability-set tabs expose all accumulated origins and fused forms. Passive abilities are inherited and never require a button: Reflect, hard skin, contact burn/resistance, flight, venomous contact, Angel guard, Divine status immunity and Multi-Dimensional teleportation. Mirror has **no active skill of its own**; use its Earth and Light tabs for active skills.

Multi-Dimensional can teleport instantly to any valid arena point by tapping, without a cooldown, even while an inherited ability set is selected. An active portal-placement operation or a tap on the player’s portal takes priority over teleportation.

## Spirit abilities

### Portals

Activate **Portals**, then tap two positions inside the arena. The first portal immediately exists, even before the second is placed. A pair works in both directions for all current mobile combat entities: fighters, summoned minions, ghosts, projectiles (including lasers), sonic waves, tokens and lingering ground effects. Static arena architecture is decorative and not a movable entity.

- Paired crossings take **180ms**. Tap either of your portals at any time to close it. Closing an entrance or exit while a fighter is crossing kills them. A normal paired-crossing death leaves a token.
- Entering a lone portal takes the entrant off-screen into another dimension. Move against the entry direction with the stick to retreat back out. AI fighters also know how to retreat.
- Opening a second exit immediately releases everyone held by the first portal.
- Closing a lone portal permanently loses its trapped fighters and their tokens, including absorbed souls. These losses cannot be revived.
- Off-screen travellers do not collide or take damage. Projectile and hazard lifetimes pause until they emerge. A brief exit cooldown prevents instant portal loops.
- A remaining portal can be paired with a replacement using the Portals skill again. Portal positions must be at least 85 world units apart. Cancel placement without closing portals using the on-screen cancel control.

### Revival

Revival restores the **nearest recoverable fallen ally**, without a range limit, at the caster’s position with 60–84 HP depending on charge. It does not substitute self-healing when there is no fallen ally and consumes no cooldown on that failed use. Permanently lost souls and temporary minions cannot be revived.

An already absorbed ally can be revived: their elemental contribution is removed from its bearer or bearer token, preventing the same soul from existing both as a fused component and a living ally.

### Angel guard

A felled Spirit, or a fighter that has inherited Spirit, becomes a controllable ghost while living allies remain. Position the ghost between a rival and an ally to block the rival’s melee attack. Ghosts cannot attack or take normal damage, can move and use portals, and stop being ghosts when revived. They do not count as surviving fighters for victory conditions. Ranged abilities bypass the ghost’s melee guard.

## Development

Node.js 22.12+ and npm are required; development uses Node.js 24.

```sh
cd /workspace/MCV-Beatz
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
npm test
npm run test:browser
npm run build
```

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium. The suite starts Vite if necessary. Tests cover combat timing, automatic lock/fusion, hidden enemy tokens, passives, randomized formats, damage tuning, portal entity transport, dimensional losses, revival, Angel guard and teleportation. Browser checks exercise landscape and rotated-portrait layouts, real multi-touch stick-and-charge input, portal hit mapping, ability switching, shield holding and returning to setup. These are Chromium mobile emulation checks; real iPhone Safari validation remains useful.

- `src/combat.js`: combat, AI, abilities, fusion and revival.
- `src/portals.js`: shared portal transport and dimensional state for all mobile entities.
- `src/render.js`: original pixel art, rocks, waves, beams, ghosts and portals.
- `src/main.js`: analog input, pointer ownership, fullscreen fallback and HUD.
- `src/style.css`, `src/icons.js`: responsive interface and original icons.
- `test/combat.test.js`, `test/browser/arena.spec.js`: simulation and browser regressions.

## Publish updates

The `main` branch stores source; `gh-pages` stores the production build. Deployment is manual:

```sh
npm run deploy:pages
```

This tests, builds, adds `.nojekyll` and pushes a new publishing commit. It preserves the working branch, normal index and publishing history and never force-pushes. Commit and push source changes to `main` separately. GitHub Pages must use **Deploy from a branch → gh-pages → / (root)**. No service worker caches an old release; refresh Safari after a new deployment.

## Remaining scope from the original design

This release implements the requested mobile/combat adjustments. Earlier features still awaiting their own iterations include online multiplayer, final art, physical scenery and doors, Light’s sacrifice, separately selectable Dark blindness, progressive quicksand/rescue, simulated flood flow and swimming, rainbow aesthetics, arbitrary-object telekinesis and Gravity’s separate held flight ability. Demonic Death still consumes a rival token rather than implementing the original targeted un-fusion and special resuscitation rules. Divine’s passive invisibility remains pending. Several other active fused skills retain their first-pass behavior. Lightning and Invincible have no supplied origin/recipe and remain hierarchy entries only.
