import { canSeeWarTrap } from "./war.js";
const TAU = Math.PI * 2;
function roof(c, x, y, w, h) {
  c.fillStyle = "#111827";
  c.beginPath();
  c.moveTo(x - w / 2 - 35, y + h);
  c.quadraticCurveTo(x - w / 3, y + h, x, y);
  c.quadraticCurveTo(x + w / 3, y + h, x + w / 2 + 35, y + h);
  c.lineTo(x + w / 2, y + h + 18);
  c.lineTo(x - w / 2, y + h + 18);
  c.closePath();
  c.fill();
  c.strokeStyle = "#728394";
  c.lineWidth = 3;
  c.stroke();
  for (let i = -5; i <= 5; i++) {
    c.beginPath();
    c.moveTo(x + (i * w) / 16, y + (Math.abs(i) * h) / 8 + 10);
    c.lineTo(x + (i * w) / 10, y + h + 10);
    c.strokeStyle = "#4c5e7277";
    c.lineWidth = 1;
    c.stroke();
  }
}
function lantern(c, x, y) {
  const g = c.createRadialGradient(x, y, 4, x, y, 80);
  g.addColorStop(0, "#ffdb9366");
  g.addColorStop(1, "#ffdb9300");
  c.fillStyle = g;
  c.fillRect(x - 80, y - 80, 160, 160);
  c.fillStyle = "#687582";
  c.fillRect(x - 6, y + 7, 12, 30);
  c.fillRect(x - 17, y + 35, 34, 7);
  c.fillRect(x - 16, y - 18, 32, 30);
  c.fillStyle = "#ffe3a0";
  c.fillRect(x - 9, y - 12, 18, 18);
  c.fillStyle = "#263644";
  c.fillRect(x - 2, y - 13, 4, 22);
  roof(c, x, y - 37, 35, 18);
}
export function paintTempleMap(c, map) {
  const sky = c.createLinearGradient(0, 0, 0, map.height);
  sky.addColorStop(0, "#101a30");
  sky.addColorStop(1, "#07191b");
  c.fillStyle = sky;
  c.fillRect(0, 0, map.width, map.height);
  const moon = c.createRadialGradient(1580, 92, 22, 1580, 92, 160);
  moon.addColorStop(0, "#dcefff55");
  moon.addColorStop(1, "#a5c6ff00");
  c.fillStyle = moon;
  c.fillRect(1420, 0, 320, 252);
  c.fillStyle = "#edf4e5";
  c.beginPath();
  c.arc(1580, 92, 31, 0, TAU);
  c.fill();
  // Distant tiled roofs and timber halls frame the outdoor courtyard.
  for (const x of [535, 1024, 1500]) {
    c.fillStyle = "#3d272d";
    c.fillRect(x - 180, 123, 360, 84);
    for (let i = -3; i <= 3; i++) {
      c.fillStyle = "#baaa8044";
      c.fillRect(x + i * 45 - 12, 145, 24, 40);
      c.fillStyle = "#60403b";
      c.fillRect(x + i * 45 - 20, 125, 8, 80);
    }
    roof(c, x, 40, 390, 80);
  }
  c.fillStyle = "#252e3d";
  c.fillRect(310, 207, 1428, 955);
  c.strokeStyle = "#7d8b9b";
  c.lineWidth = 7;
  c.strokeRect(337, 218, 1374, 928);
  const r = map.shapes[0];
  const floor = c.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  floor.addColorStop(0, "#687786");
  floor.addColorStop(0.5, "#465a6b");
  floor.addColorStop(1, "#344452");
  c.fillStyle = floor;
  c.fillRect(r.x, r.y, r.w, r.h);
  c.save();
  c.beginPath();
  c.rect(r.x, r.y, r.w, r.h);
  c.clip();
  for (let y = 230; y < 1130; y += 60) {
    for (let x = 314 + (y % 120 ? 50 : 0); x < 1700; x += 100) {
      c.fillStyle = (x + y) % 7 ? "#d4dfdd06" : "#132d3c18";
      c.fillRect(x, y, 100, 60);
      c.strokeStyle = "#c8d5e423";
      c.lineWidth = 1;
      c.strokeRect(x, y, 100, 60);
    }
  }
  // A pale stone approach through the center, with an engraved moon crest.
  c.fillStyle = "#b5c0b91a";
  c.fillRect(354, 620, 1340, 120);
  c.strokeStyle = "#c5d6d07a";
  c.lineWidth = 3;
  for (const radius of [110, 122]) {
    c.beginPath();
    c.arc(1024, 680, radius, 0, TAU);
    c.stroke();
  }
  c.beginPath();
  c.arc(1024, 680, 65, -1.3, 1.3);
  c.quadraticCurveTo(1020, 680, 1041, 617);
  c.stroke();
  c.restore();
  // Japanese stone lanterns, pines, and vermilion gates sit outside the walkable floor.
  for (const x of [300, 1748]) {
    for (const y of [300, 560, 820, 1080]) lantern(c, x, y);
    for (const y of [410, 945]) {
      c.strokeStyle = "#4a3934";
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(x, y + 65);
      c.quadraticCurveTo(x - 25, y, x + 20, y - 40);
      c.stroke();
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? "#22453f" : "#19362f";
        c.beginPath();
        c.ellipse(
          x + Math.sin(i * 2) * 38,
          y - i * 13,
          65 - i * 7,
          24,
          0,
          0,
          TAU,
        );
        c.fill();
      }
    }
  }
  for (const x of [535, 1515]) {
    c.fillStyle = "#913e36";
    c.fillRect(x - 78, 1160, 12, 98);
    c.fillRect(x + 66, 1160, 12, 98);
    c.fillRect(x - 95, 1170, 190, 13);
    c.strokeStyle = "#bf6150";
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(x - 110, 1144);
    c.quadraticCurveTo(x, 1162, x + 110, 1144);
    c.stroke();
  }
}
export function drawTempleTraps(c, game) {
  if (game.mapId !== "temple") return;
  c.save();
  for (const trap of game.spikeTraps) {
    if (!canSeeWarTrap(game, game.player, trap)) continue;
    const active = game.time - trap.triggeredAt < 0.45;
    c.fillStyle = active ? "#292333" : "#263c4b99";
    c.strokeStyle = active ? "#e3a68d" : "#9fabc2";
    c.lineWidth = 1.5;
    c.fillRect(trap.x - 23, trap.y - 18, 46, 36);
    c.strokeRect(trap.x - 23, trap.y - 18, 46, 36);
    for (let row = -1; row <= 1; row++)
      for (let col = -1; col <= 1; col++) {
        const x = trap.x + col * 13,
          y = trap.y + row * 10;
        c.fillStyle = active ? "#e3e8ee" : "#95aabd";
        c.beginPath();
        c.moveTo(x - 4, y + 3);
        c.lineTo(x, y - (active ? 18 : 5));
        c.lineTo(x + 4, y + 3);
        c.closePath();
        c.fill();
      }
  }
  c.restore();
}
