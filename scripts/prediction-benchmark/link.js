import { WebSocket, WebSocketServer } from "ws";
// Ordered application-message delay, not a claim to emulate TCP congestion.
export async function delayedLink(
  target,
  { rtt = 0, jitter = 0, dropEvery = 0, stallEvery = 0 } = {},
) {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise((r) => server.once("listening", r));
  const sockets = new Set(),
    timers = new Set();
  server.on("connection", (client) => {
    const upstream = new WebSocket(target);
    sockets.add(client);
    sockets.add(upstream);
    const pending = [];
    let upAt = 0,
      downAt = 0,
      upN = 0,
      downN = 0;
    const later = (socket, data, up) => {
      let n = up ? ++upN : ++downN;
      if (
        !up &&
        dropEvery &&
        n % dropEvery === 0 &&
        JSON.parse(data).kind === "snapshot"
      )
        return;
      const delay =
        rtt / 2 +
        (jitter ? Math.sin(n * 1.7) * jitter : 0) +
        (!up && stallEvery && n % stallEvery === 0 ? 250 : 0);
      const at = Math.max(Date.now() + Math.max(0, delay), up ? upAt : downAt);
      if (up) upAt = at;
      else downAt = at;
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          if (socket.readyState === 1) socket.send(data.toString());
        },
        Math.max(0, at - Date.now()),
      );
      timers.add(timer);
    };
    upstream.on("open", () =>
      pending.splice(0).forEach((data) => later(upstream, data, true)),
    );
    client.on("message", (data) =>
      upstream.readyState === 1
        ? later(upstream, data, true)
        : pending.push(data),
    );
    upstream.on("message", (data) => later(client, data, false));
    for (const [a, b] of [
      [client, upstream],
      [upstream, client],
    ]) {
      a.on("error", () => {});
      a.on("close", () => {
        sockets.delete(a);
        b.close();
      });
    }
  });
  return {
    url: `ws://127.0.0.1:${server.address().port}`,
    close: async () => {
      timers.forEach(clearTimeout);
      sockets.forEach((s) => s.terminate());
      await new Promise((r) => server.close(r));
    },
  };
}
