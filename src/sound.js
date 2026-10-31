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
  prepareTrack() {
    // Fetch the unchanged recording during setup, before the countdown tap.
    if (!this.track) {
      this.track = new Audio(
        new URL("./assets/music/no-escape.mp3", import.meta.url).href,
      );
      this.track.loop = false;
      this.track.playbackRate = 1;
      this.track.preservesPitch = false;
      this.track.webkitPreservesPitch = false;
      this.track.addEventListener("ended", () => {
        this.trackEnded = true;
      });
      this.track.preload = "auto";
      this.track.load();
    }
    if (this.context && this.music && !this.trackSource) {
      // iOS ignores HTMLMediaElement.volume; keep the independent music gain.
      this.trackSource = this.context.createMediaElementSource(this.track);
      this.trackSource.connect(this.music);
    }
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
    if (!this.context || !this.music) return;
    const corruption = this.scene === "corruption";
    const active = !this.paused && !document.hidden;
    const menu = this.scene === "menu";
    this.ambient.gain.value = corruption || menu || !active ? 0 : 1;
    this.syncMenu(menu && active && this.settings.music > 0);
    if (corruption) this.prepareTrack();
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
      ["corruption", "menu", "loading"].includes(this.scene) ||
      !this.settings.music
    )
      return;
    const notes = [130.81, 196, 261.63, 164.81, 220, 196, 146.83, 196];
    this.voice(notes[this.note++ % notes.length], 1.2, 0.025, this.ambient);
  }
}
