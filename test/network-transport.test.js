import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createLobbyServer } from "../server/index.js";
import { SNAPSHOT_CODEC, SnapshotDecoder } from "../src/snapshot-delta.js";
import { unpackGame } from "../src/multiplayer-protocol.js";
const waitFor = async (check) => {
  const end = Date.now() + 4000;
  while (!check()) {
    if (Date.now() > end) throw Error("Network condition timed out");
    await new Promise((r) => setTimeout(r, 15));
  }
};
async function connect(url, delta = true) {
  const ws = new WebSocket(url),
    decoder = new SnapshotDecoder();
  const c = { ws, decoder, state: null, userId: null, frames: [], drop: false };
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.kind === "identity") {
      c.userId = msg.userId;
      decoder.reset();
    }
    if (msg.kind === "state") {
      c.state = msg;
      c.userId = msg.userId;
    }
    if (msg.kind === "snapshot") {
      c.frames.push(msg);
      if (c.drop) return;
      const state = decoder.receive(msg);
      if (state) c.state = state;
      else if (msg.id > decoder.id) ws.send(JSON.stringify({ kind: "resync" }));
    }
    if (msg.kind === "error") c.error = msg.message;
  });
  await once(ws, "open");
  ws.send(
    JSON.stringify({
      kind: "join",
      mode: "tdm",
      guest: true,
      snapshotCodec: delta ? SNAPSHOT_CODEC : undefined,
    }),
  );
  await waitFor(() => c.state);
  return c;
}
test("mixed protocol-4 clients synchronize, recover lost updates, rejoin, and retain authority", async () => {
  const service = createLobbyServer({ diagnostics: true });
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  const clients = [];
  try {
    const url = `ws://127.0.0.1:${service.server.address().port}`;
    const a = await connect(url),
      b = await connect(url),
      old = await connect(url, false);
    clients.push(a, b, old);
    await waitFor(() => [a, b, old].every((c) => c.state.members.length === 3));
    assert.equal(a.state.roomId, b.state.roomId);
    assert.equal(a.state.roomId, old.state.roomId);
    assert.ok(a.frames.some((f) => f.base !== undefined));
    const room = service.rooms.get(a.state.roomId);
    const before = room.game.fighters[0].x;
    a.ws.send(JSON.stringify({ kind: "move", x: 1, y: 0, hp: 999999 }));
    await waitFor(() => unpackGame(b.state.game).fighters[0].x > before);
    assert.equal(room.game.fighters[0].hp, 120);
    b.drop = true;
    await new Promise((r) => setTimeout(r, 350));
    b.drop = false;
    await waitFor(() => service.metrics.report().resyncs > 0);
    await waitFor(() => b.decoder.id === a.decoder.id);
    assert.deepEqual(b.state, a.state);
    const [slow] = service.wss.clients; // first connection is client a
    const delivered = a.frames.length;
    await waitFor(() => !slow.snapshotPending);
    slow.snapshotPending = true;
    await new Promise((r) => setTimeout(r, 250));
    slow.snapshotPending = false;
    await waitFor(() => a.frames.length > delivered + 1);
    assert.ok(service.metrics.report().skippedSends > 0);
    // Combat keyframe preserves authoritative projectile/effect/health graph.
    room.startBattle();
    await waitFor(() => [a, b, old].every((c) => c.state.phase === "battle"));
    const views = [a, b, old].map((c) => unpackGame(c.state.game));
    for (const view of views)
      assert.equal(view.fighters.length, room.game.fighters.length);
    assert.equal(old.frames.length, 0); // unchanged legacy wire path
    a.ws.close();
    await once(a.ws, "close");
    await waitFor(() => room.members.size === 2);
    // Existing behavior: active-match departures become AI; reconnect enters a lobby.
    const again = await connect(url);
    clients.push(again);
    assert.equal(again.frames[0].base, undefined);
    assert.notEqual(again.state.roomId, room.id);
    assert.equal(again.state.phase, "lobby");
    assert.ok(clients.every((c) => !c.error));
    const metrics = service.metrics.report();
    assert.ok(
      metrics.wireBytes > 0 && metrics.serializedBytes > metrics.wireBytes,
    );
    assert.ok(
      metrics.timings.encodeMs.count > 0 &&
        metrics.timings.serializeMs.count > 0,
    );
    assert.ok(!JSON.stringify(metrics).includes(a.userId));
    const response = await fetch(
      `http://127.0.0.1:${service.server.address().port}/network-metrics`,
    );
    assert.equal(response.status, 200);
  } finally {
    clients.forEach((c) => c.ws.terminate());
    await service.close();
  }
});
test("diagnostics are not publicly exposed unless enabled", async () => {
  const service = createLobbyServer({ diagnostics: false });
  await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
  try {
    assert.equal(
      (
        await fetch(
          `http://127.0.0.1:${service.server.address().port}/network-metrics`,
        )
      ).status,
      404,
    );
  } finally {
    await service.close();
  }
});
