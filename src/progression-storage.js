import { ACHIEVEMENTS, cosmeticCatalog } from "./rewards.js";
import {
  emptyProgress,
  eligible,
  applyMatch,
  canEquip,
  equipCosmetic,
  FORMS,
} from "./progression.js";
export const STORAGE_VERSION = 1;
export const storageKey = (userId) =>
  `fusion-throwdown:progress:v1:${userId ? "account:" + userId : "guest"}`;
const finite = (n) =>
  Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const object = (o) => !!o && typeof o === "object" && !Array.isArray(o);
const validFields = (obj, fields) =>
  object(obj) && fields.every((k) => obj[k] === undefined || finite(obj[k]));
export function validateMatch(m) {
  if (
    !eligible(m) ||
    !finite(m.duration) ||
    typeof m.date !== "string" ||
    !Number.isFinite(Date.parse(m.date)) ||
    !FORMS.includes(m.finalForm)
  )
    return false;
  if (
    m.scores !== undefined &&
    (!Array.isArray(m.scores) || !m.scores.every(finite))
  )
    return false;
  if (
    !validFields(m.stats, [
      "kills",
      "deaths",
      "damageDealt",
      "damageReceived",
      "healing",
    ]) ||
    !object(m.forms) ||
    !object(m.objectives)
  )
    return false;
  if (
    !["kills", "deaths", "damageDealt", "damageReceived", "healing"].every(
      (k) => finite(m.stats[k]),
    ) ||
    !Number.isInteger(m.stats.kills) ||
    !Number.isInteger(m.stats.deaths) ||
    !Object.values(m.stats).every(finite) ||
    !Object.values(m.objectives).every(finite)
  )
    return false;
  if (
    m.players !== undefined &&
    (!Array.isArray(m.players) ||
      m.players.length > 32 ||
      !m.players.every(
        (row) =>
          object(row) &&
          FORMS.includes(row.element) &&
          typeof row.isPlayer === "boolean" &&
          typeof row.name === "string" &&
          validFields(row, [
            "kills",
            "deaths",
            "damageDealt",
            "damageReceived",
            "healing",
            "survival",
            "raceLaps",
            "raceProgress",
            "place",
            "fastestLap",
            "monstersDefeated",
            "bosses",
            "tokensAcquired",
            "flagsStolen",
            "returns",
            "touchdowns",
            "assists",
          ]),
      ))
  )
    return false;
  if (
    m.dungeonTotals != null &&
    (!validFields(m.dungeonTotals, ["monsters", "bosses"]) ||
      !Object.values(m.dungeonTotals).every(finite))
  )
    return false;
  return Object.entries(m.forms).every(
    ([e, f]) =>
      FORMS.includes(e) &&
      validFields(f, ["seconds", "kills", "fusions", "bosses", "waves"]) &&
      Object.values(f).every(finite),
  );
}
function validEarned(raw = {}) {
  if (!object(raw)) raw = {};
  const achievements = {},
    unlocks = {};
  for (const a of ACHIEVEMENTS)
    if (Number.isFinite(Date.parse(raw.achievements?.[a.id])))
      achievements[a.id] = raw.achievements[a.id];
  for (const c of cosmeticCatalog())
    if (Number.isFinite(Date.parse(raw.unlocks?.[c.id])))
      unlocks[c.id] = raw.unlocks[c.id];
  return { achievements, unlocks };
}
export function migrateSave(raw) {
  if (!object(raw)) throw new Error("Invalid save");
  if ((raw.version ?? 0) > STORAGE_VERSION)
    throw new Error("This save needs a newer game version.");
  // Version 0 development saves used the same immutable journal without a version field.
  return {
    earned: validEarned(raw.earned),
    version: STORAGE_VERSION,
    matches: Array.isArray(raw.matches)
      ? raw.matches.filter(validateMatch)
      : [],
    equipped: object(raw.equipped) ? raw.equipped : {},
    preferencesUpdatedAt: finite(raw.preferencesUpdatedAt)
      ? raw.preferencesUpdatedAt
      : 0,
  };
}
function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
export class ProgressionStore {
  constructor(userId = null, storage = browserStorage()) {
    this.userId = userId;
    this.storage = storage;
    this.key = storageKey(userId);
    this.status = userId
      ? "Saved on this device for this account. Cloud sync pending."
      : "Sign in to save stats and earn mastery XP.";
    this.save = {
      earned: { achievements: {}, unlocks: {} },
      version: STORAGE_VERSION,
      matches: [],
      equipped: {},
      preferencesUpdatedAt: 0,
    };
    this.load();
    this.rebuild();
  }
  load() {
    try {
      const text = this.storage?.getItem(this.key);
      if (!text) return;
      const parsed = JSON.parse(text);
      if ((parsed.version ?? 0) > STORAGE_VERSION) {
        this.readOnly = true;
        this.status =
          "This save needs a newer game version; it has not been changed.";
        return;
      }
      this.save = migrateSave(parsed);
    } catch {
      this.status =
        "A damaged local save could not be read. A backup is retained when storage is available.";
      try {
        this.storage?.setItem(
          this.key + ":recovery",
          this.storage.getItem(this.key),
        );
      } catch {}
    }
  }
  rebuild() {
    this.state = emptyProgress();
    this.reports = new Map();
    const unique = new Map(
      this.save.matches.filter(validateMatch).map((m) => [m.id, m]),
    );
    this.save.matches = [...unique.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
    for (const m of this.save.matches)
      this.reports.set(m.id, applyMatch(this.state, m));
    const earned = validEarned(this.save.earned);
    Object.assign(this.state.achievements, earned.achievements);
    Object.assign(this.state.unlocks, earned.unlocks);
    this.save.earned = {
      achievements: { ...this.state.achievements },
      unlocks: { ...this.state.unlocks },
    };
    for (const [slot, id] of Object.entries(this.save.equipped))
      if (canEquip(this.state, id)) {
        equipCosmetic(this.state, id);
        if (this.state.equipped[slot] !== id) delete this.state.equipped[slot];
      }
    this.save.equipped = { ...this.state.equipped };
  }
  persist() {
    if (this.discarded) return false;
    if (this.readOnly) return false;
    try {
      if (!this.storage) throw new Error("Storage unavailable");
      this.storage.setItem(this.key, JSON.stringify(this.save));
      return true;
    } catch {
      this.status =
        "Device storage is unavailable or full. Progress remains in this session; keep this page open and retry saving.";
      return false;
    }
  }
  merge(matches, preferences = null) {
    const earned = validEarned(preferences?.earned);
    this.save.earned = {
      achievements: {
        ...earned.achievements,
        ...this.save.earned.achievements,
      },
      unlocks: { ...earned.unlocks, ...this.save.earned.unlocks },
    };
    const byId = new Map(this.save.matches.map((m) => [m.id, m]));
    for (const m of matches)
      if (validateMatch(m) && !byId.has(m.id)) byId.set(m.id, m);
    this.save.matches = [...byId.values()];
    if (
      preferences &&
      object(preferences.equipped) &&
      preferences.updated > this.save.preferencesUpdatedAt
    ) {
      this.save.equipped = preferences.equipped;
      this.save.preferencesUpdatedAt = preferences.updated;
    }
    this.rebuild();
  }
  refreshFromDevice() {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return;
      const saved = migrateSave(JSON.parse(raw));
      this.merge(saved.matches, {
        equipped: saved.equipped,
        updated: saved.preferencesUpdatedAt,
        earned: saved.earned,
      });
    } catch {
      /* The current in-memory journal remains valid. */
    }
  }
  complete(match) {
    if (!validateMatch(match) || this.readOnly) return null;
    this.refreshFromDevice();
    if (this.reports.has(match.id))
      return { ...this.reports.get(match.id), duplicate: true };
    this.save.matches.push(match);
    const report = applyMatch(this.state, match);
    this.reports.set(match.id, report);
    this.save.earned = {
      achievements: { ...this.state.achievements },
      unlocks: { ...this.state.unlocks },
    };
    this.persist();
    return report;
  }
  equip(id) {
    this.refreshFromDevice();
    if (this.readOnly || !equipCosmetic(this.state, id)) return false;
    this.save.equipped = { ...this.state.equipped };
    this.save.preferencesUpdatedAt = Date.now();
    this.persist();
    return true;
  }
  async sync(client) {
    if (!this.userId || !client || this.readOnly) return false;
    if (this.syncing) {
      this.syncAgain = true;
      return this.syncing;
    }
    this.syncing = (async () => {
      let result;
      do {
        this.syncAgain = false;
        result = await this.syncOnce(client);
      } while (this.syncAgain && result);
      return result;
    })().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }
  async syncOnce(client) {
    try {
      const { data: auth, error: authError } = await client.auth.getSession();
      if (authError || auth.session?.user?.id !== this.userId) return false;
      this.refreshFromDevice();
      const remote = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await client
          .from("progression_matches")
          .select("payload")
          .eq("user_id", this.userId)
          .order("match_id")
          .range(from, from + 499);
        if (error) throw error;
        remote.push(...data.map((row) => row.payload));
        if (data.length < 500) break;
      }
      const { data: preferences, error: prefError } = await client
        .from("progression_preferences")
        .select("equipped,updated_at,earned")
        .eq("user_id", this.userId)
        .maybeSingle();
      if (prefError) throw prefError;
      this.merge(
        remote,
        preferences
          ? {
              equipped: preferences.equipped,
              updated: Date.parse(preferences.updated_at),
              earned: preferences.earned,
            }
          : null,
      );
      this.persist();
      const ids = new Set(remote.map((m) => m.id));
      const pending = this.save.matches.filter((m) => !ids.has(m.id));
      for (let i = 0; i < pending.length; i += 100) {
        const { error } = await client.from("progression_matches").upsert(
          pending
            .slice(i, i + 100)
            .map((m) => ({ user_id: this.userId, match_id: m.id, payload: m })),
          { onConflict: "user_id,match_id", ignoreDuplicates: true },
        );
        if (error) throw error;
      }
      if (
        pending.length ||
        Object.keys(this.save.earned.achievements).some(
          (id) => !preferences?.earned?.achievements?.[id],
        ) ||
        Object.keys(this.save.earned.unlocks).some(
          (id) => !preferences?.earned?.unlocks?.[id],
        ) ||
        this.save.preferencesUpdatedAt >
          (Date.parse(preferences?.updated_at) || 0)
      ) {
        const { error } = await client.rpc("save_progression_cosmetics", {
          p_user_id: this.userId,
          p_earned: this.save.earned,
          p_equipped: this.save.equipped,
          p_updated_at: new Date(this.save.preferencesUpdatedAt).toISOString(),
        });
        if (error) throw error;
      }
      this.status = this.persist()
        ? "Account progression synced. A separate copy is saved on this device."
        : "Account progression synced, but device storage is unavailable or full.";
      return true;
    } catch {
      this.status =
        "Cloud progression is unavailable. Your account’s progress is saved on this device; use Retry sync when connected. The progression database migration may be needed.";
      return false;
    }
  }
}
