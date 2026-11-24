import {
  MovementPrediction,
  MOVEMENT_PREDICTION,
  predictionRequested,
} from "./movement-prediction.js";
import { SNAPSHOT_CODEC, SnapshotDecoder } from "./snapshot-delta.js";
import { ClientNetworkDiagnostics } from "./network-diagnostics.js";
import { LOBBY_PROTOCOL } from "./multiplayer-protocol.js";
import { LobbyRoom } from "./lobby-room.js";
export class LobbyClient {
  constructor({ url = "", account, onState, onError, onDirectory, onKicked }) {
    Object.assign(this, {
      url,
      account,
      onState,
      onError,
      onDirectory,
      onKicked,
    });
    this.closed = false;
    this.decoder = new SnapshotDecoder();
    this.diagnostics = new ClientNetworkDiagnostics();
    this.prediction = new MovementPrediction(this.diagnostics);
  }
  async connect(
    mode,
    profile,
    offline = false,
    { action = "auto", roomId } = {},
  ) {
    this.mode = mode;
    this.profile = profile;
    if (offline) {
      this.local = true;
      if (action === "browse") {
        this.onDirectory?.({ mode, rooms: [], local: true });
        return;
      }
      this.userId = this.account.user?.id || "guest";
      this.room = new LobbyRoom(mode);
      this.room.join(
        this.userId,
        this.account.user?.user_metadata?.username || "Guest",
        profile.element,
        profile.cosmetics,
        { guest: !this.account.user },
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
    if (!this.url) throw new Error("The lobby server is not configured yet.");
    const endpoint = new URL(this.url);
    if (
      endpoint.protocol !== "wss:" &&
      !(
        endpoint.protocol === "ws:" &&
        ["localhost", "127.0.0.1"].includes(endpoint.hostname)
      )
    )
      throw new Error("The lobby server needs a secure wss:// address.");
    let token;
    const guest = !this.account.user;
    if (!guest) {
      const { data, error } = await this.account.client.auth.getSession();
      if (error || !data.session)
        throw new Error("Sign in again to join online.");
      token = data.session.access_token;
    }
    if (this.closed) return;
    this.socket = new WebSocket(endpoint.href);
    this.socket.onopen = () =>
      this.send({
        kind: action === "browse" ? "browse" : "join",
        action,
        roomId,
        mode,
        token,
        guest,
        snapshotCodec: SNAPSHOT_CODEC,
        movementPrediction: !predictionRequested()
          ? undefined
          : MOVEMENT_PREDICTION,
        ...profile,
      });
    this.socket.onmessage = (event) => {
      if (this.closed) return;
      const start = performance.now();
      try {
        const msg = JSON.parse(event.data);
        if (msg.kind === "pong") {
          this.diagnostics.observe("roundTripMs", performance.now() - msg.at);
          return;
        }
        if (msg.kind === "identity") {
          if (!this.checkProtocol(msg)) return;
          this.userId = msg.userId;
          this.prediction.enabled =
            msg.movementPrediction === MOVEMENT_PREDICTION &&
            predictionRequested();
          this.prediction.clear();
          this.decoder.reset();
          this.lastResync = null;
          return;
        }
        if (msg.kind === "snapshot") {
          const state = this.decoder.receive(msg);
          if (!state) {
            if (
              msg.id > this.decoder.id &&
              (!this.lastResync || performance.now() - this.lastResync >= 1000)
            ) {
              this.lastResync = performance.now();
              this.diagnostics.resyncs++;
              this.send({ kind: "resync" });
            }
            return;
          }
          this.diagnostics.snapshot(
            new TextEncoder().encode(event.data).length,
          );
          this.acceptState({ ...state, userId: this.userId });
          return;
        }
        if (msg.kind === "error") this.onError(msg.message);
        else if (msg.kind === "kicked") {
          this.onKicked?.(msg.message);
        } else if (["directory", "state"].includes(msg.kind)) {
          if (!this.checkProtocol(msg)) return;
          if (msg.kind === "directory") {
            this.onDirectory?.(msg);
            this.directoryTimer ??= setInterval(() => this.refresh(), 2500);
          } else {
            this.diagnostics.snapshot(
              new TextEncoder().encode(event.data).length,
            );
            this.acceptState(msg);
          }
        }
      } catch {
        this.onError("Could not read the lobby state. Please rejoin.");
      } finally {
        this.diagnostics.observe("receiveMs", performance.now() - start);
      }
    };
    this.socket.onclose = (event) => {
      this.prediction.clear();
      clearInterval(this.pingTimer);
      clearInterval(this.directoryTimer);
      this.directoryTimer = null;
      if (!this.closed)
        this.onError(
          event.reason === "Joined on another connection"
            ? "This account connected in another browser. Use different accounts to play together."
            : this.state
              ? "Disconnected. Your place is now controlled by AI. Rejoin a lobby to continue."
              : "Could not open the lobby directory. Retry, and make sure the latest server update is deployed on Render.",
        );
    };
    this.socket.onerror = () => {
      if (!this.closed)
        this.onError("The lobby server is unavailable. Please retry.");
    };
  }
  acceptState(state) {
    clearInterval(this.directoryTimer);
    this.directoryTimer = null;
    this.receive(state);
    if (this.closed) return;
    this.pingTimer ??= setInterval(
      () => this.send({ kind: "ping", at: performance.now() }),
      5000,
    );
  }
  checkProtocol(state) {
    if (state.protocolVersion !== LOBBY_PROTOCOL) {
      this.close();
      this.onError(
        "The lobby server needs the latest update. In Render, deploy the latest commit, then retry.",
      );
      return false;
    }
    return true;
  }
  refresh() {
    if (!this.state) this.send({ kind: "browse", mode: this.mode });
  }
  joinRoom(roomId = null) {
    this.send({
      kind: "join",
      action: roomId ? "join" : "create",
      roomId,
      mode: this.mode,
      ...this.profile,
    });
  }
  receive(state) {
    if (this.closed || !this.checkProtocol(state)) return;
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
    if (message.kind === "neutral") this.prediction.clear();
    if (this.local) {
      try {
        this.room?.command(this.userId, message);
      } catch (e) {
        this.onError(e.message);
      }
    } else if (this.socket?.readyState === 1)
      this.socket.send(JSON.stringify(message));
  }
  move(x, y, dt = 0) {
    const now = performance.now();
    if ((x || y) && !(this.previousInput?.x || this.previousInput?.y))
      this.diagnostics.armMovement();
    this.previousInput = { x, y };
    const predict = this.prediction.enabled;
    if (predict) this.prediction.setInput(x, y);
    const released =
      x === 0 && y === 0 && (this.lastVector?.x || this.lastVector?.y);
    if (now - (this.lastMove || 0) >= 45 || released) {
      this.lastMove = now;
      this.lastVector = { x, y };
      this.send({
        kind: "move",
        ...(predict ? this.prediction.command() : { x, y }),
      });
    }
    if (predict) this.prediction.advance(dt, now);
  }
  close() {
    this.send({ kind: "leave" });
    this.closed = true;
    this.prediction.clear();
    clearInterval(this.timer);
    clearInterval(this.pingTimer);
    clearInterval(this.directoryTimer);
    this.socket?.close();
  }
}
