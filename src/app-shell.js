import { icon } from "./icons.js";
import { portraitMarkup, paintPortraits } from "./characters.js";
import { orientationPoint, enableOrientedScroll } from "./orientation.js";
import {
  MODES,
  PLAY_MODES,
  TEAM_MODES,
  SOLO_MODES,
  PRACTICE_LIST,
  CONTROL_SLIDES,
  SKILL_HELP,
} from "./mode-catalog.js";
import {
  ELEMENTS,
  COMBOS,
  recipe,
  nameOf,
  skillsFor,
  extraSkillsFor,
} from "./combat.js";
import { AccountService } from "./account.js";
import { Soundtrack } from "./sound.js";
const $ = (id) => document.getElementById(id);
export function createApp(api) {
  let settings = {
    sfx: 0.6,
    music: 0.25,
    orientation: "landscape",
    charging: "hold",
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem("elemental-settings") || "{}",
    );
    for (const key of ["sfx", "music"])
      if (Number.isFinite(saved[key]))
        settings[key] = Math.max(0, Math.min(1, saved[key]));
    if (["portrait", "landscape"].includes(saved.orientation))
      settings.orientation = saved.orientation;
    if (["hold", "tap"].includes(saved.charging))
      settings.charging = saved.charging;
  } catch {}
  const sound = new Soundtrack(settings),
    account = new AccountService();
  let screen = "home",
    category = "play",
    slide = 0,
    slides = [],
    matchTicket = null,
    statsBusy = false,
    leaderPage = 0,
    metric = "kd_ratio",
    request = 0;
  const root = document.createElement("section");
  root.id = "app-shell";
  root.innerHTML = `<header class="shell-header"><button id="shell-back" aria-label="Back to home">← Back</button><div><span class="shell-wordmark">◇ ELEMENTAL</span><span id="shell-title">THE COLOSSEUM</span></div><button id="shell-account">Guest</button></header><main id="shell-content"></main><div id="intro-screen" hidden><video id="logo-video" playsinline muted preload="auto" aria-label="Opening logo video"></video><button id="intro-play" hidden>Play intro</button><button id="intro-skip">Skip intro →</button></div>`;
  document.getElementById("orientation-root").prepend(root);
  const dialog = document.createElement("dialog");
  dialog.id = "slides-dialog";
  dialog.innerHTML = `<header><span id="slides-label">HOW TO PLAY</span><button id="slides-close" aria-label="Close how to play">×</button></header><article id="slide-card" tabindex="0"><img id="slide-screenshot" alt=""><div id="slide-art" aria-hidden="true"></div><h2 id="slide-title"></h2><p id="slide-body"></p></article><footer><button id="slide-prev" aria-label="Previous slide">← Previous</button><span id="slide-count"></span><button id="slide-next" aria-label="Next slide">Next →</button></footer>`;
  document.getElementById("orientation-root").append(dialog);
  const reward = document.createElement("div");
  reward.id = "wave-reward";
  reward.hidden = true;
  reward.className = "wave-reward";
  reward.innerHTML =
    '<span class="eyebrow">WAVE CLEARED</span><h2>Choose your next advantage.</h2><p id="wave-reward-caption"></p><p id="wave-reward-timer" role="status" aria-live="polite"></p><div id="reward-options"></div>';
  $("game-wrap").append(reward);
  const save = document.createElement("p");
  save.id = "save-status";
  save.setAttribute("role", "status");
  $("game-overlay").append(save);
  const setupHeader = document.createElement("div");
  setupHeader.className = "setup-app-heading";
  setupHeader.innerHTML =
    '<h2 id="setup-mode-title">Duel</h2><div><button id="setup-how">How to play</button><button id="setup-element-guide">Element guide</button></div>';
  document.querySelector(".setup-panel").prepend(setupHeader);
  const resume = document.createElement("button");
  resume.id = "resume-btn";
  resume.textContent = "Resume match";
  resume.hidden = true;
  document.querySelector(".setup-panel").append(resume);
  const change = document.createElement("button");
  change.id = "change-mode-btn";
  change.textContent = "Change mode";
  document.querySelector(".setup-panel").append(change);
  change.onclick = () => show(category);
  function setScreen(next) {
    screen = next;
    document.body.dataset.screen = next;
    sound.setScene(
      next === "battle" && !api.game().finished ? api.game().mode : null,
      next === "battle" &&
        (api.paused() ||
          (api.game().mode === "corruption" && api.game().countingDown)),
    );
    $("shell-content").hidden = ["setup", "battle"].includes(next);
    $("shell-back").hidden = next === "home";
    $("shell-title").textContent =
      {
        home: "THE COLOSSEUM",
        play: "PLAY",
        "team-battles": "TEAM BATTLES",
        "solo-battles": "SOLO BATTLES",
        elements: "ELEMENTS & FUSIONS",
        practice: "PRACTICE",
        tutorial: "TUTORIAL",
        settings: "SETTINGS",
        account: "MY ACCOUNT",
        leaderboard: "LEADERBOARD",
        setup: "BATTLE SETUP",
      }[next] || "THE ARENA";
  }
  function show(next) {
    request++;
    if (next !== "battle" && api.started()) {
      api.pause();
      api.exitImmersive();
    }
    setScreen(next);
    const c = $("shell-content");
    if (next === "home")
      c.innerHTML = `<section class="home-hero"><span class="eyebrow">THE COLOSSEUM · v0.21.0</span><h1>Power is elemental.</h1><p>Choose your arena. Find your next form.</p><div class="home-elements" aria-label="Light, Dark, Water, Air, Earth and Fire">${Object.keys(
        ELEMENTS,
      )
        .map(
          (e) =>
            `<span style="color:${ELEMENTS[e].color}" title="${nameOf(e)}">${icon(e)}</span>`,
        )
        .join(
          "",
        )}</div></section><nav class="home-menu"><button data-screen="play"><strong>Play</strong><span>Enter the colosseum →</span></button><button data-screen="practice"><strong>Practice</strong><span>Learn. Experiment. Improve.</span></button><button data-screen="leaderboard"><strong>Leaderboard</strong><span>Compare your records</span></button><button data-screen="account"><strong>My Account</strong><span>Sign in & view stats</span></button><button data-screen="settings"><strong>Settings</strong><span>Sound & orientation</span></button></nav><p class="shell-note">Single-player battles with adaptive AI. Online multiplayer comes later.</p>`;
    else if (next === "play") {
      category = "play";
      c.innerHTML = `<div class="screen-intro"><h1>Choose your battles.</h1><p>Find your team. Face the arena alone. Or let Quick Match decide.</p></div><nav class="battle-categories"><button data-screen="team-battles"><strong>Team Battles</strong><span>Six ways to fight together →</span></button><button data-screen="solo-battles"><strong>Solo Battles</strong><span>Four ways to test yourself →</span></button><button id="quick-match"><strong>Quick Match</strong><span>A random Team or Solo mode →</span></button></nav>`;
      $("quick-match").onclick = () => chooseMode("random");
    } else if (["team-battles", "solo-battles", "practice"].includes(next)) {
      category = next;
      renderModes();
    } else if (next === "tutorial")
      c.innerHTML = `<div class="screen-intro"><h1>Learn the arena.</h1><p>Swipe through a lesson, then try it in Practice. No stats are saved.</p></div><div class="tutorial-menu"><button id="tutorial-controls">Controls <span>Movement, attacks, skills and touch gestures →</span></button><button id="tutorial-elements">Elements & fusions <span>Every form, its powers, and how to use them →</span></button><button id="tutorial-play">Try the controls <span>Start a practice duel against adaptive AI →</span></button></div>`;
    else if (next === "elements") renderElements();
    else if (next === "settings") renderSettings();
    else if (next === "account") renderAccount();
    else if (next === "leaderboard") renderLeaderboard();
    c.querySelectorAll("[data-screen]").forEach(
      (b) =>
        (b.onclick = () => {
          show(b.dataset.screen);
        }),
    );
    if (next === "tutorial") {
      $("tutorial-controls").onclick = () =>
        openSlides(CONTROL_SLIDES, "CONTROLS");
      $("tutorial-elements").onclick = () => show("elements");
      $("tutorial-play").onclick = () => chooseMode("duel");
    }
  }
  function renderModes() {
    const practice = category === "practice";
    const list = practice
      ? ["tutorial", ...PRACTICE_LIST]
      : category === "team-battles"
        ? TEAM_MODES
        : SOLO_MODES;
    $("shell-content").innerHTML =
      `<div class="screen-intro"><h1>${practice ? "Make every move count." : category === "team-battles" ? "Team Battles" : "Solo Battles"}</h1><p>${practice ? "Tutorials and adaptive AI practice. No stats are saved." : "Choose a mode. Scroll to explore every battle."}</p></div><div class="mode-menu mode-scroll" tabindex="0" aria-label="${practice ? "Practice modes" : category === "team-battles" ? "Team battle modes" : "Solo battle modes"}">${list.map((id) => `<article class="mode-card"><button data-launch="${id}"><strong>${MODES[id]?.name || "Tutorial"}</strong><span>${MODES[id]?.tag || "Controls · elements · fusion abilities"}</span></button><button data-help="${id}" aria-label="How to play ${MODES[id]?.name || id}">How to play</button></article>`).join("")}</div>`;
    enableOrientedScroll(document.querySelector(".mode-scroll"));
    $("shell-content")
      .querySelectorAll("[data-launch]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            b.dataset.launch === "tutorial"
              ? show("tutorial")
              : chooseMode(b.dataset.launch)),
      );
    $("shell-content")
      .querySelectorAll("[data-help]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            b.dataset.help === "tutorial"
              ? openSlides(CONTROL_SLIDES, "CONTROLS")
              : modeGuide(b.dataset.help)),
      );
  }
  function renderElements() {
    const forms = [...Object.keys(ELEMENTS), ...Object.values(COMBOS)];
    $("shell-content").innerHTML =
      `<div class="screen-intro"><h1>Choose an elemental.</h1><p>Open its chapter to explore its abilities and fusion recipe.</p></div><div class="element-library" tabindex="0" aria-label="Elemental chapters">${[
        1, 2, 3,
      ]
        .map(
          (tier) =>
            `<section><h2>${["", "Origins · Level I", "Fusions · Level II", "Fusions · Level III"][tier]}</h2><div class="chapter-grid">${forms
              .filter((id) => recipe(id).length === tier)
              .map(
                (id) =>
                  `<button data-chapter="${id}">${portraitMarkup(id)}<strong>${nameOf(id)}</strong></button>`,
              )
              .join("")}</div></section>`,
        )
        .join("")}</div>`;
    enableOrientedScroll(document.querySelector(".element-library"));
    $("shell-content")
      .querySelectorAll("[data-chapter]")
      .forEach((b) => (b.onclick = () => elementSlides(b.dataset.chapter)));
    paintPortraits();
  }
  function chooseMode(id) {
    if (id === "random")
      id = PLAY_MODES[Math.floor(Math.random() * PLAY_MODES.length)];
    if (!MODES[id]) id = "duel";
    category = PRACTICE_LIST.includes(id)
      ? "practice"
      : TEAM_MODES.includes(id)
        ? "team-battles"
        : "solo-battles";
    api.chooseMode(id);
    setScreen("setup");
    $("setup-mode-title").textContent = MODES[id].name;
    $("setup-how").onclick = () => modeGuide(id);
    $("setup-element-guide").onclick = () => elementSlides(api.selected());
    $("resume-btn").hidden = true;
    history.replaceState(
      null,
      "",
      `${location.pathname}?mode=${encodeURIComponent(id)}`,
    );
  }
  function modeGuide(id) {
    openSlides(
      MODES[id].slides.map((s) => [...s, `guides/${id}.png`]),
      MODES[id].name.toUpperCase(),
    );
  }
  function openSlides(items, label) {
    api.pause();
    slides = items.map((s) => (s[3] ? s : [...s, "guides/controls.png"]));
    slide = 0;
    $("slides-label").textContent = label;
    renderSlide();
    if (!dialog.open) dialog.showModal();
  }
  function renderSlide() {
    const [title, body, art, screenshot] = slides[slide];
    $("slide-screenshot").src = `${import.meta.env.BASE_URL}${screenshot}`;
    $("slide-screenshot").alt = `${title} — in-game example`;
    $("slide-title").textContent = title;
    $("slide-body").textContent = body;
    $("slide-art").textContent = art || "◇";
    $("slide-count").textContent = `${slide + 1} / ${slides.length}`;
    $("slide-prev").disabled = slide === 0;
    $("slide-next").disabled = slide === slides.length - 1;
  }
  function elementSlides(only) {
    if (!only) {
      show("elements");
      return;
    }
    const forms = only
      ? [only]
      : [...Object.keys(ELEMENTS), ...Object.values(COMBOS)];
    const items = [];
    for (const id of forms) {
      const p = api.profile(id),
        parts = recipe(id);
      items.push([
        nameOf(id),
        `${parts.length > 1 ? `Fusion: ${parts.map(nameOf).join(" + ")}. ` : ""}${p.desc} Passive: ${p.passive}.`,
        "ⅠⅡⅢ"[parts.length - 1],
        `guides/${id}.png`,
      ]);
      for (const name of [
        ...new Set(
          [...skillsFor(id), ...extraSkillsFor(id).map((s) => s.name)].filter(
            Boolean,
          ),
        ),
      ])
        items.push([
          `${nameOf(id)} · ${name}`,
          SKILL_HELP[name] ||
            "Use the matching skill button in battle. Inherited skills are also available in the top tabs.",
          "✦",
          `guides/${id}.png`,
        ]);
      if (id === "phoenix")
        items.push([
          "Phoenix · Rebirth",
          "Passive: once per match, being felled instantly restores 50% health. Your fusion stays intact and no token drops on this first fall. Further deaths use the normal mode rules.",
          "✦",
          "guides/phoenix.png",
        ]);
      if (id === "sanctuary")
        items.push([
          "Sanctuary · Aurora",
          "While a living Sanctuary is in the arena, its entire team shines and gains immunity to venom, contact burn, Heatwave, Vog, Flash, Sabotage, Blindness, Gravity x2, Flood and Death demotion. Direct attacks, Lightning, Magma, Chasm and Stone Prison are not blocked.",
          "✦",
          "guides/sanctuary.png",
        ]);
      if (id === "multi-dimensional")
        items.push([
          "Multi-Dimensional · Teleport",
          "Tap an arena destination to teleport up to 180 units after a 0.2-second vulnerable preparation. No cooldown. Portal taps take priority.",
          "⌖",
          "guides/control-teleport.png",
        ]);
    }
    openSlides(items, `${nameOf(only).toUpperCase()} · ELEMENTAL GUIDE`);
  }
  $("slides-close").onclick = () => dialog.close();
  $("slide-prev").onclick = () => {
    if (slide > 0) {
      slide--;
      renderSlide();
    }
  };
  $("slide-next").onclick = () => {
    if (slide < slides.length - 1) {
      slide++;
      renderSlide();
    }
  };
  let swipe = null;
  dialog.addEventListener("pointerdown", (e) => {
    swipe = orientationPoint(dialog, e.clientX, e.clientY);
  });
  dialog.addEventListener("pointerup", (e) => {
    const point = orientationPoint(dialog, e.clientX, e.clientY);
    if (
      swipe &&
      Math.abs(point.x - swipe.x) > 45 &&
      Math.abs(point.y - swipe.y) < 80
    ) {
      const delta = point.x - swipe.x < 0 ? 1 : -1;
      slide = Math.max(0, Math.min(slides.length - 1, slide + delta));
      renderSlide();
    }
    swipe = null;
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") $("slide-next").click();
    if (e.key === "ArrowLeft") $("slide-prev").click();
  });
  function renderSettings() {
    $("shell-content").innerHTML =
      `<div class="screen-intro"><h1>Make it yours.</h1><p>Settings are saved on this device.</p></div><div class="settings-panel"><label for="sfx-volume">SFX volume <output id="sfx-value">${Math.round(settings.sfx * 100)}%</output></label><input id="sfx-volume" type="range" min="0" max="100" value="${settings.sfx * 100}"><label for="music-volume">Music volume <output id="music-value">${Math.round(settings.music * 100)}%</output></label><input id="music-volume" type="range" min="0" max="100" value="${settings.music * 100}"><label for="orientation-setting">Play orientation</label><select id="orientation-setting"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select><label for="charging-setting">Charging abilities</label><select id="charging-setting"><option value="hold">Hold and release</option><option value="tap">Tap to charge, tap to release</option></select><p>Orientation applies everywhere. Rock shield is always held; instant skills remain a single tap.</p></div>`;
    $("orientation-setting").value = settings.orientation;
    $("charging-setting").value = settings.charging;
    $("charging-setting").onchange = (e) => {
      settings.charging = e.target.value;
      api.releaseInput();
      saveSettings();
    };
    for (const kind of ["sfx", "music"])
      $(`${kind}-volume`).oninput = (e) => {
        sound.volume(kind, Number(e.target.value) / 100);
        $(`${kind}-value`).textContent = `${e.target.value}%`;
        saveSettings();
      };
    $("sfx-volume").onchange = () => sound.tone(320);
    $("orientation-setting").onchange = (e) => {
      settings.orientation = e.target.value;
      applyOrientation();
      saveSettings();
    };
  }
  function saveSettings() {
    try {
      localStorage.setItem("elemental-settings", JSON.stringify(settings));
    } catch {}
  }
  function applyOrientation() {
    document.body.classList.toggle(
      "portrait-play",
      settings.orientation === "portrait",
    );
    api.orientationChanged?.(settings.orientation);
  }
  function renderAccount(form = "signin") {
    request++;
    const c = $("shell-content");
    if (account.user && !account.recovery) {
      c.innerHTML =
        '<div class="screen-intro"><h1>My Account</h1><p id="account-name"></p></div><div id="account-stats" class="stats-grid"></div><p id="account-message" role="status"></p><button id="account-signout">Sign out</button>';
      $("account-name").textContent =
        account.user.user_metadata?.username || "Player";
      $("account-signout").onclick = async () => {
        try {
          await account.signOut();
          show("account");
        } catch (e) {
          $("account-message").textContent = e.message;
        }
      };
      loadStats();
      return;
    }
    if (account.recovery) form = "password";
    c.innerHTML = `<div class="screen-intro"><h1>${{ signin: "Welcome back.", signup: "Join the colosseum.", reset: "Reset your password.", password: "Choose a new password." }[form]}</h1><p>${account.client ? "Play as a guest any time. Sign in to save Play-mode stats." : "Accounts are not connected yet. You can play as a guest; guest stats are not saved."}</p></div><form id="account-form" class="account-form">${form === "password" ? "" : '<label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label>'}${form === "signup" ? '<label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+"></label>' : ""}${form === "reset" ? "" : `<label>Password<input name="password" type="password" autocomplete="${form === "signin" ? "current-password" : "new-password"}" required minlength="8" maxlength="128"></label>`}<button type="submit" ${!account.client ? "disabled" : ""}>${{ signin: "Sign in", signup: "Create account", reset: "Send recovery email", password: "Update password" }[form]}</button><p id="account-message" role="status"></p></form><div class="account-links"><button id="account-to-signin">Sign in</button><button id="account-to-signup">Create account</button><button id="account-to-reset">Forgot password?</button></div>`;
    for (const key of ["signin", "signup", "reset"])
      $(`account-to-${key}`).onclick = () => renderAccount(key);
    $("account-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.currentTarget,
        values = new FormData(f),
        button = f.querySelector("[type=submit]");
      button.disabled = true;
      const status = $("account-message");
      try {
        if (form === "signin") {
          await account.signIn(values.get("email"), values.get("password"));
          renderAccount();
        } else if (form === "signup") {
          await account.signUp(
            values.get("email"),
            values.get("username"),
            values.get("password"),
          );
          status.textContent =
            "Check your email to confirm your account, then sign in.";
        } else if (form === "reset") {
          await account.reset(values.get("email"));
          status.textContent =
            "If that address has an account, a recovery email is on its way.";
        } else {
          await account.newPassword(values.get("password"));
          renderAccount();
        }
      } catch (error) {
        status.textContent = error.message;
      } finally {
        const password = f.querySelector("[name=password]");
        if (password) password.value = "";
        values.delete("password");
        button.disabled = false;
      }
    };
  }
  function statRows(data) {
    return [
      ["K/D ratio", data?.kd_ratio ?? 0],
      ["Kills", data?.kills ?? 0],
      ["Deaths", data?.deaths ?? 0],
      ["Games won", data?.wins ?? 0],
      ["Games lost", data?.losses ?? 0],
    ];
  }
  async function loadStats() {
    const revision = request;
    try {
      const data = await account.stats();
      if (screen !== "account" || revision !== request) return;
      $("account-stats").replaceChildren(
        ...statRows(data).map(([label, value]) => {
          const card = document.createElement("div");
          const title = document.createElement("span"),
            n = document.createElement("strong");
          title.textContent = label;
          n.textContent = value;
          card.append(title, n);
          return card;
        }),
      );
      $("account-message").textContent =
        "Completed Play matches only. Practice and guest results are not saved.";
    } catch (e) {
      if ($("account-message")) $("account-message").textContent = e.message;
    }
  }
  async function renderLeaderboard() {
    const revision = ++request;
    $("shell-content").innerHTML =
      `<div class="screen-intro"><h1>Leaderboard</h1><p>Signed-in players · single-player AI matches</p></div><label class="leader-filter">Rank by <select id="leader-metric"><option value="kd_ratio">KD Ratio</option><option value="kills">Kills</option><option value="deaths">Deaths</option><option value="wins">Games won</option><option value="losses">Games lost</option></select></label><div id="leader-table"></div><p id="leader-message" role="status">${account.client ? "Loading…" : "Leaderboards are not connected yet. Guest and Practice stats are never saved."}</p><div class="menu-pagination"><button id="leader-prev" ${leaderPage ? "" : "disabled"}>← Previous</button><span>Page ${leaderPage + 1}</span><button id="leader-next" disabled>Next →</button></div>`;
    $("leader-metric").value = metric;
    $("leader-metric").onchange = (e) => {
      metric = e.target.value;
      leaderPage = 0;
      renderLeaderboard();
    };
    $("leader-prev").onclick = () => {
      leaderPage--;
      renderLeaderboard();
    };
    $("leader-next").onclick = () => {
      leaderPage++;
      renderLeaderboard();
    };
    if (!account.client) return;
    try {
      const rows = await account.leaderboard(metric, leaderPage);
      if (screen !== "leaderboard" || revision !== request) return;
      const table = document.createElement("table");
      const header = table.insertRow();
      for (const title of [
        "Rank",
        "Player",
        $("leader-metric").selectedOptions[0].textContent,
      ]) {
        const th = document.createElement("th");
        th.textContent = title;
        header.append(th);
      }
      rows.forEach((row, i) => {
        const tr = table.insertRow();
        for (const v of [leaderPage * 5 + i + 1, row.username, row[metric]])
          tr.insertCell().textContent = v;
      });
      $("leader-table").replaceChildren(table);
      $("leader-message").textContent = rows.length
        ? ""
        : "No completed matches yet.";
      $("leader-next").disabled = rows.length < 5;
    } catch (e) {
      if (screen === "leaderboard") $("leader-message").textContent = e.message;
    }
  }
  account.listeners.add(() => {
    $("shell-account").textContent =
      account.user?.user_metadata?.username || "Guest";
    if (account.recovery) show("account");
    else if (screen === "account") renderAccount();
  });
  $("shell-account").onclick = () => show("account");
  $("shell-back").onclick = () => {
    history.replaceState(null, "", location.pathname);
    show(
      screen === "setup"
        ? category
        : screen === "elements"
          ? "tutorial"
          : screen === "tutorial"
            ? "practice"
            : ["team-battles", "solo-battles"].includes(screen)
              ? "play"
              : "home",
    );
  };
  $("resume-btn").onclick = () => {
    setScreen("battle");
    api.resume();
  };
  document.addEventListener("pointerdown", () => sound.unlock(), {
    passive: true,
  });
  document.addEventListener("keydown", () => sound.unlock());
  function start() {
    setScreen("battle");
    sound.setScene(
      api.game().mode,
      api.game().mode === "corruption" && api.game().countingDown,
      true,
    );
    sound.unlock();
    if (api.game().mode === "corruption") sound.primeTrack();
    matchTicket = account.startMatch(api.game().mode, category === "practice");
    $("save-status").textContent = "";
    sound.tone(300);
  }
  function battleExit() {
    show("setup");
    $("resume-btn").hidden = api.game().finished || !api.started();
  }
  let lastReward = null;
  function tick(g) {
    sound.setScene(
      screen === "battle" && !g.finished ? g.mode : null,
      screen === "battle" &&
        (api.paused() || (g.mode === "corruption" && g.countingDown)),
    );
    if (g.intermission && screen === "battle") {
      reward.hidden = false;
      if (lastReward !== g.wave) {
        api.releaseInput();
        lastReward = g.wave;
        $("wave-reward-caption").textContent =
          `Wave ${g.wave} complete${g.player.parts.length >= 3 ? " · Final boss next" : ""}`;
        $("reward-options").replaceChildren(
          ...g.rewardChoices().map((choice) => {
            const b = document.createElement("button");
            const title = document.createElement("strong"),
              detail = document.createElement("span");
            title.textContent = choice.title;
            detail.textContent = choice.description;
            b.append(title, detail);
            b.dataset.reward = choice.id;
            b.setAttribute("aria-pressed", "false");
            b.onclick = () => g.chooseReward(choice.id);
            return b;
          }),
        );
      }
      const selected = g
        .rewardChoices()
        .find((r) => r.id === g.rewardSelection);
      const message = `${Math.ceil(g.rewardRemaining)}s · ${selected ? `${selected.title} selected — you can change it` : "Choose an advantage; the first option is automatic if you wait"}`;
      if ($("wave-reward-timer").textContent !== message)
        $("wave-reward-timer").textContent = message;
      for (const b of $("reward-options").children)
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.reward === g.rewardSelection),
        );
    } else {
      reward.hidden = true;
      if (!g.intermission) lastReward = null;
    }
    if (g.finished && matchTicket && !matchTicket.saved && !statsBusy) {
      if (!matchTicket.userId || matchTicket.practice) {
        $("save-status").textContent = matchTicket.practice
          ? "Practice · no stats saved."
          : "Guest · no stats saved.";
        matchTicket.saved = true;
      } else {
        statsBusy = true;
        $("save-status").textContent = "Saving result…";
        const ticket = matchTicket;
        account
          .saveMatch(ticket, g)
          .then((saved) => {
            if (ticket === matchTicket)
              $("save-status").textContent = saved
                ? "Stats saved."
                : "Stats were not saved: the signed-in account changed.";
            ticket.saved = true;
          })
          .catch((error) => {
            if (ticket === matchTicket) {
              $("save-status").textContent =
                `Stats not saved. ${error.message}`;
              const retry = document.createElement("button");
              retry.textContent = "Retry saving";
              retry.onclick = () => {
                ticket.saved = false;
              };
              $("save-status").append(retry);
            }
            ticket.saved = true;
          })
          .finally(() => {
            statsBusy = false;
          });
      }
    }
  }
  async function initialize() {
    applyOrientation();
    setScreen("loading");
    $("shell-content").innerHTML =
      '<div class="home-hero"><span class="shell-wordmark">◇ ELEMENTAL</span><p>Opening the colosseum…</p></div>';
    let config = {};
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}app-config.json`,
        { cache: "no-store", signal: AbortSignal.timeout(4000) },
      );
      if (response.ok) config = await response.json();
    } catch {}
    account
      .initialize(config)
      .catch((e) => console.warn("Account service unavailable:", e.message));
    const deepLink = new URLSearchParams(location.search).get("mode");
    if (deepLink && MODES[deepLink]) {
      chooseMode(deepLink);
      return;
    }
    if (account.recovery) return;
    if (config.introVideo && screen === "loading") {
      $("intro-screen").hidden = false;
      const video = $("logo-video");
      video.src = new URL(
        config.introVideo,
        new URL(import.meta.env.BASE_URL, location.href),
      ).href;
      const end = () => {
        video.pause();
        $("intro-screen").hidden = true;
        show("home");
      };
      video.onended = end;
      video.onerror = end;
      $("intro-skip").onclick = end;
      const play = () =>
        video
          .play()
          .then(() => {
            $("intro-play").hidden = true;
          })
          .catch(() => {
            $("intro-play").hidden = false;
          });
      $("intro-play").onclick = play;
      play();
    } else if (screen === "loading") show("home");
  }
  initialize();
  return {
    show,
    chooseMode,
    modeGuide,
    elementSlides,
    openSlides,
    start,
    battleExit,
    tick,
    account,
    settings,
    sound,
    get screen() {
      return screen;
    },
    get slidesOpen() {
      return dialog.open;
    },
  };
}
