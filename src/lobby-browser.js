import { MODES } from "./mode-catalog.js";
import { escapeHTML as esc } from "./progression-ui.js";
export function renderLobbyBrowser(
  root,
  { mode, rooms = [], local = false, loading = false, message = "" },
  { onCreate, onJoin, onRefresh, onOffline, onAccount },
) {
  root.innerHTML = `<section class="lobby-browser"><h1>${esc(MODES[mode].name)} · Lobbies</h1><p>${local ? "AI-only rooms are private to this browser. Sign in on each device with different accounts to play together online." : "Choose a captain’s lobby or create your own. Open seats are filled by AI until players join."}</p><p class="lobby-browser-message" role="status">${esc(message || (loading ? "Finding open lobbies…" : ""))}</p><nav class="lobby-browser-actions">${local ? "<button data-account>Sign in / Register</button><button data-offline>Create AI-only lobby</button>" : `<button data-create ${loading ? "disabled" : ""}>Create Lobby</button><button data-refresh>Refresh</button><button data-offline>AI-only lobby</button>`}</nav><div class="open-lobbies">${!local && !loading && !rooms.length ? "<p>No open lobbies yet. Create one and invite others to choose your name here.</p>" : rooms.map((r) => `<article class="open-lobby"><div><strong>Captain: ${esc(r.captainName)}</strong><p>${r.humans} / ${r.capacity} players · ${r.capacity - r.humans} AI seats available</p></div><button data-join="${esc(r.roomId)}" ${r.humans >= r.capacity ? "disabled" : ""}>${r.humans >= r.capacity ? "Full" : "Join"}</button></article>`).join("")}</div></section>`;
  root.querySelector("[data-create]")?.addEventListener("click", onCreate);
  root.querySelector("[data-refresh]")?.addEventListener("click", onRefresh);
  root.querySelector("[data-offline]")?.addEventListener("click", onOffline);
  root.querySelector("[data-account]")?.addEventListener("click", onAccount);
  root
    .querySelectorAll("[data-join]")
    .forEach((b) => (b.onclick = () => onJoin(b.dataset.join)));
}
