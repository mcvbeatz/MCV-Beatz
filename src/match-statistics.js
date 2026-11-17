// Observational only: no gameplay decisions or combat values belong here.
function freshStats() {
  return {
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
export function beginStatistics(g) {
  g.matchStats = {
    ...freshStats(),
    startingForm: g.player.element,
    startingTeam: g.player.team,
  };
  const pve = ["dungeon", "zombies", "gauntlet", "gauntlet-team"].includes(
    g.mode,
  );
  g.sessionActors = new Map(
    g.fighters
      .filter((a) => !a.echo && (!pve || a.team === g.player.team))
      .map((a, i) => [
        a.id,
        {
          id: a.id,
          name: a.displayName || (a === g.player ? "You" : `AI ${i}`),
          isPlayer: a === g.player,
          team: a.team,
          element: a.element,
          stats:
            a === g.player
              ? g.matchStats
              : {
                  ...freshStats(),
                  startingForm: a.element,
                  startingTeam: a.team,
                },
        },
      ]),
  );
  g.matchStats.dungeonTotals =
    g.mode === "dungeon"
      ? {
          monsters: g.fighters.filter((a) => a.monsterKind).length,
          bosses: g.fighters.filter((a) => a.dungeonRole).length,
        }
      : null;
}
function actorStats(g, a) {
  if (!g.matchStats || g.finished) return null;
  const resolved = owner(g, a);
  return resolved === g.player
    ? g.matchStats
    : g.sessionActors?.get(resolved?.id)?.stats;
}
function owner(g, a) {
  return a?.echo ? g.fighters.find((b) => b.id === a.summoner) : a;
}
function form(g, a) {
  const s = actorStats(g, a);
  if (!s || g.finished) return null;
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
  for (const a of g.fighters)
    if (a.alive && !a.echo && actorStats(g, a)) form(g, a).seconds += dt;
  if (g.mode === "corruption")
    for (const a of g.fighters) {
      const stats = actorStats(g, a);
      if (!stats || a.echo) continue;
      if (a.team === 0 && a.alive) {
        stats.lightTime += dt;
        stats.lightStreak += dt;
        stats.longestLight = Math.max(stats.longestLight, stats.lightStreak);
      } else stats.lightStreak = 0;
    }
}
export function trackDamage(g, source, target, amount) {
  if (!g.matchStats || g.finished || amount <= 0) return;
  const receiver = actorStats(g, target),
    attacker = actorStats(g, source);
  if (receiver && !target.echo) receiver.damageReceived += amount;
  if (attacker && target.team !== owner(g, source)?.team)
    attacker.damageDealt += amount;
}
export function trackHealing(g, healer, amount) {
  const stats = actorStats(g, healer);
  if (stats && amount > 0) stats.healing += amount;
}
export function trackObjective(g, actor, key, value = 1) {
  const stats = actorStats(g, actor);
  if (!stats) return;
  stats.objectives[key] = (stats.objectives[key] || 0) + value;
}
export function trackElimination(g, victim, killer) {
  if (!g.matchStats || g.finished || victim.echo) return;
  const source = owner(g, killer),
    eliminated = actorStats(g, victim),
    attacker = actorStats(g, source);
  // Night deaths mean defeat by another participant, including successful conversion.
  if (g.mode === "corruption" && (!attacker || source === victim)) return;
  if (eliminated) eliminated.deaths++;
  if (!attacker || source.team === victim.team) return;
  attacker.kills++;
  const f = form(g, source);
  if (f) f.kills++;
  if (victim.zombieEnemy) trackObjective(g, source, "fireDefeated");
  if (victim.monsterKind) trackObjective(g, source, "monstersDefeated");
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
  const stats = actorStats(g, actor);
  stats.objectives.highestTier = Math.max(
    stats.objectives.highestTier || 1,
    actor.parts.length,
  );
}
export function trackWave(g) {
  if (!g.matchStats || g.finished) return;
  for (const actor of g.fighters.filter(
    (a) => a.team === g.player.team && !a.echo,
  )) {
    const stats = actorStats(g, actor);
    if (!stats || (stats.objectives.highestWave || 0) >= g.wave) continue;
    form(g, actor).waves++;
    trackObjective(g, actor, "waves");
    stats.objectives.highestWave = g.wave;
    if (g.finalWave) trackBoss(g, actor);
  }
}
export function trackLap(g, actor) {
  const s = actorStats(g, actor);
  if (!s) return;
  const duration = g.time - s.lastLapAt;
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
      statisticsVersion: 2,
      players: completedRoster(g),
      dungeonTotals: s.dungeonTotals,
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
        ...(g.mode === "corruption" ? { lightSurvival: s.lightTime } : {}),
      },
    }),
  );
}

export function completedRoster(g) {
  const rows = [...(g.sessionActors?.values() || [])].map((row) => {
    const a = g.fighters.find((a) => a.id === row.id) || row;
    const s = row.stats;
    return {
      id: row.id,
      name: row.name,
      isPlayer: row.isPlayer,
      team: a.team,
      element: a.element,
      kills: s.kills,
      deaths: s.deaths,
      damageDealt: s.damageDealt,
      damageReceived: s.damageReceived,
      healing: s.healing,
      ...s.objectives,
      survival: s.lightTime,
      raceLaps: a.raceLaps || 0,
      raceProgress: a.raceProgress || 0,
    };
  });
  if (g.mode === "turnpike") {
    rows.sort(
      (a, b) => b.raceLaps - a.raceLaps || b.raceProgress - a.raceProgress,
    );
    rows.forEach((a, i) => {
      a.place =
        i &&
        a.raceLaps === rows[i - 1].raceLaps &&
        Math.abs(a.raceProgress - rows[i - 1].raceProgress) < 0.01
          ? rows[i - 1].place
          : i + 1;
    });
  }
  return rows;
}
