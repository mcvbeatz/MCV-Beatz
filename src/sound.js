const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));
export class Soundtrack {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.music = null;
    this.timer = null;
    this.note = 0;
    this.scene = null;
    this.paused = false;
    this.track = null;
    this.playPending = false;
    this.playBlocked = false;
    this.trackEnded = false;
    this.primed = false;
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
        this.ambient = this.context.createGain();
        this.ambient.connect(this.music);
        this.timer = setInterval(() => this.playMusic(), 700);
      }
      this.playBlocked = false;
      this.sync();
    } catch {}
  }
  setScene(mode, paused = false, restart = false) {
    if (!restart && this.scene === mode && this.paused === paused) return;
    this.scene = mode;
    this.paused = paused;
    if (restart) {
      this.trackEnded = false;
      if (this.track) this.track.currentTime = 0;
    }
    this.sync();
  }
  primeTrack() {
    // Authorize this media element during the Start tap on iOS, silently, so
    // audible playback can begin at Go rather than during the countdown.
    if (!this.track || this.primed || this.playPending) return;
    this.primed = true;
    this.playPending = true;
    this.track.muted = true;
    this.track
      .play()
      .catch(() => {
        this.primed = false;
      })
      .finally(() => {
        this.track.pause();
        this.track.currentTime = 0;
        this.track.muted = false;
        this.playPending = false;
        this.sync();
      });
  }
  sync() {
    if (!this.context || !this.music) return;
    const corruption = this.scene === "corruption";
    const active = !this.paused && !document.hidden;
    this.ambient.gain.value = corruption || !active ? 0 : 1;
    if (corruption && !this.track) {
      this.track = new Audio(
        new URL("./assets/music/no-escape.mp3", import.meta.url).href,
      );
      this.track.loop = false;
      // Original duration is 117.048s: 0.9754x fills the 120s match (~2.5% slower).
      this.track.playbackRate = 117.048 / 120;
      this.track.preservesPitch = true;
      this.track.webkitPreservesPitch = true;
      this.track.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(this.track.duration) && this.track.duration > 0)
          this.track.playbackRate = this.track.duration / 120;
      });
      this.track.addEventListener("ended", () => {
        this.trackEnded = true;
      });
      this.track.preload = "metadata";
      // iOS ignores HTMLMediaElement.volume; route the song through the same
      // Web Audio music gain as the ambient score, separate from SFX.
      this.trackSource = this.context.createMediaElementSource(this.track);
      this.trackSource.connect(this.music);
    }
    if (!this.track) return;
    if (!corruption || !active || !this.settings.music) {
      this.track.pause();
      return;
    }
    if (
      this.track.paused &&
      !this.trackEnded &&
      !this.playPending &&
      !this.playBlocked
    ) {
      this.playPending = true;
      this.track
        .play()
        .catch(() => {
          // A fresh user gesture retries if the browser refused autoplay.
          this.playBlocked = true;
        })
        .finally(() => {
          this.playPending = false;
          if (
            this.scene !== "corruption" ||
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
    if (kind === "music" && this.music)
      this.music.gain.setTargetAtTime(
        this.settings.music,
        this.context.currentTime,
        0.1,
      );
    this.sync();
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
  playMusic() {
    if (
      !this.context ||
      document.hidden ||
      this.paused ||
      this.scene === "corruption" ||
      !this.settings.music
    )
      return;
    const notes = [130.81, 196, 261.63, 164.81, 220, 196, 146.83, 196];
    this.voice(notes[this.note++ % notes.length], 1.2, 0.025, this.ambient);
  }
}
