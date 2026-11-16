export const STAT_LABELS = {
  matches: "Matches played",
  wins: "Victories",
  losses: "Defeats",
  draws: "Draws",
  kills: "Eliminations",
  deaths: "Deaths",
  damageDealt: "Damage dealt",
  damageReceived: "Damage received",
  healing: "Healing performed",
  playtime: "Playtime",
};
// [label, comparison]. Every objective is populated by an actual engine event.
export const RECORDS = {
  zombies: {
    survival: ["Longest survival", "max"],
    fireDefeated: ["Fire enemies defeated", "sum"],
  },
  turnpike: {
    fastestLap: ["Fastest completed lap", "min"],
    raceCompletion: ["Fastest completed race", "min"],
    victories: ["Race victories", "sum"],
  },
  dungeon: {
    completions: ["Dungeon completions", "sum"],
    completion: ["Fastest successful completion", "min"],
    bosses: ["Bosses defeated", "sum"],
    finalBoss: ["Final bosses defeated", "sum"],
  },
  war: { victories: ["War victories", "sum"] },
  gridiron: {
    touchdowns: ["Touchdowns", "sum"],
    interceptions: ["Interceptions", "sum"],
    victories: ["Gridiron victories", "sum"],
  },
  corruption: {
    lightSurvival: ["Longest unbroken Light survival", "max"],
    conversions: ["Dark conversions", "sum"],
    lightVictories: ["Unconverted Light victories", "sum"],
  },
  rush: {
    highestTier: ["Highest fusion tier", "max"],
    fusionPoints: ["Most fusion points in a match", "max"],
    victories: ["Fusion Rush victories", "sum"],
  },
  ffa: {
    victories: ["Free For All victories", "sum"],
    winPercentage: ["Best win percentage", "max"],
  },
  tdm: { victories: ["Team Death Match victories", "sum"] },
  gauntlet: {
    highestWave: ["Highest wave cleared", "max"],
    completions: ["Successful runs", "sum"],
    completion: ["Fastest successful run", "min"],
  },
  "gauntlet-team": {
    highestWave: ["Highest wave cleared", "max"],
    completions: ["Successful runs", "sum"],
    completion: ["Fastest successful run", "min"],
  },
  ctf: {
    captures: ["Flags captured", "sum"],
    returns: ["Flags returned", "sum"],
    victories: ["Capture the Flag victories", "sum"],
  },
  roulette: {
    victories: ["Roulette victories", "sum"],
    transformations: ["Transformations survived", "sum"],
  },
  boss: {
    victories: ["Boss victories", "sum"],
    bosses: ["Bosses defeated", "sum"],
    bossVictories: ["Victories as the boss", "sum"],
  },
};
export function newStats() {
  return {
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    kills: 0,
    deaths: 0,
    damageDealt: 0,
    damageReceived: 0,
    healing: 0,
    playtime: 0,
  };
}
export function improveRecord(records, key, value, date, comparison = "max") {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    (comparison === "min" && value <= 0)
  )
    return false;
  const old = records[key];
  if (
    old
      ? comparison === "min"
        ? value >= old.value
        : value <= old.value
      : value === 0
  )
    return false;
  records[key] = { value, date };
  return true;
}
export function updateRecords(state, m) {
  const mode = (state.modes[m.mode] ||= {
    stats: newStats(),
    objectives: {},
    bests: {},
    armies: {},
  });
  for (const stats of [state.totals, mode.stats]) {
    stats.matches++;
    stats[
      m.result === "victory"
        ? "wins"
        : m.result === "defeat"
          ? "losses"
          : "draws"
    ]++;
    for (const key of [
      "kills",
      "deaths",
      "damageDealt",
      "damageReceived",
      "healing",
    ])
      stats[key] += Math.max(0, Number(m.stats?.[key]) || 0);
    stats.playtime += Math.max(0, m.duration || 0);
  }
  const bests = [];
  if (improveRecord(mode.bests, "kills", m.stats?.kills || 0, m.date))
    bests.push({
      key: "kills",
      label: "Most eliminations in one match",
      value: m.stats.kills,
    });
  const win = m.result === "victory",
    o = { ...m.objectives };
  if (win) {
    o.victories = 1;
    o.completions = 1;
    o.completion = m.duration;
  }
  if (m.mode === "zombies") o.survival = m.duration;
  if (m.mode === "ffa")
    o.winPercentage = (100 * mode.stats.wins) / mode.stats.matches;
  if (m.lightVictory) o.lightVictories = 1;
  if (win && m.asBoss) o.bossVictories = 1;
  if (win && m.mode === "war")
    mode.armies[m.army] = (mode.armies[m.army] || 0) + 1;
  for (const [key, [label, comparison]] of Object.entries(
    RECORDS[m.mode] || {},
  )) {
    const value = o[key];
    if (!Number.isFinite(value) || value < 0) continue;
    if (comparison === "sum")
      mode.objectives[key] = (mode.objectives[key] || 0) + value;
    else if (improveRecord(mode.bests, key, value, m.date, comparison))
      bests.push({ key, label, value });
  }
  state.feats ||= {};
  state.feats.flawless ||=
    win && m.stats.damageReceived === 0 && m.stats.deaths === 0;
  state.feats.maxKills = Math.max(
    state.feats.maxKills || 0,
    m.stats.kills || 0,
  );
  return bests;
}
export function formatStat(key, n = 0) {
  if (
    [
      "playtime",
      "survival",
      "fastestLap",
      "raceCompletion",
      "completion",
      "lightSurvival",
    ].includes(key)
  ) {
    const seconds = Math.max(0, n);
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0")}${
      ["fastestLap", "raceCompletion", "completion"].includes(key)
        ? "." +
          Math.floor((seconds % 1) * 100)
            .toString()
            .padStart(2, "0")
        : ""
    }`;
  }
  return key === "winPercentage"
    ? `${n.toFixed(1)}%`
    : Number.isInteger(n)
      ? n.toLocaleString()
      : n.toFixed(1);
}
