// Short synthesized melee cues and preloaded recordings share the SFX mixer.
export const RECORDED_SFX = {
  "rock-shield": new URL("./assets/sfx/rock-shield.mp3", import.meta.url).href,
  death: new URL("./assets/sfx/death.mp3", import.meta.url).href,
  gravity: new URL("./assets/sfx/gravity.mp3", import.meta.url).href,
  flood: new URL("./assets/sfx/flood.mp3", import.meta.url).href,
  clash: new URL("./assets/sfx/clash.mp3", import.meta.url).href,
  spring: new URL("./assets/sfx/spring.mp3", import.meta.url).href,
  laser: new URL("./assets/sfx/laser.mp3", import.meta.url).href,
  token: new URL("./assets/sfx/felled.mp3", import.meta.url).href,
  fireball: new URL("./assets/sfx/fireball.mp3", import.meta.url).href,
  flash: new URL("./assets/sfx/flash.mp3", import.meta.url).href,
  heal: new URL("./assets/sfx/heal.mp3", import.meta.url).href,
  lightning: new URL("./assets/sfx/lightning.mp3", import.meta.url).href,
  revival: new URL("./assets/sfx/revival.mp3", import.meta.url).href,
  rock: new URL("./assets/sfx/rock-formation.mp3", import.meta.url).href,
};
export const SFX_KINDS = ["swing", "slice", "impact", "clash", "token"];
const armed = new Set([
  "dark",
  "light",
  "spirit",
  "mirror",
  "sun",
  "smoke",
  "apparition",
  "demonic",
  "divine",
  "multi-dimensional",
  "lightning",
  "sanctuary",
]);
export const contactSound = (element) =>
  armed.has(element) ? "slice" : "impact";
export function synthesizeSfx(kind, sampleRate = 44100, seed = 1) {
  const length = {
    swing: 0.18,
    slice: 0.19,
    impact: 0.2,
    clash: 0.42,
    token: 0.72,
  }[kind];
  if (!length) throw new Error("Unknown sound effect");
  const samples = new Float32Array(Math.ceil(length * sampleRate));
  let state = seed,
    low = 0,
    phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate,
      p = t / length;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const noise = state / 2147483648 - 1;
    low += 0.12 * (noise - low);
    const high = noise - low;
    let v = 0;
    if (kind === "swing")
      v = (low * 0.85 + high * 0.08) * Math.sin(Math.PI * p) ** 1.8;
    if (kind === "slice")
      v =
        (high * 0.24 + low * 0.28) *
          Math.exp(-t * 24) *
          Math.min(1, t / 0.006) +
        Math.sin(TAU * (1900 * t - 2500 * t * t)) * 0.06 * Math.exp(-t * 35);
    if (kind === "impact") {
      phase += (TAU * (55 + 95 * Math.exp(-t * 40))) / sampleRate;
      v =
        (Math.sin(phase) * 0.34 + low * 0.5) *
        Math.exp(-t * 23) *
        Math.min(1, t / 0.003);
    }
    if (kind === "clash")
      v =
        (Math.sin(TAU * 720 * t) +
          0.6 * Math.sin(TAU * 1127 * t) +
          0.35 * Math.sin(TAU * 1893 * t)) *
          0.12 *
          Math.exp(-t * 11) +
        high * 0.18 * Math.exp(-t * 70);
    if (kind === "token")
      v =
        (Math.sin(
          TAU * 164.81 * t +
            1.7 * Math.sin(TAU * 329.62 * t) * Math.exp(-t * 9),
        ) *
          0.23 +
          0.065 * Math.sin(TAU * 247.22 * t)) *
        Math.exp(-t * 5.5) *
        Math.min(1, t / 0.012);
    samples[i] = v * Math.min(1, t / 0.002) * Math.min(1, (length - t) / 0.012); // silent tail, no clicks
  }
  return samples;
}
const TAU = Math.PI * 2;
export class CombatSfx {
  constructor(context, volume = 0.6) {
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = volume;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.12;
    this.gain.connect(this.compressor);
    this.compressor.connect(context.destination);
    this.buffers = new Map();
    this.voices = new Set();
    this.last = new Map();
    this.serial = 0;
    for (const kind of SFX_KINDS) {
      const data = synthesizeSfx(
        kind,
        context.sampleRate,
        179 + kind.length * 71,
      );
      const buffer = context.createBuffer(1, data.length, context.sampleRate);
      buffer.copyToChannel(data, 0);
      this.buffers.set(kind, buffer);
    }
    this.buffers.set("key", this.buffers.get("token"));
    this.ready = this.loadRecordings();
  }
  async loadRecordings() {
    const results = await Promise.allSettled(
      Object.entries(RECORDED_SFX).map(async ([kind, url]) => {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Sound effect ${kind}: ${response.status}`);
        const buffer = await this.context.decodeAudioData(
          await response.arrayBuffer(),
        );
        this.buffers.set(kind, buffer);
      }),
    );
    this.loadErrors = results
      .filter((r) => r.status === "rejected")
      .map((r) => String(r.reason));
    return this.loadErrors.length === 0;
  }
  volume(value) {
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.025);
  }
  play(kind, { gain = 1, pan = 0 } = {}) {
    if (
      !this.buffers.has(kind) ||
      this.gain.gain.value <= 0 ||
      this.context.state !== "running"
    )
      return false;
    const now = this.context.currentTime,
      interval =
        kind === "heal"
          ? 0.65
          : RECORDED_SFX[kind]
            ? 0.15
            : kind === "clash"
              ? 0.08
              : 0.045;
    if (
      now - (this.last.get(kind) ?? -Infinity) < interval ||
      (RECORDED_SFX[kind] &&
        [...this.voices].filter((v) => v.sfxKind === kind).length >= 2) ||
      (kind === "swing" && this.voices.size >= 5)
    )
      return false;
    if (this.voices.size >= 8) {
      const replace =
        RECORDED_SFX[kind] &&
        [...this.voices].find((v) =>
          ["swing", "slice", "impact"].includes(v.sfxKind),
        );
      if (!replace) return false;
      replace.stop();
      this.voices.delete(replace);
    }
    this.last.set(kind, now);
    const source = this.context.createBufferSource(),
      level = this.context.createGain(),
      panner = this.context.createStereoPanner();
    source.buffer = this.buffers.get(kind);
    source.sfxKind = kind;
    // Cycling offsets avoid identical rapid hits without touching gameplay RNG.
    const variation = [-0.035, 0.018, -0.012, 0.035, 0][this.serial++ % 5];
    source.playbackRate.value = 1 + variation;
    level.gain.value =
      Math.max(0, Math.min(1, gain)) *
      (RECORDED_SFX[kind] ? 0.55 : kind === "swing" ? 0.55 : 0.85) *
      (kind === "heal" ? 0.5 : 1) *
      (1 + variation);
    panner.pan.value = Math.max(-0.75, Math.min(0.75, pan));
    source.connect(level);
    level.connect(panner);
    panner.connect(this.gain);
    this.voices.add(source);
    source.onended = () => {
      source.disconnect();
      level.disconnect();
      panner.disconnect();
      this.voices.delete(source);
    };
    source.start();
    return true;
  }
  stop() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
}
