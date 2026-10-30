const TAU = Math.PI * 2;
export function paintCorruptionMap(c, map) {
  c.fillStyle = "#080d13";
  c.fillRect(0, 0, map.width, map.height);
  const { cx, cy, radius } = map;
  c.save();
  c.beginPath();
  c.arc(cx, cy, radius, 0, TAU);
  c.clip();
  const light = c.createRadialGradient(cx, cy, 50, cx, cy, radius);
  light.addColorStop(0, "#353445");
  light.addColorStop(0.6, "#242a37");
  light.addColorStop(1, "#171f2b");
  c.fillStyle = light;
  c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  let seed = 172617;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Worn stone floor, with small pixel chips and moss instead of a flat fill.
  for (let y = cy - radius; y < cy + radius; y += 32)
    for (let x = cx - radius; x < cx + radius; x += 40) {
      c.fillStyle = random() > 0.5 ? "#4a4a5a22" : "#10172355";
      c.fillRect(x + 1, y + 1, 38, 30);
      c.fillStyle = "#72717a30";
      c.fillRect(x + 4, y + 3, 28, 1);
      if (random() > 0.7) {
        c.fillStyle = "#3d514c55";
        c.fillRect(x + 3, y + 24, 9, 3);
      }
      if (random() > 0.6) {
        c.fillStyle = "#9b8ca833";
        c.fillRect(x + 10 + Math.floor(random() * 20), y + 8, 3, 2);
      }
    }
  c.strokeStyle = "#8f75b62a";
  c.lineWidth = 2;
  for (const r of [30, 70, 100]) {
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.stroke();
  }
  c.restore();
  const trace = (wall) => {
    c.beginPath();
    if (wall.kind === "arc") c.arc(cx, cy, wall.r, wall.start, wall.end);
    else {
      c.moveTo(wall.a.x, wall.a.y);
      c.lineTo(wall.b.x, wall.b.y);
    }
  };
  c.lineCap = "round";
  for (const wall of map.walls) {
    c.save();
    c.translate(0, 7);
    trace(wall);
    c.strokeStyle = "#03060bcc";
    c.lineWidth = 24;
    c.stroke();
    c.restore();
    trace(wall);
    c.strokeStyle = "#0e1420";
    c.lineWidth = 18;
    c.stroke();
    trace(wall);
    c.strokeStyle = "#515065";
    c.lineWidth = 12;
    c.stroke();
    c.save();
    c.translate(0, -2);
    trace(wall);
    c.strokeStyle = "#777080";
    c.lineWidth = 3;
    c.stroke();
    c.restore();
    trace(wall);
    c.strokeStyle = "#292b3a";
    c.lineWidth = 2;
    c.setLineDash([2, 18]);
    c.stroke();
    c.setLineDash([]);
  }
  // Violet braziers and broken rune stones mark junctions.
  for (let i = 0; i < 16; i++) {
    const angle = (i * TAU) / 16,
      r = i % 2 ? 496 : 304,
      x = cx + Math.cos(angle) * r,
      y = cy + Math.sin(angle) * r;
    const glow = c.createRadialGradient(x, y, 0, x, y, 25);
    glow.addColorStop(0, "#9475d888");
    glow.addColorStop(1, "#9475d800");
    c.fillStyle = glow;
    c.fillRect(x - 25, y - 25, 50, 50);
    c.fillStyle = "#1b1e2c";
    c.fillRect(x - 5, y - 5, 10, 13);
    c.fillStyle = "#a28ae2";
    c.fillRect(x - 2, y - 11, 4, 8);
    c.fillStyle = "#e3caff";
    c.fillRect(x - 1, y - 10, 2, 4);
  }
  c.strokeStyle = "#59516f";
  c.lineWidth = 5;
  c.beginPath();
  c.arc(cx, cy, radius + 9, 0, TAU);
  c.stroke();
  for (const p of map.portals) {
    c.strokeStyle = "#8edbc566";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, 34, 0, TAU);
    c.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = (i * TAU) / 8;
      c.fillStyle = "#9fe8d9";
      c.fillRect(
        p.x + Math.cos(angle) * 35 - 2,
        p.y + Math.sin(angle) * 35 - 2,
        4,
        4,
      );
    }
  }
}
export function drawMazeMap(c, game, width, height, portrait) {
  const map = game.map,
    size = Math.min(84, width * 0.2, height * 0.28),
    x = width - size - 12,
    y = portrait ? 10 : Math.min(110, height - size - 15),
    scale = (size - 8) / (map.radius * 2);
  c.save();
  c.translate(x + size / 2, y + size / 2);
  c.fillStyle = "#080d13dd";
  c.strokeStyle = "#a092be";
  c.lineWidth = 1;
  c.beginPath();
  c.arc(0, 0, size / 2, 0, TAU);
  c.fill();
  c.stroke();
  c.save();
  c.scale(scale, scale);
  c.translate(-map.cx, -map.cy);
  c.strokeStyle = "#77748b";
  c.lineWidth = 1 / scale;
  for (const wall of map.walls) {
    c.beginPath();
    if (wall.kind === "arc")
      c.arc(map.cx, map.cy, wall.r, wall.start, wall.end);
    else {
      c.moveTo(wall.a.x, wall.a.y);
      c.lineTo(wall.b.x, wall.b.y);
    }
    c.stroke();
  }
  c.restore();
  for (const p of map.portals) {
    c.fillStyle = "#afffe9";
    c.beginPath();
    c.arc((p.x - map.cx) * scale, (p.y - map.cy) * scale, 3, 0, TAU);
    c.fill();
  }
  if (game.spectatorFocus) {
    c.strokeStyle = "#b3edff";
    c.strokeRect(
      (game.spectatorFocus.x - map.cx) * scale - 4,
      (game.spectatorFocus.y - map.cy) * scale - 3,
      8,
      6,
    );
  }
  c.fillStyle = "#ffe0a4";
  c.beginPath();
  c.arc(
    (game.player.x - map.cx) * scale,
    (game.player.y - map.cy) * scale,
    3,
    0,
    TAU,
  );
  c.fill();
  c.restore();
}
