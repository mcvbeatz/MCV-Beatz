import { FORMS, ORIGINS, mastery, MAX_XP } from "./progression.js";
import {
  ACHIEVEMENTS,
  achievementProgress,
  cosmeticCatalog,
} from "./rewards.js";
import { STAT_LABELS, RECORDS, formatStat } from "./records.js";
import { MODES, PLAY_MODES } from "./mode-catalog.js";
import { nameOf } from "./combat.js";
import { portraitMarkup, paintPortraits } from "./characters.js";
export const escapeHTML = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const esc = escapeHTML;
const dateLabel = (date) => new Date(date).toLocaleDateString();
const meter = (value, max, label) =>
  `<progress value="${value}" max="${max || 1}" aria-label="${esc(label)}"></progress>`;
const statsMarkup = (stats) =>
  `<dl class="progress-stats">${Object.entries(STAT_LABELS)
    .map(
      ([key, label]) =>
        `<div><dt>${label}</dt><dd>${formatStat(key, stats?.[key] || 0)}</dd></div>`,
    )
    .join(
      "",
    )}<div><dt>K/D ratio</dt><dd>${((stats?.kills || 0) / Math.max(1, stats?.deaths || 0)).toFixed(2)}</dd></div></dl>`;
export function profileMarkup(state, username = "Guest", element = null) {
  const catalog = cosmeticCatalog(),
    items = Object.values(state.equipped)
      .map((id) => catalog.find((c) => c.id === id))
      .filter(Boolean);
  element ||= items.find((c) => c.element)?.element || "light";
  const by = (slot) => items.find((c) => c.slot === slot);
  return `<div class="progress-profile tone-${by("frame")?.tone || "default"} ${by("frame") ? "has-frame" : ""}"><div class="profile-portrait ${by("aura") ? "has-aura tone-" + by("aura").tone : ""}">${portraitMarkup(element)}${by("decoration") ? `<span class="profile-orbit tone-${by("decoration").tone}" aria-label="${esc(by("decoration").name)}">${by("decoration").symbol}</span>` : ""}</div><div><strong>${by("badge") ? `<span class="profile-badge tone-${by("badge").tone}" title="${esc(by("badge").name)}">${by("badge").symbol}</span> ` : ""}${esc(username)}</strong>${by("title") || by("decoration")?.title ? `<p class="profile-title">${esc(by("title")?.name || by("decoration").title)}</p>` : ""}<small>${items.length ? items.map((c) => esc(c.name)).join(" · ") : "Your elemental journey"}</small></div></div>`;
}
export function mountProgression(
  root,
  store,
  {
    section = "overview",
    user = null,
    onAuth,
    onSync,
    onEquip,
    onTab,
    onOverview,
  } = {},
) {
  let tab = section,
    selected = null,
    mode = "overall",
    filter = "all",
    category = "All";
  const state = () => store.state;
  function render() {
    const s = state();
    root.innerHTML = `<div class="screen-intro"><span class="eyebrow">YOUR ELEMENTAL JOURNEY</span><h1>My Account</h1></div><nav class="progress-tabs" aria-label="Account sections">${[
      ["overview", "Overview"],
      ["mastery", "Elemental Mastery"],
      ["records", "Records"],
      ["achievements", "Achievements"],
      ["cosmetics", "Cosmetics"],
    ]
      .map(
        ([id, label]) =>
          `<button data-tab="${id}" aria-current="${tab === id ? "page" : "false"}">${label}</button>`,
      )
      .join(
        "",
      )}</nav><p class="progress-storage" role="status">${esc(store.status)}</p><div class="progress-toolbar"><button data-auth>${user ? "Manage account" : "Sign in / Register"}</button>${/storage is unavailable|storage is unavailable or full|storage is full/.test(store.status) ? "<button data-save>Retry device save</button>" : ""}${user ? "<button data-sync>Retry sync</button>" : "<small>Guest saves stay on this device and never enter public leaderboards.</small>"}</div><section class="progress-content"></section>`;
    for (const button of root.querySelectorAll("[data-tab]"))
      button.onclick = () => {
        tab = button.dataset.tab;
        onTab?.(tab);
        selected = null;
        render();
      };
    root.querySelector("[data-auth]").onclick = onAuth;
    const saveButton = root.querySelector("[data-save]");
    if (saveButton)
      saveButton.onclick = () => {
        if (store.persist())
          store.status = store.userId
            ? "Progress saved on this device for this account."
            : "Guest progress is saved on this device only.";
        render();
      };
    const sync = root.querySelector("[data-sync]");
    if (sync)
      sync.onclick = async () => {
        sync.disabled = true;
        await onSync?.();
        render();
      };
    const body = root.querySelector(".progress-content");
    if (tab === "overview") {
      body.innerHTML =
        profileMarkup(s, user?.user_metadata?.username || "Guest") +
        `<h2>Overall performance</h2><p>Progression records begin with this update. Existing account lifetime totals remain available below and on the leaderboard.</p>${statsMarkup(s.totals)}<div class="progress-grid"><article class="progress-card"><h3>Total mastery</h3><strong>${Object.values(s.mastery).reduce((a, xp) => a + mastery(xp).level - 1, 0)} / ${FORMS.length * 19} levels earned</strong>${meter(
          Object.values(s.mastery).reduce((a, xp) => a + xp, 0),
          FORMS.length * MAX_XP,
          "Total mastery XP",
        )}<p>${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length} achievements · ${Object.keys(s.unlocks).length} cosmetics unlocked</p></article><article class="progress-card"><h3>Earn your next form</h3><p>Completed Play matches earn progress. Practice and abandoned matches do not. Cosmetics change appearance only.</p><p>Participation XP follows time spent in each form. Action XP belongs to the form performing the action. Endless and respawn rewards have per-match caps.</p></article></div>`;
    } else if (tab === "mastery") {
      const list = selected ? [selected] : FORMS;
      body.innerHTML = `<h2>${selected ? esc(nameOf(selected)) + " Mastery" : "Elemental Mastery"}</h2>${selected ? "<button data-all>← All elementals</button>" : "<p>Origins and fusions progress independently. Select an elemental to inspect its rewards.</p>"}<div class="progress-grid mastery-grid">${list
        .map((e) => {
          const m = mastery(s.mastery[e]);
          return `<button class="progress-card mastery-card" data-element="${e}">${portraitMarkup(e)}<strong>${esc(nameOf(e))}</strong><span>Level ${m.level} / 20</span>${meter(m.progress, 1, nameOf(e) + " mastery")}<small>${m.next ? `${m.current} / ${m.next} XP to next level` : "ELEMENTAL MASTER"} · ${m.xp} total XP</small></button>`;
        })
        .join("")}</div>${
        selected
          ? `<h3>Mastery rewards</h3><div class="progress-grid">${cosmeticCatalog()
              .filter((c) => c.element === selected)
              .map((c) => cosmeticCard(c, s))
              .join("")}</div>`
          : ""
      }`;
      for (const b of body.querySelectorAll("[data-element]"))
        b.onclick = () => {
          selected = b.dataset.element;
          render();
        };
      if (selected)
        body.querySelector("[data-all]").onclick = () => {
          selected = null;
          render();
        };
    } else if (tab === "records") {
      body.innerHTML = `<h2>Personal Records</h2><label class="progress-select">Game mode<select data-mode><option value="overall">Overall performance</option>${PLAY_MODES.map((m) => `<option value="${m}" ${m === mode ? "selected" : ""}>${esc(MODES[m].name)}</option>`).join("")}</select></label>`;
      if (mode === "overall") body.innerHTML += statsMarkup(s.totals);
      else {
        const d = s.modes[mode];
        body.innerHTML +=
          statsMarkup(d?.stats) +
          `<h3>Mode accomplishments</h3><dl class="progress-stats">${Object.entries(
            RECORDS[mode],
          )
            .map(
              ([k, [label, kind]]) =>
                `<div><dt>${label}</dt><dd>${kind === "sum" ? formatStat(k, d?.objectives[k] || 0) : d?.bests[k] ? formatStat(k, d.bests[k].value) : "—"}</dd>${d?.bests[k] ? `<small>${esc(dateLabel(d.bests[k].date))}</small>` : ""}</div>`,
            )
            .join(
              "",
            )}<div><dt>Most eliminations in one match</dt><dd>${d?.bests.kills?.value || 0}</dd>${d?.bests.kills ? `<small>${esc(dateLabel(d.bests.kills.date))}</small>` : ""}</div></dl>${mode === "war" ? `<h3>Victories by chosen army</h3><dl class="progress-stats">${ORIGINS.map((e) => `<div><dt>${nameOf(e)}</dt><dd>${d?.armies[e] || 0}</dd></div>`).join("")}</dl>` : ""}<p>Records count only completed Play matches. Damage excludes absorbed hits and overkill. Team objective wins and your personal objective actions are recorded separately.</p>`;
      }
      body.querySelector("[data-mode]").onchange = (e) => {
        mode = e.target.value;
        render();
      };
    } else if (tab === "achievements") {
      body.innerHTML = `<h2>Achievements</h2><div class="progress-toolbar"><label>Status<select data-filter>${[
        ["all", "All"],
        ["completed", "Completed"],
        ["progress", "In Progress"],
        ["locked", "Locked"],
      ]
        .map(
          ([v, t]) =>
            `<option value="${v}" ${v === filter ? "selected" : ""}>${t}</option>`,
        )
        .join(
          "",
        )}</select></label><label>Category<select data-category>${["All", ...new Set(ACHIEVEMENTS.map((a) => a.category))].map((v) => `<option ${v === category ? "selected" : ""}>${v}</option>`).join("")}</select></label></div><div class="progress-grid">${ACHIEVEMENTS.filter(
        (a) => {
          const p = achievementProgress(a, s),
            done = !!s.achievements[a.id];
          return (
            (category === "All" || a.category === category) &&
            (filter === "all" ||
              (filter === "completed" && done) ||
              (filter === "progress" && !done && p > 0) ||
              (filter === "locked" && !done && p === 0))
          );
        },
      )
        .map((a) => {
          const p = achievementProgress(a, s),
            done = !!s.achievements[a.id];
          return `<article class="progress-card ${done ? "unlocked" : ""}"><small>${a.category} · ${done ? "COMPLETED" : p ? "IN PROGRESS" : "LOCKED"}</small><h3>${a.symbol} ${a.name}</h3><p>${a.description}</p>${meter(p, a.goal, a.name)}<small>${Math.floor(p)} / ${a.goal}${done ? " · " + esc(dateLabel(s.achievements[a.id])) : ""}</small><p class="reward-label">Reward: ${a.rewardName} · ${a.slot}</p></article>`;
        })
        .join("")}</div>`;
      body.querySelector("[data-filter]").onchange = (e) => {
        filter = e.target.value;
        render();
      };
      body.querySelector("[data-category]").onchange = (e) => {
        category = e.target.value;
        render();
      };
    } else {
      body.innerHTML = `<h2>Cosmetics</h2>${profileMarkup(s, user?.user_metadata?.username || "Guest")}<p>Equip one reward in each slot. Tap an equipped item to unequip it. Halos, frames, badges, titles, and animated decorations appear on your profile and match report. Halos also surround your elemental in battle. No gameplay effects.</p><div class="progress-grid">${cosmeticCatalog()
        .map((c) => cosmeticCard(c, s))
        .join("")}</div>`;
    }
    for (const b of body.querySelectorAll("[data-equip]"))
      b.onclick = () => {
        store.equip(b.dataset.equip);
        onEquip?.();
        render();
      };
    if (tab === "overview" && user) {
      body.insertAdjacentHTML(
        "beforeend",
        '<h2>Account lifetime totals</h2><div id="account-stats" class="stats-grid"></div><p id="account-message" role="status"></p>',
      );
      onOverview?.();
    }
    paintPortraits(root);
  }
  render();
}
function cosmeticCard(c, s) {
  const unlocked = !!s.unlocks[c.id],
    equipped = s.equipped[c.slot] === c.id;
  return `<article class="progress-card cosmetic-card ${unlocked ? "unlocked" : "locked"} tone-${c.tone}"><span class="cosmetic-symbol ${c.slot === "decoration" ? "animated-decoration" : ""}">${c.symbol}</span><h3>${esc(c.name)}</h3><small>${c.slot} · ${esc(c.source)}</small><p>${unlocked ? "Unlocked" : "Locked"}${equipped ? " · EQUIPPED" : ""}</p><button data-equip="${c.id}" ${unlocked ? "" : "disabled"} aria-pressed="${equipped}">${equipped ? "Unequip" : unlocked ? "Equip" : "Locked"}</button></article>`;
}
export function renderMatchReport(
  root,
  report,
  state,
  { onRecords, onChangeMode, username = "Guest" } = {},
) {
  const m = report.match;
  root.innerHTML = `${profileMarkup(state, username, m.finalForm)}<section><h3>${m.result.toUpperCase()} · ${esc(MODES[m.mode]?.name || m.mode)}</h3><p>${esc(nameOf(m.startingForm))}${m.finalForm !== m.startingForm ? " → " + esc(nameOf(m.finalForm)) : ""} · ${formatStat("playtime", m.duration)}${["ctf", "war", "tdm", "gridiron", "rush"].includes(m.mode) ? ` · ${m.scores?.join(" – ")}` : ""}</p><dl class="progress-stats">${Object.entries(
    m.stats,
  )
    .map(
      ([k, v]) =>
        `<div><dt>${STAT_LABELS[k]}</dt><dd>${formatStat(k, v)}</dd></div>`,
    )
    .join("")}${Object.entries(m.objectives)
    .filter(([k, v]) => v > 0 && RECORDS[m.mode]?.[k])
    .map(
      ([k, v]) =>
        `<div><dt>${RECORDS[m.mode][k][0]}</dt><dd>${formatStat(k, v)}</dd></div>`,
    )
    .join("")}</dl></section>${
    report.xp
      ? `<section><h3>+${report.xp.total} Mastery XP</h3><p>${Object.entries(
          report.xp.sources,
        )
          .map(
            ([k, v]) =>
              `${{ completion: "Match complete", victory: "Victory", kills: "Eliminations", fusions: "Fusions", bosses: "Bosses", waves: "Waves" }[k]} +${v}`,
          )
          .join(" · ")}</p><div class="report-mastery">${Object.entries(
          report.xp.forms,
        )
          .filter(([, xp]) => xp > 0)
          .map(([e, xp]) => {
            const level = report.mastery[e],
              change = report.levels.find((l) => l.element === e);
            return `<article><strong>${nameOf(e)} · +${xp} XP</strong><span>${change ? `LEVEL UP ${change.from} → ${change.to}` : "Level " + level.level}</span>${meter(level.progress, 1, nameOf(e) + " mastery")}<small>${level.next ? `${level.current} / ${level.next} XP` : "ELEMENTAL MASTER"}</small></article>`;
          })
          .join("")}</div></section>`
      : `<p>${esc(report.rewardReason || "No progression rewards.")}</p>`
  }${report.records?.length ? `<section class="report-unlocks"><h3>NEW PERSONAL BEST</h3>${report.records.map((r) => `<p>${r.label}: <strong>${formatStat(r.key, r.value)}</strong></p>`).join("")}</section>` : ""}${
    report.achievements?.length
      ? `<section class="report-unlocks" role="status"><h3>Achievements unlocked</h3>${report.achievements
          .map((id) => {
            const a = ACHIEVEMENTS.find((a) => a.id === id);
            return `<article><strong>${a.symbol} ${a.name}</strong><p>${a.description}</p><small>Reward: ${a.rewardName} · ${a.slot}</small></article>`;
          })
          .join("")}</section>`
      : ""
  }${
    report.rewards?.some((id) => id.startsWith("mastery:"))
      ? `<section class="report-unlocks"><h3>Mastery rewards unlocked</h3>${report.rewards
          .filter((id) => id.startsWith("mastery:"))
          .map(
            (id) =>
              `<p>${esc(cosmeticCatalog().find((c) => c.id === id)?.name)}</p>`,
          )
          .join(
            "",
          )}<small>Equip your rewards in My Account → Cosmetics.</small></section>`
      : ""
  }<div class="report-actions"><button data-change>Change Mode</button><button data-records>View Records</button></div>`;
  root.querySelector("[data-change]").onclick = onChangeMode;
  root.querySelector("[data-records]").onclick = onRecords;
  root.addEventListener("animationend", (e) => {
    if (e.target.classList.contains("report-unlocks"))
      e.target.style.animation = "none";
  });
  paintPortraits(root);
}
