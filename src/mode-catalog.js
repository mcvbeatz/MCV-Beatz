export const MODES = {
  dungeon: {
    name: "Dungeon",
    tag: "Solo exploration · Three bosses",
    slides: [
      [
        "Enter the Drowned Vault",
        "Choose an origin and explore flooded stone chambers. Alligator, snake and wolf monsters roam the passages. Defeated monsters leave healing drops; touch one to restore 32 HP.",
        "♜",
        "guides/dungeon.svg",
      ],
      [
        "Break the tidal seal",
        "Defeat the Water mini-boss to open the upper wing. Choose a compatible elemental token, then collect it where the boss fell. There is no time limit on your choice.",
        "◇",
        "guides/dungeon.svg",
      ],
      [
        "Claim the key",
        "Defeat Apparition for your second token choice and the vault key. Collect the key, approach the locked door, and defeat Terraformer inside. Your death ends the run.",
        "⚿",
        "guides/dungeon.svg",
      ],
    ],
  },
  boss: {
    name: "Boss",
    tag: "1 vs 3–7",
    slides: [
      [
        "Face the titan",
        "Choose a level-I origin. One of 4–8 fighters becomes Invincible at random. Boss health equals all challengers combined.",
        "♜",
      ],
      [
        "Break their support",
        "The AI boss hunts healers first. Challengers should protect Light and spread out. Friendly fire is off.",
        "✦",
      ],
      [
        "Last team standing",
        "No respawns or fusion. Defeat the entire opposing side to win.",
        "⚔",
      ],
    ],
  },
  zombies: {
    name: "Zombies",
    tag: "2–8 Ice survivors · endless horde",
    slides: [
      [
        "Hold out together",
        "Survive as long as possible on the fully open dungeon map. Your team has 2–8 Ice elementals. The run ends when all teammates are felled; survival time is your score. Friendly fire and fusion are off.",
        "❄",
      ],
      [
        "The Fire horde",
        "Fire enemies take five hits and use melee only. Batches spawn every five seconds, starting at one and growing by one per defeat, capped at 100. At 50 per batch, spawns spread from the boss-room edges to exposed edges throughout the dungeon. Fallen Fire enemies sometimes leave health drops: at most 20 on the map, each lasting 15 seconds.",
        "♨",
      ],
      [
        "Explore for abilities",
        "Each teammate can hold three extra abilities alongside Icicle Burst and Drain. Touch a labelled rune to collect it, then use its ability button beside Icicle Burst on Ice. All 17 pickups are unique across the team and stay yours for the run, including after Revival. No runes appear in the starting or boss room.",
        "+",
      ],
      [
        "Choose your powers",
        "Vog, Quicksand, Teleport, Lightning strikes, Flood, Portals, Explosion, Revival, Rebirth, Telekinesis, Rock shield, Speed burst, Invisibility, Healing, Chasm, Stone prison and Life spring. Rebirth and Invisibility are passive; Rock shield is held. Teleport and Chasm need a destination tap; Portals needs two placements. Life spring is once per run.",
        "✦",
      ],
    ],
  },
  gridiron: {
    name: "Gridiron",
    tag: "4v4 · 3 minutes · sudden death",
    slides: [
      [
        "Take the field",
        "Eight fighters, all starting as Earth. When a team first falls behind, its player with the most deaths becomes Gravity for the rest of the match, including respawns. Tied death counts choose randomly. Friendly fire is on. Pick up the midfield ball by touching it with your shield down.",
        "◇",
      ],
      [
        "Protect the ball",
        "Hits force a fumble. If the carrier raises Rock shield, the shield must break first. Tap a teammate to throw a lateral, or tap Pass / P for the furthest eligible teammate sideways or behind you. Passes can be intercepted; missed catches leave a loose ball. Shielded teammates cannot catch. Surrounded AI carriers pass to an open teammate when the lateral lane is clear. Fallen players respawn at their original starting positions after five seconds.",
        "◉",
      ],
      [
        "Touchdown",
        "Bring the ball into the opposing end zone for one point. After a touchdown, players return to their starting positions and the team that conceded receives the ball. Its player with the most kills is the carrier; ties choose randomly. Most points after three minutes wins; a tie goes to sudden death, with the next touchdown winning.",
        "⚑",
      ],
    ],
  },
  turnpike: {
    name: "Turnpike Racing",
    tag: "8 racers · 3 laps · 3 minutes",
    slides: [
      [
        "Race above the clouds",
        "Eight Air elementals race a complete sky circuit. Follow the checkpoints through a long straight, two hairpins and sweeping curves. First to three laps wins, or the farthest racer after three minutes. Flying off the track slows you greatly.",
        "➜",
      ],
      [
        "A second chance",
        "Attack rival racers. When felled, keep flying as a slower guardian angel for five seconds, then respawn where you are. Fire tokens appear ahead of last place and grant Blaze for seven seconds. Health appears ahead of the racer with the lowest health.",
        "✦",
      ],
      [
        "One pickup at a time",
        "Sonic boom is replaced by ability drops. Carry one until you use it: Gravity x2, Stone prison, Flash, Tornado, Telekinesis, Randomizer, Teleport, Lightning strikes, Fire ball, Laser beam, Hydro pump, Portals or Explosion. Tap to use; Teleport then needs a destination tap, and Portals needs two clear placements.",
        "?",
      ],
      [
        "Holographic hazard",
        "Randomizer leaves a rainbow question-mark floor. Touch it to lose a fusion tier; if already level I, change to another random origin. Each fresh entry can trigger it again. Ability pickups remain single-use regardless of your form.",
        "?",
      ],
    ],
  },
  ctf: {
    name: "Capture the Flag",
    tag: "8 fighters · evergreen maze",
    slides: [
      [
        "Steal their flag",
        "Two teams of four face off in the Evergreen Labyrinth, a tree-wall maze with its own layout. Touch the opposing flag and carry it back to your own base.",
        "⚑",
      ],
      [
        "Protect home",
        "Your flag must be at home to score. Touch a dropped friendly flag to return it. Any attack on a flag carrier makes them explode, drop the flag and wait to respawn—even if shielded.",
        "⌂",
      ],
      [
        "First to three",
        "First to three captures, or most captures after three minutes, wins. Tied time goes to sudden death: the next capture wins. Respawns take 10 seconds. Fusion is disabled; friendly fire is on.",
        "Ⅲ",
      ],
    ],
  },
  domination: {
    name: "Domination",
    tag: "Four flags · 3 minutes",
    slides: [
      [
        "Capture and hold",
        "Both teams start with two flags. Stand in an enemy flag ring for 10 seconds to capture it.",
        "⚑ ⚑",
      ],
      [
        "Bring backup",
        "Each extra attacker doubles capture speed. A defender in the ring pauses capture. Abandoned progress drains.",
        "↗",
      ],
      [
        "Every second matters",
        "Each owned flag scores one point per second. Highest total at three minutes wins. 10-second respawns; friendly fire is off.",
        "◷",
      ],
    ],
  },
  gauntlet: {
    name: "Solo Waves",
    tag: "Solo survival",
    slides: [
      [
        "Start with an origin",
        "Fight escalating waves. Enemies gain health, numbers and fusion tiers as the run continues.",
        "Ⅰ",
      ],
      [
        "Choose your reward",
        "You have seven seconds between waves to choose a compatible shard, full healing, or a damage and speed boost. Change your selection until time expires; no selection automatically takes the first option. Then walk through the corridor to the next chamber of the Threefold Bastion.",
        "◇ +",
      ],
      [
        "Challenge the final boss",
        "Reach tier III to unlock the final boss in the next wave. Defeat it to finish the run. Your death ends solo survival.",
        "Ⅲ ♜",
      ],
    ],
  },
  "gauntlet-team": {
    name: "Team Waves",
    tag: "2–4 allies · survival",
    slides: [
      [
        "Survive together",
        "You and adaptive AI allies fight escalating waves. Keep at least one teammate alive.",
        "⚔ ⚔",
      ],
      [
        "Recover between waves",
        "Felled allies return at half health. You have seven seconds to select or change the team advantage; at zero the selected reward applies, or the first option is automatic. Follow the corridor to the next chamber. Allies follow you, and the next wave waits for everyone to arrive.",
        "✦",
      ],
      [
        "Evolve to tier III",
        "Reaching tier III brings the final boss next wave. Win together; a full-team defeat ends the run. Friendly fire is on.",
        "Ⅲ",
      ],
    ],
  },
  roulette: {
    name: "Elemental Roulette",
    tag: "2–8 fighters",
    slides: [
      [
        "Expect a new form",
        "Every 25 seconds every fighter transforms into a random origin or fusion.",
        "↻",
      ],
      [
        "Five seconds to prepare",
        "The HUD reveals your next form five seconds before the change. Position yourself for its abilities.",
        "5 →",
      ],
      [
        "Health carries over",
        "Transforming does not heal you. Abilities and passives change, but cooldowns carry over. Respawns take 10 seconds. Respawns are unlimited and the match always lasts three minutes. Most kills when time expires wins. Ties draw. No fusion.",
        "♥",
      ],
    ],
  },
  ffa: {
    name: "Free For All",
    tag: "2–8 fighters",
    slides: [
      [
        "Everyone is a rival",
        "Fight independently against up to seven opponents.",
        "⚔",
      ],
      [
        "Claim fallen power",
        "All rival tokens are visible. Touch compatible tokens to fuse automatically.",
        "◇",
      ],
      [
        "Last fighter standing",
        "Everyone respawns after ten seconds. The last fighter standing wins early; otherwise most kills after three minutes wins. Ties draw.",
        "Ⅰ",
      ],
    ],
  },
  war: {
    name: "War",
    tag: "3v3 · 4v4 · 5v5",
    slides: [
      [
        "One element. One army.",
        "Choose an origin. Your entire team shares it, and the opposing team shares a different random origin. Six to ten fighters; friendly fire is on.",
        "⚔",
      ],
      [
        "Return for healing",
        "Except for Light, each team receives one health drop at its base every seven seconds. Touch your team's drop to restore 59.8 HP, equal to fully charged Healing. Full-health fighters leave drops for allies.",
        "✚",
      ],
      [
        "Fight through the heat",
        "Water versus Fire always takes place in the Ember Caldera. Water loses 1 HP per second there. Most kills at three minutes wins, even after a full team wipe. Respawns take ten seconds.",
        "♨",
      ],
      [
        "Reinforcements",
        "Every two consecutive deaths without an enemy kill deliver a random compatible elemental token to your home base. Only your team can collect it. An enemy kill resets your streak. Respawning returns you to your starting element.",
        "◇",
      ],
      [
        "Moonveil Temple",
        "Light versus Dark fights in Dark’s moonlit temple courtyard. Spike traps hurt either army for 18 HP, at most once per second per fighter. Dark knows every trap; each Light fighter discovers a trap only by triggering it, and remembers it after respawning.",
        "☾",
        "guides/war-temple.png",
      ],
    ],
  },
  tdm: {
    name: "Team Death Match",
    tag: "Teams · 3 minutes",
    slides: [
      [
        "Score eliminations",
        "Defeat opposing fighters. The team with the most kills after three minutes wins.",
        "⚔",
      ],
      [
        "Protect your last survivor",
        "Respawns take 10 seconds. If your entire team is down at once, you lose immediately.",
        "◷",
      ],
      [
        "Fuse and fight",
        "A teammate respawning does not remove your fusion. Your own respawn resets you to your origin. Friendly fire is on.",
        "◇",
      ],
    ],
  },
  rush: {
    name: "Fusion Rush",
    tag: "3v3 or 4v4 · 3 minutes",
    slides: [
      [
        "Race for neutral shards",
        "Shards appear across the arena every eight seconds. Either team can collect a compatible shard by touching it.",
        "◇ ◇",
      ],
      [
        "Evolve to score",
        "An elimination earns 1 point. First reaching tier II earns 3 points; first reaching tier III earns 5. Tier bonuses are once per fighter per match.",
        "Ⅰ → Ⅲ",
      ],
      [
        "Deny and survive",
        "Take shards before the rival team. Highest score at three minutes wins. Respawns take 10 seconds and reset fusion. Friendly fire is on.",
        "◷",
      ],
    ],
  },
  corruption: {
    name: "Survive the Night",
    tag: "8 fighters · 2 minutes",
    slides: [
      [
        "The first infection",
        "Survive the Umbral Labyrinth, a vast circular maze. Eight fighters enter, and all portals are disabled. Everyone starts as Light; after five seconds one fighter becomes Dark.",
        "✦ → ◐",
      ],
      [
        "Survive or spread",
        "Two Dark strikes corrupt Light. Light can heal itself, but cannot heal others or use Flash. Hunter health matches the surviving Light team; hunters respawn in 10 seconds. Three conversions evolve Dark into Smoke with all its normal skills.",
        "◐",
      ],
      [
        "Last lights of hope",
        "The last three Light survivors gain one automatic Rebirth at half health. The last survivor evolves into Spirit and keeps Rebirth. Revival restores the earliest-converted Dark to Light, even while Dark is alive or awaiting respawn. Smoke cannot be rescued. Rebirth is only usable once per fighter per match.",
        "✦",
      ],
      [
        "Two ways to win",
        "Lasting longest as Light wins survival. Most infections wins the Dark category. At two minutes remaining Light and Spirit survivors share victory. Friendly fire is off.",
        "♕",
      ],
    ],
  },
  duel: {
    name: "Duel",
    tag: "Practice · one on one",
    slides: [
      [
        "Learn your origin",
        "Choose one of six origins and face a random adaptive AI opponent.",
        "Ⅰ",
      ],
      [
        "Master movement",
        "Move freely with the stick. Target lock automatically faces the nearest opponent within strike range.",
        "⊕",
      ],
      [
        "Experiment freely",
        "No Practice stats are saved. Try charging skills, dodging attacks and learning your range.",
        "⚔",
      ],
    ],
  },
  fused: {
    name: "Fused II Duel",
    tag: "Practice · tier II",
    slides: [
      ["Choose a fusion", "Start with any of the ten level-II forms.", "Ⅱ"],
      [
        "Inherited power",
        "Use the top tabs for origin skills. Passives remain active across tabs. Fused shortcuts keep key skills close.",
        "◇",
      ],
      [
        "Try every combination",
        "Practice does not save stats. Use the ability tutorial to explore your options.",
        "↻",
      ],
    ],
  },
  fused3: {
    name: "Fused III Duel",
    tag: "Practice · tier III",
    slides: [
      [
        "Master the third tier",
        "Choose any level-III fusion, including Ice’s evolution Abyssal, Phoenix, Terraformer and Sanctuary.",
        "Ⅲ",
      ],
      [
        "Learn the special rules",
        "Invisible Divine gives brief hints. Teleport is an arena tap. Death is a once-per-match demotion floor.",
        "✦",
      ],
      [
        "No pressure",
        "All opponents are AI. Practice results do not enter your stats or leaderboards.",
        "⚔",
      ],
    ],
  },
  team: {
    name: "Team Brawl",
    tag: "Practice · 2v2–4v4",
    slides: [
      [
        "Fight together",
        "Choose an origin and team size. Your teammates and opponents are adaptive AI.",
        "⚔ ⚔",
      ],
      [
        "Mind your allies",
        "Friendly fire is on. AI avoids attacking through teammates.",
        "!",
      ],
      [
        "Fuse on contact",
        "Touch compatible fallen ally tokens. The last team standing wins; Practice stats are not saved.",
        "◇",
      ],
    ],
  },
};
export const TEAM_MODES = [
  "tdm",
  "war",
  "rush",
  "boss",
  "domination",
  "gauntlet-team",
  "ctf",
  "gridiron",
  "zombies",
];
export const SOLO_MODES = [
  "turnpike",
  "ffa",
  "roulette",
  "gauntlet",
  "dungeon",
  "corruption",
];
export const PLAY_MODES = [...TEAM_MODES, ...SOLO_MODES];
export const PRACTICE_LIST = ["duel", "fused", "fused3", "team"];
export const CONTROL_SLIDES = [
  [
    "Move freely",
    "Drag the bottom-left stick in any direction. Farther from its center means faster movement. Keyboard: WASD or arrows.",
    "⊕",
    "guides/control-move.png",
  ],
  [
    "Strike and lock",
    "Tap or hold Strike at bottom-right. Target lock automatically faces the nearest enemy within melee range. Keyboard: J.",
    "⚔",
    "guides/control-strike.png",
  ],
  [
    "Use your skills",
    "Hold and release to charge, or choose tap-to-charge/tap-to-release in Settings. Utilities are taps; Rock shield always requires holding. Keyboard: K and L.",
    "✦",
    "guides/control-skills.png",
  ],
  [
    "Switch ability sets",
    "Fused fighters have origin and fused tabs across the top. Changing tabs changes usable skills, while inherited passives stay active. Keyboard: Tab.",
    "Ⅰ Ⅱ Ⅲ",
    "guides/control-switch.png",
  ],
  [
    "Fuse automatically",
    "Touch a compatible token or neutral Rush shard. Fusion unlocks a new form. Tokens from the opposing team are hidden except in Free For All.",
    "◇",
    "guides/control-fusion.png",
  ],
  [
    "Tap and swipe · Portals",
    "Activate Portals, then tap two clear arena positions. Tap your portals to close them; Divine can also close other players’ portals. Screen taps are mapped to the zoomed camera view too.",
    "↗",
    "guides/control-portals.png",
  ],
  [
    "Tap and swipe · Teleport",
    "As Multi-Dimensional, tap the arena to prepare a teleport. Jumps reach up to 180 units, with a visible destination and a vulnerable 0.2-second preparation.",
    "↗",
    "guides/control-teleport.png",
  ],
  [
    "Tap and swipe · Telekinesis",
    "As Gravity, swipe an enemy in the direction you want to move them. Or tap Telekinesis to push the nearest opponent away.",
    "↗",
    "guides/control-telekinesis.png",
  ],
  [
    "Play your way",
    "Settings controls music, SFX, orientation and hold/release or tap/tap charging. Portrait follows your fighter, with movement and Strike above the skills. Leave returns to battle setup; unfinished matches can be resumed.",
    "⚙",
    "guides/control-settings.png",
  ],
];
export const SKILL_HELP = {
  Explosion:
    "Tap to blast everyone within 150 units away, dealing 5 base damage. Uses Gravity’s current radius and fusion-strength knockback.",
  "Icicle Burst":
    "Hold to fire an endless stream of ten icicles per second in your facing direction at double projectile speed, dealing 6 HP per second before defenses. Release to stop. No charge or cooldown; always hold, even with tap charging enabled.",
  "Void Mantle":
    "Hold for a swirling dark-water and stone shield with 65 HP. Blocks attacks and deals 10 base damage per second within a 60-unit radius, twice its original reach. Release or break it to end; five-second recharge. Cannot fire icicles while shielding.",
  Drain:
    "Passive contact ability. Steals 3 HP per second before defenses and restores only the health actually taken. The drainer glows cyan-violet; the drained fighter darkens. Stops immediately when contact ends. Follows friendly-fire rules.",
  Chasm:
    "Tap an arena spot within 400 units. A visible crack opens for one second, then becomes a lethal 56-radius tear for eight seconds. Flyers are safe. Eight-second cooldown; no charge.",
  "Stone Prison":
    "Tap to cage the closest visible enemy within 245 units in 65 HP of rock. They cannot move or enter portals. Strike or use Speed burst to break free; Multi-Dimensional can teleport outside. An escaped cage waits two seconds, then crumbles away. Seven-second cooldown.",
  "Life spring":
    "Tap once per match to place a permanent bright spring at your feet. Any living fighter inside its 85-radius circle regenerates 8 HP per second. It remains after you fall.",
  Healing:
    "Charge and release to heal the living ally with the lowest health, including yourself. In Survive the Night, Healing restores only you.",
  Flash:
    "Tap to white out fighters within a radius 15% smaller than Vog for one second, then fade back over two seconds. Includes allies when friendly fire is on; Divine and Aurora remain immune.",
  Sabotage:
    "Cancel the closest visible enemy’s current charge, or nullify their next ability attempt. No damage or blindness.",
  Blindness:
    "Tap to disable the nearest enemy’s target lock for three seconds. Their body darkens; their screen stays clear.",
  "Shadow step":
    "Tap to dodge the next enemy attack; Light ignores this dodge.",
  "Hydro pump":
    "Charge and release a water jet that damages and pushes targets. Water also hardens Magma.",
  "Sonic boom":
    "Charge and release a wide wind shockwave in your facing direction. Damage fades with distance.",
  Gust: "Tap for a temporary movement boost.",
  Tailwind:
    "Tap to boost all living teammates’ movement for two seconds. Seven-second cooldown. In free-for-all modes, only you benefit.",
  "Rock shield":
    "Hold to surround yourself with rocks. Blocks attacks until released or its 65-HP shield breaks.",
  Flamethrower:
    "Charge and release a directional fire attack. Contact burn only lasts while touching a fire-based fighter.",
  Magma:
    "Tap to place a lava floor ahead of you for 15 seconds. Flyers ignore it; Water clears it.",
  Quicksand:
    "Charge and release a slowing, damaging floor. Flyers and Earth-bearing fighters, including Mud, are immune.",
  Revival: "Charge and release to restore the nearest recoverable fallen ally.",
  Portals:
    "Tap the skill, then tap two clear arena positions. Once both are open, tap the skill again to close the oldest, then tap again to close the remaining portal. You can also tap your portal directly to close it. Closing during transit kills the traveller; a lone portal traps entrants until they reverse out.",
  "Laser beam":
    "Charge and release a fast piercing beam in your facing direction.",
  Heatwave: "Tap to create an area that hurts susceptible fighters over time.",
  "Speed burst":
    "Tap to dash with a flame trail. Collisions deal damage. While trapped, each burst deals 22 damage to Stone Prison; breaking it lets you dash out. No cooldown once the dash ends.",
  Tornado:
    "Charge and release a moving wind funnel. Flying fighters take 15% more damage.",
  Flood:
    "Tap to fill a large area with water. Ground effects are suppressed. Water-bearing fighters move 25% faster without Flood slowing; other grounded fighters slow. Lightning strikes grow stronger.",
  Vog: "Tap for an eight-second smoke field. Dark-bearing and Aurora-protected fighters see through it; others see only their own outline inside. Fire-bearing fighters halve its remaining time on entry, once each per field. Casting around someone already inside does not trigger this. AI fights toward an exit. Seven-second cooldown; no damage.",
  Telekinesis:
    "Swipe a visible enemy within 400 units to push in that direction, or tap to push the nearest rival away.",
  "Gravity x2": "Tap to slow nearby opponents in a fuzzy purple field.",
  Doppelgänger:
    "Charge and release a pursuing copy. Longer charges raise its health from 1 to 33 HP.",
  Phase: "Tap to dodge an attack.",
  Minions:
    "Charge and release up to three fiery copies. Longer charges raise their health from 8 to 40 HP each.",
  Death:
    "Tap once per match to place a permanent demotion floor. Its dark sigil takes half a second to open; then each entry removes one fusion tier, even from flyers.",
  Radiance: "Charge and release to heal all living allies, including yourself.",
  "Lightning strikes":
    "Instantly strike the nearest visible enemy within 450 units. Invincible takes 25% extra damage without Reflect or hard-skin reduction. While any Flood is active, doubled lightning hits everyone, including you and allies. Three-second cooldown.",
};
