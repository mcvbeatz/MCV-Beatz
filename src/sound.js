const clamp = (n) => Math.max(0, Math.min(1, Number(n) || 0));
export class Soundtrack {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.music = null;
    this.timer = null;
    this.note = 0;
  }
  unlock() {
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      this.context.resume().catch(() => {});
      if (!this.music) {
        this.music = this.context.createGain();
        this.music.connect(this.context.destination);
        this.music.gain.value = this.settings.music;
        this.timer = setInterval(() => this.playMusic(), 700);
      }
    } catch {}
  }
  volume(kind, value) {
    this.settings[kind] = clamp(value);
    if (kind === "music" && this.music)
      this.music.gain.setTargetAtTime(
        this.settings.music,
        this.context.currentTime,
        0.1,
      );
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
    if (!this.context || document.hidden || !this.settings.music) return;
    const notes = [130.81, 196, 261.63, 164.81, 220, 196, 146.83, 196];
    this.voice(notes[this.note++ % notes.length], 1.2, 0.025, this.music);
  }
}
