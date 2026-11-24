import test from "node:test";
import assert from "node:assert/strict";
import { createLobbyServer } from "../server/index.js";
import { LobbyClient } from "../src/lobby-client.js";
const wait = async (fn) => {
  const end = Date.now() + 5000;
  while (!fn()) {
    if (Date.now() > end) throw Error("Timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
};
test("server rollback switch and negotiated input acknowledgments support new, old and rejoining clients", async () => {
  for (const enabled of [false, true]) {
    const service = createLobbyServer({ prediction: enabled });
    await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
    const clients = [],
      errors = [];
    try {
      const url = `ws://127.0.0.1:${service.server.address().port}`;
      const connect = async () => {
        const c = new LobbyClient({
          url,
          account: { user: null },
          onState: () => {},
          onError: (e) => errors.push(e),
        });
        clients.push(c);
        await c.connect("ffa", { element: "fire", cosmetics: {} });
        await wait(() => c.state);
        return c;
      };
      const a = await connect(),
        b = await connect();
      await wait(() => a.state.members.length === 2);
      assert.equal(a.prediction.enabled, enabled);
      assert.equal(a.state.roomId, b.state.roomId);
      const room = service.rooms.get(a.state.roomId),
        m = room.members.get(a.userId),
        actor = room.game.fighters[m.seat];
      const x = actor.x;
      a.move(1, 0, 0.016);
      await wait(() => actor.x > x);
      assert.equal(actor.hp, 120);
      if (enabled) {
        assert.ok(m.movementAck[0] > 0);
        a.send({
          kind: "move",
          seq: 0,
          x: -1,
          y: 0,
          position: { x: 99999 },
          hp: 99999,
        });
        await new Promise((r) => setTimeout(r, 70));
        assert.equal(m.input.x, 1);
        assert.equal(actor.hp, 120);
      }
      a.close();
      await wait(() => room.members.size === 1);
      const rejoin = await connect();
      assert.equal(rejoin.prediction.enabled, enabled);
      assert.equal(rejoin.state.roomId, room.id);
      const health = await (
        await fetch(url.replace("ws:", "http:") + "/health")
      ).json();
      assert.equal(health.protocolVersion, 4);
      assert.equal(health.movementPrediction, enabled ? "movement-v1" : null);
      assert.deepEqual(errors, []);
    } finally {
      clients.forEach((c) => c.close());
      await service.close();
    }
  }
});
