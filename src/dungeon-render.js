const TAU = Math.PI * 2;
function crystal(c, x, y, size = 28) {
  c.save();
  c.translate(x, y);
  c.shadowColor = "#6af5ff";
  c.shadowBlur = 22;
  const g = c.createLinearGradient(-size, 0, size, 0);
  g.addColorStop(0, "#267eab");
  g.addColorStop(0.5, "#d4ffff");
  g.addColorStop(1, "#48c6e2");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, -size * 1.8);
  c.lineTo(size * 0.48, -size * 0.65);
  c.lineTo(size * 0.32, size * 0.35);
  c.lineTo(0, size * 0.6);
  c.lineTo(-size * 0.45, -size * 0.15);
  c.closePath();
  c.fill();
  c.strokeStyle = "#c0fbff";
  c.lineWidth = 2;
  c.stroke();
  c.shadowBlur = 0;
  c.beginPath();
  c.moveTo(0, -size * 1.8);
  c.lineTo(0, size * 0.6);
  c.stroke();
  c.restore();
}
function torch(c, x, y) {
  const glow = c.createRadialGradient(x, y, 3, x, y, 100);
  glow.addColorStop(0, "#7fffee77");
  glow.addColorStop(1, "#40f4ff00");
  c.fillStyle = glow;
  c.fillRect(x - 100, y - 100, 200, 200);
  c.fillStyle = "#112c40";
  c.fillRect(x - 11, y - 6, 22, 35);
  c.strokeStyle = "#6292a0";
  c.lineWidth = 3;
  c.strokeRect(x - 11, y - 6, 22, 35);
  c.fillStyle = "#b7fff2";
  c.shadowColor = "#37fffa";
  c.shadowBlur = 20;
  c.beginPath();
  c.moveTo(x, y - 28);
  c.bezierCurveTo(x + 20, y - 8, x + 14, y + 10, x, y + 13);
  c.bezierCurveTo(x - 17, y + 8, x - 10, y - 6, x, y - 28);
  c.fill();
  c.shadowBlur = 0;
}
export function paintDungeonMap(c, map, floorPath) {
  const water = c.createLinearGradient(0, 0, map.width, map.height);
  water.addColorStop(0, "#092a3e");
  water.addColorStop(0.5, "#08728a");
  water.addColorStop(1, "#071b30");
  c.fillStyle = water;
  c.fillRect(0, 0, map.width, map.height);
  for (let y = 30; y < map.height; y += 44)
    for (let x = 10; x < map.width; x += 72) {
      c.strokeStyle = `rgba(77,224,238,${0.025 + ((x + y) % 7) * 0.006})`;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 23, y - 8, x + 48, y);
      c.stroke();
    }
  // A shared floor path covers internal joins, leaving masonry only at exposed edges.
  floorPath(c, map);
  c.strokeStyle = "#061423";
  c.lineWidth = 94;
  c.shadowColor = "#020c1edd";
  c.shadowBlur = 30;
  c.shadowOffsetY = 30;
  c.stroke();
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;
  floorPath(c, map);
  c.strokeStyle = "#1c4b65";
  c.lineWidth = 66;
  c.stroke();
  floorPath(c, map);
  c.strokeStyle = "#508c9c";
  c.lineWidth = 18;
  c.stroke();
  // Clip masonry courses to the raised wall silhouette; the floor covers inner joins.
  c.save();
  c.beginPath();
  for (const s of map.shapes) c.rect(s.x - 33, s.y - 33, s.w + 66, s.h + 66);
  c.clip();
  for (let y = 0; y < map.height; y += 22)
    for (let x = y % 44 ? 0 : -30; x < map.width; x += 60) {
      c.fillStyle = (x + y) % 4 ? "#244f66" : "#315f75";
      c.fillRect(x + 2, y + 2, 56, 18);
      c.strokeStyle = "#71959f55";
      c.lineWidth = 1;
      c.strokeRect(x + 2, y + 2, 56, 18);
    }
  c.restore();
  c.save();
  floorPath(c, map);
  c.clip();
  const floor = c.createLinearGradient(0, 0, 0, map.height);
  floor.addColorStop(0, "#4b7d86");
  floor.addColorStop(0.5, "#6ca4a7");
  floor.addColorStop(1, "#315e70");
  c.fillStyle = floor;
  c.fillRect(0, 0, map.width, map.height);
  for (let y = 0; y < map.height; y += 48)
    for (let x = y % 96 ? 0 : -48; x < map.width; x += 96) {
      c.fillStyle = (x * 7 + y * 11) % 5 === 0 ? "#aee5d40d" : "#0c314312";
      c.fillRect(x + 2, y + 2, 92, 44);
      c.strokeStyle = "#0c35434d";
      c.lineWidth = 2;
      c.strokeRect(x, y, 96, 48);
      c.strokeStyle = "#c6f8e529";
      c.beginPath();
      c.moveTo(x + 2, y + 3);
      c.lineTo(x + 92, y + 3);
      c.stroke();
    }
  for (const r of map.rooms) {
    // Fine fractures and worn chips stay subtle at play scale.
    for (let i = 0; i < 16; i++) {
      const x = r.x + 65 + ((i * 137) % (r.w - 130)),
        y = r.y + 90 + ((i * 83) % (r.h - 180));
      c.strokeStyle = "#0a354530";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 8, y + 4);
      c.lineTo(x + 4, y + 11);
      c.stroke();
    }
    c.strokeStyle = "#c0ead66b";
    c.lineWidth = 3;
    c.strokeRect(r.x + 27, r.y + 27, r.w - 54, r.h - 54);
    c.strokeStyle = "#133e51aa";
    c.lineWidth = 7;
    c.strokeRect(r.x + 36, r.y + 36, r.w - 72, r.h - 72);
    const cx = r.x + r.w / 2,
      cy = r.y + r.h / 2;
    c.strokeStyle = "#b8efe736";
    c.lineWidth = 2;
    for (const size of [75, 105]) {
      c.beginPath();
      c.arc(cx, cy, size, 0, TAU);
      c.stroke();
    }
    c.save();
    c.translate(cx, cy);
    c.rotate(Math.PI / 4);
    c.strokeRect(-53, -53, 106, 106);
    c.restore();
    c.font = "18px Georgia";
    c.textAlign = "center";
    c.fillStyle = "#d2f4e8b0";
    c.fillText(r.label, cx, r.y + 70);
    // Recessed drainage grates and shallow steps recall the flooded fortress.
    for (const gx of [r.x + 70, r.x + r.w - 165]) {
      const gy = r.y + r.h - 135;
      c.fillStyle = "#0b3647";
      c.fillRect(gx, gy, 95, 65);
      c.strokeStyle = "#8ebcc0";
      c.lineWidth = 4;
      for (let dx = 8; dx < 95; dx += 14) {
        c.beginPath();
        c.moveTo(gx + dx, gy);
        c.lineTo(gx + dx, gy + 65);
        c.stroke();
      }
      c.strokeRect(gx, gy, 95, 65);
    }
  }
  c.restore();
  for (const r of map.rooms) {
    for (const x of [r.x + 44, r.x + r.w - 44]) {
      torch(c, x, r.y + 115);
      crystal(c, x - 14, r.y + r.h - 48, 14);
      crystal(c, x + 15, r.y + r.h - 46, 18);
      crystal(c, x, r.y + r.h - 55, 25);
    }
    // Dark arched culverts discharge into the water beyond each room.
    for (let x = r.x + 125; x < r.x + r.w - 65; x += 160) {
      const y = r.y + r.h + 18;
      c.fillStyle = "#081e31";
      c.beginPath();
      c.roundRect(x - 26, y - 4, 52, 44, [24, 24, 2, 2]);
      c.fill();
      c.strokeStyle = "#49798e";
      c.lineWidth = 5;
      c.stroke();
      const fall = c.createLinearGradient(0, y + 20, 0, y + 76);
      fall.addColorStop(0, "#65f2eeaa");
      fall.addColorStop(1, "#3fdff000");
      c.fillStyle = fall;
      c.fillRect(x - 19, y + 23, 38, 62);
    }
  }
}
export function drawDungeon(c, g, time) {
  if (!["dungeon", "zombies"].includes(g.mode)) return;
  c.save();
  for (const gate of g.map.gates) {
    if (g.map.dungeonStage >= gate.section) continue;
    const vertical = gate.h > gate.w;
    c.fillStyle = "#0a2034";
    c.fillRect(gate.x - 8, gate.y - 8, gate.w + 16, gate.h + 16);
    c.strokeStyle = gate.section === 1 ? "#5ce8ef" : "#cbb77d";
    c.lineWidth = 5;
    c.strokeRect(gate.x - 8, gate.y - 8, gate.w + 16, gate.h + 16);
    c.strokeStyle = "#91b7bd";
    c.lineWidth = 6;
    for (let n = 12; n < (vertical ? gate.h : gate.w); n += 20) {
      c.beginPath();
      if (vertical) {
        c.moveTo(gate.x, gate.y + n);
        c.lineTo(gate.x + gate.w, gate.y + n);
      } else {
        c.moveTo(gate.x + n, gate.y);
        c.lineTo(gate.x + n, gate.y + gate.h);
      }
      c.stroke();
    }
    c.fillStyle = "#e5d69f";
    c.fillRect(gate.x + gate.w / 2 - 10, gate.y + gate.h / 2 - 10, 20, 20);
  }
  for (const h of g.healthDrops) {
    const y = h.y - 7 + Math.sin(time * 3 + h.x) * 2;
    c.shadowColor = "#60f7bc";
    c.shadowBlur = 12;
    c.fillStyle = "#193e41";
    c.beginPath();
    c.roundRect(h.x - 10, y - 21, 20, 28, 5);
    c.fill();
    c.strokeStyle = "#a8ffdc";
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = "#65e8ad";
    c.fillRect(h.x - 7, y - 8, 14, 11);
    c.fillStyle = "#e7fff0";
    c.fillRect(h.x - 2, y - 14, 4, 17);
    c.fillRect(h.x - 7, y - 9, 14, 4);
    c.shadowBlur = 0;
  }
  const key = g.dungeon?.key;
  if (key && !key.collected) {
    c.save();
    c.translate(key.x, key.y - 15 + Math.sin(time * 3) * 3);
    c.shadowColor = "#ffda78";
    c.shadowBlur = 15;
    c.strokeStyle = "#ffe19a";
    c.lineWidth = 5;
    c.beginPath();
    c.arc(0, -12, 10, 0, TAU);
    c.moveTo(0, -2);
    c.lineTo(0, 24);
    c.lineTo(10, 24);
    c.moveTo(0, 15);
    c.lineTo(9, 15);
    c.stroke();
    c.restore();
  }
  for (const a of g.fighters.filter((a) => a.dungeonRole && a.alive)) {
    c.textAlign = "center";
    c.font = "bold 12px sans-serif";
    c.fillStyle = "#d1f5eb";
    c.fillText(
      a.dungeonRole === "water"
        ? "WATER WARDEN"
        : a.dungeonRole === "apparition"
          ? "APPARITION · KEY KEEPER"
          : "TERRAFORMER",
      a.x,
      a.y - 91,
    );
  }
  c.restore();
}
