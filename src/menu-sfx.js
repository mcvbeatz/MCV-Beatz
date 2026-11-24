export const SELECTION_URL = new URL(
  "./assets/sfx/selection.mp3",
  import.meta.url,
).href;
export const CANCEL_URL = new URL("./assets/sfx/cancel.mp3", import.meta.url)
  .href;
const recordings = new Map();
// Fetch before the first interaction; decode once the gesture unlocks audio.
export function prepareMenuRecording(url) {
  if (!recordings.has(url)) {
    recordings.set(
      url,
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Menu sound: ${response.status}`);
          return response.arrayBuffer();
        })
        .catch((error) => {
          recordings.delete(url);
          throw error;
        }),
    );
  }
  return recordings.get(url);
}
export function prepareSelectionRecording() {
  return prepareMenuRecording(SELECTION_URL);
}
export function isCancelControl(control) {
  const label = `${control.id || ""} ${control.getAttribute("aria-label") || ""} ${control.textContent || ""}`;
  return (
    /\b(back|leave|cancel|close|return)\b/i.test(label) ||
    /^[\s←]*(?:[x×✕✖]|←.*)$/i.test(control.textContent.trim())
  );
}
export class MenuClickSfx {
  constructor(context, volume, url = SELECTION_URL) {
    this.url = url;
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
      const data = await prepareMenuRecording(this.url);
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
