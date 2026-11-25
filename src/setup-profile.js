import { skillsFor, extraSkillsFor, recipe, COMBOS, nameOf } from "./combat.js";
import { SKILL_HELP } from "./mode-catalog.js";
import { portraitMarkup, paintPortraits } from "./characters.js";
import { icon } from "./icons.js";

// Editorial play-style comparisons, not combat multipliers. Gameplay values stay
// in Combat. Compatibility counts actual recipes reachable from the chosen form.
const RATINGS = {
  light: [2, 4, 3, 2],
  dark: [2, 3, 3, 3],
  water: [4, 2, 4, 3],
  air: [3, 2, 3, 5],
  earth: [2, 5, 1, 2],
  fire: [4, 2, 3, 2],
  ice: [3, 3, 4, 3],
  abyssal: [4, 5, 4, 2],
  mud: [3, 4, 4, 2],
  spirit: [2, 4, 3, 5],
  mirror: [2, 5, 2, 2],
  sun: [5, 3, 5, 2],
  blaze: [4, 2, 2, 5],
  cloud: [4, 3, 5, 5],
  smoke: [4, 3, 4, 3],
  gravity: [3, 5, 4, 2],
  apparition: [3, 3, 3, 5],
  demonic: [5, 3, 4, 5],
  divine: [2, 5, 4, 5],
  "multi-dimensional": [2, 5, 3, 5],
  lightning: [5, 3, 5, 5],
  invincible: [5, 5, 2, 1],
  phoenix: [5, 4, 5, 5],
  terraformer: [4, 5, 4, 5],
  sanctuary: [2, 5, 3, 2],
};
const SHORT_HELP = {
  Healing: "Charge to restore health to the living ally who needs it most.",
  Flash: "Briefly blind nearby vulnerable fighters and create space.",
  "Hydro pump": "Launch a focused jet of water that pushes rivals back.",
  "Sonic boom": "Send a spreading sound wave that weakens with distance.",
  "Rock shield": "Hold a breakable shield to absorb incoming attacks.",
  Flamethrower: "Charge and release a directional fire attack.",
  Magma: "Place molten ground ahead of you for 15 seconds.",
  Sabotage: "Cancel an enemy's charge or nullify their next ability attempt.",
  "Shadow step": "Dodge the next strike while the skill is active.",
  "Icicle Burst": "Hold to fire a rapid, continuous stream of icicles.",
  "Void Mantle":
    "Hold a dark-water and stone shield that damages nearby enemies.",
  "Stone Prison": "Trap a nearby enemy inside a breakable stone cage.",
  Portals: "Connect two places; tap again to close your oldest portal.",
  "Life spring": "Place a permanent healing spring, once per match.",
  "Lightning strikes":
    "Strike a nearby rival with lightning. Flood spreads the strike.",
  Telekinesis: "Push a nearby rival away, or swipe them across the field.",
  Chasm: "Tap the field to open a lethal rift beneath grounded fighters.",

  "Laser beam": "Fire a fast, piercing beam through the arena.",
  Heatwave: "Surround yourself with damaging heat.",
  Tornado: "Send a swirling tornado toward your rivals.",
  Flood: "Flood the field; Water moves faster while grounded rivals slow.",
  Vog: "Expand a cloud of damaging volcanic fog.",
  "Speed burst": "Dash forward with a flame trail and contact damage.",
  "Gravity x2": "Pull nearby fighters into a heavy gravitational field.",
  Doppelgänger: "Summon a double that pursues your enemies.",
  Phase: "Briefly phase out of danger.",
  Minions: "Charge to summon stronger allies that hunt rivals.",
  Death: "Place a sigil that demotes forms on contact, once per match.",
  Radiance: "Heal every living teammate, including yourself.",
  Tailwind: "Boost your movement speed.",
  Teleport: "Tap the field to step through space after a short preparation.",
  Explosion: "Blast nearby fighters away and deal damage.",
};
const abilitySymbols = {
  Healing: "healing",
  Radiance: "healing",
  Flash: "light",
  "Hydro pump": "water",
  Flood: "water",
  "Sonic boom": "air",
  Gust: "air",
  Tailwind: "air",
  Tornado: "air",
  "Rock shield": "invincible",
  "Stone Prison": "earth",
  "Void Mantle": "abyssal",
  Magma: "magma",
  Flamethrower: "fire",
  "Speed burst": "strike",
  "Icicle Burst": "ice",
  Teleport: "portals",
  Portals: "portals",
  Revival: "revival",
  "Life spring": "healing",
  "Lightning strikes": "lightning",
  "Laser beam": "lightning",
  Heatwave: "fire",
  "Gravity x2": "gravity",
  Telekinesis: "gravity",
  Chasm: "chasm",
  Explosion: "explosion",
  "Shadow step": "dark",
  Blindness: "dark",
  Sabotage: "practice",
  Doppelgänger: "team",
  Minions: "team",
};
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function setupDetails(element, mode) {
  let abilities = [
    ...skillsFor(element),
    ...extraSkillsFor(element).map((s) => s.name),
  ].filter(Boolean);
  if (element === "multi-dimensional") abilities.unshift("Teleport");
  if (mode === "corruption") abilities = ["Healing"];
  if (mode === "turnpike") abilities = ["Tailwind"];
  abilities = [...new Set(abilities)];
  const parts = recipe(element);
  const compatible = Object.keys(COMBOS).filter((key) => {
    const target = key.split("+");
    return (
      target.length > parts.length && parts.every((p) => target.includes(p))
    );
  }).length;
  return {
    abilities: abilities.map((name) => ({
      name,
      description: (
        SHORT_HELP[name] ||
        SKILL_HELP[name] ||
        "Use this skill from its ability button."
      ).split(/(?<=[.!?])\s+(?=[A-Z])/)[0],
    })),
    ratings: [...RATINGS[element], Math.min(5, compatible)],
    compatible,
  };
}
export function renderSetupProfile(root, element, profile, mode) {
  const details = setupDetails(element, mode);
  const stats = ["Power", "Defense", "Range", "Mobility", "Compatibility"];
  const symbols = ["strike", "invincible", "practice", "air", "fusion"];
  root.style.setProperty("--profile-color", profile.color);
  root.innerHTML = `<div class="setup-champion" aria-label="${esc(profile.name)} artwork"><div class="champion-halo"></div>${portraitMarkup(element).replaceAll('="96"', '="360"')}</div><div class="setup-kit"><div class="profile-heading"><h2 id="profile-name">${esc(profile.name)}</h2><span class="tier">${["I", "II", "III"][recipe(element).length - 1]}</span></div><h3 class="ornament-heading">◇ Abilities ◇</h3><div class="setup-abilities">${details.abilities.map((a) => `<article class="setup-ability"><span>${icon(abilitySymbols[a.name] || element)}</span><div><h4>${esc(a.name)}</h4><p>${esc(a.description)}</p></div></article>`).join("")}</div>${mode === "turnpike" ? '<p class="setup-mode-note">Collect an ability drop on the track to gain another skill.</p>' : ""}</div><section class="setup-passive"><h3>◆ Passive Ability ◆</h3><div>${icon("invincible")}<strong id="profile-passive">${esc(profile.passive)}</strong></div></section><section class="setup-comparison"><h3 class="ornament-heading">◇ Comparison Stats ◇</h3><p>Relative play-style strengths · ${details.compatible} further fusion${details.compatible === 1 ? "" : "s"}</p>${stats.map((label, i) => `<div class="comparison-row">${icon(symbols[i])}<span>${label}</span><meter min="0" max="5" value="${details.ratings[i]}" aria-label="${esc(nameOf(element))} ${label}"></meter><b>${details.ratings[i]} / 5</b></div>`).join("")}</section>`;
  paintPortraits(root);
}
