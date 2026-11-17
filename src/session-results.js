// A session scoreboard deliberately exposes only the requested mode-specific columns.
const combat = [
  ["kills", "Eliminations"],
  ["deaths", "Deaths"],
];
export const SESSION_COLUMNS = {
  corruption: [...combat, ["survival", "Survival"]],
  turnpike: [
    ["place", "Place"],
    ["fastestLap", "Fastest completed lap"],
    ...combat,
  ],
  ffa: combat,
  roulette: combat,
  gauntlet: combat,
  dungeon: [
    ["monstersDefeated", "Monsters Defeated"],
    ["bosses", "Bosses Defeated"],
  ],
  tdm: combat,
  war: combat,
  rush: [...combat, ["tokensAcquired", "Tokens Acquired"]],
  boss: [
    ["damageDealt", "Damage Dealt"],
    ["damageReceived", "Damage Received"],
    ["healing", "Damage Healed"],
  ],
  "gauntlet-team": combat,
  ctf: [
    ["flagsStolen", "Flags Stolen"],
    ["returns", "Flags Recovered"],
    ...combat,
  ],
  gridiron: [["touchdowns", "Touchdowns"], ["assists", "Assists"], ...combat],
  zombies: combat,
};
export const excludesOverallPerformance = (mode) =>
  ["gauntlet", "gauntlet-team"].includes(mode);
export const excludesOverallEliminations = (mode) =>
  ["dungeon", "zombies"].includes(mode);
export function overallEliminations(mode, count) {
  return excludesOverallEliminations(mode) ? 0 : count;
}
export function ordinal(n) {
  if (!(n > 0)) return "—";
  const lastTwo = n % 100;
  return (
    n +
    (lastTwo >= 11 && lastTwo <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th")
  );
}
export const SESSION_BESTS = {
  dungeon: { monstersDefeated: ["Most monsters defeated in one run", "max"] },
  boss: {
    damageDealt: ["Most damage dealt", "max"],
    damageReceived: ["Most damage received", "max"],
    healing: ["Most damage healed", "max"],
  },
  rush: { tokensAcquired: ["Most tokens acquired in one match", "max"] },
  ctf: {
    flagsStolen: ["Most flags stolen in one match", "max"],
    returns: ["Most flags recovered in one match", "max"],
  },
  gridiron: { touchdowns: ["Most touchdowns in one match", "max"] },
  turnpike: { place: ["Best finishing place", "min"] },
};
export function sessionRows(match) {
  return match.players?.length
    ? match.players
    : [
        {
          id: "player",
          name: "You",
          isPlayer: true,
          element: match.finalForm,
          ...match.stats,
          ...match.objectives,
          survival: match.objectives?.lightSurvival || 0,
        },
      ];
}
