// Optional transport extension to protocol 4. Gameplay snapshots remain lossless.
export const SNAPSHOT_CODEC = "json-delta-v1";
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const blocked = new Set(["__proto__", "constructor", "prototype"]);

// A one-item array replaces a value, 0 deletes a key, an object patches children.
// Array length uses '$'; real object keys are never interpreted as array length.
export function difference(before, after) {
  if (before === after) return undefined;
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) !== Array.isArray(after)
  )
    return [after];
  const patch = Object.create(null);
  let changed = false;
  if (Array.isArray(after) && before.length !== after.length) {
    patch.$ = after.length;
    changed = true;
  }
  for (const key of Object.keys(after)) {
    const delta = own(before, key)
      ? difference(before[key], after[key])
      : [after[key]];
    if (delta !== undefined) {
      patch[key] = delta;
      changed = true;
    }
  }
  if (!Array.isArray(after))
    for (const key of Object.keys(before)) {
      if (!own(after, key)) {
        patch[key] = 0;
        changed = true;
      }
    }
  return changed ? patch : undefined;
}
export function applyDifference(before, patch) {
  if (Array.isArray(patch)) return patch[0];
  if (
    !patch ||
    typeof patch !== "object" ||
    !before ||
    typeof before !== "object"
  )
    throw Error("Invalid snapshot delta");
  const result = Array.isArray(before) ? before.slice() : { ...before };
  for (const key of Object.keys(patch)) {
    if (blocked.has(key)) throw Error("Invalid snapshot key");
    if (Array.isArray(result) && key === "$") result.length = patch[key];
    else if (patch[key] === 0) delete result[key];
    else result[key] = applyDifference(before[key], patch[key]);
  }
  return result;
}
export class SnapshotEncoder {
  constructor() {
    this.id = 0;
    this.state = null;
  }
  encode(state) {
    // Canonical JSON also detaches references to live room metadata. Never diff
    // mutable combat objects or allow undefined/Infinity to change wire semantics.
    const json = JSON.stringify(state);
    const next = JSON.parse(json);
    const id = ++this.id;
    const full = `{"kind":"snapshot","codec":"${SNAPSHOT_CODEC}","id":${id},"state":${json}}`;
    let delta = full;
    if (this.state)
      delta = JSON.stringify({
        kind: "snapshot",
        codec: SNAPSHOT_CODEC,
        id,
        base: id - 1,
        patch: difference(this.state, next) || {},
      });
    this.state = next;
    return { id, full, delta: delta.length < full.length ? delta : full };
  }
}
export class SnapshotDecoder {
  constructor() {
    this.reset();
  }
  reset() {
    this.id = 0;
    this.state = null;
  }
  receive(frame) {
    if (
      frame.codec !== SNAPSHOT_CODEC ||
      !Number.isSafeInteger(frame.id) ||
      frame.id < 1
    )
      throw Error("Invalid snapshot transport");
    if (frame.id <= this.id) return null; // duplicated or delayed old packets
    if (frame.base !== undefined && (frame.base !== this.id || !this.state))
      return null;
    const state =
      frame.base === undefined
        ? frame.state
        : applyDifference(this.state, frame.patch);
    if (!state?.game?.nodes?.length) throw Error("Invalid snapshot state");
    this.state = state;
    this.id = frame.id;
    return state;
  }
}
