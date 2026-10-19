import frames from "./assets/origins.json" with { type: "json" };

const atlasUrl = new URL("./assets/origins.png", import.meta.url).href;

export const ORIGINS = ["water", "dark", "fire", "air", "earth", "light"];
export const ATTACK_NAMES = {
  water: "Tidal palm",
  dark: "Twin dagger slash",
  fire: "Flame fist",
  air: "Wind chop",
  earth: "Stone claw",
  light: "Radiant spear",
};
const sheet = typeof Image === "undefined" ? null : new Image();
let loaded = false;
export const charactersReady = new Promise((resolve) => {
  if (!sheet) {
    resolve(false);
    return;
  }
  sheet.onload = () => {
    loaded = true;
    resolve(true);
  };
  // The procedural avatar remains available if a browser cannot load the atlas.
  sheet.onerror = () => resolve(false);
});
if (sheet) sheet.src = atlasUrl;

export function characterPose(a) {
  const side = Math.abs(a.fx) > Math.abs(a.fy);
  const facing = side ? 1 : a.fy < 0 ? 2 : 0;
  const progress =
    a.swing > 0 ? Math.max(0, Math.min(1, 1 - a.swing / 0.22)) : -1;
  // Match the existing 110ms strike windup. Recoil, contact, then recovery.
  const contact = progress >= 0.5 && progress < 0.92;
  return {
    frame: facing + (contact ? 3 : 0),
    flip: side && a.fx < 0,
    progress,
  };
}

function paintFrame(c, element, frame, flip, height) {
  const spec = frames[element];
  const f = spec.frames[frame];
  const scale = height / spec.height;
  c.save();
  c.imageSmoothingEnabled = false;
  if (flip) c.scale(-1, 1);
  c.drawImage(
    sheet,
    f.x,
    f.y,
    f.w,
    f.h,
    -f.anchorX * scale,
    -f.anchorY * scale,
    f.w * scale,
    f.h * scale,
  );
  c.restore();
}

// All coordinates are visual only: facing and hit timing come from Combat.
export function drawCharacter(c, a, time) {
  if (!loaded || a.parts.length !== 1 || !frames[a.element]) return false;
  const pose = characterPose(a);
  const moving = Math.hypot(a.vx, a.vy) > 15;
  const walk = moving ? Math.sin(time * 13) : 0;
  const p = pose.progress;
  const reach =
    p < 0
      ? 0
      : p < 0.5
        ? -3 * Math.sin(p * Math.PI * 2)
        : 6 * Math.sin((p - 0.5) * Math.PI * 2);
  c.save();
  c.translate(a.fx * reach, a.fy * reach);
  // A short rocking gait preserves the hand-drawn silhouettes at phone scale.
  c.rotate(walk * 0.025);
  paintFrame(c, a.element, pose.frame, pose.flip, 64);
  c.restore();
  return true;
}

export function paintPortraits(root = document) {
  if (!loaded) return;
  for (const canvas of root.querySelectorAll("canvas[data-character]")) {
    const c = canvas.getContext("2d");
    const element = canvas.dataset.character;
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
  if (a.parts.length !== 1 || !ORIGINS.includes(a.element)) return false;
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
  if (a.element === "water") {
    arc("#148cd5", 6, 38 + p * 12, -0.55, 0.65);
    arc("#9ffaff", 2, 42 + p * 12, -0.5, 0.55);
    c.fillStyle = "#c0ffff";
    for (let i = 0; i < 4; i++)
      c.fillRect(40 + p * 18 - i * 2, -17 + i * 10, 3, 3);
  } else if (a.element === "dark") {
    for (const sign of [-1, 1]) {
      c.strokeStyle = sign < 0 ? "#9ca9cf" : "#f1f4ff";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(24, sign * 18);
      c.lineTo(52 + p * 5, -sign * 16);
      c.stroke();
    }
  } else if (a.element === "fire") {
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
  } else if (a.element === "air") {
    arc("#5edbe5", 4, 34 + p * 17, -0.75, 0.7);
    arc("#f4ffff", 2, 40 + p * 15, -0.6, 0.55);
    arc("#a0faff", 1, 47 + p * 12, -0.3, 0.3);
  } else if (a.element === "earth") {
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
