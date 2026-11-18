import { Combat } from "./combat.js";
import { PortalSystem } from "./portals.js";
export const LOBBY_PROTOCOL = 3;
export const RESULTS_SECONDS = 30;
export const START_SECONDS = 5;
export function packGame(game) {
  const seen = new Map(),
    nodes = [];
  const encode = (value) => {
    if (value === game.map && value) return { map: true };
    if (!value || typeof value !== "object")
      return typeof value === "function" ? null : value;
    if (seen.has(value)) return { ref: seen.get(value) };
    const id = nodes.length;
    seen.set(value, id);
    nodes.push(null);
    if (value instanceof Set)
      nodes[id] = { type: "set", data: [...value].map(encode) };
    else if (value instanceof Map)
      nodes[id] = {
        type: "map",
        data: [...value].map(([k, v]) => [encode(k), encode(v)]),
      };
    else if (Array.isArray(value))
      nodes[id] = { type: "array", data: value.map(encode) };
    else
      nodes[id] = {
        type:
          value === game
            ? "game"
            : value instanceof PortalSystem
              ? "portals"
              : "object",
        data: Object.fromEntries(
          Object.entries(value)
            .filter(
              ([k, v]) =>
                typeof v !== "function" &&
                !["humanInputs", "progressReport", "progressState"].includes(
                  k,
                ) &&
                !/Cache|Crowd/.test(k),
            )
            .map(([k, v]) => [k, encode(v)]),
        ),
      };
    return { ref: id };
  };
  encode(game);
  return {
    mapState: game.map
      ? { activeRoom: game.map.activeRoom, travelRooms: game.map.travelRooms }
      : null,
    options: {
      mode: game.mode,
      mapId: game.mapId,
      enemyElement: game.warElements?.[1],
      element: game.warElements?.[0],
      players: game.fighters.length,
      size: game.fighters.length / 2,
    },
    nodes,
  };
}
export function unpackGame(packet, previous = null) {
  if (!packet?.nodes?.length || packet.nodes.length > 150000)
    throw new Error("Invalid game snapshot");
  const game =
    previous?.mode === packet.options.mode &&
    previous.mapId === packet.options.mapId
      ? previous
      : new Combat(packet.options);
  const rootData = packet.nodes[0].data;
  for (const key of game._wireKeys || [])
    if (!(key in rootData)) delete game[key];
  game._wireKeys = Object.keys(rootData);
  const values = packet.nodes.map((n) =>
    n.type === "game"
      ? game
      : n.type === "portals"
        ? new PortalSystem(game)
        : n.type === "array"
          ? []
          : n.type === "map"
            ? new Map()
            : n.type === "set"
              ? new Set()
              : {},
  );
  const decode = (v) =>
    v && typeof v === "object" ? (v.map ? game.map : values[v.ref]) : v;
  packet.nodes.forEach((n, i) => {
    const value = values[i];
    if (n.type === "array") value.push(...n.data.map(decode));
    else if (n.type === "set") n.data.forEach((v) => value.add(decode(v)));
    else if (n.type === "map")
      n.data.forEach(([k, v]) => value.set(decode(k), decode(v)));
    else
      for (const [key, v] of Object.entries(n.data))
        if (!["__proto__", "constructor", "prototype"].includes(key))
          value[key] = decode(v);
  });
  if (game.map && packet.mapState) Object.assign(game.map, packet.mapState);
  return game;
}
export function resultFor(game, actor) {
  if (!game.finished) return null;
  if (game.mode === "corruption")
    return [
      ...(game.winners?.light || []),
      ...(game.winners?.dark || []),
    ].includes(actor.id)
      ? "victory"
      : "defeat";
  return game.winnerTeam === null
    ? "draw"
    : game.winnerTeam === actor.team
      ? "victory"
      : "defeat";
}
export function lobbySizes(mode) {
  if (["gridiron", "ctf", "corruption", "turnpike"].includes(mode)) return [8];
  if (mode === "war") return [6, 8, 10];
  if (mode === "rush") return [6, 8];
  if (mode === "gauntlet-team") return [2, 3, 4];
  if (["tdm"].includes(mode)) return [4, 6, 8];
  if (mode === "boss") return [4, 5, 6, 7, 8];
  return [2, 3, 4, 5, 6, 7, 8];
}

export const forcedLobbyElement = (mode) =>
  ({
    gridiron: "earth",
    turnpike: "air",
    corruption: "light",
    zombies: "ice",
  })[mode] || null;
