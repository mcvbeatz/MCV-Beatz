import { LOBBY_PROTOCOL } from "../src/multiplayer-protocol.js";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { MULTIPLAYER_MODES } from "../src/mode-catalog.js";
import { LobbyRoom } from "../src/lobby-room.js";
export function createLobbyServer({
  verifyUser,
  origins = [],
  maxRooms = 12,
} = {}) {
  const rooms = new Map(),
    clients = new Map();
  const server = http.createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 404, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        ok: req.url === "/health",
        rooms: rooms.size,
        protocolVersion: LOBBY_PROTOCOL,
      }),
    );
  });
  const wss = new WebSocketServer({
    server,
    maxPayload: 8192,
    perMessageDeflate: { threshold: 1024 },
    verifyClient: ({ origin }) => !origins.length || origins.includes(origin),
  });
  const send = (ws, p) => {
    if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 1024 * 1024)
      ws.send(JSON.stringify(p));
  };
  function leave(ws) {
    const c = clients.get(ws);
    if (c) {
      c.room?.leave(c.user.id);
      clients.delete(ws);
      if (c.room && !c.room.members.size) rooms.delete(c.room.id);
    }
  }
  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));
    let busy = false,
      windowAt = Date.now(),
      messages = 0;
    const authTimeout = setTimeout(() => {
      if (!clients.has(ws)) ws.close(1008, "Sign in required");
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
            const user = await verifyUser(msg.token);
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
            c = { user, room: null };
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
            );
            c.room = room;
            send(ws, { kind: "state", userId: c.user.id, ...room.snapshot() });
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
        if (!c.room) return;
        const result = c.room.command(c.user.id, msg);
        for (const userId of result?.kicked || []) {
          for (const [other, member] of clients) {
            if (member.room === c.room && member.user.id === userId) {
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
      leave(ws);
    });
    ws.on("error", () => {});
  });
  let frame = 0,
    last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now(),
      dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const room of rooms.values()) {
      try {
        room.tick(dt);
        if (++room.sequence % 3 === 0) {
          const state = room.snapshot();
          for (const [ws, c] of clients)
            if (c.room === room)
              send(ws, { kind: "state", userId: c.user.id, ...state });
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
    if (++frame % 600 === 0)
      for (const ws of wss.clients) {
        if (!ws.isAlive) ws.terminate();
        else {
          ws.isAlive = false;
          ws.ping();
        }
      }
  }, 1000 / 30);
  return {
    server,
    wss,
    rooms,
    close: async () => {
      clearInterval(timer);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
    },
  };
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  const verifyUser = async (token) => {
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
