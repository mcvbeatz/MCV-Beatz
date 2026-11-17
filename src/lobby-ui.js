import { BASE_FORMS } from "./player-preferences.js";
import { lobbySizes } from "./multiplayer-protocol.js";
import { MODES } from "./mode-catalog.js";
import { cosmeticCatalog } from "./rewards.js";
import { escapeHTML as esc, profileMarkup } from "./progression-ui.js";
import { paintPortraits } from "./characters.js";
export function renderLobbyPanel(
  root,
  client,
  store,
  profile,
  { onLeave, onEquip, onProfile, onStart, onSize },
) {
  const s = client.state,
    me = s.members.find((m) => m.id === client.userId),
    captain = s.captain === client.userId;
  const catalog = cosmeticCatalog(),
    slots = ["aura", "frame", "title", "badge", "decoration"];
  const expanded = root.querySelector("details")?.open;
  root.innerHTML = `<header><strong>${esc(MODES[s.mode].name)} · Lobby</strong><button data-leave>Leave lobby</button></header><p>${client.local ? "AI-only lobby · Other users cannot join this room." : "Online lobby · Humans replace AI seats."}</p><p data-lobby-clock></p><p>${captain ? "You are captain" : `Captain: ${esc(s.members.find((m) => m.id === s.captain)?.name || "—")}`}</p><button data-start ${!captain || s.phase !== "lobby" ? "disabled" : ""}>Start · 5 second countdown</button><label>Players<select data-size ${!captain || s.phase !== "lobby" ? "disabled" : ""}>${lobbySizes(
    s.mode,
  )
    .map(
      (n) =>
        `<option ${n === s.capacity ? "selected" : ""} ${n < s.members.length ? "disabled" : ""}>${n}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Your elemental<select data-element ${s.phase !== "lobby" ? "disabled" : ""}>${BASE_FORMS.map((e) => `<option value="${e}" ${e === me.element ? "selected" : ""}>${e[0].toUpperCase() + e.slice(1)}</option>`).join("")}</select></label><p class="lobby-rules">Movement only here. Mode rules may assign your match form (for example, Earth in Gridiron or Ice in Zombies).</p><details ${expanded ? "open" : ""}><summary>Cosmetics · auras, frames, titles & badges</summary>${profileMarkup(store.state, me.name, me.element)}${slots
    .map(
      (slot) =>
        `<label>${slot}<select data-cosmetic="${slot}" ${s.phase !== "lobby" ? "disabled" : ""}><option value="">None</option>${catalog
          .filter((c) => c.slot === slot)
          .map(
            (c) =>
              `<option value="${c.id}" ${store.state.equipped[slot] === c.id ? "selected" : ""} ${store.state.unlocks[c.id] ? "" : "disabled"}>${esc(c.name)}${store.state.unlocks[c.id] ? "" : " · Locked"}</option>`,
          )
          .join("")}</select></label>`,
    )
    .join("")}</details><ol class="lobby-members">${Array.from(
    { length: s.capacity },
    (_, i) => {
      const member = s.members.find((m) => m.seat === i);
      const badge = catalog.find((c) => c.id === member?.cosmetics?.badge),
        title = catalog.find((c) => c.id === member?.cosmetics?.title),
        frame = catalog.find((c) => c.id === member?.cosmetics?.frame);
      return `<li class="${frame ? "member-frame tone-" + frame.tone : ""}">${badge ? `<span title="${esc(badge.name)}">${badge.symbol}</span> ` : ""}${member ? esc(member.name) + (member.id === s.captain ? " · Captain" : "") : `AI ${i + 1}`}<small>${member ? esc(member.element) : "AI seat available"}${title ? " · " + esc(title.name) : ""}</small></li>`;
    },
  ).join("")}</ol>`;
  root.querySelector("[data-leave]").onclick = onLeave;
  root.querySelector("[data-size]").onchange = (e) =>
    onSize(Number(e.target.value));
  root.querySelector("[data-element]").onchange = (e) =>
    onProfile(e.target.value);
  root.querySelector("[data-start]").onclick = onStart;
  root
    .querySelectorAll("[data-cosmetic]")
    .forEach(
      (select) =>
        (select.onchange = () =>
          onEquip(select.dataset.cosmetic, select.value)),
    );
  paintPortraits(root);
}
