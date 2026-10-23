import test from "node:test";
import assert from "node:assert/strict";
import { AccountService } from "../src/account.js";
test("guest and Practice results never reach the stats backend, even if the guest signs in later", async () => {
  const a = new AccountService();
  let calls = 0;
  a.client = {
    rpc: async () => {
      calls++;
      return { error: null };
    },
  };
  const guest = a.startMatch("rush");
  a.user = { id: "one" };
  const g = {
    finished: true,
    player: { kills: 3, deaths: 1 },
    result: "victory",
    time: 180,
  };
  assert.equal(await a.saveMatch(guest, g), false);
  for (const mode of ["duel", "fused", "fused3", "team", "tutorial"])
    assert.equal(await a.saveMatch(a.startMatch(mode), g), false);
  assert.equal(await a.saveMatch(a.startMatch("rush", true), g), false);
  assert.equal(calls, 0);
});
test("completed signed-in Play matches save once and cannot be credited to another account", async () => {
  const a = new AccountService();
  a.user = { id: "one" };
  let calls = [];
  a.client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { error: null };
    },
  };
  const ticket = a.startMatch("roulette"),
    g = {
      finished: false,
      player: { kills: 4, deaths: 0 },
      result: "victory",
      time: 52.5,
    };
  assert.equal(await a.saveMatch(ticket, g), false);
  g.finished = true;
  assert.equal(await a.saveMatch(ticket, g), true);
  assert.equal(await a.saveMatch(ticket, g), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_duration, 52);
  assert.equal(calls[0].args.p_mode, "roulette");
  const other = a.startMatch("rush");
  a.user = { id: "two" };
  assert.equal(await a.saveMatch(other, g), false);
  assert.equal(calls.length, 1);
});
test("failed stats submissions remain retryable; unconfigured accounts give an explicit error", async () => {
  const a = new AccountService();
  await assert.rejects(
    () => a.signIn("a@b.com", "not-stored"),
    /not connected/,
  );
  a.user = { id: "one" };
  a.client = { rpc: async () => ({ error: new Error("Offline") }) };
  const ticket = a.startMatch("rush");
  await assert.rejects(
    () =>
      a.saveMatch(ticket, {
        finished: true,
        player: {},
        time: 180,
        result: "defeat",
      }),
    /Offline/,
  );
  assert.equal(ticket.saved, undefined);
});
