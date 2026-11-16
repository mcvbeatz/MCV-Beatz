import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
import {
  beginStatistics,
  trackTime,
  trackLap,
  completedRoster,
  completedSnapshot,
} from "../src/match-statistics.js";
import {
  SESSION_COLUMNS,
  ordinal,
  overallEliminations,
} from "../src/session-results.js";
import { ProgressionStore, validateMatch } from "../src/progression-storage.js";
import { AccountService } from "../src/account.js";
import { PLAY_MODES } from "../src/mode-catalog.js";
const finish = (g, id) => {
  g.finish(g.player.team, "Test finish");
  return completedSnapshot(g, { id, practice: false });
};
test("every Play mode has exactly its requested scoreboard columns; Practice has none", () => {
  assert.deepEqual(Object.keys(SESSION_COLUMNS).sort(), [...PLAY_MODES].sort());
  for (const m of ["duel", "fused", "fused3", "team", "tutorial"])
    assert.equal(SESSION_COLUMNS[m], undefined);
  assert.deepEqual(
    SESSION_COLUMNS.corruption.map((c) => c[0]),
    ["kills", "deaths", "survival"],
  );
  assert.deepEqual(
    SESSION_COLUMNS.turnpike.map((c) => c[0]),
    ["place", "fastestLap", "kills", "deaths"],
  );
  assert.deepEqual(
    SESSION_COLUMNS.boss.map((c) => c[0]),
    ["damageDealt", "damageReceived", "healing"],
  );
  assert.deepEqual(
    SESSION_COLUMNS.ctf.map((c) => c[0]),
    ["flagsStolen", "returns", "kills", "deaths"],
  );
});
test("the roster retains every participant across fusions, deaths and respawns, excluding PvE enemies and echoes", () => {
  for (const mode of PLAY_MODES) {
    const g = new Combat({ mode, players: 8, size: 4 });
    const expected = [
      "zombies",
      "dungeon",
      "gauntlet",
      "gauntlet-team",
    ].includes(mode)
      ? g.fighters.filter((a) => a.team === g.player.team).length
      : g.fighters.length;
    assert.equal(completedRoster(g).length, expected, mode);
  }
  const g = new Combat({ mode: "tdm" }),
    bot = g.fighters.find((a) => a.team !== g.player.team);
  g.fell(g.player, { killer: bot });
  g.respawn(g.player);
  g.fell(bot, { killer: g.player });
  g.respawn(bot);
  const rows = completedRoster(g);
  assert.equal(rows.find((r) => r.isPlayer).kills, 1);
  assert.equal(rows.find((r) => r.id === bot.id).kills, 1);
  assert.equal(rows.find((r) => r.id === bot.id).deaths, 1);
});
test("Survive the Night counts Light and Dark eliminations/deaths and total Light survival, without counting the initial infection", () => {
  const g = new Combat({ mode: "corruption" }),
    p = g.player,
    dark = g.fighters[1],
    light = g.fighters[2];
  trackTime(g, 5);
  g.corrupt(dark);
  assert.equal(completedRoster(g).find((r) => r.id === dark.id).deaths, 0);
  g.corrupt(p, dark);
  assert.equal(g.matchStats.deaths, 1);
  assert.equal(completedRoster(g).find((r) => r.id === dark.id).kills, 1);
  g.corrupt(light, p);
  assert.equal(g.matchStats.kills, 1);
  g.nightForm(p, "light", 0, true);
  p.nightRebirth = false;
  trackTime(g, 7);
  g.fell(dark, { killer: p });
  assert.equal(g.matchStats.kills, 2);
  assert.equal(g.matchStats.lightTime, 12);
  g.fell(p);
  assert.equal(
    g.matchStats.deaths,
    1,
    "environmental death does not count in Night",
  );
  assert.equal(completedRoster(g).find((r) => r.isPlayer).survival, 12);
});
test("Night rebirth prevents conversion credit, and repeated conversion callbacks do not duplicate elimination counts", () => {
  const g = new Combat({ mode: "corruption" }),
    p = g.player,
    dark = g.fighters[1];
  g.corrupt(dark);
  p.nightRebirth = true;
  g.corrupt(p, dark);
  assert.equal(g.matchStats.deaths, 0);
  g.corrupt(p, dark);
  g.corrupt(p, dark);
  assert.equal(g.matchStats.deaths, 1);
  assert.equal(completedRoster(g).find((r) => r.id === dark.id).kills, 1);
});
test("every racer gets independent completed laps and a place, including tied finishing positions", () => {
  const g = new Combat({ mode: "turnpike" });
  for (const [i, a] of g.fighters.entries()) {
    a.raceProgress = 100 * (8 - i);
    a.raceLaps = 1;
    g.time = 30 + i;
    trackLap(g, a);
  }
  g.fighters[1].raceProgress = g.player.raceProgress;
  const rows = completedRoster(g);
  assert.equal(rows[0].place, 1);
  assert.equal(rows[1].place, 1);
  assert.equal(rows[2].place, 3);
  assert.equal(rows[7].fastestLap, 37);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal), [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "12th",
    "13th",
    "21st",
  ]);
});
test("Boss damage and healing use actual HP for every player, including summoner credit and overheal", () => {
  const g = new Combat({ mode: "boss", random: () => 0.99 }),
    p = g.player,
    b = g.fighters.find((a) => a.team !== p.team);
  p.hp = 80;
  b.hp = 50;
  g.damage(p, b, 10, true, false, "neutral", false);
  g.damage(b, p, 8, true, false, "neutral", false);
  const dealt = 50 - b.hp,
    received = 80 - p.hp,
    healed = p.maxHp - p.hp;
  g.restoreHealth(p, 100, false, b);
  const rows = completedRoster(g),
    player = rows.find((r) => r.isPlayer),
    bot = rows.find((r) => r.id === b.id);
  assert.equal(dealt, 7.5);
  assert.equal(bot.damageReceived, dealt);
  assert.equal(player.damageDealt, dealt);
  assert.equal(bot.damageDealt, received);
  assert.equal(player.damageReceived, received);
  assert.equal(bot.healing, healed);
});
test("Fusion Rush tokens acquired count actual token pickups separately from fusion actions", () => {
  const g = new Combat({ mode: "rush", element: "water" }),
    p = g.player;
  g.tokens = [
    { x: p.x, y: p.y, parts: ["dark"], neutral: true, shard: true, souls: [] },
  ];
  g.touchTokens(p);
  assert.equal(completedRoster(g).find((r) => r.isPlayer).tokensAcquired, 1);
  g.touchTokens(p);
  assert.equal(g.matchStats.objectives.tokensAcquired, 1);
});
test("CTF counts opposing flag pickups and friendly recoveries for AI players as well as the user", () => {
  const g = new Combat({ mode: "ctf" }),
    p = g.player,
    bot = g.fighters.find((a) => a !== p && a.team === p.team),
    enemy = g.flags[1 - p.team],
    own = g.flags[p.team];
  for (const a of g.fighters) if (a !== bot) a.alive = false;
  Object.assign(bot, enemy.home);
  g.updateFlags();
  g.updateFlags();
  assert.equal(completedRoster(g).find((r) => r.id === bot.id).flagsStolen, 1);
  Object.assign(own, { dropped: true, x: bot.x, y: bot.y });
  g.updateFlags();
  assert.equal(completedRoster(g).find((r) => r.id === bot.id).returns, 1);
});
test("Dungeon ratios separate 15 monsters and 3 bosses and persist true eliminations without inflating overall kills", () => {
  const g = new Combat({ mode: "dungeon" }),
    monster = g.fighters.find((a) => a.monsterKind),
    boss = g.fighters.find((a) => a.dungeonRole === "water");
  g.fell(monster, { killer: g.player });
  g.fell(boss, { killer: g.player });
  const m = finish(g, "dungeon-result");
  assert.deepEqual(m.dungeonTotals, { monsters: 15, bosses: 3 });
  assert.equal(m.players[0].monstersDefeated, 1);
  assert.equal(m.players[0].bosses, 1);
  assert.equal(m.stats.kills, 2);
  const store = new ProgressionStore(null, {
    getItem() {
      return null;
    },
    setItem() {},
  });
  store.complete(m);
  assert.equal(store.state.totals.kills, 0);
  assert.equal(store.state.modes.dungeon.stats.kills, 2);
});
test("old guest journals also recalculate Overall Performance without Dungeon/Zombies kills", () => {
  const g = new Combat({ mode: "zombies" });
  g.matchStats.kills = 250;
  const m = finish(g, "old-zombies");
  delete m.players;
  delete m.statisticsVersion;
  const raw = JSON.stringify({ version: 1, matches: [m], equipped: {} });
  const store = new ProgressionStore(null, {
    getItem() {
      return raw;
    },
    setItem() {},
  });
  assert.equal(store.state.totals.kills, 0);
  assert.equal(store.state.modes.zombies.stats.kills, 250);
  assert.equal(overallEliminations("ffa", 4), 4);
});
test("hosted overall totals receive zero PvE eliminations and actual new Night counts", async () => {
  const a = new AccountService();
  a.user = { id: "user" };
  const sent = [];
  a.client = {
    rpc: async (name, args) => {
      sent.push(args);
      return {};
    },
  };
  for (const mode of ["dungeon", "zombies", "corruption"])
    await a.saveMatch(a.startMatch(mode), {
      finished: true,
      result: "victory",
      time: 120,
      player: { kills: 4, deaths: 0 },
      matchStats: { kills: 30, deaths: 5 },
    });
  assert.deepEqual(
    sent.map((s) => s.p_kills),
    [0, 0, 30],
  );
  assert.deepEqual(
    sent.map((s) => s.p_deaths),
    [5, 5, 5],
  );
});

test("malformed saved scoreboards are rejected while legacy receipts remain valid", () => {
  const m = finish(new Combat({ mode: "ffa" }), "valid-roster");
  assert.equal(validateMatch(m), true);
  for (const players of [
    "broken",
    {},
    [null],
    [{ ...m.players[0], kills: "bad" }],
  ])
    assert.equal(validateMatch({ ...m, players }), false);
  assert.equal(
    validateMatch({ ...m, dungeonTotals: { monsters: "bad" } }),
    false,
  );
  delete m.players;
  delete m.dungeonTotals;
  assert.equal(validateMatch(m), true);
});
