import { BattlePlaylist, TRACK_URLS } from "./music-catalog.js";
import { CombatSfx } from "./combat-sfx.js";
const SCENE_TRACKS = {
  corruption: "no-escape",
  war: "dont-let-up",
  volcano: "no-smoke",
  victory: "a-win-is-a-win",
  defeat: "downcast",
};
const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));
export class Soundtrack {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.music = null;
    this.scene = null;
    this.paused = false;
    this.track = null;
    this.trackId = null;
    this.desiredTrackId = null;
    this.trackGeneration = 0;
    this.playlist = new BattlePlaylist();
    this.battleTrackId = null;
    this.preparedBattleTrackId = null;
    this.warMapPreload = null;
    this.menuBuffer = null;
    this.menuLoading = null;
    this.menuSource = null;
    this.menuOffset = 0;
    this.menuStartedAt = 0;
    this.playPending = false;
    this.playBlocked = false;
    this.trackEnded = false;
    document.addEventListener("visibilitychange", () => this.sync());
  }
  unlock() {
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
      if (!this.music) {
        this.music = this.context.createGain();
        this.music.connect(this.context.destination);
        this.music.gain.value = this.settings.music;
      }
      this.sfx ||= new CombatSfx(this.context, this.settings.sfx);
      this.playBlocked = false;
      this.sync();
    } catch {}
  }
  setScene(mode, paused = false, restart = false) {
    if (!restart && this.scene === mode && this.paused === paused) return;
    if (mode === "battle" && (restart || !this.battleTrackId))
      this.battleTrackId = this.preparedBattleTrackId || this.playlist.next();
    if (restart && mode === "battle") this.preparedBattleTrackId = null;
    this.scene = mode;
    this.paused = paused;
    this.desiredTrackId =
      mode === "battle" ? this.battleTrackId : SCENE_TRACKS[mode] || null;
    if (restart) {
      this.trackEnded = false;
      if (this.track) this.track.currentTime = 0;
    }
    this.sync();
  }
  prepareBattle(mode) {
    // Reserve the exact shuffled song that Start will play, rather than choosing
    // another after the countdown is already visible. Loading remains silent.
    const scene = mode === "corruption" || mode === "war" ? mode : "battle";
    const id =
      scene === "battle"
        ? (this.preparedBattleTrackId ||= this.playlist.next())
        : SCENE_TRACKS[scene];
    this.prepareTrack(id);
    if (mode === "war" && !this.warMapPreload) {
      // War's opponent/map is rolled at Start; warm the volcanic exception too.
      // Playback still uses the single user-authorized media element.
      this.warMapPreload = new Audio(TRACK_URLS["no-smoke"]);
      this.warMapPreload.preload = "auto";
      this.warMapPreload.load();
    }
  }
  prepareTrack(id = "no-escape") {
    if (!this.track) {
      // Reuse one user-authorized media element for battles and results so a
      // win/loss transition can play without another tap, including on iOS.
      this.track = new Audio();
      this.track.playbackRate = 1;
      this.track.preservesPitch = false;
      this.track.webkitPreservesPitch = false;
      this.track.addEventListener("ended", () => {
        if (!this.track.ended) return;
        this.trackEnded = true;
        if (this.scene === "battle") {
          this.battleTrackId = this.playlist.next();
          this.desiredTrackId = this.battleTrackId;
          this.sync();
        }
      });
      this.track.preload = "auto";
    }
    if (this.trackId !== id) {
      this.track.pause();
      this.trackGeneration++;
      this.trackId = id;
      this.trackEnded = false;
      this.playBlocked = false;
      this.playPending = false;
      this.track.src = TRACK_URLS[id];
      this.track.loop = ["no-smoke", "a-win-is-a-win", "downcast"].includes(id);
      this.track.load();
    }
    if (this.context && this.music && !this.trackSource) {
      this.trackSource = this.context.createMediaElementSource(this.track);
      this.trackGain = this.context.createGain();
      this.trackSource.connect(this.trackGain);
      this.trackGain.connect(this.music);
    }
    if (this.trackGain)
      this.trackGain.gain.value =
        id === "a-win-is-a-win" ? 0.75 * 0.85 : id === "dont-let-up" ? 0.9 : 1;
  }
  prepareMenu() {
    if (!this.context || this.menuBuffer || this.menuLoading) return;
    this.menuLoading = fetch(
      new URL("./assets/music/solace.mp3", import.meta.url).href,
    )
      .then((response) => {
        if (!response.ok) throw new Error("Menu music could not load");
        return response.arrayBuffer();
      })
      .then((data) => this.context.decodeAudioData(data))
      .then((buffer) => {
        this.menuBuffer = buffer;
        this.sync();
      })
      .catch(() => {
        // Retry on the next gesture or scene change, without a retry loop.
        this.menuLoading = null;
      });
  }
  menuPosition() {
    if (!this.menuBuffer) return 0;
    const elapsed = this.menuSource
      ? this.context.currentTime - this.menuStartedAt
      : 0;
    return (this.menuOffset + elapsed) % this.menuBuffer.duration;
  }
  stopMenu() {
    if (!this.menuSource) return;
    this.menuOffset = this.menuPosition();
    this.menuSource.stop();
    this.menuSource.disconnect();
    this.menuSource = null;
  }
  syncMenu(active) {
    if (!active) return this.stopMenu();
    this.prepareMenu();
    if (!this.menuBuffer || this.menuSource) return;
    const source = this.context.createBufferSource();
    source.buffer = this.menuBuffer;
    // The audio engine wraps at the buffer boundary with no replay callback,
    // network request, timer delay, or extra silence between repetitions.
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = this.menuBuffer.duration;
    source.connect(this.music);
    this.menuStartedAt = this.context.currentTime;
    this.menuSource = source;
    source.start(0, this.menuOffset);
  }
  sync() {
    if (
      this.paused ||
      document.hidden ||
      !this.settings.sfx ||
      ["menu", "victory", "defeat", "draw"].includes(this.scene)
    )
      this.sfx?.stop();
    if (!this.context || !this.music) return;
    const active = !this.paused && !document.hidden && this.settings.music > 0;
    this.syncMenu(this.scene === "menu" && active);
    if (this.desiredTrackId) this.prepareTrack(this.desiredTrackId);
    if (!this.track) return;
    if (!this.desiredTrackId || !active) {
      this.track.pause();
      return;
    }
    if (
      this.track.paused &&
      !this.trackEnded &&
      !this.playPending &&
      !this.playBlocked
    ) {
      const generation = this.trackGeneration;
      this.playPending = true;
      this.track
        .play()
        .catch(() => {
          if (generation === this.trackGeneration) this.playBlocked = true;
        })
        .finally(() => {
          // An aborted play from the previous file must not block or pause
          // the newer result/battle track on this shared media element.
          if (generation !== this.trackGeneration) return;
          this.playPending = false;
          if (
            !this.desiredTrackId ||
            this.paused ||
            document.hidden ||
            !this.settings.music
          )
            this.track.pause();
        });
    }
  }
  volume(kind, value) {
    this.settings[kind] = clamp(value);
    if (kind === "sfx") this.sfx?.volume(this.settings.sfx);
    if (kind === "music" && this.music)
      this.music.gain.setTargetAtTime(
        this.settings.music,
        this.context.currentTime,
        0.1,
      );
    this.sync();
  }
  combat(game, active) {
    const events = game.audioEvents?.splice(0) || [];
    if (!active || game.finished || document.hidden || !this.settings.sfx) {
      this.sfx?.stop();
      return;
    }
    const listener = game.spectatorFocus || game.player;
    for (const event of events) {
      if (
        event.kind === "token" &&
        !event.neutral &&
        game.mode !== "ffa" &&
        event.team !== game.player.team
      )
        continue;
      const distance = Math.hypot(event.x - listener.x, event.y - listener.y);
      if (distance > 650) continue;
      this.sfx?.play(event.kind, {
        gain: 1 - distance / 800,
        pan: (event.x - listener.x) / 700,
      });
    }
  }
  tone(frequency = 180) {
    if (!this.settings.sfx) return;
    this.unlock();
    if (!this.context) return;
    this.voice(
      frequency,
      0.12,
      this.settings.sfx * 0.06,
      this.context.destination,
      "triangle",
    );
  }
  voice(freq, length, volume, destination, type = "sine") {
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume),
      c.currentTime + 0.025,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + length);
    o.connect(g);
    g.connect(destination);
    o.start();
    o.stop(c.currentTime + length + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
}
