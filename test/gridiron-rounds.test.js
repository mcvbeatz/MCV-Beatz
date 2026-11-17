import test from "node:test";
import assert from "node:assert/strict";
import { Combat } from "./combat-fixture.js";
import {
  passGridiron,
  updateGridiron,
  fumble,
  advanceGridironCelebration,
} from "../src/event-modes.js";
import { completedSnapshot } from "../src/match-statistics.js";
import { ProgressionStore } from "../src/progression-storage.js";
import { AccountService } from "../src/account.js";
import { synthesizeSfx } from "../src/combat-sfx.js";
function setup() {
  const g = new Combat({ mode: "gridiron" });
  g.fighters.forEach((a, i) => Object.assign(a, { x: 450 + i * 100, y: 800 }));
  const a = g.player,
    b = g.fighters[1];
  Object.assign(a, { x: 700, y: 500 });
  Object.assign(b, { x: 1000, y: 500 });
  g.ball.carrier = a.id;
  return { g, a, b };
}
function catchPass(g, a, b) {
  assert.ok(passGridiron(g, a, b));
  g.time += 1;
  updateGridiron(g);
  assert.equal(g.ball.carrier, b.id);
}
function score(g, a) {
  a.x = a.team === 0 ? 1500 : 250;
  a.y = 500;
  g.ball.carrier = a.id;
  updateGridiron(g);
}
test("a caught pass followed by a touchdown grants one assist; repeated score callbacks cannot duplicate it", () => {
  const { g, a, b } = setup();
  catchPass(g, a, b);
  score(g, b);
  assert.equal(g.matchStats.objectives.assists, 1);
  assert.equal(g.sessionActors.get(b.id).stats.objectives.touchdowns, 1);
  updateGridiron(g);
  updateGridiron(g);
  assert.equal(g.matchStats.objectives.assists, 1);
  assert.deepEqual(g.scores, [1, 0]);
});
test("fumbles, interceptions and missed catches remove scoring-assist credit", () => {
  for (const loss of ["fumble", "interception", "miss"]) {
    const { g, a, b } = setup();
    if (loss === "fumble") {
      catchPass(g, a, b);
      fumble(g, b);
    } else {
      assert.ok(passGridiron(g, a, b));
      if (loss === "interception")
        Object.assign(g.fighters[4], { x: 850, y: 500 });
      else b.y = 700;
      g.time += 1;
      updateGridiron(g);
    }
    score(g, b);
    assert.equal(g.matchStats.objectives.assists || 0, 0, loss);
  }
});
test("touchdown freezes clock and combat for three seconds, permits movement and idle poses, then restarts with one whistle", () => {
  const { g, a, b } = setup();
  g.time = 90;
  catchPass(g, a, b);
  a.hitReact = a.clash = 1;
  score(g, b);
  assert.equal(a.hitReact, 0);
  assert.equal(a.clash, 0);
  const clock = g.time,
    hp = b.hp,
    x = a.x;
  g.update(0.05, { x: 1, y: 0 }, true);
  assert.ok(a.x > x);
  assert.equal(a.victory, false);
  assert.equal(g.time, clock);
  assert.equal(g.strike(a), false);
  assert.equal(g.utility(a), false);
  assert.equal(g.damage(a, b, 999), 0);
  assert.equal(b.hp, hp);
  g.update(0.05, { x: 0, y: 0 }, true);
  assert.equal(a.victory, true);
  for (let i = 0; i < 57; i++) g.update(0.05, { x: 0, y: 0 }, true);
  assert.ok(g.gridCelebration);
  assert.equal(g.time, clock);
  g.update(0.05, { x: 0, y: 0 }, true);
  g.update(0.00001, { x: 0, y: 0 }, true);
  assert.equal(g.gridCelebration, null);
  assert.equal(g.time, clock);
  assert.equal(g.audioEvents.filter((e) => e.kind === "whistle").length, 1);
  assert.equal(g.fighters.find((a) => a.id === g.ball.carrier).team, 1);
  assert.ok(
    g.fighters.every((a) => a.alive && !a.victory && a.x === a.spawn.x),
  );
});
test("sudden-death touchdown celebrates before deciding the winner without starting another round", () => {
  const { g, a } = setup();
  g.suddenDeath = true;
  score(g, a);
  assert.equal(g.finished, false);
  advanceGridironCelebration(g, 3, { x: 0, y: 0 });
  assert.equal(g.finished, true);
  assert.equal(g.winnerTeam, 0);
  assert.equal(g.audioEvents.filter((e) => e.kind === "whistle").length, 0);
});
test("three distinct forward yard lines cheer for either team; recrossing or losing the ball resets no fake progress", () => {
  for (const team of [0, 1]) {
    const { g } = setup(),
      a = g.fighters.find((a) => a.team === team),
      dir = team === 0 ? 1 : -1;
    a.x = team === 0 ? 400 : 1400;
    a.y = 500;
    g.ball.carrier = a.id;
    updateGridiron(g);
    for (let i = 0; i < 3; i++) {
      a.x += dir * 114;
      updateGridiron(g);
    }
    assert.equal(g.audioEvents.filter((e) => e.kind === "crowd-run").length, 1);
    a.x -= dir * 114;
    updateGridiron(g);
    a.x += dir * 114;
    updateGridiron(g);
    assert.equal(g.audioEvents.filter((e) => e.kind === "crowd-run").length, 1);
    fumble(g, a);
    g.ball.carrier = a.id;
    updateGridiron(g);
    a.x += dir * 114;
    updateGridiron(g);
    assert.equal(g.audioEvents.filter((e) => e.kind === "crowd-run").length, 1);
  }
});
test("Waves retain mode records and mastery but contribute nothing to Overall Performance or public writes", async () => {
  const store = new ProgressionStore(null, null),
    account = new AccountService();
  account.user = { id: "signed-in" };
  account.client = {
    rpc: () => {
      throw new Error("No public write expected");
    },
  };
  for (const mode of ["gauntlet", "gauntlet-team"]) {
    const g = new Combat({ mode });
    g.matchStats.kills = 10;
    g.matchStats.deaths = 1;
    g.matchStats.damageDealt = 100;
    g.time = 90;
    g.finish(g.player.team, "Waves complete");
    const report = store.complete(
      completedSnapshot(g, { id: mode, practice: false }),
    );
    assert.ok(report.xp.total > 0);
    assert.equal(store.state.modes[mode].stats.kills, 10);
    assert.ok(Object.values(store.state.totals).every((v) => v === 0));
    assert.equal(await account.saveMatch(account.startMatch(mode), g), false);
  }
});
test("crowd sounds have different lengths, finite bounded samples, and audible energy", () => {
  const run = synthesizeSfx("crowd-run", 8000),
    score = synthesizeSfx("crowd-touchdown", 8000);
  assert.ok(score.length > run.length);
  for (const samples of [run, score]) {
    assert.ok(samples.every((n) => Number.isFinite(n) && Math.abs(n) <= 1));
    assert.ok(
      samples.reduce((sum, n) => sum + n * n, 0) / samples.length > 0.0001,
    );
  }
});
test("account deletion calls only the authenticated self-delete RPC and keeps the account on failure", async () => {
  const service = new AccountService();
  service.user = { id: "one" };
  let calls = [];
  service.client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { error: { message: "missing migration" } };
    },
    auth: { signOut: async () => ({ error: null }) },
  };
  await assert.rejects(service.deleteAccount(), /missing migration/);
  assert.equal(service.user.id, "one");
  service.client.rpc = async (name, args) => {
    calls.push([name, args]);
    return { error: null };
  };
  assert.equal(await service.deleteAccount(), "one");
  assert.equal(service.user, null);
  assert.deepEqual(calls, [
    ["delete_own_account", undefined],
    ["delete_own_account", undefined],
  ]);
});

test("a touchdown at the regulation buzzer celebrates before results and never starts a spurious round", () => {
  const { g, a } = setup();
  g.time = 180;
  score(g, a);
  assert.equal(g.finished, false);
  advanceGridironCelebration(g, 3, { x: 0, y: 0 });
  assert.equal(g.finished, true);
  assert.equal(g.winnerTeam, 0);
  assert.equal(g.audioEvents.filter((e) => e.kind === "whistle").length, 0);
});
