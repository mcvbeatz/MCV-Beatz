import {
  acceptMovement,
  neutralMovement,
  acknowledgeMovement,
} from "./movement-ack.js";
import { TEAM_LOBBY_MODES, lobbyTeam, lobbyTeamCounts } from "./lobby-teams.js";
import { Combat, makeFighter } from "./combat.js";
import { beginStatistics } from "./match-statistics.js";
import { BASE_FORMS } from "./player-preferences.js";
import { MULTIPLAYER_MODES } from "./mode-catalog.js";
import {
  LOBBY_PROTOCOL,
  lobbySizes,
  forcedLobbyElement,
  packGame,
  RESULTS_SECONDS,
  START_SECONDS,
} from "./multiplayer-protocol.js";
import { cosmeticCatalog } from "./rewards.js";
import { control } from "./multiplayer-controls.js";
const cleanCosmetics = (value) =>
  Object.fromEntries(
    Object.entries(value || {}).filter(([slot, id]) =>
      cosmeticCatalog().some((c) => c.slot === slot && c.id === id),
    ),
  );
export class LobbyRoom {
  constructor(mode, { now = () => Date.now(), id = crypto.randomUUID() } = {}) {
    if (!MULTIPLAYER_MODES.includes(mode))
      throw new Error("Unknown multiplayer mode");
    this.id = id;
    this.mode = mode;
    this.now = now;
    this.members = new Map();
    this.order = 0;
    this.capacity = lobbySizes(mode).at(-1);
    this.phase = "lobby";
    this.deadline = null;
    this.roundId = null;
    this.sequence = 0;
    this.createLobby();
  }
  get captain() {
    return (
      [...this.members.values()].sort((a, b) => a.order - b.order)[0]?.id ||
      null
    );
  }
  memberElement(m) {
    if (this.mode === "war") {
      const captain = this.members.get(this.captain);
      const captainSide = (captain?.seat || 0) % 2;
      return m.seat % 2 === captainSide
        ? captain?.element || "fire"
        : this.warEnemy || "water";
    }
    return forcedLobbyElement(this.mode) || m.element;
  }
  refreshWar() {
    if (this.mode !== "war") return;
    const army = this.members.get(this.captain)?.element || "fire";
    if (!this.warEnemy || this.warEnemy === army) {
      const pool = BASE_FORMS.filter((e) => e !== army);
      this.warEnemy = pool[Math.floor(Math.random() * pool.length)];
    }
    if (["lobby", "countdown"].includes(this.phase)) {
      this.game.fighters.forEach((a, seat) =>
        Object.assign(
          a,
          makeFighter(
            a.id,
            this.memberElement({ seat }),
            lobbyTeam(this.mode, seat) ?? 0,
            a.x,
            a.y,
          ),
        ),
      );
      for (const m of this.members.values()) this.applyMember(m);
    }
  }
  createLobby() {
    this.game = new Combat({ mode: "duel", mapId: "classic" });
    this.game.lobby = true;
    this.game.fighters = Array.from({ length: this.capacity }, (_, i) =>
      makeFighter(
        `seat-${i}`,
        forcedLobbyElement(this.mode) || BASE_FORMS[i % 6],
        lobbyTeam(this.mode, i) ?? 0,
        220 + (i % 5) * 145,
        260 + Math.floor(i / 5) * 155,
      ),
    );
    this.game.fighters.forEach((a, i) => (a.displayName = `AI ${i + 1}`));
    this.game.player = this.game.fighters[0];
    this.game.humanInputs = new Map();
    this.phase = "lobby";
    this.deadline = null;
    for (const m of this.members.values()) {
      m.ready = false;
      this.applyMember(m);
    }
    this.refreshWar();
  }
  applyMember(m) {
    const a = this.game.fighters[m.seat];
    if (!a) return;
    a.displayName = m.name;
    a.cosmetics = m.cosmetics || {};
    if (this.phase === "lobby" || this.phase === "countdown")
      Object.assign(
        a,
        makeFighter(
          a.id,
          this.memberElement(m),
          lobbyTeam(this.mode, m.seat) ?? 0,
          a.x,
          a.y,
        ),
        {
          displayName: m.name,
          cosmetics: m.cosmetics || {},
          lobbyReady: !!m.ready,
        },
      );
  }
  join(id, name, element = "fire", cosmetics = {}, { guest = false } = {}) {
    if (this.members.has(id)) return this.members.get(id);
    if (this.phase !== "lobby" || this.members.size >= this.capacity)
      throw new Error("This lobby is full or its round has started.");
    const used = new Set([...this.members.values()].map((m) => m.seat));
    let seat = 0;
    while (used.has(seat)) seat++;
    const member = {
      id,
      guest,
      name: String(name || "Player").slice(0, 24),
      element: BASE_FORMS.includes(element) ? element : "fire",
      cosmetics: cleanCosmetics(cosmetics),
      seat,
      order: this.order++,
      ready: false,
      input: { x: 0, y: 0 },
      lastInput: this.now(),
    };
    this.members.set(id, member);
    this.applyMember(member);
    this.refreshWar();
    return member;
  }
  leave(id) {
    const m = this.members.get(id);
    if (!m) return;
    this.members.delete(id);
    const actor = ["lobby", "countdown"].includes(this.phase)
      ? this.game.fighters[m.seat]
      : this.game.fighters.find((a) => a.id === m.actorId);
    if (actor) {
      actor.displayName = `AI ${m.seat + 1}`;
      actor.cosmetics = {};
      actor.lobbyReady = false;
    }
    this.game.humanInputs?.delete(actor?.id);
    if (
      this.phase === "battle" &&
      this.game.player.id === m.actorId &&
      this.captain
    ) {
      const next = this.game.fighters.find(
        (a) => a.id === this.members.get(this.captain).actorId,
      );
      if (next) {
        this.game.player = next;
        this.game.matchStats = this.game.sessionActors.get(next.id).stats;
      }
    }
    this.refreshWar();
    // Countdown cancellation prevents a new captain inheriting an unexpected start.
    if (this.phase === "countdown") {
      this.phase = "lobby";
      this.deadline = null;
    }
  }
  command(id, message) {
    const m = this.members.get(id);
    if (!m) return;
    const a =
      this.game.fighters.find((a) => a.id === m.actorId) ||
      this.game.fighters[m.seat];
    if (message.kind === "neutral") {
      neutralMovement(m);
      m.input = { x: 0, y: 0 };
      m.lastInput = 0;
      if (a) {
        a.charging = false;
        a.charge = 0;
        this.game.utility(a, false);
      }
      return;
    }
    if (message.kind === "move") {
      if (!acceptMovement(m, message)) return;
      m.input = {
        x: Math.max(-1, Math.min(1, Number(message.x) || 0)),
        y: Math.max(-1, Math.min(1, Number(message.y) || 0)),
      };
      m.lastInput = this.now();
      return;
    }
    if (message.kind === "team") {
      if (
        this.phase !== "lobby" ||
        !TEAM_LOBBY_MODES.has(this.mode) ||
        ![0, 1].includes(message.team)
      )
        return;
      if (m.seat % 2 === message.team) return;
      const used = new Set(
        [...this.members.values()].map((member) => member.seat),
      );
      const seat = Array.from({ length: this.capacity }, (_, i) => i).find(
        (i) => i % 2 === message.team && !used.has(i),
      );
      if (seat === undefined) throw new Error("That team is full.");
      const oldSeat = m.seat,
        old = this.game.fighters[oldSeat];
      Object.assign(
        old,
        makeFighter(
          old.id,
          this.memberElement({
            seat: oldSeat,
            element: BASE_FORMS[oldSeat % 6],
          }),
          oldSeat % 2,
          old.x,
          old.y,
        ),
        { displayName: `AI ${oldSeat + 1}`, cosmetics: {}, lobbyReady: false },
      );
      m.seat = seat;
      m.ready = false;
      m.input = { x: 0, y: 0 };
      m.lastInput = 0;
      this.applyMember(m);
      this.refreshWar();
      return;
    }
    if (message.kind === "profile" && this.phase === "lobby") {
      if (
        !forcedLobbyElement(this.mode) &&
        (this.mode !== "war" || id === this.captain) &&
        BASE_FORMS.includes(message.element)
      ) {
        if (m.element !== message.element) m.ready = false;
        m.element = message.element;
      }
      if (message.cosmetics && typeof message.cosmetics === "object")
        m.cosmetics = cleanCosmetics(message.cosmetics);
      this.applyMember(m);
      this.refreshWar();
      return;
    }
    if (
      message.kind === "size" &&
      id === this.captain &&
      this.phase === "lobby"
    ) {
      if (!lobbySizes(this.mode).includes(message.size))
        throw new Error("Choose a supported player limit.");
      const excess = Math.max(0, this.members.size - message.size);
      const kick = message.kick ?? [];
      if (
        !Array.isArray(kick) ||
        kick.length !== excess ||
        new Set(kick).size !== excess ||
        kick.some((userId) => userId === id || !this.members.has(userId))
      )
        throw new Error(
          `Choose exactly ${excess} other players to remove, or choose a higher limit. The lobby has not changed.`,
        );
      const retained = [...this.members.values()].filter(
        (member) => !kick.includes(member.id),
      );
      for (const team of lobbyTeamCounts(this.mode, message.size, retained))
        if (team.users > team.capacity)
          throw new Error(
            `${team.name} has too many players for that limit. Choose a higher limit or switch teams first.`,
          );
      // Validate the entire change before removing anyone or reassigning seats.
      for (const userId of kick) this.leave(userId);
      this.capacity = message.size;
      const nextSeat = [0, 1];
      [...this.members.values()]
        .sort((a, b) => a.order - b.order)
        .forEach((m, i) => {
          if (TEAM_LOBBY_MODES.has(this.mode)) {
            const team = m.seat % 2;
            m.seat = nextSeat[team];
            nextSeat[team] += 2;
          } else m.seat = i;
        });
      this.createLobby();
      return { kicked: kick };
    }
    if (
      message.kind === "start" &&
      id !== this.captain &&
      this.phase === "lobby"
    ) {
      m.ready = true;
      this.applyMember(m);
      return;
    }
    if (
      message.kind === "start" &&
      id === this.captain &&
      this.phase === "lobby"
    ) {
      this.phase = "countdown";
      this.preparedGame = this.buildBattle();
      this.deadline = this.now() + START_SECONDS * 1000;
      return;
    }
    if (this.phase === "battle" && a) {
      if (message.kind === "reward" && id !== this.captain) return;
      control(this.game, a, message);
    }
  }
  buildBattle() {
    const captain = this.members.get(this.captain);
    return new Combat({
      mode: this.mode,
      element:
        this.mode === "war"
          ? this.memberElement({ seat: 0 })
          : captain?.element || "fire",
      enemyElement:
        this.mode === "war"
          ? this.memberElement({ seat: this.capacity - 1 })
          : undefined,
      size: this.mode === "gauntlet-team" ? this.capacity : this.capacity / 2,
      players: this.capacity,
      countdown: true,
    });
  }
  startBattle() {
    this.game = this.preparedGame || this.buildBattle();
    this.preparedGame = null;
    // The shared five-second lobby countdown has already completed.
    this.game.countdown = 0;
    let roster =
      this.mode === "zombies" || this.mode === "gauntlet-team"
        ? this.game.fighters.filter((a) => a.team === 0)
        : this.game.fighters;
    if (TEAM_LOBBY_MODES.has(this.mode)) {
      const jade = roster.filter((a) => a.team === 0),
        ember = roster.filter((a) => a.team === 1);
      roster = jade.flatMap((a, i) => [a, ember[i]]);
    }
    roster.forEach((a, i) => (a.displayName = `AI ${i + 1}`));
    this.seatIds = roster.map((a) => a.id);
    for (const m of this.members.values()) {
      const a = roster[m.seat];
      if (!a) continue;
      m.actorId = a.id;
      m.matchId = crypto.randomUUID();
      if (
        !["gridiron", "turnpike", "corruption", "zombies", "war"].includes(
          this.mode,
        ) &&
        a.element !== "invincible"
      ) {
        const fresh = makeFighter(a.id, m.element, a.team, a.x, a.y);
        Object.assign(a, fresh, {
          spawn: { x: a.x, y: a.y, element: m.element },
          kills: 0,
          deaths: 0,
        });
      }
      a.displayName = m.name;
      a.cosmetics = m.cosmetics;
    }
    this.game.player = roster[this.members.get(this.captain)?.seat || 0];
    beginStatistics(this.game);
    this.game.humanInputs = new Map();
    this.phase = "battle";
    this.roundId = crypto.randomUUID();
    this.deadline = null;
    this.sequence++;
  }
  tick(dt) {
    const now = this.now(),
      g = this.game;
    if (this.phase === "countdown" && now >= this.deadline) {
      this.startBattle();
      return;
    }
    if (this.phase === "results" && now >= this.deadline) {
      this.preparedGame = null;
      this.createLobby();
      return;
    }
    g.humanInputs = new Map();
    for (const m of this.members.values()) {
      const a =
        this.phase === "lobby" || this.phase === "countdown"
          ? g.fighters[m.seat]
          : g.fighters.find((a) => a.id === m.actorId);
      if (a) {
        a.aiControlled = false;
        if (now - m.lastInput > 500) {
          a.charging = false;
          a.charge = 0;
          g.utility(a, false);
        }
        g.humanInputs.set(
          a.id,
          now - m.lastInput > 500 ? { x: 0, y: 0 } : m.input,
        );
      }
    }
    if (this.phase === "lobby" || this.phase === "countdown") {
      g.time += dt;
      for (const [i, a] of g.fighters.entries()) {
        const input = g.humanInputs.get(a.id);
        g.move(
          a,
          input?.x ?? Math.cos(g.time * 0.55 + i) * 0.25,
          input?.y ?? Math.sin(g.time * 0.45 + i) * 0.25,
          dt,
        );
      }
    } else if (this.phase === "battle") {
      if (!g.finished) g.update(dt, { x: 0, y: 0 });
      else {
        g.advanceCelebration(dt);
        if (!g.celebrationRemaining) {
          this.phase = "results";
          this.deadline = now + RESULTS_SECONDS * 1000;
        }
      }
    }
    acknowledgeMovement(this, dt);
  }
  snapshot(graph = null) {
    return {
      protocolVersion: LOBBY_PROTOCOL,
      roomId: this.id,
      mode: this.mode,
      nextMapId: this.preparedGame?.mapId,
      capacity: this.capacity,
      teams: lobbyTeamCounts(this.mode, this.capacity, this.members.values()),
      phase: this.phase,
      captain: this.captain,
      deadline: this.deadline,
      serverNow: this.now(),
      roundId: this.roundId,
      sequence: this.sequence,
      members: [...this.members.values()].map(
        ({ input, lastInput, moveState, ...m }) => ({
          ...m,
          team: lobbyTeam(this.mode, m.seat),
          element: this.memberElement(m),
          elementLocked:
            !!forcedLobbyElement(this.mode) ||
            (this.mode === "war" && m.id !== this.captain),
        }),
      ),
      game: packGame(this.game, graph),
    };
  }
}
