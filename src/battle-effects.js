import { inWorld, visibility, distance } from "./combat.js";
import { weaponStyle } from "./characters.js";

const TAU = Math.PI * 2;
export function immersionFor(game, a) {
  if (a.ghost || game.flying(a)) return 0;
  const hazards = game.hazards.filter(inWorld);
  if (hazards.some((h) => h.kind === "flood" && distance(h, a) <= h.r))
    return 32;
  if (
    !hazards.some((h) => h.kind === "flood") &&
    hazards.some((h) => h.kind === "quicksand" && distance(h, a) <= h.r)
  )
    return 10;
  return 0;
}

export function drawTerrain(c, game, time) {
  const hazards = game.hazards.filter(inWorld);
  const flooded = hazards.some((h) => h.kind === "flood");
  for (const h of hazards) {
    if (h.kind === "gravity" || (flooded && h.kind === "quicksand")) continue;
    if (!["flood", "quicksand"].includes(h.kind)) {
      c.save();
      c.globalAlpha = 0.3 + Math.sin(time * 4) * 0.07;
      c.fillStyle =
        { magma: "#ef7642", vog: "#8d7599", heatwave: "#f4ad4f" }[h.kind] ||
        "#aaa";
      c.beginPath();
      c.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, TAU);
      c.fill();
      c.globalAlpha = 0.55;
      c.strokeStyle = c.fillStyle;
      c.setLineDash([6, 10]);
      c.stroke();
      c.restore();
      continue;
    }
    c.save();
    c.beginPath();
    c.rect(135, 175, 754, 385);
    c.clip();
    c.beginPath();
    c.arc(h.x, h.y, h.r, 0, TAU);
    c.clip();
    if (h.kind === "flood") {
      const water = c.createLinearGradient(0, 175, 0, 560);
      water.addColorStop(0, "#377f9bcf");
      water.addColorStop(1, "#195a78e8");
      c.fillStyle = water;
      c.fillRect(135, 175, 754, 385);
      for (let y = 180; y < 570; y += 17) {
        c.strokeStyle = y % 3 ? "#9cdeea66" : "#c5f3f277";
        c.lineWidth = 1.5;
        c.beginPath();
        for (let x = 130; x <= 900; x += 9) {
          const yy = y + Math.sin(x * 0.045 + time * 2 + y) * 3;
          if (x === 130) c.moveTo(x, yy);
          else c.lineTo(x, yy);
        }
        c.stroke();
      }
      for (let i = 0; i < 30; i++) {
        const x = 140 + ((i * 113 + time * 9) % 740);
        const y = 180 + ((i * 83) % 370);
        c.fillStyle = "#d7f9ed55";
        c.fillRect(x, y + Math.sin(time * 3 + i) * 3, 8, 1);
      }
    } else if (h.kind === "quicksand") {
      const sand = c.createRadialGradient(h.x, h.y, 3, h.x, h.y, h.r);
      sand.addColorStop(0, "#493824");
      sand.addColorStop(0.35, "#a57e49");
      sand.addColorStop(1, "#d6b879");
      c.fillStyle = sand;
      c.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
      for (let i = 0; i < 8; i++) {
        const radius = h.r * (1 - ((time * 0.16 + i / 8) % 1));
        c.strokeStyle = i % 2 ? "#efd49b88" : "#6d512e88";
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(h.x, h.y, radius, radius * 0.8, time * 0.12, 0, TAU);
        c.stroke();
      }
      for (let i = 0; i < 48; i++) {
        const r = h.r * (1 - ((time * 0.22 + i * 0.137) % 1));
        const angle = i * 2.4 + time * 0.7;
        c.fillStyle = i % 2 ? "#e7c58b" : "#775832";
        c.fillRect(
          h.x + Math.cos(angle) * r,
          h.y + Math.sin(angle) * r * 0.8,
          2,
          2,
        );
      }
    } else {
      c.globalAlpha = 0.3 + Math.sin(time * 4) * 0.07;
      c.fillStyle =
        { magma: "#ef7642", vog: "#8d7599", heatwave: "#f4ad4f" }[h.kind] ||
        "#aaa";
      c.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    }
    c.restore();
  }
}

export function drawWaterline(c, a, depth, time) {
  if (!depth) return;
  c.save();
  c.translate(a.x, a.y - depth);
  c.strokeStyle = depth === 32 ? "#b9edf0bb" : "#e3c38d";
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(
    0,
    1,
    depth === 32 ? 23 : 19,
    4 + Math.sin(time * 5) * 0.8,
    0,
    0,
    Math.PI,
  );
  c.stroke();
  c.strokeStyle = depth === 32 ? "#75d4e788" : "#75583488";
  c.beginPath();
  c.ellipse(0, 3, 29, 7, 0, 0.2, Math.PI - 0.2);
  c.stroke();
  c.restore();
}

export function drawReflectShield(c, a, time, front) {
  if (!(a.reflect > 0)) return;
  const angle = time * 13;
  if (Math.sin(angle) >= 0 !== front) return;
  c.save();
  c.translate(Math.cos(angle) * 31, -32 + Math.sin(angle) * 12);
  c.scale(0.35 + Math.abs(Math.sin(angle)) * 0.65, 1);
  c.globalAlpha *= Math.min(1, a.reflect / 0.12);
  c.fillStyle = "#d8efff38";
  c.strokeStyle = "#e6f5ffd9";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, -22);
  c.lineTo(15, -14);
  c.lineTo(13, 9);
  c.lineTo(0, 22);
  c.lineTo(-13, 9);
  c.lineTo(-15, -14);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = "#a8c9f388";
  c.beginPath();
  c.moveTo(-9, -10);
  c.lineTo(8, 6);
  c.moveTo(-3, -14);
  c.lineTo(10, -1);
  c.stroke();
  c.restore();
}

function clashWeapon(c, element, x, y, endX, endY) {
  const style = weaponStyle(element);
  const length = Math.hypot(endX - x, endY - y);
  c.save();
  c.translate(x, y);
  c.rotate(Math.atan2(endY - y, endX - x));
  if (style === "light") {
    c.strokeStyle = "#76572d";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(length - 7, 0);
    c.stroke();
    c.fillStyle = "#f4f3d7";
    c.strokeStyle = "#c5a150";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(length, 0);
    c.lineTo(length - 13, -5);
    c.lineTo(length - 10, 0);
    c.lineTo(length - 13, 5);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (style === "dark") {
    for (const sign of [-1, 1]) {
      c.strokeStyle = "#ad8d5c";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, sign * 6);
      c.lineTo(7, sign * 4);
      c.stroke();
      c.fillStyle =
        element === "demonic" || element === "smoke" ? "#f8a567" : "#dce7f4";
      c.beginPath();
      c.moveTo(6, sign * 8);
      c.lineTo(length, 0);
      c.lineTo(10, sign * 2);
      c.closePath();
      c.fill();
    }
  } else if (style === "earth") {
    c.fillStyle =
      element === "gravity"
        ? "#9261bc"
        : element === "invincible"
          ? "#c8974b"
          : "#927344";
    c.fillRect(Math.max(0, length - 19), -9, 16, 18);
    c.strokeStyle = "#efe4ba";
    c.lineWidth = 2;
    for (const yy of [-6, 0, 6]) {
      c.beginPath();
      c.moveTo(length - 7, yy);
      c.lineTo(length, yy * 0.4);
      c.stroke();
    }
  } else {
    c.fillStyle =
      style === "fire" ? "#ffc040" : style === "water" ? "#39d4f4" : "#c8f8fc";
    c.beginPath();
    c.arc(length - 7, 0, 9, 0, TAU);
    c.fill();
    c.strokeStyle = style === "fire" ? "#fff4c1" : "#f1ffff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(length - 5, 0, 8, -1.3, 1.3);
    c.stroke();
  }
  c.restore();
}

export function drawClashes(c, game) {
  for (const a of game.fighters) {
    if (!a.alive || !inWorld(a) || !(a.clash > 0) || visibility(a) <= 0)
      continue;
    const b = game.fighters.find((f) => f.id === a.clashPartner);
    if (
      !b?.alive ||
      !inWorld(b) ||
      b.clash <= 0 ||
      b.clashPartner !== a.id ||
      a.id > b.id ||
      visibility(b) <= 0
    )
      continue;
    const x = (a.x + b.x) / 2,
      y = (a.y + b.y) / 2 - 27;
    const recoil = Math.sin((0.3 - a.clash) * 50) * 2;
    c.save();
    c.globalAlpha *= Math.min(visibility(a), visibility(b));
    clashWeapon(c, a.element, a.x, a.y - 27, x + recoil, y);
    clashWeapon(c, b.element, b.x, b.y - 27, x - recoil, y);
    c.fillStyle = "#fff6c9";
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * TAU;
      const radius = i % 2 ? 3 : 10 + Math.abs(recoil);
      const xx = x + Math.cos(angle) * radius,
        yy = y + Math.sin(angle) * radius;
      if (i === 0) c.moveTo(xx, yy);
      else c.lineTo(xx, yy);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = "#fff3b0";
    c.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * TAU,
        radius = 8 + (0.3 - a.clash) * 45;
      c.beginPath();
      c.moveTo(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4);
      c.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      c.stroke();
    }
    c.restore();
  }
}

export function distortGravity(c, canvas, buffer, game, view, time) {
  const fields = game.hazards.filter((h) => inWorld(h) && h.kind === "gravity");
  if (!fields.length) return;
  if (buffer.width !== canvas.width || buffer.height !== canvas.height) {
    buffer.width = canvas.width;
    buffer.height = canvas.height;
  }
  const b = buffer.getContext("2d");
  b.clearRect(0, 0, buffer.width, buffer.height);
  b.drawImage(canvas, 0, 0);
  for (const h of fields) {
    c.save();
    c.beginPath();
    c.arc(h.x, h.y, h.r, 0, TAU);
    c.clip();
    c.setTransform(1, 0, 0, 1, 0, 0);
    // Offset copies provide a soft blur even on Safari without Canvas filters.
    c.globalAlpha = 0.19;
    for (const [dx, dy] of [
      [-1.5, 0],
      [1.5, 0],
      [0, -1.5],
      [0, 1.5],
    ])
      c.drawImage(buffer, dx, dy);
    const left = Math.max(0, Math.floor((h.x - h.r) * view.scale + view.tx));
    const right = Math.min(
      canvas.width,
      Math.ceil((h.x + h.r) * view.scale + view.tx),
    );
    const top = Math.max(0, Math.floor((h.y - h.r) * view.scale + view.ty));
    const bottom = Math.min(
      canvas.height,
      Math.ceil((h.y + h.r) * view.scale + view.ty),
    );
    c.globalAlpha = 0.24;
    if (right > left)
      for (let y = top; y < bottom - 2; y += 5) {
        const dx = Math.sin(y * 0.6 + time * 15) * 2;
        c.drawImage(
          buffer,
          left,
          y,
          right - left,
          2,
          left + dx,
          y,
          right - left,
          2,
        );
      }
    c.globalAlpha = 0.12;
    c.fillStyle = "#8c50c7";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.restore();
  }
}
