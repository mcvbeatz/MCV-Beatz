# Elemental — The Colosseum · v0.7

A single-player elemental combat game with concept-based pixel characters, AI battles, fusion and touch controls. Built with vanilla JavaScript, Canvas 2D and Vite. No server, accounts, secrets or external runtime assets are required.

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

## Origin character art

The six level-I elementals now use the supplied concepts, adapted into a consistent pixel-art style. Each has front, back and right-side idle and attack poses; left-facing poses mirror the right side. The setup panel previews all three views.

| Element | Character                                                 | Melee animation       |
| ------- | --------------------------------------------------------- | --------------------- |
| Water   | Blue armored knight with flowing cyan water hair          | Tidal palm and splash |
| Dark    | Masked navy ninja with twin silver daggers                | Crossing dagger slash |
| Fire    | Red flame body with a white-hot crown                     | Lunging flame fist    |
| Air     | Silver crown and armor with cyan accents                  | Sweeping wind chop    |
| Earth   | Brown reptilian brawler with green scales and ivory claws | Heavy clawed punch    |
| Light   | White hood and cape, tan armor and spear                  | Radiant spear thrust  |

Facing follows the actual target lock or movement direction. Each strike has recoil, contact and recovery synchronized to the existing **110ms windup / 220ms swing**. The same art is used for players and AI. All **14 fused forms** now have their own front, back, side and attack frames, combining the component concepts. Level II adds a shine; level III adds a glow. Divine remains fully concealed at rest in battle, while its selection previews show the design.

The **12 grounded elementals** (Water, Dark, Fire, Earth, Light, Mud, Mirror, Sun, Smoke, Gravity, Multi-Dimensional and Invincible) have alternating directional running frames with contact poses between strides. Cadence follows movement speed; the cycle stops when movement stops or is blocked. Attacks and clashes take precedence. Air and the seven Air-based fusions retain hovering movement. Running uses facing direction, so automatic target lock still allows strafing.

The transparent atlases ship as lossless WebP files with versioned asset URLs. Each atlas loads independently, with a procedural fallback if loading fails. No external image service is used at runtime. Frame rectangles and foot anchors are documented in `src/assets/README.md`.

## Swipe controls and ability visuals

- **Telekinesis:** select Gravity's skill tab and swipe directly on a visible enemy's body. The enemy is pushed in the swipe direction, including in the rotated portrait layout. The main ability button and K key only explain the gesture. A valid swipe deals **18 base damage**, applies the existing **260-unit knockback impulse**, and starts a **4.5-second cooldown**. Range is **200 world units**. Invalid targets, taps, cancelled touches and gestures outside range consume nothing. The AI uses the same targeted operation. It no longer charges or pushes every nearby fighter through a button press.
- **Gravity x2:** its circular gameplay area now softens and distorts the scene with a slight purple tint. The effect uses offset image copies for Safari compatibility and never draws hidden fighters.
- **Flood:** a moving water surface replaces the flat marker. Grounded characters are occluded up to their waist; flying characters remain above the water. Existing Flood damage and slowing rules still apply.
- **Quicksand:** sand bands and particles spiral inward; grounded feet disappear beneath the surface. Flood suppresses the ground effect as before.
- **Reflect:** a translucent shield rotates around the recipient when reflection occurs. Reflection text is removed; the 40% return / 60% incoming split and normal defenses remain intact.
- **Contested strikes:** the fighters briefly hold opposing contact poses with their own spears, daggers, claws or elemental fists meeting in a shared spark. Normal swing animations are suppressed during this **300ms** clash. Existing quarter-damage rules still apply.

## Combat rules

- Duel, **Fused II**, **Fused III**, and 2v2 / 3v3 / 4v4 team brawls against AI. Rivals draw a random element from the selected tier each battle.
- Fused II offers the nine level-II elements. Fused III offers **Demonic, Divine, Multi-Dimensional, Lightning and Invincible**, each with all of its origin ability tabs.
- Automatic lock faces the nearest rival within **69 world units** while allowing independent movement. Blindness disrupts locking.
- Melee has a **110ms windup**, **430ms cooldown**, and **14 base damage**. Facing attacks contested within **100ms** deal quarter damage to both fighters. Friendly fire remains on.
- Low health reduces speed. Air passively flies faster with slower direction changes. Stick magnitude controls movement speed.
- Main skills charge for up to **1.8 seconds** and scale to **2.6×** potency. Hits interrupt charge growth for **270ms** without deleting stored power; Dark sabotage cancels charging.
- Same-element abilities deal half damage. The supplied hierarchy gives a **1.2×** advantage.
- Water ability damage to any Fire-bearing elemental is multiplied by **0.7**, a 30% reduction from v0.1. Against base Fire, Hydro pump’s combined multiplier is now **1.68×** (2 × 1.2 × 0.7). Flood deals **25% max-health base damage once per fighter per cast**, with normal defenses and partial reflection applied, instead of instant death. Grounded fighters are still slowed; leaving and re-entering the same Flood does not repeat its damage.
- Rock shield has **65 durability**, blocks 360°, and renders a shell of rising rocks. It lasts as long as held, with no former 3-second timeout. Releasing or breaking it starts a 5-second cooldown.
- Sonic boom is an expanding fan-shaped wave, with damage falling off over distance. The Sun laser is a fast, piercing beam with swept collision, not a ball.

## Latest elemental changes and AI

- **Blaze:** Flame burst is removed. Speed burst is a directional **300ms dash at 650 world units/second**, with a fading flame trail and **zero recharge**. It follows current movement, or facing if stationary. A new dash can start as soon as the active dash ends, even if an origin utility is cooling down. Each dash hits every crossed fighter once for **22 base damage**, including teammates. Burn only applies during physical contact, with no lingering damage after the dash passes. Fire, Water and Divine resist the burn; shields, dodge and reflection still work on the impact. The flame trail itself is decorative.
- **Lightning (Cloud + Light / Spirit + Water):** tap **Lightning strikes** for an instant hit on the nearest visible enemy within **300 world units**, with **26 base damage**, no charge, and a **4.5-second cooldown**. No valid target means no cooldown. Flood doubles strike damage at the target. **Shock** passively prevents movement, inertia, knockback, dashes and teleportation while another living fighter touches Lightning (under 30 units). It affects allies too, ends immediately when contact breaks, and does not prevent attacks. Divine is immune. Both skills/passives follow the normal inherited-form rules.
- **Invincible (Sun + Earth / Mirror + Fire):** **2× melee damage** is passive; inherited abilities and contact burn keep normal strength. It remains active across ability sets. Reflected damage does not receive the melee bonus. Invincible has no active fused skill and still takes damage normally, with its inherited defenses.
- **Burn vs venom:** contact burn deals **5 base damage/second only while touching a Fire-bearing elemental**; it stops immediately on separation. A Blaze dash does impact damage and does not leave a burn timer. Mud contact refreshes **5 seconds of venom**, dealing **3 base damage/second** after separation. Immunities still apply. Magma, Vog, Heatwave and direct attacks keep their separate ability damage.
- **Smoke:** Smoke veil is removed; Vog remains its active fused skill.
- **Gravity:** purple across the avatar, selector, HUD and token.
- **Healing / Radiance:** automatically heals the living, on-screen teammate with the **lowest current HP**, including the caster, without a range limit. Selection happens when the charge is released. Fallen allies, temporary minions and fighters trapped in another dimension are excluded; Spirit Revival handles fallen allies.
- **Divine:** fully invisible at rest, including its shadow, glow, health bar and player marker. Actions reveal a **30% opaque silhouette** while charging/holding a shield and for **450ms** after a strike or cast. Continuous movement reveals **10% opacity for 150ms after each full second**; stopping resets the cadence. Taking actual health damage reveals **10% opacity for 150ms**, then hides again; action visibility takes priority. Damage labels do not leave a lingering position marker. This remains active across origin skill sets and applies to the player's own avatar too. Hidden fighters cannot be locked or selected by the AI, but physical hits and area effects can still connect.
- **AI:** Fire closes to burn-contact distance against vulnerable enemies. Light prioritizes healing and a teammate-safe Flash, maintains distance while supporting, and still strikes any enemy within melee range whenever healing or support does not take priority. It closes in with a health advantage of at least 15 HP. Fighters prioritize nearby threats to wounded allies, separate from teammates, avoid harmful floor effects and dodge incoming projectiles. They decline attacks when an ally is closer than the nearest visible rival, also check melee arcs and ability paths, and cancel unsafe wind-ups. When otherwise idle, they move to and attack random spaces within 65 units of a Divine's last seen location. Search attacks still check friendly-fire risk and can physically hit a hidden fighter; they never read its hidden live coordinates. Friendly fire remains enabled; a teammate can still move into an attack already in flight.

Demonic minions now have **8 HP** and retain their existing count, lifetime and contact burn. Apparition doubles remain at **1 HP**. An ordinary direct melee hit can still kill a Demonic minion.

**Reflect:** Mirror and its descendants return **40% of incoming ability damage**, take the remaining **60%**, and then apply each recipient's normal defenses. The original elemental matchup is calculated once before the split. Reflections cannot bounce repeatedly. Melee is not reflected.

## Automatic fusion and passives

Only allied tokens are rendered. Touching a compatible token within **27 world units** fuses automatically, heals 30 HP, blends colors and creates a shockwave that briefly pushes all other on-field fighters away, including allies. Level II gains a shine; level III gains a glow.

Ability-set tabs expose all accumulated origins and fused forms. Passive abilities are inherited and never require a button: Reflect, hard skin, contact burn/resistance, flight, venomous contact, Angel guard, Divine invisibility/status immunity and Multi-Dimensional teleportation, Lightning Shock and Invincible strength. Mirror has **no active skill of its own**; use its Earth and Light tabs for active skills.

Multi-Dimensional can prepare a teleport by tapping, even while an inherited ability set is selected. Each jump is limited to **180 world units**; farther taps mark a destination 180 units in that direction. A visible marker warns opponents during a **200ms vulnerable preparation** at the departure point. Movement pauses during preparation; damage can still hit or kill the fighter. Shock, knockback, death or portal entry cancels the pending jump. Repeated taps cannot replace or bypass a pending jump, and another jump can start immediately after arrival without a cooldown. An active portal-placement operation or a tap on the player’s portal takes priority over teleportation.

Multi-Dimensional has no Rift. Its **Teleport** reminder button explains arena taps and preparation; pressing it does not teleport, activate a mode or spend a cooldown. Teleport remains available across inherited ability sets.

## Spirit abilities

### Portals

Activate **Portals**, then tap two positions inside the arena. Each portal shows a **500ms opening warning** before it accepts travellers. Placement within **40 units of a living fighter or ghost**, including the owner, is rejected. The first portal can function alone once its warning ends. A pair works in both directions for all current mobile combat entities: fighters, summoned minions, ghosts, projectiles (including lasers), sonic waves, tokens and lingering ground effects. Static arena architecture is decorative and not a movable entity.

- Paired crossings take **180ms**. Tap either of your portals at any time to close it. Closing an entrance or exit while a fighter is crossing kills them. Closing a warning marker or a portal beneath a fighter who has not entered it does not kill that fighter. A normal paired-crossing death leaves a token.
- Entering a lone portal takes the entrant off-screen into another dimension. Move against the entry direction with the stick to retreat back out. AI fighters also know how to retreat.
- Once a second exit finishes its opening warning, it releases anyone still held by the first portal.
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

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium. The suite starts Vite if necessary. Tests cover combat timing, automatic lock/fusion, hidden enemy tokens, passives, randomized formats, damage tuning, portal entity transport, dimensional losses, revival, Angel guard and teleportation. Browser checks exercise landscape and rotated-portrait layouts, real multi-touch stick-and-charge input, portal hit mapping, ability switching, shield holding returning to setup, zero-cooldown dashes, level-III controls and complete Divine concealment. These are Chromium mobile emulation checks; real iPhone Safari validation remains useful.

- `src/combat.js`: combat, AI, abilities, fusion and revival.
- `src/portals.js`: shared portal transport and dimensional state for all mobile entities.
- `src/render.js`: original pixel art, rocks, waves, beams, ghosts and portals.
- `src/characters.js`, `src/assets/`: directional origin/fusion sprites, running and attack animation, portraits and atlas anchors.
- `src/battle-effects.js`: terrain surfaces, immersion, reflection shields, paired weapon clashes and gravity distortion.
- `src/main.js`: analog input, pointer ownership, fullscreen fallback and HUD.
- `src/style.css`, `src/icons.js`: responsive interface and original icons.
- `test/combat.test.js`, `test/tactics.test.js`, `test/elements.test.js`, `test/balance.test.js`, `test/browser/arena.spec.js`: simulation and browser regressions.

## Publish updates

The `main` branch stores source; `gh-pages` stores the production build. Deployment is manual:

```sh
npm run deploy:pages
```

This tests, builds, adds `.nojekyll` and pushes a new publishing commit. It preserves the working branch, normal index and publishing history and never force-pushes. Commit and push source changes to `main` separately. GitHub Pages must use **Deploy from a branch → gh-pages → / (root)**. No service worker caches an old release; refresh Safari after a new deployment.

## Remaining scope from the original design

This release implements the requested mobile/combat adjustments. Earlier features still awaiting their own iterations include online multiplayer, final art, physical scenery and doors, Light’s sacrifice, separately selectable Dark blindness, progressive quicksand/rescue, simulated flood flow and swimming, rainbow aesthetics, arbitrary-object telekinesis and Gravity’s separate held flight ability. Demonic Death still consumes a rival token rather than implementing the original targeted un-fusion and special resuscitation rules. Several other active fused skills retain their first-pass behavior.
