// A short high-register plucked string, synthesized once and shared by clicks.
// Karplus–Strong's filtered delay loop supplies string harmonics rather than a beep.
export function menuStringBuffer(context) {
  const rate = context.sampleRate,
    length = Math.ceil(rate * 0.19);
  const buffer = context.createBuffer(1, length, rate),
    data = buffer.getChannelData(0);
  const period = Math.round(rate / 1568),
    ring = new Float32Array(period);
  let seed = 971;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  for (let i = 0; i < period; i++) ring[i] = noise();
  const mean = ring.reduce((sum, v) => sum + v, 0) / period;
  for (let i = 0; i < period; i++) ring[i] -= mean;
  for (let i = 0; i < length; i++) {
    const at = i % period,
      value = ring[at];
    ring[at] = 0.494 * (value + ring[(at + 1) % period]);
    data[i] =
      value * Math.min(1, i / (rate * 0.003)) * Math.exp(-i / (rate * 0.085));
  }
  const peak = data.reduce((p, v) => Math.max(p, Math.abs(v)), 0.001);
  for (let i = 0; i < length; i++) data[i] *= 0.7 / peak;
  return buffer;
}
export function menuReverbBuffer(context) {
  const rate = context.sampleRate,
    length = Math.ceil(rate * 0.34);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let seed = 173 + channel * 911;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] =
        (seed / 2147483648 - 1) *
        Math.exp(-i / (rate * 0.065)) *
        Math.min(1, i / (rate * 0.012));
    }
  }
  return buffer;
}
export class MenuClickSfx {
  constructor(context, volume) {
    this.context = context;
    this.buffer = menuStringBuffer(context);
    this.voices = new Set();
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(context.destination);
    this.dry = context.createGain();
    this.dry.gain.value = 0.7;
    this.dry.connect(this.output);
    this.reverb = context.createConvolver();
    this.reverb.buffer = menuReverbBuffer(context);
    this.wet = context.createGain();
    this.wet.gain.value = 0.26;
    this.reverb.connect(this.wet);
    this.wet.connect(this.output);
    this.volume(volume);
  }
  volume(value) {
    this.level = Math.max(0, Math.min(1, Number(value) || 0));
    this.output.gain.setTargetAtTime(
      this.level * 0.23,
      this.context.currentTime,
      0.008,
    );
    if (!this.level) this.stop();
  }
  stop() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
  play() {
    if (!this.level) return;
    if (this.voices.size >= 4) {
      const oldest = this.voices.values().next().value;
      oldest.stop();
      this.voices.delete(oldest);
    }
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.detune.value = (Math.random() - 0.5) * 12;
    source.connect(this.dry);
    source.connect(this.reverb);
    this.voices.add(source);
    source.onended = () => {
      source.disconnect();
      this.voices.delete(source);
    };
    source.start();
  }
}
