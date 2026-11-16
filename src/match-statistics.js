// Observational only: no gameplay decisions or combat values belong here.
export function beginStatistics(g) {
  g.matchStats = {
    startingForm: g.player.element,
    startingTeam: g.player.team,
    forms: {},
    objectives: {},
    damageDealt: 0,
    damageReceived: 0,
    healing: 0,
    kills: 0,
    deaths: 0,
    lightTime: 0,
    lightStreak: 0,
    longestLight: 0,
    converted: false,
    lastLapAt: 0,
  };
}
function owner(g, a) {
  return a?.echo ? g.fighters.find((b) => b.id === a.summoner) : a;
}
function form(g, a) {
  const s = g.matchStats;
  if (!s || owner(g, a) !== g.player || g.finished) return null;
  const e = owner(g, a).element;
  return (s.forms[e] ||= {
    seconds: 0,
    kills: 0,
    fusions: 0,
    bosses: 0,
    waves: 0,
  });
}
export function trackTime(g, dt) {
  const s = g.matchStats;
  if (!s || g.finished || !Number.isFinite(dt) || dt <= 0) return;
  if (g.player.alive) form(g, g.player).seconds += dt;
  if (g.mode === "corruption" && g.player.team === 0 && g.player.alive) {
    s.lightTime += dt;
    s.lightStreak += dt;
    s.longestLight = Math.max(s.longestLight, s.lightStreak);
  } else s.lightStreak = 0;
}
export function trackDamage(g, source, target, amount) {
  if (!g.matchStats || g.finished || amount <= 0) return;
  if (target === g.player) g.matchStats.damageReceived += amount;
  // Friendly fire and self-harm never count as damage dealt to an enemy.
  if (owner(g, source) === g.player && target.team !== g.player.team)
    g.matchStats.damageDealt += amount;
}
export function trackHealing(g, healer, amount) {
  if (
    g.matchStats &&
    !g.finished &&
    owner(g, healer) === g.player &&
    amount > 0
  )
    g.matchStats.healing += amount;
}
export function trackObjective(g, actor, key, value = 1) {
  if (!g.matchStats || g.finished || owner(g, actor) !== g.player) return;
  const o = g.matchStats.objectives;
  o[key] = (o[key] || 0) + value;
}
export function trackElimination(g, victim, killer) {
  if (!g.matchStats || g.finished || victim.echo) return;
  if (victim === g.player) g.matchStats.deaths++;
  if (owner(g, killer) !== g.player || victim.team === g.player.team) return;
  g.matchStats.kills++;
  form(g, killer).kills++;
  if (victim.zombieEnemy) trackObjective(g, killer, "fireDefeated");
}
export function trackBoss(g, actor, final = false) {
  const f = form(g, actor);
  if (!f) return;
  f.bosses++;
  trackObjective(g, actor, "bosses");
  if (final) trackObjective(g, actor, "finalBoss");
}
export function trackFusion(g, actor) {
  const f = form(g, actor);
  if (!f) return;
  f.fusions++;
  trackObjective(g, actor, "fusions");
  g.matchStats.objectives.highestTier = Math.max(
    g.matchStats.objectives.highestTier || 1,
    actor.parts.length,
  );
}
export function trackWave(g) {
  if (!g.matchStats || g.finished) return;
  // Team objectives credit surviving and felled participants, once per cleared wave.
  if ((g.matchStats.objectives.highestWave || 0) >= g.wave) return;
  form(g, g.player).waves++;
  trackObjective(g, g.player, "waves");
  g.matchStats.objectives.highestWave = g.wave;
  if (g.finalWave) trackBoss(g, g.player);
}
export function trackLap(g, actor) {
  if (actor !== g.player || !g.matchStats) return;
  const s = g.matchStats,
    duration = g.time - s.lastLapAt;
  if (duration > 0)
    s.objectives.fastestLap = Math.min(
      s.objectives.fastestLap || Infinity,
      duration,
    );
  s.lastLapAt = g.time;
  s.objectives.laps = actor.raceLaps;
  if (actor.raceLaps >= 3) s.objectives.raceCompletion = g.time;
}
export function completedSnapshot(g, ticket, now = new Date().toISOString()) {
  if (!g.finished || !g.matchStats) return null;
  const s = g.matchStats;
  return JSON.parse(
    JSON.stringify({
      id: ticket.id,
      mode: g.mode,
      practice: ticket.practice,
      completed: true,
      date: now,
      result: g.result,
      duration: g.time,
      startingForm: s.startingForm,
      finalForm: g.player.element,
      army: g.warElements?.[s.startingTeam] || s.startingForm,
      asBoss: g.mode === "boss" && s.startingForm === "invincible",
      lightVictory:
        g.mode === "corruption" &&
        g.result === "victory" &&
        g.player.team === 0 &&
        !s.converted,
      scores: g.scores?.slice(),
      forms: s.forms,
      stats: {
        kills: s.kills,
        deaths: s.deaths,
        damageDealt: s.damageDealt,
        damageReceived: s.damageReceived,
        healing: s.healing,
      },
      objectives: {
        ...s.objectives,
        ...(g.mode === "corruption" ? { lightSurvival: s.longestLight } : {}),
      },
    }),
  );
}
