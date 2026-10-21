import { inWorld, visibility } from "./combat.js";
import {
  drawCharacter,
  drawCharacterStrike,
  characterPose,
} from "./characters.js";
import {
  drawTerrain,
  immersionFor,
  drawWaterline,
  drawReflectShield,
  drawClashes,
  distortGravity,
  drawCue,
} from "./battle-effects.js";
const PALETTE = {
  light: "#f5edcf",
  dark: "#25232e",
  water: "#367ac9",
  air: "#76d6d8",
  earth: "#92633f",
  fire: "#ca493a",
};
export function fighterColor(a) {
  if (
    a.parts.length === 2 &&
    a.parts.includes("dark") &&
    a.parts.includes("earth")
  )
    return "#9254ce";
  const colors = a.parts.map((e) => PALETTE[e] || "#c4ab77");
  const channels = colors.map((c) =>
    [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)),
  );
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(channels.reduce((s, c) => s + c[i], 0) / channels.length)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function shade(hex, factor) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * factor))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.background = document.createElement("canvas");
    this.distortion = document.createElement("canvas");
    this.background.width = 1024;
    this.background.height = 680;
    this.makeBackground();
  }
  makeBackground() {
    const c = this.background.getContext("2d");
    c.fillStyle = "#26332e";
    c.fillRect(0, 0, 1024, 680);
    let seed = 271;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    // Ancient grandstands, laid in three concentric tiers.
    c.fillStyle = "#182921";
    c.fillRect(45, 75, 934, 554);
    for (let tier = 0; tier < 4; tier++) {
      const x = 60 + tier * 17,
        y = 82 + tier * 19,
        w = 904 - tier * 34,
        h = 530 - tier * 38;
      c.fillStyle = ["#465344", "#5d6249", "#707151", "#747455"][tier];
      c.fillRect(x, y, w, h);
      c.fillStyle = "#25392e";
      c.fillRect(x + 8, y + 8, w - 16, h - 16);
      c.strokeStyle = "#172d25";
      c.lineWidth = 2;
      for (let k = x; k < x + w; k += 38) {
        c.beginPath();
        c.moveTo(k, y);
        c.lineTo(k, y + 8);
        c.moveTo(k, y + h - 8);
        c.lineTo(k, y + h);
        c.stroke();
      }
      for (let k = y; k < y + h; k += 32) {
        c.beginPath();
        c.moveTo(x, k);
        c.lineTo(x + 8, k);
        c.moveTo(x + w - 8, k);
        c.lineTo(x + w, k);
        c.stroke();
      }
    }
    c.fillStyle = "#8c8962";
    c.fillRect(129, 162, 766, 411);
    c.fillStyle = "#aaa175";
    c.fillRect(137, 170, 750, 395);
    for (let y = 171; y < 565; y += 35) {
      for (let x = 138; x < 885; x += 42) {
        c.fillStyle = ["#a19a70", "#a69e74", "#a9a077", "#a39c73", "#ada37a"][
          Math.floor(rand() * 5)
        ];
        c.fillRect(x, y, 40, 33);
        c.fillStyle = "#c3b88a44";
        c.fillRect(x, y, 40, 2);
        c.fillStyle = "#777d5a77";
        c.fillRect(x + 40, y, 2, 35);
        for (let j = 0; j < 6; j++) {
          c.fillStyle = rand() > 0.5 ? "#c8bd8c55" : "#757d5944";
          c.fillRect(x + rand() * 36, y + rand() * 30, 2, 2);
        }
      }
    }
    // Worn circular combat seal.
    c.save();
    c.translate(512, 365);
    c.strokeStyle = "#c4b88566";
    c.lineWidth = 3;
    for (const r of [106, 119, 146]) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = "#757c5d55";
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      c.lineTo(Math.cos(a) * 100, Math.sin(a) * 100);
    }
    c.stroke();
    c.beginPath();
    c.moveTo(0, -82);
    c.lineTo(72, 42);
    c.lineTo(-72, 42);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(0, 82);
    c.lineTo(72, -42);
    c.lineTo(-72, -42);
    c.closePath();
    c.stroke();
    c.restore();
    // Recessed entrances.
    for (const x of [462]) {
      c.fillStyle = "#1f3029";
      c.fillRect(x, 80, 100, 91);
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? "#59634b" : "#424f3c";
        c.fillRect(x, 95 + i * 14, 100, 6);
      }
      c.fillStyle = "#b1a471";
      c.fillRect(x - 8, 153, 116, 9);
      c.fillStyle = "#263a2c";
      c.fillRect(x, 572, 100, 55);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = "#657056";
        c.fillRect(x, 575 + i * 14, 100, 7);
      }
    }
    // Corner columns and hanging banners.
    for (const [x, y] of [
      [151, 195],
      [871, 195],
      [151, 548],
      [871, 548],
    ]) {
      c.fillStyle = "#182b2466";
      c.beginPath();
      c.ellipse(x + 8, y + 8, 28, 15, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#5a6347";
      c.fillRect(x - 20, y - 28, 40, 26);
      c.fillStyle = "#96936b";
      c.fillRect(x - 15, y - 57, 30, 36);
      c.fillStyle = "#b4aa7c";
      c.fillRect(x - 22, y - 62, 44, 12);
      c.fillStyle = "#6d7653";
      c.fillRect(x - 19, y - 48, 38, 6);
      c.fillStyle = "#c0b784";
      c.fillRect(x - 22, y - 64, 44, 4);
      c.fillStyle = "#747b56";
      c.fillRect(x - 20, y - 17, 40, 8);
      c.fillStyle = "#aaa478";
      c.fillRect(x - 24, y - 10, 48, 8);
    }
    for (const x of [274, 750]) {
      c.fillStyle = "#182d25";
      c.fillRect(x - 23, 89, 46, 60);
      c.fillStyle = "#56684b";
      c.fillRect(x - 19, 89, 38, 46);
      c.beginPath();
      c.moveTo(x - 19, 135);
      c.lineTo(x, 150);
      c.lineTo(x + 19, 135);
      c.fill();
      c.fillStyle = "#c0ae70";
      c.fillRect(x - 24, 86, 48, 4);
      c.strokeStyle = "#b3a16c";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, 102);
      c.lineTo(x + 9, 119);
      c.lineTo(x, 133);
      c.lineTo(x - 9, 119);
      c.closePath();
      c.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const x = 65 + rand() * 900,
        y = rand() > 0.5 ? 80 + rand() * 48 : 590 + rand() * 35;
      c.fillStyle = rand() > 0.5 ? "#243d2b" : "#3f5639";
      c.fillRect(x, y, 4 + rand() * 7, 3 + rand() * 8);
    }
    for (let i = 0; i < 35; i++) {
      const x = rand() > 0.5 ? 92 : 926,
        y = 170 + rand() * 380;
      c.fillStyle = "#344f35";
      c.fillRect(x, y, 9, 4);
    }
    c.fillStyle = "#172b2377";
    c.fillRect(0, 0, 1024, 66);
    c.fillRect(0, 636, 1024, 44);
  }
  avatar(c, a, time, immersion = 0) {
    const scale = 2.35;
    const flying = a.parts.includes("air");
    const pose = characterPose(a);
    const walking = pose.running;
    const step = walking ? Math.sin(time * 12) * 2 : 0;
    const bob = flying ? Math.sin(time * 3) * 2 - 8 : walking ? -pose.bob : 0;
    const color = fighterColor(a);
    c.save();
    c.translate(Math.round(a.x), Math.round(a.y));
    c.fillStyle = "#162b2466";
    c.beginPath();
    c.ellipse(0, 7, 21, flying ? 8 : 6, 0, 0, Math.PI * 2);
    if (!immersion) c.fill();
    if (a.parts.length >= 3) {
      c.shadowColor = color;
      c.shadowBlur = 22;
      c.fillStyle = color + "45";
      c.beginPath();
      c.arc(0, -14, 28, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }
    if (a.id === "player") {
      c.strokeStyle = "#e6d39699";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, 7, 24, 9, 0, 0, Math.PI * 2);
      c.stroke();
    }
    drawReflectShield(c, a, time, false);
    c.translate(0, bob);
    c.save();
    if (immersion) {
      c.beginPath();
      c.rect(-110, -160, 220, 160 - immersion - bob);
      c.clip();
    }
    if (!drawCharacter(c, a, time)) {
      c.scale(scale, scale);
      const px = (x, y, w, h, fill) => {
        c.fillStyle = fill;
        c.fillRect(Math.round(x), Math.round(y), w, h);
      };
      // Original, compact hooded knight silhouette: cape, tunic, boots, face and blade.
      px(-7, -20, 14, 16, "#25302b");
      px(-8, -16, 16, 13, shade(color, 0.6));
      px(-9, -9, 18, 7, shade(color, 0.68));
      px(-7, -17, 3, 13, color);
      px(4, -17, 3, 13, shade(color, 0.85));
      px(-6, -21, 12, 8, shade(color, 0.7));
      px(-5, -23, 10, 3, color);
      px(-6, -21, 12, 4, color);
      px(-4, -19, 8, 5, "#262c28");
      px(-3, -19, 6, 4, "#d2b383");
      px(a.fx < -0.3 ? -3 : 1, -18, 2, 1, "#242b27");
      px(-4, -14, 8, 10, color);
      px(-4, -14, 8, 2, shade(color, 1.24));
      px(-6, -13, 2, 7, shade(color, 0.9));
      px(4, -13, 2, 7, shade(color, 0.85));
      px(-4, -6, 8, 2, shade(color, 0.48));
      px(-1, -6, 2, 2, "#d8c38a");
      px(-4, -4, 3, 4 + Math.round(step / 2), "#31362d");
      px(1, -4, 3, 4 - Math.round(step / 2), "#31362d");
      px(-5, Math.round(step / 2), 4, 2, "#222d27");
      px(1, -Math.round(step / 2), 4, 2, "#222d27");
      if (a.fy < -0.6) {
        px(-5, -19, 10, 5, color);
        px(-4, -14, 8, 10, shade(color, 0.9));
        px(-1, -20, 2, 15, shade(color, 1.13));
      }
      const side = a.fx < 0 ? -1 : 1;
      px(side > 0 ? 7 : -8, -13, 2, 10, "#c8cbbb");
      px(side > 0 ? 5 : -10, -6, 6, 2, "#ba9d61");
      px(side > 0 ? 7 : -8, -4, 2, 3, "#4b4030");
      if (a.parts.length === 2) {
        px(-4, -22, 2, 1, "#fff5d4");
        px(-3, -23, 1, 3, "#fff5d4");
        px(3, -12, 1, 3, "#fff5d4");
      }
      if (a.flash > 0) {
        c.save();
        c.globalAlpha *= 0.65;
        px(-5, -22, 10, 20, "#fff3d1");
        c.restore();
      }
    }
    c.restore();
    c.restore();
    c.save();
    c.translate(a.x, a.y);
    drawReflectShield(c, a, time, true);
    if (a.shield) {
      const rise = Math.min(1, a.shieldTime / 0.16);
      c.save();
      c.translate(0, 9);
      c.scale(1, rise);
      c.fillStyle = "#3a4231";
      c.beginPath();
      c.ellipse(0, -5, 34, 13, 0, 0, Math.PI * 2);
      c.fill();
      const rocks = [
        [-29, -37, 20, 43],
        [-14, -70, 24, 73],
        [5, -66, 23, 71],
        [20, -34, 16, 39],
        [-20, -19, 24, 28],
        [1, -22, 24, 31],
      ];
      for (let i = 0; i < rocks.length; i++) {
        const [x, y, w, h] = rocks[i];
        c.fillStyle = [
          "#8a8160",
          "#a79e78",
          "#8e926e",
          "#706d50",
          "#aaa27d",
          "#8f8b65",
        ][i];
        c.strokeStyle = "#4d533b";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, y + 9);
        c.lineTo(x + w * 0.3, y);
        c.lineTo(x + w - 3, y + 3);
        c.lineTo(x + w, y + h - 6);
        c.lineTo(x + w * 0.65, y + h);
        c.lineTo(x, y + h - 3);
        c.closePath();
        c.fill();
        c.stroke();
        c.strokeStyle = "#d4c69366";
        c.beginPath();
        c.moveTo(x + 3, y + 10);
        c.lineTo(x + w * 0.35, y + 3);
        c.lineTo(x + w - 5, y + 6);
        c.stroke();
      }
      c.restore();
      c.fillStyle = "#24382b";
      c.fillRect(-29, 15, 58, 5);
      c.fillStyle = "#d4be8a";
      c.fillRect(-29, 15, (58 * a.shieldHp) / 65, 5);
    }
    if (a.dodge > 0) {
      c.strokeStyle = "#c3a3ed88";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, -12, 31, 36, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (a.charging) {
      const p = a.charge / 1.8;
      c.strokeStyle = "#efd48f";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, -18, 31 + p * 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      c.stroke();
      for (let j = 0; j < 4; j++) {
        const angle = time * 4 + (j * Math.PI) / 2;
        c.fillStyle = "#f3dc9b";
        c.fillRect(
          Math.cos(angle) * (30 + p * 8),
          Math.sin(angle) * (30 + p * 8) - 18,
          3,
          3,
        );
      }
    }
    if (a.swing > 0 && !a.clash && !drawCharacterStrike(c, a)) {
      const angle = Math.atan2(a.fy, a.fx);
      c.strokeStyle = "#fff0bc";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(0, -12, 49, angle - 0.7, angle + 0.7);
      c.stroke();
      c.strokeStyle = "#e9bc6877";
      c.lineWidth = 8;
      c.beginPath();
      c.arc(0, -12, 42, angle - 0.5, angle + 0.5);
      c.stroke();
    }
    if (a.burn > 0) {
      for (let i = 0; i < 3; i++) {
        const height = 8 + Math.sin(time * 13 + i * 2) * 4;
        c.fillStyle = "#f16b32";
        c.fillRect(-15 + i * 13, -height, 6, height);
        c.fillStyle = "#ffd175";
        c.fillRect(-13 + i * 13, -height * 0.6, 2, height * 0.6);
      }
    }
    // Leave room above the taller crowns and Air's floating silhouette.
    c.translate(0, -10);
    if (a.id !== "player") {
      c.fillStyle = "#23332b";
      c.fillRect(-22, -70, 44, 5);
      c.fillStyle = a.team === 0 ? "#9cd3bd" : "#d88b70";
      c.fillRect(-22, -70, (44 * a.hp) / a.maxHp, 5);
      c.fillStyle = a.team === 0 ? "#b5dec8" : "#e4ad8b";
      c.font = "8px monospace";
      c.textAlign = "center";
      // Small diamonds identify spirits and echoes without status labels.
      if (a.ghost || a.echo) {
        c.beginPath();
        c.moveTo(0, -82);
        c.lineTo(4, -78);
        c.lineTo(0, -74);
        c.lineTo(-4, -78);
        c.closePath();
        c.fill();
      }
    } else {
      c.fillStyle = "#f5dc99";
      c.beginPath();
      c.moveTo(-4, -77);
      c.lineTo(4, -77);
      c.lineTo(0, -72);
      c.fill();
    }
    c.restore();
  }
  worldPoint(x, y) {
    const v = this.view || { scale: 1, tx: 0, ty: 0 };
    return { x: (x - v.tx) / v.scale, y: (y - v.ty) / v.scale };
  }
  draw(game, idle = false) {
    const c = this.ctx,
      w = this.canvas.clientWidth || 1024,
      h = this.canvas.clientHeight || 680;
    if (
      this.canvas.width !== Math.round(w) ||
      this.canvas.height !== Math.round(h)
    ) {
      this.canvas.width = Math.round(w);
      this.canvas.height = Math.round(h);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#1a2c25";
    c.fillRect(0, 0, w, h);
    const scale = Math.min(w / 834, h / 530),
      tx = (w - 834 * scale) / 2 - 95 * scale,
      ty = (h - 530 * scale) / 2 - 100 * scale;
    this.view = { scale, tx, ty };
    c.save();
    c.translate(tx, ty);
    c.scale(scale, scale);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.background, 0, 0);
    const t = idle ? performance.now() / 1000 : game.time;
    drawTerrain(c, game, t);
    for (const flag of game.flags) {
      const color = flag.team === game.player.team ? "#75d8f3" : "#f18e76";
      c.save();
      c.strokeStyle = color;
      c.fillStyle = color + "22";
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(flag.home.x, flag.home.y, 34, 20, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(flag.home.x - 12, flag.home.y);
      c.lineTo(flag.home.x + 12, flag.home.y);
      c.moveTo(flag.home.x, flag.home.y - 8);
      c.lineTo(flag.home.x, flag.home.y + 8);
      c.stroke();
      const carrier = game.fighters.find((a) => a.id === flag.carrier);
      const x = (carrier?.x ?? flag.x) + (carrier ? 22 : 0),
        y = carrier?.y ?? flag.y;
      c.strokeStyle = "#eadfc3";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y - 66);
      c.stroke();
      const flutter = Math.sin(t * 8 + flag.team) * 4;
      c.fillStyle = color;
      c.shadowColor = color;
      c.shadowBlur = 9;
      c.beginPath();
      c.moveTo(x + 1, y - 65);
      c.lineTo(x + 30, y - 62 + flutter);
      c.lineTo(x + 25, y - 49 + flutter);
      c.lineTo(x + 1, y - 46);
      c.closePath();
      c.fill();
      c.restore();
    }
    for (const p of game.portals.portals) {
      if (!game.portals.active(p)) {
        c.save();
        c.strokeStyle = "#e2c8ff";
        c.fillStyle = "#b295e533";
        c.lineWidth = 3;
        c.setLineDash([5, 5]);
        c.beginPath();
        c.ellipse(p.x, p.y, 30, 17, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#eee0ff";
        c.font = "10px monospace";
        c.textAlign = "center";

        c.restore();
        continue;
      }
      const pair = game.portals.portals.filter(
        (q) => q.owner === p.owner && game.portals.active(q),
      );
      c.save();
      c.translate(p.x, p.y - 12);
      c.shadowBlur = 17;
      c.shadowColor = "#9aaff9";
      c.fillStyle = "#151d38";
      c.beginPath();
      c.ellipse(0, 0, 25, 34, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = p.owner === game.player.id ? "#c8c3ff" : "#9aceea";
      c.lineWidth = 4;
      c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = "#7d8fd4";
      c.lineWidth = 2;
      for (let j = 0; j < 3; j++) {
        c.beginPath();
        c.ellipse(
          0,
          0,
          9 + j * 5,
          13 + j * 6,
          Math.sin(t * 2 + j) * 0.2,
          t * 2 + j,
          t * 2 + j + Math.PI * 1.4,
        );
        c.stroke();
      }
      c.fillStyle = "#d4dbfc";
      c.font = "9px monospace";
      c.textAlign = "center";
      for (let i = 0; i < pair.length; i++) {
        c.beginPath();
        c.arc((i - (pair.length - 1) / 2) * 9, 47, 2.5, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    for (const a of game.fighters) {
      if (!a.alive || !inWorld(a) || !a.blink) continue;
      const p = a.blink;
      c.save();
      c.strokeStyle = "#e4c4ff";
      c.fillStyle = "#c599f044";
      c.lineWidth = 2;
      c.setLineDash([5, 4]);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(p.x, p.y);
      c.stroke();
      c.setLineDash([]);
      c.beginPath();
      c.arc(p.x, p.y, 22, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(p.x - 30, p.y);
      c.lineTo(p.x + 30, p.y);
      c.moveTo(p.x, p.y - 30);
      c.lineTo(p.x, p.y + 30);
      c.stroke();
      c.fillStyle = "#f1deff";
      c.font = "9px monospace";
      c.textAlign = "center";

      c.restore();
    }
    for (const token of game.visibleTokens()) {
      const color = fighterColor(token);
      c.save();
      const age = game.time - (token.bornAt ?? -10);
      const drop = age < 0.7 ? -30 * Math.pow(1 - age / 0.7, 2) : 0;
      c.translate(token.x, token.y - 9 + drop + Math.sin(t * 3) * 4);
      c.rotate(Math.PI / 4);
      c.shadowColor = color;
      c.shadowBlur = age < 1.2 ? 25 : 15;
      c.fillStyle = color;
      c.fillRect(-7, -7, 14, 14);
      c.strokeStyle = "#f5e4b9";
      c.lineWidth = 2;
      c.strokeRect(-7, -7, 14, 14);
      c.rotate(-Math.PI / 4);
      const shine =
        age < 1.2 ? 12 + Math.sin(age * 18) * 5 : 5 + Math.sin(t * 3) * 2;
      c.strokeStyle = "#fff4c5";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-shine, 0);
      c.lineTo(shine, 0);
      c.moveTo(0, -shine);
      c.lineTo(0, shine);
      c.stroke();
      c.restore();
      c.fillStyle = "#e4d7a1";
      c.font = "9px monospace";
      c.textAlign = "center";
    }
    const target = game.target(game.player);
    if (target && game.player.alive && inWorld(game.player)) {
      c.save();
      c.globalAlpha = visibility(target);
      c.strokeStyle = "#efd397";
      c.lineWidth = 2;
      const x = target.x,
        y = target.y - 22,
        s = 34;
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        c.beginPath();
        c.moveTo(x + dx * s, y + dy * (s - 9));
        c.lineTo(x + dx * s, y + dy * s);
        c.lineTo(x + dx * (s - 9), y + dy * s);
        c.stroke();
      }
      c.restore();
    }
    for (const a of [...game.fighters]
      .filter((a) => (a.alive || a.ghost) && inWorld(a) && visibility(a) > 0)
      .sort((a, b) => a.y - b.y)) {
      c.save();
      c.globalAlpha = a.ghost ? 0.38 : visibility(a);
      const immersion = immersionFor(game, a);
      this.avatar(c, a, t, immersion);
      drawWaterline(c, a, immersion, t);
      c.restore();
      if (a.ghost) {
        c.save();
        c.translate(a.x, a.y - 30);
        c.strokeStyle = "#b8ede8bb";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-8, -5);
        c.quadraticCurveTo(-39, -43, -36, 1);
        c.lineTo(-12, 12);
        c.moveTo(8, -5);
        c.quadraticCurveTo(39, -43, 36, 1);
        c.lineTo(12, 12);
        c.stroke();
        c.restore();
      }
    }
    drawClashes(c, game);
    for (const p of game.projectiles.filter(inWorld)) {
      c.save();
      c.translate(p.x, p.y - 12);
      c.rotate(Math.atan2(p.dy, p.dx));
      if (p.kind === "laser") {
        for (const [width, color] of [
          [20, "#ffe3a533"],
          [9, "#ffd37e"],
          [3, "#fffce5"],
        ]) {
          c.strokeStyle = color;
          c.lineWidth = width;
          c.lineCap = "round";
          c.beginPath();
          c.moveTo(-Math.max(20, p.trail), 0);
          c.lineTo(15, 0);
          c.stroke();
        }
      } else {
        c.fillStyle = fighterColor(p.owner);
        c.shadowColor = c.fillStyle;
        c.shadowBlur = 12;
        c.globalAlpha = 0.8;
        c.beginPath();
        c.ellipse(0, 0, p.r, p.r, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fff3c9";
        c.fillRect(-5, -3, 9, 6);
      }
      c.restore();
    }
    for (const wave of game.waves.filter(inWorld)) {
      c.save();
      c.translate(wave.originX, wave.originY - 12);
      c.rotate(Math.atan2(wave.fy, wave.fx));
      // Thin moving wind fronts use exactly the existing sonic cone and range.
      for (let i = 0; i < 5; i++) {
        const r = Math.max(0, wave.radius - i * 9);
        c.strokeStyle =
          i === 0 ? "#edfffcdd" : `rgba(184,237,231,${0.6 - i * 0.1})`;
        c.lineWidth = i === 0 ? 3 : 1.5;
        c.beginPath();
        c.arc(0, 0, r, -wave.halfAngle, wave.halfAngle);
        c.stroke();
      }
      for (let i = -4; i <= 4; i++) {
        const angle = (i * wave.halfAngle) / 4;
        const r = Math.max(0, wave.radius - (Math.abs(i) % 3) * 8);
        c.strokeStyle = "#d7fff1aa";
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(
          Math.cos(angle) * Math.max(0, r - 28),
          Math.sin(angle) * Math.max(0, r - 28),
        );
        c.quadraticCurveTo(
          Math.cos(angle) * r,
          Math.sin(angle) * r - 4,
          Math.cos(angle) * r,
          Math.sin(angle) * r,
        );
        c.stroke();
      }
      c.restore();
    }
    for (const e of game.effects) {
      c.globalAlpha = e.life / e.max;
      if (e.kind === "cue") {
        drawCue(c, e, game);
        c.globalAlpha = 1;
        continue;
      }
      if (e.kind === "lightning") {
        for (const [width, color] of [
          [9, "#9acfff66"],
          [4, "#b3eaff"],
          [1.5, "#ffffff"],
        ]) {
          c.strokeStyle = color;
          c.lineWidth = width;
          c.beginPath();
          c.moveTo(e.x - 16, e.y - 175);
          c.lineTo(e.x + 8, e.y - 130);
          c.lineTo(e.x - 10, e.y - 100);
          c.lineTo(e.x + 13, e.y - 57);
          c.lineTo(e.x, e.y);
          c.stroke();
        }
        c.globalAlpha = 1;
        continue;
      }
      if (e.kind === "flame-trail") {
        const flicker = Math.sin(e.x * 0.7 + e.y * 0.3 + t * 18);
        const height = (10 + (23 * e.life) / e.max) * (0.85 + flicker * 0.35);
        const lean = Math.cos(e.x * 0.4 + t * 12) * 6;
        c.fillStyle = "#ef542d";
        c.beginPath();
        c.moveTo(e.x - 9, e.y + 3);
        c.lineTo(e.x - 5, e.y - height * 0.6);
        c.lineTo(e.x + lean, e.y - height);
        c.lineTo(e.x + 4, e.y - height * 0.4);
        c.lineTo(e.x + 9, e.y + 3);
        c.fill();
        c.fillStyle = "#ffd17b";
        c.beginPath();
        c.moveTo(e.x - 4, e.y + 2);
        c.lineTo(e.x + lean * 0.3, e.y - height * 0.6);
        c.lineTo(e.x + 5, e.y + 2);
        c.fill();
        c.globalAlpha = 1;
        continue;
      }
      if (e.kind === "telekinesis") {
        c.save();
        c.translate(e.x, e.y);
        c.rotate(Math.atan2(e.dy, e.dx));
        c.strokeStyle = "#d8b6ff";
        c.lineWidth = 3;
        const reach = 18 + (1 - e.life / e.max) * 45;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(reach, 0);
        c.lineTo(reach - 9, -7);
        c.moveTo(reach, 0);
        c.lineTo(reach - 9, 7);
        c.stroke();
        c.restore();
        c.globalAlpha = 1;
        continue;
      }
      c.strokeStyle = e.color;
      c.lineWidth = e.kind === "fusion" ? 9 : 4;
      c.beginPath();
      c.arc(e.x, e.y, e.r * (1 - e.life / e.max) + 10, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }
    for (const [x, y] of [
      [210, 151],
      [814, 151],
      [210, 586],
      [814, 586],
    ]) {
      c.fillStyle = "#3e3929";
      c.fillRect(x - 5, y, 10, 12);
      c.fillStyle = "#c9984e";
      c.fillRect(x - 4, y - 7, 8, 9);
      c.fillStyle = "#efd18a";
      c.fillRect(x - 2, y - 12 + Math.sin(t * 8 + x) * 2, 4, 9);
      c.fillStyle = "#f6de9c";
      c.fillRect(x + Math.sin(t * 2) * 4, y - 20 - ((t * 9) % 15), 2, 2);
    }
    distortGravity(c, this.canvas, this.distortion, game, this.view, t);
    c.restore();
    if (game.player.blind > 0 && inWorld(game.player)) {
      c.fillStyle = game.fighters.some(
        (a) => a.element === "light" && a.team !== 0,
      )
        ? "#fff8dcaa"
        : "#070c15d9";
      c.fillRect(0, 0, w, h);
      c.font = "16px monospace";
      c.textAlign = "center";
      c.fillStyle = "#dacfae";
    }
    if (game.player.dimension) {
      c.fillStyle = "#11102a70";
      c.fillRect(0, 0, w, h);
    }
  }
}
