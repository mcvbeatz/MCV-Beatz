export const MODES = {
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
  ctf: {
    name: "Capture the Flag",
    tag: "2v2 · 3v3 · 4v4",
    slides: [
      [
        "Steal their flag",
        "Touch the opposing flag and carry it back to your own base.",
        "⚑",
      ],
      [
        "Protect home",
        "Your flag must be at home to score. Touch a dropped friendly flag to return it.",
        "⌂",
      ],
      [
        "First to three",
        "Three captures wins. Respawns take 10 seconds. Fusion is disabled; friendly fire is on.",
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
    name: "Elemental Gauntlet Solo",
    tag: "Solo survival",
    slides: [
      [
        "Start with an origin",
        "Fight escalating waves. Enemies gain health, numbers and fusion tiers as the run continues.",
        "Ⅰ",
      ],
      [
        "Choose your reward",
        "Between waves choose a compatible shard, full healing, or a damage and speed boost for the next wave.",
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
    name: "Elemental Gauntlet Teams",
    tag: "2–4 allies · survival",
    slides: [
      [
        "Survive together",
        "You and adaptive AI allies fight escalating waves. Keep at least one teammate alive.",
        "⚔ ⚔",
      ],
      [
        "Recover between waves",
        "Felled allies return at half health between waves. Your reward heals, upgrades or evolves the team.",
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
        "Transforming does not heal you. Abilities and passives change, but cooldowns carry over. Respawns take 10 seconds. A lone standing fighter wins immediately; otherwise most kills at 3 minutes wins. Ties draw. No fusion.",
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
        "No respawns. Stay alive to win; if felled you can watch the remaining fight.",
        "Ⅰ",
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
    name: "Corruption",
    tag: "2–8 fighters · 2 minutes",
    slides: [
      [
        "The first infection",
        "Everyone starts as Light. After five seconds a random fighter becomes Dark with no abilities.",
        "✦ → ◐",
      ],
      [
        "Survive or spread",
        "Two Dark strikes corrupt Light. Light can heal itself, but cannot heal others or use Flash. Dark health matches the number of remaining Lights; Dark respawns in 10 seconds.",
        "◐",
      ],
      [
        "Two ways to win",
        "Lasting longest as Light wins survival. Most infections wins the Dark category. At two minutes remaining Lights share victory. Friendly fire is off.",
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
      ["Choose a fusion", "Start with any of the nine level-II forms.", "Ⅱ"],
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
        "Choose Demonic, Divine, Multi-Dimensional, Lightning or Invincible.",
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
export const PLAY_MODES = [
  "boss",
  "ctf",
  "domination",
  "gauntlet",
  "gauntlet-team",
  "roulette",
  "ffa",
  "tdm",
  "rush",
  "corruption",
];
export const PRACTICE_LIST = ["duel", "fused", "fused3", "team"];
export const CONTROL_SLIDES = [
  [
    "Move freely",
    "Drag the bottom-left stick in any direction. Farther from its center means faster movement. Keyboard: WASD or arrows.",
    "⊕",
  ],
  [
    "Strike and lock",
    "Tap or hold Strike at bottom-right. Target lock automatically faces the nearest enemy within melee range. Keyboard: J.",
    "⚔",
  ],
  [
    "Use your skills",
    "Hold and release to charge, or choose tap-to-charge/tap-to-release in Settings. Utilities are taps; Rock shield always requires holding. Keyboard: K and L.",
    "✦",
  ],
  [
    "Switch ability sets",
    "Fused fighters have origin and fused tabs across the top. Changing tabs changes usable skills, while inherited passives stay active. Keyboard: Tab.",
    "Ⅰ Ⅱ Ⅲ",
  ],
  [
    "Fuse automatically",
    "Touch a compatible token or neutral Rush shard. Fusion unlocks a new form. Tokens from the opposing team are hidden except in Free For All.",
    "◇",
  ],
  [
    "Tap and swipe",
    "Portals: activate, then tap two clear places. Teleport: tap a destination. Telekinesis: swipe an enemy, or tap its button to push away.",
    "↗",
  ],
  [
    "Play your way",
    "Settings has independent music and SFX volumes and landscape/portrait layouts. Pause or return to setup from the arena toolbar.",
    "⚙",
  ],
];
export const SKILL_HELP = {
  Healing:
    "Charge and release to heal the living ally with the lowest health, including yourself. In Corruption, Healing restores only you.",
  Flash: "Tap to blind nearby fighters. Light creates room to recover.",
  Sabotage:
    "Charge and release to interrupt and cancel a nearby enemy ability.",
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
    "Tap to place a permanent lava floor ahead of you. Flyers ignore it; Water clears it.",
  Quicksand:
    "Charge and release a slowing, damaging floor. Flyers and Mud are immune.",
  Revival: "Charge and release to restore the nearest recoverable fallen ally.",
  Portals:
    "Tap the skill, then tap two clear arena positions. Tap your portal to close it. Closing during transit kills the traveller; a lone portal traps entrants until they reverse out.",
  "Laser beam":
    "Charge and release a fast piercing beam in your facing direction.",
  Heatwave: "Tap to create an area that hurts susceptible fighters over time.",
  "Speed burst":
    "Tap to dash with a flame trail. Collisions deal damage. No cooldown once the dash ends.",
  Tornado: "Charge and release a broad moving attack.",
  Flood:
    "Tap to fill a large area with water. Grounds effects are suppressed, grounded fighters slow, and Lightning strikes grow stronger.",
  Vog: "Charge and release a field of blindness and burning damage.",
  Telekinesis:
    "Swipe a visible enemy within 400 units to push in that direction, or tap to push the nearest rival away.",
  "Gravity x2": "Tap to slow nearby opponents in a fuzzy purple field.",
  Doppelgänger:
    "Charge and release to summon a fragile copy that pursues enemies.",
  Phase: "Tap to dodge an attack.",
  Minions: "Charge and release to summon up to three fiery copies.",
  Death:
    "Tap once per match to place a permanent demotion floor. Each entry removes one fusion tier, even from flyers.",
  Radiance: "Charge and release to heal all living allies, including yourself.",
  "Lightning strikes":
    "Tap for an instant strike at the nearest visible enemy in range. Three-second cooldown.",
};
