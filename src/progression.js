import { ELEMENTS, COMBOS } from "./combat.js";
import { PLAY_MODES } from "./mode-catalog.js";
import {
  ACHIEVEMENTS,
  achievementProgress,
  cosmeticCatalog,
} from "./rewards.js";
import { updateRecords } from "./records.js";
export const ORIGINS = Object.keys(ELEMENTS);
export const FORMS = [...new Set([...ORIGINS, ...Object.values(COMBOS)])];
export const XP = Object.freeze({
  completion: 25,
  victory: 50,
  kills: 10,
  fusions: 30,
  bosses: 75,
  waves: 15,
});
export const XP_CAPS = Object.freeze({
  kills: 20,
  fusions: 3,
  bosses: 3,
  waves: 10,
});
export const MAX_LEVEL = 20;
export const levelCost = (level) =>
  75 + 25 * (level - 1) + 5 * (level - 1) ** 2;
export function mastery(xp = 0) {
  xp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let level = 1,
    remaining = xp;
  while (level < MAX_LEVEL && remaining >= levelCost(level))
    remaining -= levelCost(level++);
  return {
    level,
    xp,
    current: level === MAX_LEVEL ? 0 : remaining,
    next: level === MAX_LEVEL ? 0 : levelCost(level),
    progress: level === MAX_LEVEL ? 1 : remaining / levelCost(level),
  };
}
export const MAX_XP = Array.from({ length: 19 }, (_, i) =>
  levelCost(i + 1),
).reduce((a, b) => a + b, 0);
export function eligible(m) {
  return (
    !!m &&
    m.completed === true &&
    !m.practice &&
    PLAY_MODES.includes(m.mode) &&
    ["victory", "defeat", "draw"].includes(m.result) &&
    typeof m.id === "string" &&
    m.id.length <= 100 &&
    m.id.length > 0 &&
    FORMS.includes(m.startingForm)
  );
}
const number = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0);
export function calculateXP(m) {
  if (!eligible(m)) return { total: 0, forms: {}, sources: {} };
  const entries = Object.entries(m.forms || {}).filter(([e]) =>
    FORMS.includes(e),
  );
  if (!entries.length) entries.push([m.startingForm, { seconds: 1 }]);
  const forms = Object.fromEntries(entries.map(([e]) => [e, 0])),
    sources = {};
  function allocate(points, weights) {
    const sum = weights.reduce((n, [, v]) => n + v, 0);
    if (!sum) return;
    const shares = weights.map(([e, v], i) => ({
      e,
      i,
      raw: (points * v) / sum,
      n: Math.floor((points * v) / sum),
    }));
    let rest = points - shares.reduce((n, s) => n + s.n, 0);
    for (const s of [...shares].sort(
      (a, b) => b.raw - b.n - (a.raw - a.n) || a.i - b.i,
    ))
      if (rest-- > 0) s.n++;
    for (const s of shares) forms[s.e] += s.n;
  }
  let time = entries.map(([e, f]) => [e, number(f.seconds)]);
  if (!time.some(([, v]) => v)) time = [[m.startingForm, 1]];
  forms[m.startingForm] ||= 0;
  sources.completion = XP.completion;
  allocate(XP.completion, time);
  if (m.result === "victory") {
    sources.victory = XP.victory;
    allocate(XP.victory, time);
  }
  for (const key of Object.keys(XP_CAPS)) {
    const weights = entries.map(([e, f]) => [e, Math.floor(number(f[key]))]);
    const count = Math.min(
      XP_CAPS[key],
      weights.reduce((n, [, v]) => n + v, 0),
    );
    if (count) {
      sources[key] = count * XP[key];
      allocate(sources[key], weights);
    }
  }
  return {
    total: Object.values(sources).reduce((a, b) => a + b, 0),
    forms,
    sources,
  };
}
export function emptyProgress() {
  return {
    mastery: {},
    modes: {},
    totals: {
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
    },
    achievements: {},
    unlocks: {},
    baseWins: [],
    fusionForms: [],
    highestTier: 1,
    fusionCount: 0,
    equipped: {},
  };
}
export function applyMatch(state, m) {
  if (!eligible(m)) return null;
  const xp = calculateXP(m),
    levels = [],
    rewards = [];
  for (const [e, amount] of Object.entries(xp.forms)) {
    const old = mastery(state.mastery[e] || 0);
    state.mastery[e] = Math.min(MAX_XP, old.xp + amount);
    const next = mastery(state.mastery[e]);
    if (next.level > old.level)
      levels.push({ element: e, from: old.level, to: next.level });
    for (const level of [5, 10, 15, 20])
      if (next.level >= level) {
        const id = `mastery:${e}:${level}`;
        if (!state.unlocks[id]) {
          state.unlocks[id] = m.date;
          rewards.push(id);
        }
      }
    if (
      !ORIGINS.includes(e) &&
      ((m.forms?.[e]?.seconds || 0) > 0 || (m.forms?.[e]?.fusions || 0) > 0) &&
      !state.fusionForms.includes(e)
    )
      state.fusionForms.push(e);
  }
  state.fusionCount += number(m.objectives?.fusions);
  state.highestTier = Math.max(
    state.highestTier,
    number(m.objectives?.highestTier),
  );
  if (
    m.result === "victory" &&
    ORIGINS.includes(m.startingForm) &&
    !state.baseWins.includes(m.startingForm)
  )
    state.baseWins.push(m.startingForm);
  const records = updateRecords(state, m);
  const achievements = [];
  for (const a of ACHIEVEMENTS)
    if (
      !state.achievements[a.id] &&
      achievementProgress(a, state, m) >= a.goal
    ) {
      state.achievements[a.id] = m.date;
      state.unlocks[a.reward] = m.date;
      achievements.push(a.id);
      rewards.push(a.reward);
    }
  return {
    match: m,
    xp,
    levels,
    achievements,
    rewards,
    records,
    mastery: Object.fromEntries(
      Object.keys(xp.forms).map((e) => [e, mastery(state.mastery[e])]),
    ),
  };
}
export function canEquip(state, id) {
  return !!state.unlocks[id] && cosmeticCatalog().some((c) => c.id === id);
}
export function equipCosmetic(state, id) {
  if (!canEquip(state, id)) return false;
  const cosmetic = cosmeticCatalog().find((c) => c.id === id);
  if (state.equipped[cosmetic.slot] === id)
    delete state.equipped[cosmetic.slot];
  else state.equipped[cosmetic.slot] = id;
  return true;
}
