import { LOBBY_PROTOCOL } from "./multiplayer-protocol.js";
import { LobbyRoom } from "./lobby-room.js";
export class LobbyClient {
  constructor({ url = "", account, onState, onError }) {
    Object.assign(this, { url, account, onState, onError });
    this.closed = false;
  }
  async connect(mode, profile, offline = false) {
    this.mode = mode;
    this.profile = profile;
    if (offline || !this.url || !this.account.user) {
      this.local = true;
      this.userId = this.account.user?.id || "guest";
      this.room = new LobbyRoom(mode);
      this.room.join(
        this.userId,
        this.account.user?.user_metadata?.username || "Guest",
        profile.element,
        profile.cosmetics,
      );
      let frames = 0,
        last = performance.now();
      this.timer = setInterval(() => {
        const now = performance.now();
        this.room.tick(Math.min(0.05, (now - last) / 1000));
        last = now;
        if (++frames % 3 === 0) {
          this.receive({ ...this.room.snapshot(), userId: this.userId });
          this.room.game.audioEvents = [];
        }
      }, 1000 / 30);
      this.receive({ ...this.room.snapshot(), userId: this.userId });
      return;
    }
    const endpoint = new URL(this.url);
    if (
      endpoint.protocol !== "wss:" &&
      !(
        endpoint.protocol === "ws:" &&
        ["localhost", "127.0.0.1"].includes(endpoint.hostname)
      )
    )
      throw new Error("The lobby server needs a secure wss:// address.");
    const { data, error } = await this.account.client.auth.getSession();
    if (error || !data.session)
      throw new Error("Sign in again to join online.");
    if (this.closed) return;
    this.socket = new WebSocket(endpoint.href);
    this.socket.onopen = () =>
      this.send({
        kind: "join",
        mode,
        token: data.session.access_token,
        ...profile,
      });
    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.kind === "error") this.onError(msg.message);
        else if (msg.kind === "state") this.receive(msg);
      } catch {
        this.onError("Could not read the lobby state. Please rejoin.");
      }
    };
    this.socket.onclose = () => {
      if (!this.closed)
        this.onError(
          "Disconnected. Your place is now controlled by AI. Rejoin a lobby to continue.",
        );
    };
    this.socket.onerror = () => {
      if (!this.closed)
        this.onError(
          "The lobby server is unavailable. Retry, or choose an AI-only lobby.",
        );
    };
  }
  receive(state) {
    if (this.closed) return;
    if (state.protocolVersion !== LOBBY_PROTOCOL) {
      this.close();
      this.onError(
        "The lobby server needs the latest update. In Render, deploy the latest commit, then retry.",
      );
      return;
    }
    this.state = state;
    this.userId = state.userId;
    this.receivedAt = performance.now();
    this.onState(state);
  }
  remaining() {
    return this.state?.deadline
      ? Math.max(
          0,
          (this.state.deadline -
            this.state.serverNow -
            (performance.now() - this.receivedAt)) /
            1000,
        )
      : null;
  }
  send(message) {
    if (this.closed) return;
    if (this.local) {
      try {
        this.room.command(this.userId, message);
      } catch (e) {
        this.onError(e.message);
      }
    } else if (this.socket?.readyState === 1)
      this.socket.send(JSON.stringify(message));
  }
  move(x, y) {
    const now = performance.now();
    if (now - (this.lastMove || 0) < 45) return;
    this.lastMove = now;
    this.send({ kind: "move", x, y });
  }
  close() {
    this.send({ kind: "leave" });
    this.closed = true;
    clearInterval(this.timer);
    this.socket?.close();
  }
}
