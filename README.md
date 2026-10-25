# Elemental — The Colosseum · v0.14

## v0.14 navigation, camera and lessons

- **Leave** is visible from the start of battle and always returns to that match’s setup. Unfinished matches can be resumed; completed matches offer a new battle.
- **Play → Team Battles:** Team Death Match, Team Waves, Domination, Capture the Flag, Fusion Rush, Boss. **Play → Solo Battles:** Free For All, Elemental Roulette, Solo Waves, Corruption. Each category uses a single, compact, full-width scrolling list. **Quick Match** randomly selects from both categories. Practice remains unranked.
- **Solo Waves / Team Waves** are the new display names for the Gauntlet modes. Existing URLs and saved mode IDs remain compatible.
- **Portrait battles** use a dedicated arena window above the movement/Strike row, with all active skills in a full-width row underneath. Fighters stay at least as large as the equivalent landscape view. The camera follows the player and clamps at map edges; screen gestures use the same camera transform. The victory sequence fits the arena so every survivor’s pose can be seen. Landscape keeps its whole-arena view.
- **Elemental selection cards** retain their 90×75 proportions in both orientations. The Home row uses the same six SVG symbols as the battle HUD.
- **Elements & Fusions** opens a 20-character chapter picker. Selecting one shows only that elemental’s swipeable chapter.
- **Controls** has nine illustrated lessons: movement direction, automatic lock and a connected strike, an active Sonic boom, origin/fused skill switching, before/after token absorption, portal placement, teleport preparation, enemy-swiping telekinesis, and current Settings/Leave behavior. The three tap/swipe techniques have separate screenshots for clarity. `node scripts/capture-controls.mjs` reproduces these real engine/input demonstrations with temporary teaching annotations.

## v0.13 mobile and battle update

- A prominent **Leave** button is available throughout the battle and returns to battle setup. All surviving winners display their own victory pose for four real seconds before results; all 20 elementals have a pose.
- The chosen **Landscape / Portrait** orientation applies to Home, setup, guides, account/settings and battles. The entire app rotates when needed, with matching touch coordinates. The viewport disables gesture zoom and form fields use a 16px minimum font to prevent iOS focus zoom. Fullscreen is optional; the web fallback keeps the same layout.
- **Gauntlet enemies have half their previous health**, including solo and team final bosses: first-wave enemies have 60 HP, wave two 69 HP; the solo final boss has 180 HP.
- **Divine owners see a 25% opaque silhouette** even at rest. Enemy visibility and AI targeting still use the existing concealment/reveal rules.
- **Lightning's Tailwind** replaces its personal Gust with a two-second movement boost for all living real teammates, including the caster, on a seven-second cooldown. It is available directly on the Lightning tab and replaces Gust on its inherited Air tab. In free-for-all, only the caster benefits. Ordinary Air keeps Gust.
- **Charging controls** in Settings offer hold/release or tap-to-start/tap-to-release, including fused shortcuts. Rock shield stays hold-based; Lightning strikes and telekinesis stay instant.
- Every mode guide and elemental tutorial includes actual game screenshots. Refresh the 35 images with `node scripts/capture-guides.mjs` while Vite is running.

## App navigation and new modes

The app opens with the configured logo video, then Home: **Play, Practice, Leaderboard, My Account, Settings**. No logo video was supplied for this release, so Home opens immediately. Add the video and set `introVideo` in `public/app-config.json` to activate the intro. Playback completion, Skip, and video failures all return to Home; blocked autoplay offers a Play button.

Screens fit the viewport without page scrolling. Mode lists and the elemental chapter library scroll within the screen; the character picker scrolls horizontally. Each mode has a swipeable How to Play slideshow. Practice includes controls and element/fusion ability tutorials, plus Duel, Fused II, Fused III and Team Brawl. Tutorial's Try Controls opens an unranked AI practice duel. Random chooses a Play mode, never Practice. `?mode=rush` (and other mode IDs) are supported setup deep links.

- **Fusion Rush:** 3v3 or 4v4, three minutes, 10-second respawns. Neutral compatible shards appear at distributed positions: six at start, up to two every eight seconds, capped at eight and expiring after 32 seconds. Either team can collect them. Eliminations give 1 point; first reaching tier II gives 3 and tier III gives 5, once per fighter per match (not farmable by respawning). Highest score wins; ties draw. Fusion resets on your respawn. Friendly fire is on, and ordinary ally-token fusion remains available.
- **Solo Waves:** start with an origin, clear escalating waves, then choose a compatible shard, full healing, or +25% damage / +15% speed for the next wave. Waves increase in number, health and elemental tier. Reaching tier III unlocks the final Invincible boss on the following wave. Beat the boss to win; dying ends the run. Rewards pause combat and the clock.
- **Team Waves:** two to four allies, currently one human and adaptive AI teammates. The same survival progression applies. Any surviving teammate keeps the run alive; felled allies return at half health between waves. Healing/upgrade rewards affect the team, and a shard choice also gives each AI ally a compatible evolution when possible. A full team wipe ends the run. Friendly fire remains on.
- **Elemental Roulette:** 2–8 independent fighters, random transformations every 25 seconds. The HUD reveals your next form five seconds before the change. Current HP, maximum HP, cooldowns and incoming status effects carry over; old forms, passives, charges, shields and dashes are replaced. No fusion. Respawns take 10 seconds, using the latest rolled form, and transformations also update waiting fighters without reviving them early. A single standing real fighter wins immediately; otherwise most kills at three minutes wins, with ties drawing.

Settings independently control SFX and the procedural ambient soundtrack. Volumes, orientation and charging preferences persist on the device. The chosen orientation applies across the entire app, rotating the layout and input coordinates when necessary. This is a mobile web/PWA layout, not a packaged App Store binary.

## Account service setup

Sign-in, email/username/password registration, email password recovery, personal stats and the five leaderboard metrics are integrated with **Supabase Auth/Postgres**, but a hosted project has not been configured. The UI clearly marks these services unavailable until connected. Guest play works and neither guest nor Practice results are stored or queued. Completed, signed-in Play matches save kills, deaths, wins/losses and K/D (kills divided by at least one death); a unique match ID prevents duplicate credit.

See [backend/README.md](backend/README.md) and [backend/supabase.sql](backend/supabase.sql) for the schema, row-level access policies, Auth setup, email sender and redirect configuration. Only the public project URL and publishable key belong in `public/app-config.json`. Passwords are sent to the authentication provider over HTTPS, never stored by this app; Auth stores password hashes. Local storage contains only settings; sessionStorage contains Auth session tokens.

Online multiplayer remains future work. Its lobby requirements are recorded in the backend guide: a 60-second countdown, early start when everyone readies, and adaptive-AI takeover of players who leave after a match starts. There is no fake online lobby or fabricated leaderboard. Current saved results are client-submitted AI-match stats; authoritative server-side results are required before competitive online leaderboards.

### Modes and battle behavior

- **Corruption:** 2–8 fighters start as Light; a random fighter becomes Dark at 5 seconds. Dark melee converts Light after two hits. Light healing restores only the caster’s two-hit resistance; Flash is unavailable. Each Light strike removes one Dark health point. Fresh Dark fighters have one point per remaining living Light fighter (seven Lights means seven hits). The cap falls as Lights convert, without healing existing damage; respawns use the current cap. Corrupted AI relentlessly pursues the nearest visible Light and attacks at its normal maximum cadence. Dark has no abilities and respawns after 10 seconds. Light survival and Dark infection totals have separate winners, including ties. Ends when all are Dark or after 2 minutes. Friendly fire and fusion are disabled.
- **Boss:** choose a level-I origin among 4–8 fighters; one fighter becomes the Invincible boss at random. The other 3–7 retain their origins, and boss maximum health equals their combined maximum health. The AI boss relentlessly targets the nearest healer first, then the nearest remaining opponent, using melee and fire abilities. Last team standing wins, with no respawns, friendly fire or fusion.
- **Domination:** 2v2–4v4, four flags, two initially owned by each team. A capture takes 10 seconds; each additional attacker doubles speed. Defenders contest and pause capture. Unattended progress drains at one capture-second per second. Each owned flag scores one flag-second each second; highest total at 3 minutes wins, with ties drawing. Respawns take 10 seconds; team wipes do not end this mode. Friendly fire is disabled; AI can attack through allies. Allied-token fusion follows Deathmatch's respawn rules.
- **Lightning strikes:** cooldown reduced from 4.5 to **3 seconds**, with the same instant strike and range.

A single-player elemental combat game with concept-based pixel characters, AI battles, fusion and touch controls. Built with vanilla JavaScript, Canvas 2D and Vite. Guest play requires no server or account. Optional accounts and leaderboards use a configured hosted backend.

**Public site:** https://mcvbeatz.github.io/MCV-Beatz/

## Playing on an iPhone

Open the site in Safari. Choose Play or Practice, select a mode and elemental, then enter the battle. Phone play fills the viewport. Choose upright Portrait or the Landscape rotation fallback in Settings. The controls are:

- **Bottom left:** analog movement stick, in any direction. Movement and skill buttons support simultaneous touches.
- **Bottom right:** Strike. The nearest opponent is automatically targeted when within melee range.
- **Bottom middle:** active skills. Hold the main skill to charge, then release. Earth’s Rock shield stays up while its button is held, until it breaks.
- **Across the top:** available ability sets. A Mirror can choose Earth, Light or Mirror; switching skills does not change its fused identity, passives or cooldowns.
- **Top right:** pause, fullscreen and return to setup. The prominent Leave button always returns to the current battle’s setup.

The fullscreen button requests browser fullscreen where supported. On iOS versions that do not support element fullscreen, the game fills the available browser viewport. Safari’s **Share → Add to Home Screen** provides a standalone view without normal browser bars. A manifest and Apple standalone metadata are included; offline play is not implemented.

Keyboard controls remain available: **WASD/arrows** move, **J** strikes, **hold/release K** charges/casts, **L** uses the second skill, **U/I** use the added fused skills, **Tab** cycles skill sets, **Esc** pauses, **R** restarts. There are no manual lock or fusion buttons. Arena taps are reserved for portal placement/closure or passive teleportation, not movement.

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

The **12 grounded elementals** (Water, Dark, Fire, Earth, Light, Mud, Mirror, Sun, Smoke, Gravity, Multi-Dimensional and Invincible) have alternating directional running frames with contact poses between strides. Earth and Mud use continuous all-fours strides without upright contact frames. Cadence follows movement speed; the cycle stops when movement stops or is blocked. Attacks and clashes take precedence. Air and the seven Air-based fusions retain hovering movement. Target-locked movement uses dedicated sidestep frames for every elemental, including flyers.

The transparent atlases ship as lossless WebP files with versioned asset URLs. Each atlas loads independently, with a procedural fallback if loading fails. No external image service is used at runtime. Frame rectangles and foot anchors are documented in `src/assets/README.md`.

The v0.9 revision gives Divine a featureless white-light face under its hood; Invincible has an uncovered Sun-like human head, muscular human arms and golden scales; Lightning has golden hair; Multi-Dimensional has a smooth hood without head spikes. Updated idle, directional attacks and applicable running frames all use the revised designs.

## Game modes

All modes are single-player with adaptive AI opponents. Team formats offer **2v2, 3v3 and 4v4**; friendly fire is enabled except in Boss, Corruption and Domination.

- **Capture the Flag:** carry the enemy flag to your home flag. Your own flag must be at base to score; touch a dropped friendly flag to return it. Death drops a carried flag. First to **3 captures** wins. Fighters respawn after **10 seconds**, even after a full-team defeat. Only level-I elements are available, and tokens and fusion are disabled. AI assigns attackers and defenders, intercepts flag carriers and returns dropped flags.
- **Team Deathmatch:** **3 minutes**, with **10-second respawns**. Most enemy kills wins; tied scores draw. A team immediately loses if all its real fighters are down together; surviving summons do not prevent this. Enemy kills by minions count for their summoner, while friendly kills and minion deaths score no points. A teammate's respawn preserves any fusion you acquired from their token. Your own respawn resets you to your starting element, full health and fresh cooldowns. Unclaimed tokens disappear when their owner respawns. Revival also resets the returned fighter without stripping other fighters' fusions.
- **Free for All:** choose **2–8 fighters**, each on their own side. Last living real fighter wins; there are no respawns. All rival tokens are visible and compatible ones fuse on touch. After falling, you can watch the remaining rivals finish the match.
- **Duel, Team Brawl, Fused II and Fused III** retain their existing elimination rules and allied-token fusion rules.

The HUD shows flag/kill scores, Deathmatch time remaining, respawn countdowns and the number of surviving Free for All fighters. Match results identify captures, timeout or elimination.

## v0.10 battle adjustments

- **AI repetition:** after three repetitions of the same action, an AI must reposition or choose another action. Three seconds without meaningful movement, damage or fusion also triggers a new plan. Fighters actively seek visible compatible tokens, flank hazards, and can escape an existing harmful floor instead of freezing at its edge. Friendly-fire restraint and hidden-Divine visibility rules still apply.
- **Death:** Demonic places a permanent **66-unit radius** floor sigil, the same size and forward placement as Magma. Each entry lowers a real fighter by one tier, including flyers, allies and the caster; level-I fighters are unaffected. Remaining within the sigil does not repeatedly demote, but leaving and re-entering can. Level III keeps the alphabetically first valid level-II form made from its current origins: **Demonic → Apparition; Divine → Mirror; Multi-Dimensional → Gravity; Lightning → Cloud; Invincible → Mirror**. Level II keeps its alphabetically first origin. Removed abilities and passives are stripped immediately. This neither restores fallen teammates nor drops replacement tokens. **Once per fighter per match**, including across respawns, revival and re-fusion. Death does not reflect.
- **Invincible:** movement speed is multiplied by **0.85**, including while using inherited ability tabs.
- **Character animation:** locked-on movement uses a guarded directional sidestep or sideways hover for every elemental. Unlocked grounded movement retains its running cycle. Directional hurt frames accompany the existing recoil wobble; attacks and other committed animations keep priority. Mud has sandy-tan hair and white eyes; Divine has a floating stance and its existing faceless white-light hood.
- **Portals:** bright-white interiors and rims, an expanding opening animation during the existing 500ms warning, and a collapsing closing animation. Closing immediately ends transport and resolves crossings as before; the remaining animation is visual only.

## Direct fused abilities

The fused tab now exposes these added buttons without switching origin tabs:

| Elemental         | Added abilities                                  |
| ----------------- | ------------------------------------------------ |
| Spirit            | Healing                                          |
| Divine            | Revival, Portals; Radiance heals the living team |
| Sun               | Healing                                          |
| Demonic           | Speed burst, Sonic boom                          |
| Mirror            | Rock shield, Healing                             |
| Smoke             | Shadow step, Flamethrower                        |
| Gravity           | Rock shield                                      |
| Apparition        | Sonic boom                                       |
| Multi-Dimensional | Healing, Shadow step                             |
| Lightning         | Healing (Tailwind is the main utility)           |

Buttons fit between the stick and Strike, using two rows on narrower screens. Added charge skills share the existing main-ability cooldown, and added utilities share the utility cooldown; Speed burst retains zero recharge. A held charge stays tied to the pressed ability. Passives remain automatic. The origin selector scrolls horizontally on phones, keeping Fire reachable.

Earth's Rock burst is removed; Rock shield remains. Doppelgängers pursue and strike enemies instead of retreating because of their low HP. Damage numbers are hidden. Idle and running fighters briefly recoil from hits; attacks, clashes, charging, shielding, dashes and teleport preparation take priority. Recoil is visual and does not add combat knockback.

## Swipe controls and ability visuals

- **Telekinesis:** swipe directly on a visible enemy to push in that direction, or tap the button / K to push the nearest visible rival away. Reach is **400 world units**, with a **520-unit knockback impulse** (twice the former distance before arena walls). It still deals **18 base damage** and has a **4.5-second cooldown**. Invalid targets, cancelled touches and out-of-range gestures consume nothing. It cannot be used while holding Rock shield.
- **Magma:** the affected floor shows glowing lava channels, drifting dark crust and bubbling highlights. Existing damage, cooling and flight rules remain unchanged.
- **Sonic boom:** fast curved wind fronts and directional streaks move through the existing fan-shaped strike area. Range, speed and damage are unchanged.
- **Gravity x2:** its circular gameplay area now softens and distorts the scene with a slight purple tint. The effect uses offset image copies for Safari compatibility and never draws hidden fighters.
- **Flood:** a moving water surface replaces the flat marker. Grounded characters are occluded up to their waist; flying characters remain above the water. Existing Flood damage and slowing rules still apply.
- **Mud:** immune to quicksand damage, slowing and sinking, regardless of which skill tab is selected.
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
- Water ability damage to any Fire-bearing elemental is multiplied by **0.7**, a 30% reduction from v0.1. Against base Fire, Hydro pump’s combined multiplier is now **1.68×** (2 × 1.2 × 0.7). Flood deals **25% max-health base damage once per fighter per cast**, with normal defenses applied and no reflection, instead of instant death. Grounded fighters are still slowed; leaving and re-entering the same Flood does not repeat its damage.
- Rock shield has **65 durability**, blocks 360°, and renders a shell of rising rocks. It lasts as long as held, with no former 3-second timeout. Releasing or breaking it starts a 5-second cooldown.
- Sonic boom is an expanding fan-shaped wave, with damage falling off over distance. The Sun laser is a fast, piercing beam with swept collision, not a ball.

## Latest elemental changes and AI

- **Blaze:** Flame burst is removed. Speed burst is a directional **300ms dash at 650 world units/second**, with a fading flame trail and **zero recharge**. It follows current movement, or facing if stationary. A new dash can start as soon as the active dash ends, even if an origin utility is cooling down. Each dash hits every crossed fighter once for **22 base damage**, including teammates. Burn only applies during physical contact, with no lingering damage after the dash passes. Fire, Water and Divine resist the burn; shields, dodge and reflection still work on the impact. The flame trail itself is decorative.
- **Lightning (Cloud + Light / Spirit + Water):** tap **Lightning strikes** for an instant hit on the nearest visible enemy within **300 world units**, with **26 base damage**, no charge, and a **3-second cooldown**. No valid target means no cooldown. Flood doubles strike damage at the target. **Shock** passively prevents movement, inertia, knockback, dashes and teleportation while another living fighter touches Lightning (under 30 units). It affects allies when friendly fire is enabled, ends immediately when contact breaks, and does not prevent attacks. Divine is immune. Both skills/passives follow the normal inherited-form rules.
- **Invincible (Sun + Earth / Mirror + Fire):** **2× melee damage** is passive; inherited abilities and contact burn keep normal strength. It remains active across ability sets. Reflected damage does not receive the melee bonus. Invincible has no active fused skill and still takes damage normally, with its inherited defenses.
- **Burn vs venom:** contact burn deals **5 base damage/second only while touching a Fire-bearing elemental**; it stops immediately on separation. A Blaze dash does impact damage and does not leave a burn timer. Mud contact refreshes **5 seconds of venom**, dealing **3 base damage/second** after separation. Immunities still apply. Magma, Vog, Heatwave and direct attacks keep their separate ability damage.
- **Smoke:** Smoke veil is removed; Vog, Shadow step and Flamethrower are available on the fused tab.
- **Gravity:** purple across the avatar, selector, HUD and token.
- **Healing:** automatically heals the living, on-screen teammate with the **lowest current HP**, including the caster, without a range limit. Selection happens when the charge is released. Fallen allies, temporary minions and fighters trapped in another dimension are excluded; Spirit and Divine Revival handle fallen allies. **Radiance heals all living, on-screen teammates**, including Divine itself, by the same charged amount per recipient (23 × charge power, capped at max HP). It does not revive fallen allies.
- **Divine:** fully invisible to other fighters at rest, including its shadow, glow and health bar; its owner sees a 25%-opaque silhouette. Actions reveal a **30% opaque silhouette** while charging/holding a shield and for **450ms** after a strike or cast. Continuous movement reveals **10% opacity for 150ms after each full second**; stopping resets the cadence. Taking actual health damage reveals **10% opacity for 150ms**, then hides again; action visibility takes priority. Damage labels do not leave a lingering position marker. These opponent-visibility rules remain active across origin skill sets; the owner’s silhouette stays visible. Hidden fighters cannot be locked or selected by the AI, but physical hits and area effects can still connect.
- **AI:** Fire closes to burn-contact distance against vulnerable enemies. Light prioritizes healing and a teammate-safe Flash, maintains distance while supporting, and still strikes any enemy within melee range whenever healing or support does not take priority. It closes in with a health advantage of at least 15 HP. Fighters prioritize nearby threats to wounded allies, separate from teammates, avoid harmful floor effects and dodge incoming projectiles. They decline attacks when an ally is closer than the nearest visible rival, also check melee arcs and ability paths, and cancel unsafe wind-ups. When otherwise idle, they move to and attack random spaces within 65 units of a Divine's last seen location. Search attacks still check friendly-fire risk and can physically hit a hidden fighter; they never read its hidden live coordinates. Friendly fire remains enabled; a teammate can still move into an attack already in flight.

Demonic minions now have **8 HP** and retain their existing count, lifetime and contact burn. Apparition doubles remain at **1 HP**. An ordinary direct melee hit can still kill a Demonic minion.

**Reflect:** Mirror and its descendants return **40% of incoming ability damage**, take the remaining **60%**, and then apply each recipient's normal defenses. The original elemental matchup is calculated once before the split. Reflections cannot bounce repeatedly. Melee is not reflected. **Quicksand, Gravity x2, Flood, Heatwave and Magma never trigger Reflect**; damaging terrain applies its full damage before the recipient's normal defenses. Vog and direct elemental abilities still reflect.

Spirit and Divine AI now open and traverse paired portals to close distance, retreat or reach wounded allies. They choose clear destinations, preserve player placement and never deliberately close a gate on a traveller. Multi-Dimensional AI uses bounded teleports with the same vulnerable preparation as the player, avoiding occupied and hazardous destinations. AI decisions never track an invisible enemy's live coordinates.

Combat feedback uses animations instead of floating event text: summons and revived fighters flash, tokens fall with a shining glint, and healing, shields, dodges, interruptions and dimensional losses use contextual effects. Hidden Divine fighters remain concealed by these cues. Persistent control instructions, scores and match results remain readable in the HUD.

## Automatic fusion and passives

In team elimination and Deathmatch, only allied tokens are rendered. Free for All exposes all rival tokens; Capture the Flag disables tokens and fusion. Touching a compatible token within **27 world units** fuses automatically, heals 30 HP, blends colors and creates a shockwave that briefly pushes all other on-field fighters away, including allies. Level II gains a shine; level III gains a glow.

Ability-set tabs expose all accumulated origins and fused forms. Passive abilities are inherited and never require a button: Reflect, hard skin, contact burn/resistance, flight, venomous contact, Angel guard, Divine invisibility/status immunity and Multi-Dimensional teleportation, Lightning Shock and Invincible strength. Mirror exposes Rock shield and Healing directly on its fused tab.

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

Browser tests use `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium. The suite starts Vite if necessary. Tests cover flag pickup/return/capture, objective AI, timed scores, respawn fusion retention/reset, team wipes, Free for All sizes and tokens, combat timing, automatic lock/fusion, hidden enemy tokens, passives, randomized formats, damage tuning, portal entity transport, dimensional losses, revival, Angel guard and teleportation. Browser checks exercise landscape and rotated-portrait layouts, real multi-touch stick-and-charge input, portal hit mapping, ability switching, shield holding returning to setup, zero-cooldown dashes, level-III controls Divine opponent concealment and owner silhouette, both charging styles, illustrated guides and victory timing. These are Chromium mobile emulation checks; real iPhone Safari validation remains useful.

- `src/combat.js`: combat, AI, abilities, fusion and revival.
- `src/portals.js`: shared portal transport and dimensional state for all mobile entities.
- `src/render.js`: original pixel art, rocks, waves, beams, ghosts and portals.
- `src/characters.js`, `src/assets/`: directional origin/fusion sprites, running and attack animation, portraits and atlas anchors.
- `src/battle-effects.js`: terrain surfaces, immersion, reflection shields, paired weapon clashes and gravity distortion.
- `src/main.js`: analog input, pointer ownership, fullscreen fallback and HUD.
- `src/style.css`, `src/icons.js`: responsive interface and original icons.
- `test/*.test.js`, `test/browser/*.spec.js`: simulation and browser regressions.

## Publish updates

The `main` branch stores source; `gh-pages` stores the production build. Deployment is manual:

```sh
npm run deploy:pages
```

This tests, builds, adds `.nojekyll` and pushes a new publishing commit. It preserves the working branch, normal index and publishing history and never force-pushes. Commit and push source changes to `main` separately. GitHub Pages must use **Deploy from a branch → gh-pages → / (root)**. No service worker caches an old release; refresh Safari after a new deployment.

## Remaining scope from the original design

This release implements the requested mobile/combat adjustments. Earlier features still awaiting their own iterations include online multiplayer, final art, physical scenery and doors, Light’s sacrifice, separately selectable Dark blindness, progressive quicksand/rescue, simulated flood flow and swimming, rainbow aesthetics, arbitrary-object telekinesis and Gravity’s separate held flight ability. Several other active fused skills retain their first-pass behavior.
