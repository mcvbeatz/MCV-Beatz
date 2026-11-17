export const SELECTION_URL = new URL(
  "./assets/sfx/selection.mp3",
  import.meta.url,
).href;
let recording;
// Fetch before the first interaction; decode once the gesture unlocks audio.
export function prepareSelectionRecording() {
  if (!recording) {
    recording = fetch(SELECTION_URL)
      .then((response) => {
        if (!response.ok)
          throw new Error(`Selection sound: ${response.status}`);
        return response.arrayBuffer();
      })
      .catch((error) => {
        recording = null;
        throw error;
      });
  }
  return recording;
}
export class MenuClickSfx {
  constructor(context, volume) {
    this.context = context;
    this.buffer = null;
    this.voices = new Set();
    this.pendingAt = null;
    this.output = context.createGain();
    this.output.gain.value =
      Math.max(0, Math.min(1, Number(volume) || 0)) * 0.35 * 0.8;
    this.output.connect(context.destination);
    this.volume(volume);
    this.ready = this.load();
  }
  async load() {
    this.loading = true;
    try {
      const data = await prepareSelectionRecording();
      this.buffer = await this.context.decodeAudioData(data.slice(0));
      this.loadError = null;
      if (
        this.pendingAt !== null &&
        performance.now() - this.pendingAt < 500 &&
        !document.hidden
      )
        this.play();
      return true;
    } catch (error) {
      this.loadError = String(error);
      return false;
    } finally {
      this.loading = false;
      this.pendingAt = null;
    }
  }
  volume(value) {
    this.level = Math.max(0, Math.min(1, Number(value) || 0));
    this.output.gain.setTargetAtTime(
      this.level * 0.35 * 0.8,
      this.context.currentTime,
      0.008,
    );
    if (!this.level) this.stop();
  }
  stop() {
    this.pendingAt = null;
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
  play() {
    if (!this.level) return false;
    if (!this.buffer) {
      this.pendingAt = performance.now();
      if (!this.loading) this.ready = this.load();
      return false;
    }
    this.pendingAt = null;
    if (this.voices.size >= 4) {
      const oldest = this.voices.values().next().value;
      oldest.stop();
      this.voices.delete(oldest);
    }
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.output);
    this.voices.add(source);
    source.onended = () => {
      source.disconnect();
      this.voices.delete(source);
    };
    source.start();
    return true;
  }
}
