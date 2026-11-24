import test from "node:test";
import assert from "node:assert/strict";
import {
  difference,
  applyDifference,
  SnapshotEncoder,
  SnapshotDecoder,
} from "../src/snapshot-delta.js";
import { LobbyRoom } from "../src/lobby-room.js";
import { MULTIPLAYER_MODES } from "../src/mode-catalog.js";
import {
  unpackGame,
  packGame,
  SnapshotGraph,
} from "../src/multiplayer-protocol.js";
const wire = (value) => JSON.parse(JSON.stringify(value));
const frame = (json) => JSON.parse(json);
// Equivalent graphs can enumerate object fields in different orders after a
// full root replacement followed by a delta. Compare all values and reference
// identities with canonical numbering; only object-key enumeration (including
// the decoder's _wireKeys bookkeeping set) is irrelevant to gameplay.
function canonicalGraph(packet) {
  const ids = new Map(),
    nodes = [];
  const visit = (value, field) => {
    if (!value || typeof value !== "object" || !("ref" in value)) return value;
    if (ids.has(value.ref)) return { ref: ids.get(value.ref) };
    const id = nodes.length,
      node = packet.nodes[value.ref];
    ids.set(value.ref, id);
    nodes.push(null);
    let data;
    if (node.type === "array" || node.type === "set") {
      data = node.data.map((v) => visit(v));
      if (field === "_wireKeys") data.sort();
    } else if (node.type === "map") {
      data = node.data.map(([k, v]) => [visit(k), visit(v)]);
    } else {
      data = Object.fromEntries(
        Object.keys(node.data)
          .sort()
          .map((k) => [k, visit(node.data[k], k)]),
      );
    }
    nodes[id] = { type: node.type, data };
    return { ref: id };
  };
  visit({ ref: 0 });
  return { ...packet, nodes };
}

test("lossless deltas handle arrays, removed keys, nulls, strings and JSON semantics", () => {
  const cases = [
    null,
    {},
    [],
    [1, 2, 3],
    [4],
    { a: 1, b: null },
    { a: [{ x: 1 }], b: { c: 2 } },
    { $: true },
    "hello",
    4,
  ];
  for (const a of cases)
    for (const b of cases) {
      const d = difference(a, b);
      assert.deepEqual(d === undefined ? a : applyDifference(a, wire(d)), b);
    }
  assert.throws(() => applyDifference({}, JSON.parse('{"__proto__":[{}]}')));
});
test("every mode round-trips evolving authoritative state, effects, references and results", () => {
  for (const mode of MULTIPLAYER_MODES) {
    const room = new LobbyRoom(mode);
    room.join("a", "A", "fire", {});
    room.join("b", "B", "water", {});
    const encoder = new SnapshotEncoder(),
      decoder = new SnapshotDecoder(),
      graph = new SnapshotGraph();
    for (let i = 0; i < 15; i++) {
      if (i === 3) room.startBattle();
      if (i === 6) room.command("a", { kind: "startCharge" });
      if (i === 9) room.command("a", { kind: "releaseCharge" });
      if (i === 12) {
        room.game.finished = true;
        room.game.winnerTeam = 0;
      }
      room.tick(1 / 30);
      room.sequence++;
      const expected = wire(room.snapshot(graph)),
        encoded = encoder.encode(expected);
      const actual = decoder.receive(frame(i ? encoded.delta : encoded.full));
      assert.deepEqual(actual, expected, `${mode} frame ${i}`);
      const restored = unpackGame(actual.game);
      assert.deepEqual(
        canonicalGraph(wire(packGame(restored))),
        canonicalGraph(wire(packGame(unpackGame(wire(room.snapshot().game))))),
        `${mode} legacy equivalence ${i}`,
      );
      assert.equal(
        restored.player,
        restored.fighters.find((a) => a.id === restored.player.id),
      );
      assert.equal(restored.portals.game, restored);
      assert.deepEqual(
        restored.fighters.map((a) => [a.id, a.x, a.y, a.hp, a.alive]),
        room.game.fighters.map((a) => [a.id, a.x, a.y, a.hp, a.alive]),
      );
    }
  }
});
test("a lost or delayed delta never corrupts state; a keyframe recovers and reconnect starts clean", () => {
  const room = new LobbyRoom("ffa", { now: () => 1000 });
  room.join("a", "A", "fire", {});
  const encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder();
  const frames = [];
  for (let i = 0; i < 5; i++) {
    room.tick(0.033);
    room.sequence++;
    frames.push(encoder.encode(room.snapshot()));
  }
  decoder.receive(frame(frames[0].full));
  const before = decoder.state;
  assert.equal(decoder.receive(frame(frames[2].delta)), null);
  assert.equal(decoder.state, before);
  decoder.receive(frame(frames[3].full));
  assert.equal(decoder.receive(frame(frames[1].delta)), null);
  assert.deepEqual(
    decoder.receive(frame(frames[4].delta)),
    wire(room.snapshot()),
  );
  assert.equal(decoder.receive(frame(frames[4].full)), null);
  decoder.reset();
  assert.deepEqual(
    decoder.receive(frame(frames[4].full)),
    wire(room.snapshot()),
  );
});
test("unchanged roster, settings and statistics disappear from steady-state wire updates", () => {
  const room = new LobbyRoom("tdm");
  room.join("a", "A", "fire", {});
  const encoder = new SnapshotEncoder();
  encoder.encode(room.snapshot());
  room.tick(0.033);
  room.sequence++;
  const encoded = encoder.encode(room.snapshot());
  assert.ok(encoded.delta.length < encoded.full.length * 0.4);
  assert.ok(!encoded.delta.includes("displayName"));
});
test("stable graph IDs survive insertion/removal and recycle storage", () => {
  const room = new LobbyRoom("ffa", { now: () => 1000 });
  room.join("a", "A", "fire", {});
  room.startBattle();
  const graph = new SnapshotGraph(),
    encoder = new SnapshotEncoder(),
    decoder = new SnapshotDecoder();
  let high = 0;
  for (let i = 0; i < 100; i++) {
    room.game.projectiles = [
      { owner: room.game.player, x: i, y: 20, trail: [{ x: i - 1, y: 20 }] },
    ];
    room.game.transientTest =
      i % 2
        ? new Map([[room.game.player, new Set([room.game.fighters[1]])]])
        : [];
    const packet = room.snapshot(graph),
      f = encoder.encode(packet);
    const state = decoder.receive(frame(i ? f.delta : f.full));
    assert.deepEqual(state, wire(packet));
    const g = unpackGame(state.game);
    assert.equal(g.projectiles[0].owner, g.player);
    high = Math.max(high, packet.game.nodes.length);
  }
  assert.ok(graph.next < high + 10);
  assert.ok(graph.ids.size < high);
});
