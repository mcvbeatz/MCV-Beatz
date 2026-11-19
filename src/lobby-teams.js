// Lobby seats alternate Jade/Ember. The match roster is mapped to that order,
// including modes such as Gridiron whose fighters are stored team by team.
export const TEAM_LOBBY_MODES = new Set([
  "tdm",
  "war",
  "ctf",
  "rush",
  "gridiron",
]);
export const LOBBY_TEAMS = [
  { id: 0, name: "Jade Team", x: 400, y: 350 },
  { id: 1, name: "Ember Team", x: 624, y: 350 },
];
export const lobbyTeam = (mode, seat) =>
  TEAM_LOBBY_MODES.has(mode) ? seat % 2 : null;
export function lobbyTeamCounts(mode, capacity, members) {
  if (!TEAM_LOBBY_MODES.has(mode)) return [];
  const roster = [...members];
  return LOBBY_TEAMS.map((t) => ({
    ...t,
    capacity: capacity / 2,
    users: roster.filter((m) => m.seat % 2 === t.id).length,
  }));
}
export function renderLobbyTeams(root, state, userId, onTeam) {
  const me = state.members.find((m) => m.id === userId);
  const teams = state.teams || [];
  root.hidden = state.phase !== "lobby" || !teams.length;
  if (root.hidden) return;
  const signature = JSON.stringify([state.roomId, me?.team, teams]);
  if (root.dataset.signature === signature) return;
  root.dataset.signature = signature;
  root.innerHTML = teams
    .map(
      (t) =>
        `<button data-lobby-team="${t.id}" class="${t.id ? "ember" : "jade"}" ${t.users >= t.capacity || me?.team === t.id ? "disabled" : ""} aria-pressed="${me?.team === t.id}"><strong>${t.name}</strong><small>${t.users} / ${t.capacity} · ${me?.team === t.id ? "Your team" : t.users >= t.capacity ? "Locked" : "Switch"}</small></button>`,
    )
    .join("");
  root
    .querySelectorAll("button")
    .forEach((b) => (b.onclick = () => onTeam(Number(b.dataset.lobbyTeam))));
}
export function positionLobbyTeams(root, canvas, view) {
  if (root.hidden || !view) return;
  Object.assign(root.style, {
    left: `${canvas.offsetLeft}px`,
    top: `${canvas.offsetTop}px`,
    width: `${canvas.clientWidth}px`,
    height: `${canvas.clientHeight}px`,
  });
  for (const team of LOBBY_TEAMS) {
    const b = root.querySelector(`[data-lobby-team="${team.id}"]`);
    if (b)
      Object.assign(b.style, {
        left: `${view.tx + team.x * view.scale}px`,
        top: `${view.ty + team.y * view.scale}px`,
        width: `${Math.max(64, 172 * view.scale)}px`,
      });
  }
}
