import { inWorld, visibility, distance, hasPassive } from "./combat.js";
import { weaponStyle } from "./characters.js";

const TAU = Math.PI * 2;
export function immersionFor(game, a) {
  if (a.ghost || game.flying(a)) return 0;
  const hazards = game.hazards.filter(inWorld);
  if (hazards.some((h) => h.kind === "flood" && distance(h, a) <= h.r))
    return 32;
  if (
    !hasPassive(a, "mud") &&
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
    if (h.kind === "death") {
      c.save();
      c.translate(h.x, h.y);
      c.scale(1, 0.7);
      c.fillStyle = "#1b1229dd";
      c.strokeStyle = "#f3e4ca";
      c.lineWidth = 2;
      c.shadowColor = "#fff2db";
      c.shadowBlur = 12;
      c.beginPath();
      c.arc(0, 0, h.r, 0, TAU);
      c.fill();
      c.stroke();
      c.rotate(time * 0.35);
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * TAU) / 6;
        c.moveTo(Math.cos(angle) * h.r * 0.86, Math.sin(angle) * h.r * 0.86);
        c.lineTo(
          Math.cos(angle + TAU / 3) * h.r * 0.86,
          Math.sin(angle + TAU / 3) * h.r * 0.86,
        );
      }
      c.stroke();
      c.rotate(-time * 0.7);
      c.beginPath();
      c.arc(0, 0, h.r * 0.42, 0, TAU);
      c.stroke();
      c.fillStyle = "#fff6e9";
      c.fillRect(-3, -14, 6, 28);
      c.fillRect(-12, -3, 24, 6);
      c.restore();
      continue;
    }
    if (h.kind === "magma") {
      // Match the existing ground footprint, with molten channels and dark crust.
      c.save();
      c.beginPath();
      c.rect(135, 175, 754, 385);
      c.clip();
      c.beginPath();
      c.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, TAU);
      c.clip();
      const lava = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      lava.addColorStop(0, "#ffc14a");
      lava.addColorStop(0.5, "#fa651b");
      lava.addColorStop(1, "#a92a12");
      c.fillStyle = lava;
      c.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
      for (let row = -4; row <= 4; row++)
        for (let col = -4; col <= 4; col++) {
          const seed = Math.sin(row * 47 + col * 19);
          const x =
            h.x + col * 22 + (row % 2) * 10 + Math.sin(time * 0.5 + row) * 2;
          const y =
            h.y +
            row * 15 +
            Math.sin(col * 31 + row * 13) * 5 +
            Math.cos(time * 0.6 + col) * 2;
          c.save();
          c.translate(x, y);
          c.rotate(seed * 0.45);
          c.scale(0.6 + Math.abs(seed) * 0.65, 0.7 + Math.abs(seed) * 0.4);
          c.translate(-x, -y);
          c.fillStyle = seed > 0 ? "#592c24" : "#7a3524";
          c.beginPath();
          c.moveTo(x - 8, y - 5);
          c.lineTo(x + 5, y - 7);
          c.lineTo(x + 10, y - 1);
          c.lineTo(x + 6, y + 5);
          c.lineTo(x - 7, y + 4);
          c.closePath();
          c.fill();
          c.strokeStyle = "#ffb342";
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(x - 8, y - 5);
          c.lineTo(x + 5, y - 7);
          c.stroke();
          c.restore();
        }
      for (let i = 0; i < 14; i++) {
        const angle = i * 2.4,
          r = h.r * Math.sqrt((i + 0.5) / 14);
        const pulse = (time * 0.7 + i * 0.17) % 1;
        c.strokeStyle = `rgba(255,231,113,${1 - pulse})`;
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(
          h.x + Math.cos(angle) * r,
          h.y + Math.sin(angle) * r * 0.7,
          1 + pulse * 5,
          1 + pulse * 2,
          0,
          0,
          TAU,
        );
        c.stroke();
      }
      c.restore();
      continue;
    }
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

// Event cues are anchored to the affected body and obey Divine concealment.
export function drawCue(c, e, game) {
  const actor = e.subject && game.fighters.find((a) => a.id === e.subject);
  if (actor && (!inWorld(actor) || visibility(actor) <= 0)) return;
  const p = 1 - e.life / e.max;
  const x = actor ? actor.x : e.x,
    y = (actor ? actor.y : e.y) - 28;
  c.save();
  c.translate(x, y);
  c.globalAlpha *= actor ? visibility(actor) : 1;
  c.strokeStyle = e.color;
  c.fillStyle = e.color;
  c.lineWidth = 2.5;
  if (["heal", "revive"].includes(e.cue)) {
    for (let i = 0; i < 7; i++) {
      const xx = Math.sin(i * 2.4) * 25,
        yy = 20 - p * 55 + (i % 3) * 7;
      c.fillRect(xx - 2, yy - 6, 4, 12);
      c.fillRect(xx - 6, yy - 2, 12, 4);
    }
  } else if (e.cue === "shatter") {
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * TAU,
        r = 20 + p * 35;
      c.save();
      c.translate(Math.cos(angle) * r, Math.sin(angle) * r + p * p * 20);
      c.rotate(angle + p * 3);
      c.fillRect(-4, -4, 8, 8);
      c.restore();
    }
  } else if (e.cue === "guard") {
    c.beginPath();
    c.moveTo(0, -30);
    c.lineTo(23, -18);
    c.lineTo(18, 10);
    c.lineTo(0, 28);
    c.lineTo(-18, 10);
    c.lineTo(-23, -18);
    c.closePath();
    c.stroke();
  } else if (e.cue === "dodge") {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(-p * 30 - i * 10, 0, 15, 26, 0.2, -1.4, 1.4);
      c.stroke();
    }
  } else if (e.cue === "lost") {
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.4 + p * 5,
        r = (1 - p) * 38;
      c.fillRect(Math.cos(angle) * r, Math.sin(angle) * r, 3, 3);
    }
  } else if (e.cue === "portal") {
    c.beginPath();
    c.ellipse(0, 0, 22 + p * 20, 30 + p * 20, 0, p * 5, p * 5 + 5);
    c.stroke();
  } else if (e.cue === "unavailable") {
    c.beginPath();
    c.arc(0, 0, 12 + p * 6, 0, TAU);
    c.moveTo(-10, -10);
    c.lineTo(10, 10);
    c.stroke();
  } else if (e.cue === "interrupt") {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * TAU;
      c.beginPath();
      c.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
      c.lineTo(
        Math.cos(angle + 0.2) * (20 + p * 15),
        Math.sin(angle + 0.2) * (20 + p * 15),
      );
      c.lineTo(
        Math.cos(angle) * (30 + p * 15),
        Math.sin(angle) * (30 + p * 15),
      );
      c.stroke();
    }
  }
  c.restore();
}

// Shared bright-white portal geometry; lifecycle changes appearance, never collision timing.
export function drawPortal(
  c,
  portal,
  time,
  progress = 1,
  closing = false,
  pairCount = 0,
) {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return;
  c.save();
  c.translate(portal.x, portal.y - 12);
  c.scale(
    closing
      ? Math.max(0.03, p * p)
      : Math.max(0.03, Math.sin((p * Math.PI) / 2)),
    Math.max(0.08, p),
  );
  c.shadowColor = "#ffffff";
  c.shadowBlur = 24;
  c.strokeStyle = "#ffffff";
  const gradient = c.createRadialGradient(0, 0, 2, 0, 0, 35);
  gradient.addColorStop(0, "#ffffffee");
  gradient.addColorStop(0.6, "#f3ffffa0");
  gradient.addColorStop(1, "#ffffff22");
  c.fillStyle = gradient;
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(0, 0, 25, 34, 0, 0, TAU);
  c.fill();
  c.stroke();
  c.shadowBlur = 7;
  c.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.ellipse(
      0,
      0,
      8 + i * 5,
      12 + i * 6,
      Math.sin(time * 3 + i) * 0.2,
      time * 3 + i,
      time * 3 + i + Math.PI * 1.25,
    );
    c.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i * TAU) / 8 + time;
    const reach = closing ? 24 + 30 * (1 - p) : 28 + 18 * (1 - p);
    c.fillStyle = "#fff";
    c.fillRect(
      Math.cos(angle) * reach - 1,
      Math.sin(angle) * reach * 1.25 - 1,
      2,
      2,
    );
  }
  c.shadowBlur = 0;
  c.fillStyle = "#fff";
  for (let i = 0; i < pairCount; i++) {
    c.beginPath();
    c.arc((i - (pairCount - 1) / 2) * 9, 47, 2.5, 0, TAU);
    c.fill();
  }
  c.restore();
}
