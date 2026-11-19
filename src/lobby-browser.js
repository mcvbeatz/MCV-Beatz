import { MODES } from "./mode-catalog.js";
import { escapeHTML as esc } from "./progression-ui.js";
export function renderLobbyBrowser(
  root,
  {
    mode,
    rooms = [],
    signedIn = false,
    loading = false,
    message = "",
    view = "choose",
  },
  { onCreate, onJoin, onRefresh, onAccount, onChooseJoin, onChooseBack },
) {
  root.innerHTML = `<section class="lobby-browser"><h1>${esc(MODES[mode].name)} · ${view === "choose" ? "Lobbies" : "Join Lobby"}</h1>${view === "choose" ? `<nav class="lobby-entry-actions"><button data-create ${loading ? "disabled" : ""}>Create Lobby</button><button data-choose-join>Join Lobby</button>${signedIn ? "" : "<button data-account>Sign in</button>"}</nav>` : `<nav class="lobby-browser-actions"><button data-choose-back>← Back</button><button data-refresh>Refresh</button></nav><div class="open-lobbies">${!loading && !rooms.length ? "<p>No open lobbies.</p>" : rooms.map((r) => `<article class="open-lobby"><div><strong>Captain: ${esc(r.captainName)}</strong><p>${r.humans} / ${r.capacity} players</p></div><button data-join="${esc(r.roomId)}" ${r.humans >= r.capacity ? "disabled" : ""}>${r.humans >= r.capacity ? "Full" : "Join"}</button></article>`).join("")}</div>`}<p class="lobby-browser-message" role="status">${esc(message || (loading ? "Connecting…" : ""))}</p></section>`;
  root.querySelector("[data-create]")?.addEventListener("click", onCreate);
  root
    .querySelector("[data-choose-join]")
    ?.addEventListener("click", onChooseJoin);
  root
    .querySelector("[data-choose-back]")
    ?.addEventListener("click", onChooseBack);
  root.querySelector("[data-refresh]")?.addEventListener("click", onRefresh);
  root.querySelector("[data-account]")?.addEventListener("click", onAccount);
  root
    .querySelectorAll("[data-join]")
    .forEach((b) => (b.onclick = () => onJoin(b.dataset.join)));
}
