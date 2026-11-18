import { BASE_FORMS } from "./player-preferences.js";
import { lobbySizes } from "./multiplayer-protocol.js";
import { MODES } from "./mode-catalog.js";
import { cosmeticCatalog } from "./rewards.js";
import { escapeHTML as esc, profileMarkup } from "./progression-ui.js";
import { paintPortraits, portraitMarkup } from "./characters.js";
import { icon } from "./icons.js";
export function renderLobbyPanel(
  root,
  client,
  store,
  profile,
  { onEquip, onProfile, onStart, onSize, onOpen, controls, status },
) {
  const s = client.state,
    me = s.members.find((m) => m.id === client.userId);
  const captain = s.captain === client.userId,
    waiting = s.phase === "lobby";
  const catalog = cosmeticCatalog();
  if (!waiting) delete root.dataset.tab;
  if (!captain || !waiting || client.sizeDraft?.size === s.capacity)
    delete client.sizeDraft;
  const paint = () => {
    const tab = root.dataset.tab;
    const draft = client.sizeDraft;
    if (draft)
      draft.kick = draft.kick.filter((id) =>
        s.members.some((m) => m.id === id && id !== s.captain),
      );
    const excess = draft ? Math.max(0, s.members.length - draft.size) : 0;
    root.hidden = !tab;
    status.textContent = `${MODES[s.mode].name} · ${client.local ? "AI-only lobby" : "Online lobby"} · ${captain ? "You are captain" : "Captain: " + (s.members.find((m) => m.id === s.captain)?.name || "—")}`;
    controls.innerHTML = `<button data-start ${!waiting || draft ? "disabled" : ""} title="${captain ? "Start the five-second countdown" : "Show Ready! above your elemental"}">${icon("strike")}<strong>START</strong><small>${captain ? "Captain" : me.ready ? "Ready!" : "Signal ready"}</small></button>${[
      ["players", "team", "Players", String(s.capacity)],
      [
        "elemental",
        me.element,
        "Elemental",
        me.element + (me.elementLocked ? " · Locked" : ""),
      ],
      ["cosmetics", "fusion", "Cosmetics", "Customize"],
    ]
      .map(
        ([id, glyph, label, detail]) =>
          `<button data-lobby-tab="${id}" aria-expanded="${tab === id}" ${!waiting || (id === "elemental" && me.elementLocked) ? "disabled" : ""}>${icon(glyph)}<strong>${label}</strong><small>${esc(detail)}</small></button>`,
      )
      .join("")}`;
    controls.querySelector("[data-start]").onclick = () => {
      onOpen?.();
      onStart();
    };
    controls.querySelectorAll("[data-lobby-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          onOpen?.();
          if (root.dataset.tab === b.dataset.lobbyTab) delete root.dataset.tab;
          else root.dataset.tab = b.dataset.lobbyTab;
          paint();
        }),
    );
    if (!tab) {
      root.replaceChildren();
      return;
    }
    let content = "";
    if (tab === "players") {
      const sizes = lobbySizes(s.mode);
      content = `<p>${captain ? "Choose the lobby’s player limit." : "Only the captain can change the player limit."}${sizes.length === 1 ? " This mode requires eight players." : ""}</p><label>Players<select data-size ${!captain || !waiting || sizes.length === 1 ? "disabled" : ""}>${sizes.map((n) => `<option ${n === (draft?.size ?? s.capacity) ? "selected" : ""}>${n}</option>`).join("")}</select></label>${
        draft
          ? `<fieldset class="lobby-kick-picker"><legend>Choose ${excess} player${excess === 1 ? "" : "s"} to remove</legend><p>The limit stays at ${s.capacity} until you confirm. Choose a higher limit above to keep everyone.</p>${s.members
              .filter((m) => m.id !== s.captain)
              .map(
                (m) =>
                  `<label><input type="checkbox" data-kick="${esc(m.id)}" ${draft.kick.includes(m.id) ? "checked" : ""}>${esc(m.name)}</label>`,
              )
              .join(
                "",
              )}<p data-size-error role="status"></p><button data-size-confirm ${draft.kick.length !== excess ? "disabled" : ""}>${excess ? `Remove ${excess} & ` : ""}Apply ${draft.size} players</button><button data-size-cancel>Keep current limit</button></fieldset>`
          : ""
      }<ol class="lobby-members">${Array.from(
        { length: s.capacity },
        (_, seat) => {
          const m = s.members.find((m) => m.seat === seat);
          const badge = catalog.find((c) => c.id === m?.cosmetics?.badge),
            title = catalog.find((c) => c.id === m?.cosmetics?.title),
            frame = catalog.find((c) => c.id === m?.cosmetics?.frame);
          return `<li class="${frame ? "member-frame tone-" + frame.tone : ""}">${badge ? `<span title="${esc(badge.name)}">${badge.symbol}</span> ` : ""}${m ? esc(m.name) + (m.id === s.captain ? " · Captain" : m.ready ? " · Ready!" : "") : `AI ${seat + 1}`}<small>${m ? esc(m.element) : "Available seat"}${title ? " · " + esc(title.name) : ""}</small></li>`;
        },
      ).join("")}</ol>`;
    } else if (tab === "elemental") {
      content = `${portraitMarkup(me.element)}<label>Your elemental<select data-element ${me.elementLocked || !waiting ? "disabled" : ""}>${BASE_FORMS.map((e) => `<option value="${e}" ${e === me.element ? "selected" : ""}>${e[0].toUpperCase() + e.slice(1)}</option>`).join("")}</select></label><p>${s.mode === "war" ? "The captain chooses their army; teammates share their assigned army’s element." : s.mode === "boss" ? "One player is randomly assigned the boss form when the match starts." : "Choose your form for this match."}</p>`;
    } else if (tab === "cosmetics") {
      content =
        profileMarkup(store.state, me.name, me.element) +
        ["aura", "frame", "title", "badge", "decoration"]
          .map(
            (slot) =>
              `<label>${slot}<select data-cosmetic="${slot}"><option value="">None</option>${catalog
                .filter((c) => c.slot === slot)
                .map(
                  (c) =>
                    `<option value="${c.id}" ${store.state.equipped[slot] === c.id ? "selected" : ""} ${store.state.unlocks[c.id] ? "" : "disabled"}>${esc(c.name)}${store.state.unlocks[c.id] ? "" : " · Locked"}</option>`,
                )
                .join("")}</select></label>`,
          )
          .join("");
    }
    root.innerHTML = `<header><h2>${tab[0].toUpperCase() + tab.slice(1)}</h2><button data-lobby-close aria-label="Close lobby settings">Done</button></header>${content}`;
    root.querySelector("[data-lobby-close]").onclick = () => {
      delete root.dataset.tab;
      paint();
    };
    root.querySelector("[data-size]")?.addEventListener("change", (e) => {
      const size = Number(e.target.value);
      if (size < s.members.length) {
        client.sizeDraft = { size, kick: [] };
        paint();
      } else {
        delete client.sizeDraft;
        onSize(size);
        paint();
      }
    });
    root.querySelectorAll("[data-kick]").forEach(
      (el) =>
        (el.onchange = () => {
          const picked = new Set(client.sizeDraft.kick);
          if (el.checked) picked.add(el.dataset.kick);
          else picked.delete(el.dataset.kick);
          client.sizeDraft.kick = [...picked];
          paint();
        }),
    );
    root
      .querySelector("[data-size-confirm]")
      ?.addEventListener("click", () => onSize(draft.size, [...draft.kick]));
    root.querySelector("[data-size-cancel]")?.addEventListener("click", () => {
      delete client.sizeDraft;
      paint();
    });
    root
      .querySelector("[data-element]")
      ?.addEventListener("change", (e) => onProfile(e.target.value));
    root
      .querySelectorAll("[data-cosmetic]")
      .forEach(
        (el) => (el.onchange = () => onEquip(el.dataset.cosmetic, el.value)),
      );
    paintPortraits(root);
  };
  paint();
}
