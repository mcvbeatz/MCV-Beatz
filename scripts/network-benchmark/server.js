import { createLobbyServer } from "../../server/index.js";
import { spawnZombie } from "../../src/zombies.js";
let seed = 7391;
Math.random = () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const service = createLobbyServer({
  diagnostics: true,
  compression: process.env.BENCH_COMPRESSION !== "0",
});
await new Promise((r) => service.server.listen(0, "127.0.0.1", r));
process.send({ port: service.server.address().port });
process.on("message", async (msg) => {
  if (msg.kind === "start") {
    const room = [...service.rooms.values()][0];
    room.capacity = msg.players;
    room.startBattle();
    if (room.mode === "zombies") {
      room.game.zombies.rate = 1;
      for (let i = 0; i < 100; i++) spawnZombie(room.game);
      // A sustained cooperative fight: connected seats use the existing AI.
      // This benchmark hook is never imported by the production server.
      const update = room.game.update.bind(room.game);
      room.game.update = (dt, input) => {
        room.game.humanInputs.clear();
        update(dt, input);
      };
    }
    process.send({ started: true });
  } else if (msg.kind === "reset") {
    service.metrics.reset();
    process.send({ reset: true });
  } else if (msg.kind === "report") {
    const room = [...service.rooms.values()][0];
    process.send({
      report: service.metrics.report(),
      fighters: room.game.fighters.length,
      phase: room.phase,
    });
  } else if (msg.kind === "close") {
    await service.close();
    process.exit(0);
  }
});

process.on("disconnect", async () => {
  await service.close();
  process.exit(0);
});
