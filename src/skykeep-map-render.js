const TAU = Math.PI * 2;
function cloud(c, x, y, w) {
  c.save();
  c.translate(x, y);
  c.scale(1, 0.32);
  const mist = c.createRadialGradient(0, 0, 0, 0, 0, w);
  mist.addColorStop(0, "#effaff55");
  mist.addColorStop(1, "#e4f7ff00");
  c.fillStyle = mist;
  c.fillRect(-w, -w, w * 2, w * 2);
  c.restore();
}
export function drawSkykeepChasms(c, map) {
  for (const h of map.chasms) {
    c.save();
    c.translate(h.x, h.y);
    c.fillStyle = "#d0dce1";
    c.beginPath();
    c.arc(0, 0, h.r + 7, 0, TAU);
    c.fill();
    const depth = c.createRadialGradient(0, 12, 4, 0, 0, h.r);
    depth.addColorStop(0, "#060d1d");
    depth.addColorStop(0.65, "#142738");
    depth.addColorStop(1, "#485e6c");
    c.fillStyle = depth;
    c.beginPath();
    c.arc(0, 0, h.r, 0, TAU);
    c.fill();
    c.save();
    c.clip();
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = `rgba(153,184,201,${0.18 - i * 0.035})`;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, 9 + i * 9, h.r - i * 8, (h.r - i * 8) * 0.72, 0, 0, TAU);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = "#2a3a49";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, h.r, 0, TAU);
    c.stroke();
    // Broken stone teeth and cracks make the lethal edge easy to read.
    for (let i = 0; i < 9; i++) {
      const a = (i * TAU) / 9,
        r = h.r + 6;
      c.strokeStyle = "#475d69";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(a + 0.025) * (r + 15), Math.sin(a + 0.025) * (r + 15));
      c.lineTo(Math.cos(a - 0.015) * (r + 22), Math.sin(a - 0.015) * (r + 22));
      c.stroke();
    }
    c.restore();
  }
}
export function paintSkykeepMap(c, map, floorPath) {
  const sky = c.createLinearGradient(0, 0, 0, map.height);
  sky.addColorStop(0, "#31678e");
  sky.addColorStop(1, "#b6d6df");
  c.fillStyle = sky;
  c.fillRect(0, 0, map.width, map.height);
  for (let i = 0; i < 18; i++)
    cloud(c, (i * 457) % map.width, (i * 263) % map.height, 180 + (i % 3) * 80);
  // Long tower faces descend beneath the rooftop, with windows disappearing into cloud.
  c.fillStyle = "#40556b";
  c.fillRect(300, 240, 1448, 1120);
  c.fillStyle = "#2b4059";
  c.fillRect(1724, 260, 42, 1100);
  for (let y = 1180; y < 1360; y += 70)
    for (let x = 370; x < 1720; x += 95) {
      c.fillStyle = "#1b2c42";
      c.fillRect(x, y, 19, 36);
      c.fillStyle = "#8ea7b344";
      c.fillRect(x - 3, y - 3, 25, 4);
    }
  c.fillStyle = "#d4e0dc";
  c.fillRect(302, 188, 1444, 984);
  const floor = c.createLinearGradient(324, 210, 1724, 1150);
  floor.addColorStop(0, "#c6d5d3");
  floor.addColorStop(1, "#819ca8");
  floorPath(c, map);
  c.fillStyle = floor;
  c.fill();
  c.save();
  c.clip();
  for (let y = 210; y < 1150; y += 64)
    for (let x = 280 + (y % 128 ? 32 : 0); x < 1730; x += 96) {
      c.fillStyle = (x + y) % 5 ? "#ffffff08" : "#25465714";
      c.fillRect(x, y, 96, 64);
      c.strokeStyle = "#526f7b44";
      c.lineWidth = 1;
      c.strokeRect(x, y, 96, 64);
    }
  // Pale wind compass at the center, between the broken floor openings.
  c.strokeStyle = "#e8f1d9aa";
  c.lineWidth = 3;
  for (const r of [90, 104]) {
    c.beginPath();
    c.arc(1024, 650, r, 0, TAU);
    c.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    c.beginPath();
    c.moveTo(1024 + Math.cos(a) * 50, 650 + Math.sin(a) * 50);
    c.lineTo(1024 + Math.cos(a) * 85, 650 + Math.sin(a) * 85);
    c.stroke();
  }
  c.restore();
  // Crenellated parapets and four round castle turrets frame a clear battle floor.
  for (const y of [183, 1154])
    for (let x = 300; x < 1760; x += 56) {
      c.fillStyle = "#526d80";
      c.fillRect(x, y, 36, 27);
      c.fillStyle = "#dce7df";
      c.fillRect(x, y, 36, 8);
    }
  for (const x of [296, 1730])
    for (let y = 210; y < 1160; y += 56) {
      c.fillStyle = "#4b6578";
      c.fillRect(x, y, 22, 36);
      c.fillStyle = "#c1d2d4";
      c.fillRect(x, y, 22, 7);
    }
  for (const x of [302, 1746])
    for (const y of [190, 1170]) {
      c.fillStyle = "#344f65";
      c.beginPath();
      c.arc(x, y + 12, 67, 0, TAU);
      c.fill();
      c.fillStyle = "#b6cbd0";
      c.beginPath();
      c.arc(x, y, 61, 0, TAU);
      c.fill();
      c.strokeStyle = "#e2e9dc";
      c.lineWidth = 8;
      c.stroke();
      c.fillStyle = "#5d7f91";
      c.beginPath();
      c.arc(x, y, 43, 0, TAU);
      c.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        c.fillStyle = "#d3dfd9";
        c.fillRect(
          x + Math.cos(a) * 54 - 10,
          y + Math.sin(a) * 54 - 10,
          20,
          20,
        );
      }
      c.strokeStyle = "#293f51";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x, y + 15);
      c.lineTo(x, y - 65);
      c.stroke();
      c.fillStyle = "#dbf5e9";
      c.beginPath();
      c.moveTo(x, y - 65);
      c.lineTo(x + 43, y - 57);
      c.lineTo(x + 35, y - 35);
      c.lineTo(x, y - 42);
      c.closePath();
      c.fill();
    }
  drawSkykeepChasms(c, map);
}
