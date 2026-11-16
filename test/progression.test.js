import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
import {
  beginStatistics,
  completedSnapshot,
  trackTime,
  trackLap,
} from "../src/match-statistics.js";
import {
  calculateXP,
  mastery,
  levelCost,
  MAX_XP,
  FORMS,
  emptyProgress,
  applyMatch,
  canEquip,
  equipCosmetic,
} from "../src/progression.js";
import {
  ProgressionStore,
  storageKey,
  validateMatch,
} from "../src/progression-storage.js";
import { improveRecord } from "../src/records.js";
import {
  updateGridiron,
  passGridiron,
  updateRace,
} from "../src/event-modes.js";
import { advancedEnd, updateAdvanced } from "../src/advanced-modes.js";
import { dungeonFelled } from "../src/dungeon.js";
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};
function match(overrides = {}) {
  return {
    id: "match-1",
    mode: "ffa",
    completed: true,
    practice: false,
    date: "2026-11-16T00:00:00.000Z",
    result: "victory",
    duration: 180,
    startingForm: "fire",
    finalForm: "fire",
    forms: {
      fire: { seconds: 180, kills: 0, fusions: 0, bosses: 0, waves: 0 },
    },
    stats: {
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      damageReceived: 1,
      healing: 0,
    },
    objectives: {},
    ...overrides,
  };
}
test("increasing mastery costs, exact boundaries, level cap and every playable form", () => {
  assert.equal(FORMS.length, 25);
  assert.equal(mastery(0).level, 1);
  assert.equal(mastery(74).level, 1);
  assert.equal(mastery(75).level, 2);
  for (let i = 1; i < 19; i++) assert.ok(levelCost(i + 1) > levelCost(i));
  assert.equal(mastery(MAX_XP).level, 20);
  assert.equal(mastery(MAX_XP + 100).level, 20);
});
test("participation XP splits between actual forms; action XP belongs to the fused form, without inherited duplication", () => {
  const m = match({
    forms: {
      water: { seconds: 90 },
      ice: { seconds: 90, kills: 2, fusions: 1 },
    },
    startingForm: "water",
    finalForm: "ice",
    objectives: { fusions: 1, highestTier: 2 },
  });
  const xp = calculateXP(m);
  assert.equal(xp.total, 125);
  assert.equal(xp.forms.water, 38);
  assert.equal(xp.forms.ice, 87);
  assert.equal(xp.forms.dark, undefined);
  const state = emptyProgress();
  applyMatch(state, m);
  assert.equal(state.mastery.water, 38);
  assert.equal(state.mastery.ice, 87);
  assert.equal(state.mastery.dark, undefined);
});
test("reward caps are per match across forms; real elimination statistics remain uncapped", () => {
  const m = match({
    forms: {
      fire: { seconds: 100, kills: 1000, fusions: 10, waves: 100, bosses: 99 },
      smoke: { seconds: 100, kills: 1000 },
    },
    stats: {
      kills: 2000,
      deaths: 1,
      damageDealt: 20000,
      damageReceived: 120,
      healing: 0,
    },
  });
  const xp = calculateXP(m);
  assert.equal(xp.total, 740);
  assert.equal(xp.sources.kills, 200);
  const state = emptyProgress();
  applyMatch(state, m);
  assert.equal(state.totals.kills, 2000);
});
test("practice, abandoned, unsupported modes and malformed saves never earn progression", () => {
  for (const m of [
    match({ practice: true }),
    match({ completed: false }),
    match({ mode: "tutorial" }),
    match({ mode: "duel" }),
    match({ result: "pending" }),
  ])
    assert.equal(calculateXP(m).total, 0);
  assert.equal(validateMatch(match({ stats: { kills: NaN } })), false);
  assert.equal(validateMatch(match({ date: 20261116 })), false);
  assert.equal(validateMatch(match({ scores: "invalid" })), false);
});
test("guest journal survives restart, deduplicates completion and never alters settings", () => {
  const storage = memory();
  storage.setItem("elemental-settings", "existing");
  const s = new ProgressionStore(null, storage),
    m = match({
      stats: {
        kills: 5,
        deaths: 0,
        damageDealt: 50,
        damageReceived: 0,
        healing: 0,
      },
    });
  const first = s.complete(m);
  assert.ok(first.achievements.includes("five"));
  assert.ok(first.achievements.includes("flawless"));
  assert.equal(s.complete(m).duplicate, true);
  assert.equal(s.state.totals.matches, 1);
  const reopened = new ProgressionStore(null, storage);
  assert.equal(reopened.state.totals.matches, 1);
  assert.equal(reopened.complete(m).duplicate, true);
  const second = reopened.complete(match({ id: "match-2" }));
  assert.equal(second.achievements.includes("five"), false);
  assert.equal(storage.getItem("elemental-settings"), "existing");
  assert.equal(reopened.state.achievements.five, m.date);
});
test("accounts and guests remain separate, including after switching back", () => {
  const storage = memory();
  new ProgressionStore(null, storage).complete(match());
  const a = new ProgressionStore("user-a", storage);
  assert.equal(a.state.totals.matches, 0);
  a.complete(match({ id: "a" }));
  assert.equal(new ProgressionStore("user-b", storage).state.totals.matches, 0);
  assert.equal(new ProgressionStore(null, storage).state.totals.matches, 1);
  assert.equal(new ProgressionStore("user-a", storage).state.totals.matches, 1);
});
test("corrupted storage and unavailable storage fail safely; future saves are not overwritten", () => {
  const storage = memory();
  storage.setItem(storageKey(null), "{broken");
  const s = new ProgressionStore(null, storage);
  assert.equal(s.state.totals.matches, 0);
  assert.equal(storage.getItem(storageKey(null) + ":recovery"), "{broken");
  s.complete(match());
  assert.equal(s.state.totals.matches, 1);
  storage.setItem(
    storageKey(null),
    JSON.stringify({ version: 99, matches: [] }),
  );
  const newer = new ProgressionStore(null, storage);
  assert.equal(newer.complete(match()), null);
  assert.match(storage.getItem(storageKey(null)), /99/);
  const unavailable = new ProgressionStore(null, {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  });
  unavailable.complete(match());
  assert.match(unavailable.status, /storage is unavailable/);
});
test("locked cosmetics cannot be equipped, unlocked rewards can be equipped and unequipped and survive restart", () => {
  const storage = memory(),
    s = new ProgressionStore(null, storage);
  assert.equal(s.equip("achievement:five"), false);
  s.complete(
    match({
      stats: {
        kills: 5,
        deaths: 1,
        damageDealt: 10,
        damageReceived: 1,
        healing: 0,
      },
    }),
  );
  assert.ok(s.equip("achievement:five"));
  assert.equal(
    new ProgressionStore(null, storage).state.equipped.badge,
    "achievement:five",
  );
  assert.ok(s.equip("achievement:five"));
  assert.equal(s.state.equipped.badge, undefined);
  const state = emptyProgress();
  state.mastery.fire = MAX_XP - 1;
  applyMatch(state, match());
  for (const l of [5, 10, 15, 20])
    assert.ok(canEquip(state, `mastery:fire:${l}`));
  assert.ok(equipCosmetic(state, "mastery:fire:20"));
  assert.equal(state.equipped.decoration, "mastery:fire:20");
});
test("personal bests improve only in the correct direction and preserve dates on ties", () => {
  const r = {};
  assert.ok(improveRecord(r, "lap", 50, "one", "min"));
  assert.equal(improveRecord(r, "lap", 55, "two", "min"), false);
  assert.equal(improveRecord(r, "lap", 50, "three", "min"), false);
  assert.equal(r.lap.date, "one");
  assert.ok(improveRecord(r, "lap", 49, "four", "min"));
  assert.ok(improveRecord(r, "kills", 4, "one"));
  assert.equal(improveRecord(r, "kills", 3, "two"), false);
});
test("damage tracks actual health only, excluding shield absorption and overkill; healing credits its source and excludes overheal", () => {
  const g = new Combat({ mode: "tdm", element: "light" }),
    p = g.player;
  const foe = makeFighter("target", "water", 1, p.x + 30, p.y),
    ally = makeFighter("ally", "earth", 0, p.x, p.y + 30);
  g.fighters = [p, foe, ally];
  foe.shield = 30;
  g.damage(p, foe, 10);
  assert.equal(g.matchStats.damageDealt, 0);
  foe.shield = 0;
  foe.hp = 4;
  g.damage(p, foe, 10);
  assert.equal(g.matchStats.damageDealt, 4);
  assert.equal(g.matchStats.kills, 1);
  ally.hp = 110;
  g.restoreHealth(ally, 40, false, p);
  assert.equal(g.matchStats.healing, 10);
  g.restoreHealth(ally, 40, false, p);
  assert.equal(g.matchStats.healing, 10);
  g.damage(ally, p, 4, false, false, "earth", false, true);
  assert.ok(g.matchStats.damageReceived > 0);
  assert.equal(g.matchStats.damageDealt, 4);
});
test("fusion hook records the new body form and real participation, not the inherited skill selector", () => {
  const g = new Combat({ mode: "tdm", element: "water" });
  trackTime(g, 10);
  assert.ok(g.applyFusion(g.player, ["dark"]));
  trackTime(g, 10);
  assert.equal(g.matchStats.forms.water.seconds, 10);
  assert.equal(g.matchStats.forms.ice.fusions, 1);
  assert.equal(g.matchStats.forms.ice.seconds, 10);
  assert.equal(g.matchStats.forms.dark, undefined);
});
test("completed CTF captures and returns use the actual interacting player", () => {
  const g = new Combat({ mode: "ctf" }),
    p = g.player,
    own = g.flags[p.team],
    enemy = g.flags[1 - p.team];
  for (const a of g.fighters) if (a !== p) a.alive = false;
  Object.assign(p, own.home);
  Object.assign(own, { dropped: true, x: p.x, y: p.y });
  g.updateFlags();
  assert.equal(g.matchStats.objectives.returns, 1);
  enemy.carrier = p.id;
  g.updateFlags();
  assert.equal(g.matchStats.objectives.captures, 1);
  g.updateFlags();
  assert.equal(g.matchStats.objectives.captures, 1);
});
test("Gridiron touchdown and opponent pass interception are real objective events, and each new round whistles", () => {
  const g = new Combat({ mode: "gridiron" }),
    p = g.player;
  g.update(0.02, { x: 0, y: 0 }, false);
  assert.equal(g.audioEvents.filter((e) => e.kind === "whistle").length, 1);
  for (const a of g.fighters) {
    a.x = 700;
    a.y = 700;
  }
  const opponent = g.fighters.find((a) => a.team !== p.team),
    receiver = g.fighters.find(
      (a) => a.team === opponent.team && a !== opponent,
    );
  Object.assign(opponent, { x: 500, y: 350 });
  Object.assign(receiver, { x: 700, y: 350 });
  Object.assign(p, { x: 600, y: 350 });
  g.ball.carrier = opponent.id;
  assert.ok(passGridiron(g, opponent, receiver));
  g.time += 0.3;
  updateGridiron(g);
  assert.equal(g.ball.carrier, p.id);
  assert.equal(g.matchStats.objectives.interceptions, 1);
  const zone = g.map.endZones.find((z) => z.team !== p.team);
  Object.assign(p, { x: zone.x + 5, y: zone.y + 5 });
  g.ball.carrier = p.id;
  updateGridiron(g);
  assert.equal(g.matchStats.objectives.touchdowns, 1);
  assert.equal(g.audioEvents.filter((e) => e.kind === "whistle").length, 2);
});
test("Zombies damage is measured in actual hit points and Fire eliminations are individual, not the team total", () => {
  const g = new Combat({ mode: "zombies", players: 2 });
  const enemy = makeFighter("z", "fire", 1, g.player.x + 20, g.player.y);
  Object.assign(enemy, { zombieEnemy: true, hp: 5, maxHp: 5, zombieTicks: {} });
  g.fighters.push(enemy);
  for (let i = 0; i < 5; i++) g.damage(g.player, enemy, 99);
  assert.equal(g.matchStats.damageDealt, 5);
  assert.equal(g.matchStats.objectives.fireDefeated, 1);
  assert.equal(g.matchStats.kills, 1);
});
test("waves, dungeon bosses, roulette transformations and racing laps are event driven", () => {
  const waves = new Combat({ mode: "gauntlet" });
  for (const a of waves.fighters) if (a.team === 1) a.alive = false;
  advancedEnd(waves);
  advancedEnd(waves);
  assert.equal(waves.matchStats.objectives.waves, 1);
  const dungeon = new Combat({ mode: "dungeon" });
  const boss = dungeon.fighters.find((a) => a.dungeonRole === "final");
  dungeonFelled(dungeon, boss);
  dungeonFelled(dungeon, boss);
  assert.equal(dungeon.matchStats.objectives.bosses, 1);
  assert.equal(dungeon.matchStats.objectives.finalBoss, 1);
  const roulette = new Combat({ mode: "roulette" });
  roulette.time = 25;
  updateAdvanced(roulette);
  assert.equal(roulette.matchStats.objectives.transformations, 1);
  const race = new Combat({ mode: "turnpike" });
  race.player.raceLaps = 1;
  race.time = 42;
  trackLap(race, race.player);
  race.player.raceLaps = 2;
  race.time = 80;
  trackLap(race, race.player);
  assert.equal(race.matchStats.objectives.fastestLap, 38);
  assert.equal(race.matchStats.objectives.raceCompletion, undefined);
});
test("every mode retains independent universal stats, mode objectives, and dated records", () => {
  const s = emptyProgress();
  applyMatch(
    s,
    match({
      mode: "war",
      army: "water",
      stats: {
        kills: 9,
        deaths: 2,
        damageDealt: 200,
        damageReceived: 150,
        healing: 30,
      },
    }),
  );
  applyMatch(
    s,
    match({
      id: "race",
      mode: "turnpike",
      objectives: { fastestLap: 41, raceCompletion: 129 },
    }),
  );
  assert.equal(s.modes.war.armies.water, 1);
  assert.equal(s.modes.war.bests.kills.value, 9);
  assert.equal(s.modes.turnpike.objectives.victories, 1);
  assert.equal(s.modes.turnpike.bests.fastestLap.value, 41);
  assert.equal(s.totals.kills, 9);
});
test("earned achievements and rewards remain permanent when reading an older partial journal", () => {
  const storage = memory(),
    s = new ProgressionStore(null, storage);
  s.complete(
    match({
      stats: {
        kills: 5,
        deaths: 0,
        damageDealt: 20,
        damageReceived: 0,
        healing: 0,
      },
    }),
  );
  const saved = JSON.parse(storage.getItem(storageKey(null)));
  saved.matches = [];
  storage.setItem(storageKey(null), JSON.stringify(saved));
  const restored = new ProgressionStore(null, storage);
  assert.ok(restored.state.achievements.five);
  assert.ok(canEquip(restored.state, "achievement:five"));
});
test("cloud sync unions private journals, retries idempotently and keeps account data separate", async () => {
  const storage = memory(),
    store = new ProgressionStore("account", storage);
  store.complete(match());
  const rows = [{ payload: match({ id: "remote", result: "defeat" }) }];
  let uploads = 0,
    rpc = 0;
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "account" } } },
      }),
    },
    from(table) {
      return {
        select() {
          return this;
        },
        eq(key, value) {
          assert.equal(value, "account");
          return this;
        },
        order() {
          return this;
        },
        async range() {
          return { data: rows };
        },
        async maybeSingle() {
          return { data: null };
        },
        async upsert(batch, options) {
          assert.equal(options.ignoreDuplicates, true);
          uploads += batch.length;
          for (const row of batch) {
            assert.equal(row.user_id, "account");
            rows.push(row);
          }
          return {};
        },
      };
    },
    async rpc(name, args) {
      assert.equal(name, "save_progression_cosmetics");
      assert.equal(args.p_user_id, "account");
      rpc++;
      return {};
    },
  };
  assert.ok(await store.sync(client));
  assert.equal(store.state.totals.matches, 2);
  assert.equal(uploads, 1);
  assert.equal(rpc, 1);
  assert.ok(await store.sync(client));
  assert.equal(uploads, 1);
  assert.equal(new ProgressionStore(null, storage).state.totals.matches, 0);
  client.auth.getSession = async () => ({
    data: { session: { user: { id: "another-account" } } },
  });
  assert.equal(await store.sync(client), false);
  assert.equal(uploads, 1);
});
test("cloud failure leaves a retriable local account save and clear messaging", async () => {
  const storage = memory(),
    store = new ProgressionStore("account", storage);
  store.complete(match());
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "account" } } },
      }),
    },
    from() {
      throw Error("offline");
    },
  };
  assert.equal(await store.sync(client), false);
  assert.match(store.status, /Cloud progression is unavailable/);
  assert.equal(
    new ProgressionStore("account", storage).state.totals.matches,
    1,
  );
});
test("Light survival and Dark conversions are counted without granting a Light victory after conversion", () => {
  const g = new Combat({ mode: "corruption" });
  trackTime(g, 12);
  const p = g.player,
    other = g.fighters[1];
  g.corrupt(p);
  g.corrupt(other, p);
  assert.equal(g.matchStats.objectives.conversions, 1);
  assert.equal(g.matchStats.longestLight, 12);
  g.finished = true;
  g.result = "victory";
  assert.equal(
    completedSnapshot(g, { id: "night", practice: false }).lightVictory,
    false,
  );
});
test("equipment changed during an in-flight cloud save is synchronized in a follow-up pass", async () => {
  const store = new ProgressionStore("account", memory());
  store.complete(
    match({
      stats: {
        kills: 5,
        deaths: 0,
        damageDealt: 25,
        damageReceived: 0,
        healing: 0,
      },
    }),
  );
  const rows = [];
  let preferences = null,
    release,
    entered;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const waiting = new Promise((resolve) => {
    entered = resolve;
  });
  let writes = 0;
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "account" } } },
      }),
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        async range() {
          return { data: rows };
        },
        async maybeSingle() {
          return { data: preferences };
        },
        async upsert(batch) {
          rows.push(...batch);
          return {};
        },
      };
    },
    async rpc(name, args) {
      preferences = {
        equipped: { ...args.p_equipped },
        earned: args.p_earned,
        updated_at: args.p_updated_at,
      };
      if (++writes === 1) {
        entered();
        await blocked;
      }
      return {};
    },
  };
  const first = store.sync(client);
  await waiting;
  store.equip("achievement:five");
  const second = store.sync(client);
  release();
  await Promise.all([first, second]);
  assert.equal(writes, 2);
  assert.equal(preferences.equipped.badge, "achievement:five");
  assert.equal(rows.length, 1);
});
