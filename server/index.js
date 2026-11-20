import { LOBBY_PROTOCOL, SnapshotGraph } from "../src/multiplayer-protocol.js";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { SnapshotEncoder, SNAPSHOT_CODEC } from "../src/snapshot-delta.js";
import { NetworkMetrics } from "./network-metrics.js";
import { pathToFileURL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { MULTIPLAYER_MODES } from "../src/mode-catalog.js";
import { LobbyRoom } from "../src/lobby-room.js";
export function createLobbyServer({
  verifyUser,
  origins = [],
  maxRooms = 12,
  diagnostics = process.env.NETWORK_DIAGNOSTICS === "1",
  compression = process.env.WS_COMPRESSION !== "0",
  compressionLevel = Number(process.env.WS_COMPRESSION_LEVEL || 6),
} = {}) {
  const metrics = new NetworkMetrics(diagnostics);
  const rooms = new Map(),
    clients = new Map();
  const encoders = new WeakMap();
  const graphs = new WeakMap();
  const server = http.createServer((req, res) => {
    if (diagnostics && req.url === "/network-metrics") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(metrics.report()));
      return;
    }
    res.writeHead(req.url === "/health" ? 200 : 404, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        ok: req.url === "/health",
        rooms: rooms.size,
        protocolVersion: LOBBY_PROTOCOL,
        snapshotCodec: SNAPSHOT_CODEC,
      }),
    );
  });
  const wss = new WebSocketServer({
    server,
    maxPayload: 8192,
    perMessageDeflate: compression
      ? {
          threshold: 1024,
          zlibDeflateOptions: {
            level: Math.max(1, Math.min(9, compressionLevel || 6)),
          },
        }
      : false,
    verifyClient: ({ origin }) => !origins.length || origins.includes(origin),
  });
  const transmit = (ws, json, snapshot = false, byteLength) => {
    if (
      ws.readyState !== WebSocket.OPEN ||
      (snapshot && (ws.bufferedAmount >= 256 * 1024 || ws.snapshotPending))
    ) {
      metrics.add("skippedSends");
      return false;
    }
    const bytes = byteLength ?? Buffer.byteLength(json);
    metrics.add("serializedBytes", bytes);
    if (snapshot) metrics.observe("snapshotBytes", bytes);
    const start = performance.now();
    if (snapshot) ws.snapshotPending = true;
    ws.send(json, () => {
      if (snapshot) ws.snapshotPending = false;
      metrics.observe("sendCompletionMs", performance.now() - start);
    });
    return true;
  };
  const send = (ws, packet) => {
    const start = performance.now();
    const json = JSON.stringify(packet);
    metrics.observe("serializeMs", performance.now() - start);
    return transmit(ws, json, packet.kind === "state");
  };
  function leave(ws) {
    const c = clients.get(ws);
    if (c) {
      metrics.setActive(ws, false);
      c.room?.leave(c.user.id);
      clients.delete(ws);
      if (c.room && !c.room.members.size) rooms.delete(c.room.id);
    }
  }
  wss.on("connection", (ws) => {
    metrics.track(ws);
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));
    let busy = false,
      windowAt = Date.now(),
      messages = 0;
    const authTimeout = setTimeout(() => {
      if (!clients.has(ws)) ws.close(1008, "Lobby request required");
    }, 10000);
    ws.on("message", async (raw) => {
      if (Date.now() - windowAt > 1000) {
        messages = 0;
        windowAt = Date.now();
      }
      if (++messages > 100) return ws.close(1008, "Too many messages");
      try {
        const msg = JSON.parse(raw);
        let c = clients.get(ws);
        if (["browse", "join"].includes(msg.kind)) {
          if (busy) return;
          busy = true;
          if (!MULTIPLAYER_MODES.includes(msg.mode))
            throw new Error("Unknown multiplayer mode");
          if (!c) {
            const guest = msg.guest === true && msg.token == null;
            const guestId = guest ? crypto.randomUUID() : null;
            const user = guest
              ? {
                  id: `guest:${guestId}`,
                  guest: true,
                  user_metadata: {
                    username: `Guest ${guestId.slice(0, 6).toUpperCase()}`,
                  },
                }
              : { ...(await verifyUser(msg.token)), guest: false };
            if (ws.readyState !== WebSocket.OPEN) return;
            if (!user?.id) throw new Error("Sign in to join an online lobby.");
            for (const [other, member] of clients)
              if (member.user.id === user.id) {
                send(other, {
                  kind: "error",
                  message:
                    "This account connected in another browser. Use different accounts to play together.",
                });
                leave(other);
                other.close(1000, "Joined on another connection");
              }
            c = {
              user,
              room: null,
              delta: msg.snapshotCodec === SNAPSHOT_CODEC,
              frameId: 0,
            };
            clients.set(ws, c);
            clearTimeout(authTimeout);
          }
          if (c.room) throw new Error("Leave your current lobby first.");
          if (msg.kind === "browse") {
            send(ws, {
              kind: "directory",
              protocolVersion: LOBBY_PROTOCOL,
              mode: msg.mode,
              rooms: [...rooms.values()]
                .filter((r) => r.mode === msg.mode && r.phase === "lobby")
                .map((r) => ({
                  roomId: r.id,
                  captainName: r.members.get(r.captain)?.name || "Player",
                  humans: r.members.size,
                  capacity: r.capacity,
                })),
            });
          } else {
            const action = msg.action || "auto";
            if (!["auto", "create", "join"].includes(action))
              throw new Error("Unknown lobby action");
            let room =
              action === "join"
                ? rooms.get(msg.roomId)
                : action === "auto"
                  ? [...rooms.values()].find(
                      (r) =>
                        r.mode === msg.mode &&
                        r.phase === "lobby" &&
                        r.members.size < r.capacity,
                    )
                  : null;
            if (
              action === "join" &&
              (!room ||
                room.mode !== msg.mode ||
                room.phase !== "lobby" ||
                room.members.size >= room.capacity)
            )
              throw new Error(
                "That lobby is full or no longer open. Refresh the list or create a lobby.",
              );
            if (!room) {
              if (rooms.size >= maxRooms)
                throw new Error("All rooms are busy. Try again shortly.");
              room = new LobbyRoom(msg.mode);
              rooms.set(room.id, room);
            }
            room.join(
              c.user.id,
              c.user.user_metadata?.username,
              msg.element,
              msg.cosmetics,
              { guest: c.user.guest },
            );
            c.room = room;
            metrics.setActive(ws, true);
            c.frameId = 0;
            if (c.delta)
              send(ws, {
                kind: "identity",
                protocolVersion: LOBBY_PROTOCOL,
                userId: c.user.id,
              });
            else
              send(ws, {
                kind: "state",
                userId: c.user.id,
                ...room.snapshot(),
              });
          }
          busy = false;
          return;
        }
        if (!c) return;
        if (msg.kind === "leave") {
          leave(ws);
          ws.close(1000, "Left lobby");
          return;
        }
        if (msg.kind === "ping") {
          send(ws, { kind: "pong", at: Number(msg.at) || 0 });
          return;
        }
        if (!c.room) return;
        if (msg.kind === "resync" && c.delta) {
          if (!c.lastResync || Date.now() - c.lastResync >= 1000) {
            c.frameId = 0;
            c.lastResync = Date.now();
            metrics.add("resyncs");
          }
          return;
        }
        const result = c.room.command(c.user.id, msg);
        for (const userId of result?.kicked || []) {
          for (const [other, member] of clients) {
            if (member.room === c.room && member.user.id === userId) {
              metrics.setActive(other, false);
              member.room = null;
              send(other, {
                kind: "kicked",
                message:
                  "The captain reduced the player limit and removed you from this lobby. Choose another lobby or create your own.",
              });
            }
          }
        }
      } catch (error) {
        busy = false;
        send(ws, { kind: "error", message: error.message });
      }
    });
    ws.on("close", () => {
      clearTimeout(authTimeout);
      metrics.collect(ws, true);
      leave(ws);
    });
    ws.on("error", () => {});
  });
  let frame = 0,
    last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now(),
      dt = Math.min(0.05, (now - last) / 1000);
    metrics.add(
      "playerSeconds",
      ([...clients.values()].filter((c) => c.room).length * (now - last)) /
        1000,
    );
    metrics.add("roomSeconds", (rooms.size * (now - last)) / 1000);
    last = now;
    const tickStart = performance.now();
    for (const room of rooms.values()) {
      try {
        const combatStart = performance.now();
        room.tick(dt);
        metrics.observe("combatMs", performance.now() - combatStart);
        if (++room.sequence % 3 === 0) {
          const recipients = [...clients].filter(([, c]) => c.room === room);
          const hasDelta = recipients.some(([, c]) => c.delta);
          const packStart = performance.now();
          let graph = graphs.get(room);
          if (hasDelta && !graph)
            graphs.set(room, (graph = new SnapshotGraph()));
          const state = room.snapshot(hasDelta ? graph : null);
          const legacy =
            hasDelta && recipients.some(([, c]) => !c.delta)
              ? room.snapshot()
              : state;
          metrics.observe("packMs", performance.now() - packStart);
          metrics.add("snapshots");
          let encoded;
          if (hasDelta) {
            let encoder = encoders.get(room);
            if (!encoder) encoders.set(room, (encoder = new SnapshotEncoder()));
            const start = performance.now();
            encoded = encoder.encode(state);
            metrics.observe("encodeMs", performance.now() - start);
            encoded.fullBytes = Buffer.byteLength(encoded.full);
            encoded.deltaBytes = Buffer.byteLength(encoded.delta);
            metrics.observe("fullSnapshotBytes", encoded.fullBytes);
          }
          for (const [ws, c] of recipients) {
            if (!c.delta)
              send(ws, { kind: "state", userId: c.user.id, ...legacy });
            else {
              const full =
                c.frameId !== encoded.id - 1 || encoded.delta === encoded.full;
              if (
                transmit(
                  ws,
                  full ? encoded.full : encoded.delta,
                  true,
                  full ? encoded.fullBytes : encoded.deltaBytes,
                )
              ) {
                c.frameId = encoded.id;
                metrics.add(full ? "keyframes" : "deltaFrames");
              }
            }
          }
          room.game.audioEvents = [];
        }
      } catch (error) {
        console.error("Room stopped:", error.message);
        for (const [ws, c] of clients)
          if (c.room === room) {
            send(ws, {
              kind: "error",
              message: "The room stopped. Please rejoin.",
            });
            ws.close(1011);
          }
        rooms.delete(room.id);
      }
    }
    metrics.observe("tickMs", performance.now() - tickStart);
    if (++frame % 600 === 0)
      for (const ws of wss.clients) {
        if (!ws.isAlive) ws.terminate();
        else {
          ws.isAlive = false;
          ws.ping();
        }
      }
  }, 1000 / 30);
  const metricsTimer = diagnostics
    ? setInterval(() => {
        console.log(JSON.stringify({ network: metrics.report() }));
        metrics.reset();
      }, 60000)
    : null;
  metricsTimer?.unref();
  return {
    metrics,
    server,
    wss,
    rooms,
    close: async () => {
      clearInterval(timer);
      clearInterval(metricsTimer);
      metrics.close();
      for (const ws of wss.clients) ws.terminate();
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
    },
  };
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const verifyUser = async (token) => {
    if (!url || !key)
      throw new Error("Account sign-in is not configured on this server.");
    if (typeof token !== "string" || token.length > 4096)
      throw new Error("Sign in required");
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Your session expired. Sign in again.");
    return response.json();
  };
  const app = createLobbyServer({
    verifyUser,
    origins: (
      process.env.ALLOWED_ORIGINS || "https://mcvbeatz.github.io"
    ).split(","),
  });
  app.server.listen(Number(process.env.PORT) || 8080, "0.0.0.0", () =>
    console.log("Fusion Throwdown lobby server ready"),
  );
}
