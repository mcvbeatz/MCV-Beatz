import newFusions from "./assets/new-fusions.json" with { type: "json" };
import newMotion from "./assets/new-fusions-motion.json" with { type: "json" };
import newReactions from "./assets/new-fusions-reactions.json" with { type: "json" };
import victoryFrames from "./assets/victory.json" with { type: "json" };
import combatMud from "./assets/combat-mud.json" with { type: "json" };
import tuned from "./assets/tuned-identities.json" with { type: "json" };
import tunedRuns from "./assets/tuned-running.json" with { type: "json" };
import combatOrigins from "./assets/combat-origins.json" with { type: "json" };
import combatGrounded from "./assets/combat-grounded.json" with { type: "json" };
import combatAirborne from "./assets/combat-airborne.json" with { type: "json" };
import combatGravity from "./assets/combat-gravity.json" with { type: "json" };
import combatSun from "./assets/combat-sun.json" with { type: "json" };
import combatLightning from "./assets/combat-lightning.json" with { type: "json" };
import hurtOrigins from "./assets/hurt-origins.json" with { type: "json" };
import hurtGrounded from "./assets/hurt-grounded.json" with { type: "json" };
import hurtAirborne from "./assets/hurt-airborne.json" with { type: "json" };
import { canReactToHit } from "./combat.js";
import origins from "./assets/origins.json" with { type: "json" };
import grounded from "./assets/fusions-grounded.json" with { type: "json" };
import airborne from "./assets/fusions-airborne.json" with { type: "json" };
import originRuns from "./assets/running-origins.json" with { type: "json" };
import fusionRuns from "./assets/running-fusions.json" with { type: "json" };

import revised from "./assets/revised-characters.json" with { type: "json" };
import revisedRuns from "./assets/revised-running.json" with { type: "json" };

export const ORIGINS = ["water", "dark", "fire", "air", "earth", "light"];
const frames = {
  ...origins,
  ...grounded,
  ...airborne,
  ...revised,
  ...tuned,
  ...newFusions,
};
export const CHARACTERS = Object.keys(frames);
export const ATTACK_NAMES = {
  phoenix: "Solar talon",
  terraformer: "Rift gauntlet",
  sanctuary: "Spring lance",
  water: "Tidal palm",
  dark: "Twin dagger slash",
  fire: "Flame fist",
  air: "Wind chop",
  earth: "Stone claw",
  light: "Radiant spear",
  mud: "Mire smash",
  spirit: "Spirit lance",
  mirror: "Prismatic thrust",
  sun: "Solar spear",
  blaze: "Blazing palm",
  cloud: "Storm palm",
  smoke: "Ember blades",
  gravity: "Gravity fist",
  apparition: "Phantom blades",
  demonic: "Infernal slash",
  divine: "Celestial spear",
  "multi-dimensional": "Dimensional blades",
  lightning: "Thunder lance",
  invincible: "Titan fist",
};
function loadAtlas(spec, url) {
  const atlas = {
    spec,
    image: typeof Image === "undefined" ? null : new Image(),
    loaded: false,
  };
  atlas.ready = new Promise((resolve) => {
    if (!atlas.image) {
      resolve(false);
      return;
    }
    atlas.image.onload = () => {
      atlas.loaded = true;
      paintPortraits();
      resolve(true);
    };
    atlas.image.onerror = () => resolve(false);
    atlas.image.src = url;
  });
  return atlas;
}
const victory = loadAtlas(
  victoryFrames,
  new URL("./assets/victory.png", import.meta.url).href,
);
const fusionVictory = loadAtlas(
  newReactions,
  new URL("./assets/new-fusions-reactions.webp", import.meta.url).href,
);
const atlases = [
  loadAtlas(
    newFusions,
    new URL("./assets/new-fusions.webp", import.meta.url).href,
  ),
  loadAtlas(origins, new URL("./assets/origins.webp", import.meta.url).href),
  loadAtlas(
    grounded,
    new URL("./assets/fusions-grounded.webp", import.meta.url).href,
  ),
  loadAtlas(
    airborne,
    new URL("./assets/fusions-airborne.webp", import.meta.url).href,
  ),
];
atlases.push(
  loadAtlas(
    revised,
    new URL("./assets/revised-characters.webp", import.meta.url).href,
  ),
);
const runs = [
  loadAtlas(
    { sanctuary: newMotion.sanctuary },
    new URL("./assets/new-fusions-motion.webp", import.meta.url).href,
  ),
  loadAtlas(
    originRuns,
    new URL("./assets/running-origins.webp", import.meta.url).href,
  ),
  loadAtlas(
    fusionRuns,
    new URL("./assets/running-fusions.webp", import.meta.url).href,
  ),
];
runs.push(
  loadAtlas(
    revisedRuns,
    new URL("./assets/revised-running.webp", import.meta.url).href,
  ),
);
atlases.push(
  loadAtlas(
    tuned,
    new URL("./assets/tuned-identities.webp", import.meta.url).href,
  ),
);
runs.push(
  loadAtlas(
    tunedRuns,
    new URL("./assets/tuned-identities.webp", import.meta.url).href,
  ),
);
const actions = [
  loadAtlas(
    newMotion,
    new URL("./assets/new-fusions-motion.webp", import.meta.url).href,
  ),
  loadAtlas(
    combatOrigins,
    new URL("./assets/combat-origins.webp", import.meta.url).href,
  ),
  loadAtlas(
    combatGrounded,
    new URL("./assets/combat-grounded.webp", import.meta.url).href,
  ),
  loadAtlas(
    combatAirborne,
    new URL("./assets/combat-airborne.webp", import.meta.url).href,
  ),
  loadAtlas(
    combatGravity,
    new URL("./assets/combat-gravity.webp", import.meta.url).href,
  ),
  loadAtlas(
    combatSun,
    new URL("./assets/combat-sun.webp", import.meta.url).href,
  ),
  loadAtlas(
    combatLightning,
    new URL("./assets/combat-lightning.webp", import.meta.url).href,
  ),
];
actions.push(
  loadAtlas(
    combatMud,
    new URL("./assets/combat-mud.webp", import.meta.url).href,
  ),
);
const hurts = [
  fusionVictory,
  loadAtlas(
    hurtOrigins,
    new URL("./assets/hurt-origins.webp", import.meta.url).href,
  ),
  loadAtlas(
    hurtGrounded,
    new URL("./assets/hurt-grounded.webp", import.meta.url).href,
  ),
  loadAtlas(
    hurtAirborne,
    new URL("./assets/hurt-airborne.webp", import.meta.url).href,
  ),
];
const actionByElement = Object.fromEntries(
  actions.flatMap((atlas) => Object.keys(atlas.spec).map((e) => [e, atlas])),
);
const hurtByElement = Object.fromEntries(
  hurts.flatMap((atlas) => Object.keys(atlas.spec).map((e) => [e, atlas])),
);
const byElement = Object.fromEntries(
  atlases.flatMap((atlas) => Object.keys(atlas.spec).map((e) => [e, atlas])),
);
const runByElement = Object.fromEntries(
  runs.flatMap((atlas) => Object.keys(atlas.spec).map((e) => [e, atlas])),
);
export const charactersReady = Promise.all(
  [victory, ...atlases, ...runs, ...actions, ...hurts].map((a) => a.ready),
).then((loaded) => loaded.every(Boolean));

export function isRunning(a) {
  return (
    a.alive &&
    !a.ghost &&
    !a.lock &&
    !a.parts.includes("air") &&
    !a.blink &&
    a.movingTime > 0 &&
    Math.hypot(a.vx, a.vy) > 3
  );
}

export function characterPose(a) {
  const dashing = a.alive && !a.ghost && !a.blink && a.burst > 0;
  const clashing = !dashing && a.clash > 0;
  // Blaze follows its travel vector even when target lock faces another way.
  const fx = dashing ? a.burstX : clashing ? a.clashFx : a.fx,
    fy = dashing ? a.burstY : clashing ? a.clashFy : a.fy;
  const side = Math.abs(fx) > Math.abs(fy);
  const facing = side ? 1 : fy < 0 ? 2 : 0;
  const progress =
    a.swing > 0 ? Math.max(0, Math.min(1, 1 - a.swing / 0.22)) : -1;
  // Match the existing 110ms strike windup. Recoil, contact, then recovery.
  const contact = progress >= 0.5 && progress < 0.92;
  const reacting = !dashing && a.hitReact > 0 && canReactToHit(a);
  const sidestepping =
    !dashing &&
    !!a.lock &&
    a.alive &&
    !a.ghost &&
    !a.blink &&
    !a.charging &&
    !a.shield &&
    a.movingTime > 0 &&
    Math.hypot(a.vx, a.vy) > 3 &&
    progress < 0 &&
    !clashing &&
    !reacting;
  const running =
    !dashing && isRunning(a) && progress < 0 && !clashing && !reacting;
  // movingTime advances only for actual voluntary movement; a wall, Shock,
  // a portal or a teleport must not produce a treadmill animation.
  const cadence =
    Math.max(0.2, Math.min(1.8, Math.hypot(a.vx, a.vy) / 150)) * 10;
  const cycle = a.movingTime * cadence;
  const stride = Math.floor(cycle) % 4;
  return {
    dashing,
    dashX: dashing ? fx : 0,
    dashY: dashing ? fy : 0,
    dashLean: dashing
      ? Math.min(1, (0.3 - a.burst) / 0.045, a.burst / 0.06)
      : 0,
    frame: facing + (!dashing && (contact || clashing) ? 3 : 0),
    flip: side && fx < 0,
    progress,
    running,
    reacting,
    facing,
    sidestepping,
    stepFrame: sidestepping ? facing * 2 + (stride < 2 ? 0 : 1) : null,
    hurtFrame: reacting ? facing : null,
    runFrame:
      running && ["earth", "mud"].includes(a.element)
        ? facing * 2 + (stride < 2 ? 0 : 1)
        : running && stride % 2 === 0
          ? facing * 2 + (stride === 2 ? 1 : 0)
          : null,
    bob: running ? Math.abs(Math.sin((cycle * Math.PI) / 2)) * 2 : 0,
  };
}

function paintFrame(
  c,
  element,
  frame,
  flip,
  height,
  running = false,
  flash = 0,
) {
  let atlas =
    running === "step"
      ? actionByElement[element]
      : running === "hurt"
        ? element === "mud"
          ? null
          : hurtByElement[element]
        : running
          ? runByElement[element]
          : byElement[element];
  if (running === "hurt" && !atlas?.loaded) {
    atlas = actionByElement[element];
    frame += 6;
  }
  if (!atlas?.loaded) return false;
  const spec = atlas.spec[element];
  const f = spec.frames[frame];
  const scale = height / spec.height;
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  if (!!flip !== !!f.mirror) c.scale(-1, 1);
  c.drawImage(
    atlas.image,
    f.x,
    f.y,
    f.w,
    f.h,
    -f.anchorX * scale,
    -f.anchorY * scale,
    f.w * scale,
    f.h * scale,
  );
  if (flash > 0) {
    if (!atlas.white) {
      atlas.white = document.createElement("canvas");
      atlas.white.width = atlas.image.width;
      atlas.white.height = atlas.image.height;
      const tint = atlas.white.getContext("2d");
      tint.drawImage(atlas.image, 0, 0);
      tint.globalCompositeOperation = "source-in";
      tint.fillStyle = "#fffbe5";
      tint.fillRect(0, 0, atlas.white.width, atlas.white.height);
    }
    c.globalAlpha *= flash;
    c.drawImage(
      atlas.white,
      f.x,
      f.y,
      f.w,
      f.h,
      -f.anchorX * scale,
      -f.anchorY * scale,
      f.w * scale,
      f.h * scale,
    );
  }
  c.restore();
  return true;
}

// All coordinates are visual only: facing and hit timing come from Combat.
export function drawCharacter(c, a, time) {
  if (a.victory && newReactions[a.element] && fusionVictory.loaded) {
    const spec = newReactions[a.element],
      f = spec.frames[3];
    const scale = 76 / spec.height;
    c.save();
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(
      fusionVictory.image,
      f.x,
      f.y,
      f.w,
      f.h,
      -f.anchorX * scale,
      8 - f.anchorY * scale,
      f.w * scale,
      f.h * scale,
    );
    c.restore();
    return true;
  }
  if (a.victory && victoryFrames[a.element] && victory.loaded) {
    const f = victoryFrames[a.element],
      scale = 76 / f.h;
    c.drawImage(
      victory.image,
      f.x,
      f.y,
      f.w,
      f.h,
      (-f.w * scale) / 2,
      8 - f.h * scale,
      f.w * scale,
      f.h * scale,
    );
    return true;
  }
  if (!byElement[a.element]?.loaded) return false;
  const pose = characterPose(a);
  const p = pose.progress;
  const reach =
    p < 0
      ? 0
      : p < 0.5
        ? -3 * Math.sin(p * Math.PI * 2)
        : 6 * Math.sin((p - 0.5) * Math.PI * 2);
  c.save();
  c.translate(a.fx * reach, a.fy * reach);
  if (pose.dashing) {
    // Shear from the feet so the head leads the dash, using the matching
    // directional frame rather than rotating the face toward the ground.
    c.transform(
      1,
      0,
      -pose.dashX * pose.dashLean * 0.48,
      1 - pose.dashY * pose.dashLean * 0.18,
      0,
      0,
    );
  }
  if (pose.reacting) {
    const recoil = Math.sin((1 - a.hitReact / 0.24) * Math.PI);
    c.translate(a.hitDx * recoil * 11, a.hitDy * recoil * 7 - recoil * 3);
    c.rotate(a.hitDx * recoil * 0.16);
  }
  if (a.clash > 0) {
    const brace = 3 + Math.sin((0.3 - a.clash) * 45) * 1.5;
    c.translate(a.clashFx * brace, a.clashFy * brace);
  }
  const running = pose.runFrame !== null && runByElement[a.element]?.loaded;
  const sidestepping = pose.sidestepping && actionByElement[a.element]?.loaded;
  const hurt =
    pose.reacting &&
    (hurtByElement[a.element]?.loaded || actionByElement[a.element]?.loaded);
  if (sidestepping) {
    // A short lateral weight transfer preserves target-facing and never plays a run cycle.
    const shift = Math.sin(a.movingTime * 12) * 2;
    c.translate(-a.fy * shift, a.fx * shift * 0.45);
  }
  paintFrame(
    c,
    a.element,
    hurt
      ? pose.hurtFrame
      : sidestepping
        ? pose.stepFrame
        : running
          ? pose.runFrame
          : pose.frame,
    pose.flip,
    (running || sidestepping) && ["earth", "mud"].includes(a.element) ? 44 : 64,
    hurt ? "hurt" : sidestepping ? "step" : running,
    a.spawnFlash > 0 ? 0.35 + Math.abs(Math.sin(a.spawnFlash * 22)) * 0.65 : 0,
  );
  if (a.parts.length === 2) {
    // Keep the level-II shine with the new silhouettes (and inherited alpha).
    const glint = 0.35 + Math.max(0, Math.sin(time * 2.8)) * 0.65;
    c.globalAlpha *= glint;
    c.fillStyle = "#f7fcff";
    c.fillRect(-9, -54, 2, 8);
    c.fillRect(-12, -51, 8, 2);
  }
  c.restore();
  return true;
}

// Keep the directional hurt silhouette upright while it fades away.
export function deathPose(death) {
  const p = Math.max(0, Math.min(1, death.elapsed / death.duration));
  return {
    progress: p,
    opacity: Math.min(1, (1 - p) / 0.6),
    rotation: 0,
    x: 0,
    y: death.fighter.parts.includes("air") ? -8 : 0,
  };
}
export function drawFallenCharacter(c, death, color = "#e1d8b5") {
  const a = death.fighter,
    pose = deathPose(death);
  if (pose.opacity <= 0) return false;
  const side = Math.abs(a.fx) > Math.abs(a.fy);
  const facing = side ? 1 : a.fy < 0 ? 2 : 0;
  c.save();
  c.globalAlpha *= pose.opacity;
  c.fillStyle = "#10172266";
  c.beginPath();
  c.ellipse(0, 7, 21, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(pose.x, pose.y);
  const drawn =
    paintFrame(c, a.element, facing, side && a.fx < 0, 64, "hurt") ||
    paintFrame(c, a.element, facing, side && a.fx < 0, 64);
  c.restore();
  if (pose.progress > 0.45) {
    const disperse = (pose.progress - 0.45) / 0.55;
    c.fillStyle = color;
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.4;
      const radius = 8 + disperse * (16 + (i % 4) * 6);
      c.beginPath();
      c.arc(
        pose.x * 2 + Math.cos(angle) * radius,
        2 + Math.sin(angle) * radius * 0.4 - disperse * 20,
        1.3 + (i % 3) * 0.5,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
  c.restore();
  return drawn;
}

export function paintPortraits(root = document) {
  for (const canvas of root.querySelectorAll("canvas[data-character]")) {
    const c = canvas.getContext("2d");
    const element = canvas.dataset.character;
    if (!byElement[element]?.loaded) continue;
    const frame = Number(canvas.dataset.view || 0);
    const spec = frames[element];
    const f = spec.frames[frame];
    const scale = Math.min(
      (canvas.height - 12) / spec.height,
      (canvas.width - 6) / f.w,
    );
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.translate(
      (canvas.width - f.w * scale) / 2 + f.anchorX * scale,
      canvas.height - 5,
    );
    paintFrame(c, element, frame, false, scale * spec.height);
    c.restore();
  }
}

export function portraitMarkup(element, view = 0) {
  return `<canvas class="character-portrait" data-character="${element}" data-view="${view}" width="96" height="96" aria-hidden="true"></canvas>`;
}

export function drawCharacterStrike(c, a) {
  if (!CHARACTERS.includes(a.element)) return false;
  if (a.clash > 0) return true;
  const style = weaponStyle(a.element);
  if (a.swing <= 0 || a.swing > 0.11) return true;
  const p = Math.min(1, (0.11 - a.swing) / 0.11);
  const angle = Math.atan2(a.fy, a.fx);
  c.save();
  c.translate(0, -26);
  c.rotate(angle);
  c.globalAlpha *= 1 - p * 0.8;
  c.lineCap = "square";
  const arc = (color, width, radius, start, end) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(0, 0, radius, start, end);
    c.stroke();
  };
  if (style === "water") {
    arc("#148cd5", 6, 38 + p * 12, -0.55, 0.65);
    arc("#9ffaff", 2, 42 + p * 12, -0.5, 0.55);
    c.fillStyle = "#c0ffff";
    for (let i = 0; i < 4; i++)
      c.fillRect(40 + p * 18 - i * 2, -17 + i * 10, 3, 3);
  } else if (style === "dark") {
    for (const sign of [-1, 1]) {
      c.strokeStyle = sign < 0 ? "#9ca9cf" : "#f1f4ff";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(24, sign * 18);
      c.lineTo(52 + p * 5, -sign * 16);
      c.stroke();
    }
  } else if (style === "fire") {
    c.translate(p * 9, 0);
    c.fillStyle = "#f34b17";
    c.beginPath();
    for (const [i, point] of [
      [26, 4],
      [35, -4],
      [43, -11],
      [42, -3],
      [55, -1],
      [48, 5],
      [54, 10],
      [41, 9],
      [37, 14],
      [34, 8],
    ].entries()) {
      if (i === 0) c.moveTo(...point);
      else c.lineTo(...point);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#ffb92c";
    c.fillRect(34, -2, 10, 9);
    c.fillStyle = "#fff5ae";
    c.fillRect(40, 0, 5, 4);
    c.fillStyle = "#ffcf5e";
    for (let i = 0; i < 3; i++) c.fillRect(48 + p * 15, -14 + i * 13, 3, 3);
  } else if (style === "air") {
    arc("#5edbe5", 4, 34 + p * 17, -0.75, 0.7);
    arc("#f4ffff", 2, 40 + p * 15, -0.6, 0.55);
    arc("#a0faff", 1, 47 + p * 12, -0.3, 0.3);
  } else if (style === "earth") {
    for (let i = 0; i < 5; i++) {
      c.fillStyle = i % 2 ? "#b5a46a" : "#654b2e";
      const size = 7 - i;
      c.fillRect(33 + p * (14 + i * 3), (i - 2) * (5 + p * 5), size, size);
    }
    for (let i = -1; i <= 1; i++) {
      c.strokeStyle = "#f1e3b4";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(27, i * 7);
      c.lineTo(49 + p * 7, i * 7 + 3);
      c.stroke();
    }
  } else {
    c.strokeStyle = "#ffe6a0";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(19, 0);
    c.lineTo(57 + p * 3, 0);
    c.stroke();
    c.fillStyle = "#ffffff";
    c.fillRect(53 + p * 3, -6, 2, 13);
    c.fillRect(48 + p * 3, -1, 12, 2);
  }
  c.restore();
  return true;
}

export function weaponStyle(element) {
  return (
    {
      mud: "earth",
      spirit: "light",
      mirror: "light",
      sun: "light",
      blaze: "fire",
      cloud: "water",
      smoke: "dark",
      gravity: "earth",
      apparition: "dark",
      demonic: "dark",
      divine: "light",
      "multi-dimensional": "dark",
      lightning: "light",
      invincible: "earth",
      phoenix: "light",
      terraformer: "earth",
      sanctuary: "light",
    }[element] || element
  );
}
