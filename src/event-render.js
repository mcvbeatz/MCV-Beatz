const TAU = Math.PI * 2;
function trackPath(c, map) {
  c.beginPath();
  for (const [i, p] of map.track.entries())
    i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
  c.closePath();
}
function tree(c, x, y, size = 1) {
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  c.fillStyle = "#071e1899";
  c.beginPath();
  c.ellipse(4, 6, 15, 9, 0, 0, TAU);
  c.fill();
  c.fillStyle = "#705039";
  c.fillRect(-3, -8, 6, 17);
  for (let j = 0; j < 3; j++) {
    c.fillStyle = ["#174b36", "#216446", "#33835a"][j];
    c.beginPath();
    c.moveTo(0, -37 + j * 8);
    c.lineTo(-16 + j * 3, -5 - j * 5);
    c.lineTo(16 - j * 3, -5 - j * 5);
    c.closePath();
    c.fill();
  }
  c.restore();
}
export function paintEvergreen(c, map) {
  const sky = c.createLinearGradient(0, 0, 0, map.height);
  sky.addColorStop(0, "#13382c");
  sky.addColorStop(1, "#071f20");
  c.fillStyle = sky;
  c.fillRect(0, 0, map.width, map.height);
  c.fillStyle = "#54784c";
  c.beginPath();
  c.arc(map.cx, map.cy, map.radius, 0, TAU);
  c.fill();
  for (let i = 0; i < 1600; i++) {
    const x = (Math.sin(i * 17.17) * 0.5 + 0.5) * map.width,
      y = (Math.sin(i * 37.71) * 0.5 + 0.5) * map.height;
    if (Math.hypot(x - map.cx, y - map.cy) < map.radius) {
      c.fillStyle = i % 3 ? "#bad39a29" : "#d9dec055";
      c.fillRect(x, y, 3, 2);
    }
  }
  for (const s of map.segments) {
    const length = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y),
      n = Math.max(1, Math.ceil(length / 22));
    for (let i = 0; i < n; i++)
      tree(
        c,
        s.a.x + ((s.b.x - s.a.x) * i) / n,
        s.a.y + ((s.b.y - s.a.y) * i) / n,
        0.95,
      );
  }
  for (const [i, p] of map.flagHomes.entries()) {
    c.fillStyle = i ? "#d47e4866" : "#75d9b366";
    c.beginPath();
    c.arc(p.x, p.y, 36, 0, TAU);
    c.fill();
    c.strokeStyle = i ? "#ffd3aa" : "#c6ffdc";
    c.lineWidth = 3;
    c.stroke();
  }
}
export function paintStadium(c, map) {
  c.fillStyle = "#13232b";
  c.fillRect(0, 0, map.width, map.height);
  for (let row = 0; row < 8; row++) {
    c.strokeStyle = row % 2 ? "#30454c" : "#263a42";
    c.lineWidth = 13;
    c.strokeRect(
      70 + row * 13,
      95 + row * 12,
      map.width - 140 - row * 26,
      map.height - 190 - row * 24,
    );
    for (let i = 0; i < 70; i++) {
      c.fillStyle = ["#d0b58b", "#89bba6", "#cf946c", "#587b91"][(i + row) % 4];
      c.fillRect(95 + i * 23, 100 + row * 12, 5, 4);
      c.fillRect(95 + i * 23, map.height - 105 - row * 12, 5, 4);
    }
  }
  const r = map.shapes[0];
  c.fillStyle = "#39714d";
  c.fillRect(r.x, r.y, r.w, r.h);
  for (let i = 0; i < 12; i++) {
    c.fillStyle = i % 2 ? "#39784f" : "#438456";
    c.fillRect(r.x + (i * r.w) / 12, r.y, r.w / 12, r.h);
  }
  for (const z of map.endZones) {
    c.fillStyle = z.team ? "#a96542" : "#347c77";
    c.fillRect(z.x, z.y, z.w, z.h);
    c.save();
    c.translate(z.x + z.w / 2, map.cy);
    c.rotate(-Math.PI / 2);
    c.textAlign = "center";
    c.fillStyle = "#fff0d0";
    c.font = "bold 37px sans-serif";
    c.fillText(z.team ? "EMBER" : "JADE", 0, 12);
    c.restore();
  }
  c.strokeStyle = "#f1edc8";
  c.lineWidth = 4;
  c.strokeRect(r.x, r.y, r.w, r.h);
  c.beginPath();
  c.moveTo(map.cx, r.y);
  c.lineTo(map.cx, r.y + r.h);
  c.stroke();
  // Full yard lines, with no hash marks or goal posts.
  c.globalAlpha = 0.35;
  for (let i = 1; i < 10; i++) {
    const x = r.x + 150 + ((r.w - 300) * i) / 10;
    c.beginPath();
    c.moveTo(x, r.y);
    c.lineTo(x, r.y + r.h);
    c.stroke();
  }
  c.globalAlpha = 1;
  c.fillStyle = "#285c46";
  c.beginPath();
  c.moveTo(map.cx, map.cy - 75);
  c.lineTo(map.cx + 58, map.cy);
  c.lineTo(map.cx, map.cy + 75);
  c.lineTo(map.cx - 58, map.cy);
  c.closePath();
  c.fill();
  c.stroke();
  c.font = "bold 48px serif";
  c.fillStyle = "#f1edc8";
  c.textAlign = "center";
  c.fillText("E", map.cx, map.cy + 17);
  c.fillStyle = "#dce6d2";
  c.font = "bold 28px sans-serif";
  c.textAlign = "center";
  c.fillText("GRIDIRON", map.cx, 155);
  for (const x of [90, map.width - 90])
    for (const y of [130, map.height - 130]) {
      c.fillStyle = "#f4e8b6";
      c.shadowColor = "#e8f9ff";
      c.shadowBlur = 28;
      c.fillRect(x - 15, y - 5, 30, 10);
      c.shadowBlur = 0;
    }
}
export function paintTurnpike(c, map) {
  const sky = c.createLinearGradient(0, 0, 0, map.height);
  sky.addColorStop(0, "#456d9c");
  sky.addColorStop(1, "#b5dce7");
  c.fillStyle = sky;
  c.fillRect(0, 0, map.width, map.height);
  for (let i = 0; i < 85; i++) {
    const x = (Math.sin(i * 13.4) * 0.5 + 0.5) * map.width,
      y = (Math.sin(i * 6.9) * 0.5 + 0.5) * map.height;
    c.fillStyle = "#f3fcff55";
    c.beginPath();
    c.ellipse(x, y, 120 + (i % 5) * 25, 40 + (i % 3) * 12, -0.15, 0, TAU);
    c.fill();
  }
  c.save();
  c.translate(12, 28);
  trackPath(c, map);
  c.lineWidth = 170;
  c.strokeStyle = "#24477255";
  c.stroke();
  c.restore();
  trackPath(c, map);
  c.lineJoin = "round";
  c.lineCap = "round";
  c.lineWidth = 164;
  c.strokeStyle = "#c0f0ec";
  c.shadowColor = "#a4ffff";
  c.shadowBlur = 14;
  c.stroke();
  c.shadowBlur = 0;
  c.lineWidth = 148;
  c.strokeStyle = "#243b62";
  c.stroke();
  c.lineWidth = 132;
  c.strokeStyle = "#3a5480";
  c.stroke();
  c.lineWidth = 2;
  c.setLineDash([22, 28]);
  c.strokeStyle = "#add2e764";
  c.stroke();
  c.setLineDash([]);
  const start = map.trackAt(0);
  c.save();
  c.translate(start.x, start.y);
  c.rotate(Math.atan2(start.dy, start.dx));
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 10; col++) {
      c.fillStyle = (row + col) % 2 ? "#17283e" : "#effffc";
      c.fillRect(row * 14 - 14, col * 14 - 70, 14, 14);
    }
  c.restore();
  c.fillStyle = "#eaffff";
  c.textAlign = "center";
  c.font = "bold 27px sans-serif";
  c.fillText("CLOUDWAY CIRCUIT", map.cx, 1480);
  for (let i = 1; i < map.checkpoints.length; i++) {
    const p = map.checkpoints[i];
    c.save();
    c.translate(p.x, p.y);
    c.rotate(Math.atan2(p.dy, p.dx));
    c.strokeStyle = "#b8e7f466";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -75);
    c.lineTo(0, 75);
    c.stroke();
    c.restore();
  }
}
export function drawEventObjects(c, g, t, foreground = false) {
  if (g.ball && foreground) {
    const carrier = g.fighters.find((a) => a.id === g.ball.carrier),
      x = carrier ? carrier.x + 19 : g.ball.x,
      y = carrier ? carrier.y - 25 : g.ball.y;
    c.save();
    c.translate(x, y);
    c.rotate(-0.4);
    c.fillStyle = "#8b4b2b";
    c.strokeStyle = "#ffe3b5";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(0, 0, 15, 10, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(-7, 0);
    c.lineTo(7, 0);
    for (let i = -4; i <= 4; i += 4) {
      c.moveTo(i, -4);
      c.lineTo(i, 4);
    }
    c.stroke();
    c.restore();
  }
  if (foreground) return;
  for (const d of g.raceDrops || []) {
    c.save();
    c.translate(d.x, d.y + Math.sin(t * 3 + d.x) * 4);
    c.fillStyle =
      d.kind === "health"
        ? "#93edb2"
        : d.kind === "fire"
          ? "#ffb25a"
          : "#c3b0ff";
    c.shadowColor = c.fillStyle;
    c.shadowBlur = 12;
    c.beginPath();
    c.roundRect(-16, -16, 32, 32, 7);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = "#182642";
    c.font = "bold 22px sans-serif";
    c.textAlign = "center";
    if (d.kind === "fire") {
      c.beginPath();
      c.moveTo(0, -12);
      c.bezierCurveTo(1, -3, 13, 0, 8, 9);
      c.bezierCurveTo(3, 16, -12, 10, -8, 2);
      c.lineTo(-5, -3);
      c.lineTo(-3, 3);
      c.quadraticCurveTo(3, 0, 0, -12);
      c.fill();
    } else c.fillText(d.kind === "health" ? "+" : "?", 0, 8);
    c.restore();
  }
  for (const h of g.hazards.filter((h) => h.kind === "randomizer")) {
    c.save();
    c.translate(h.x, h.y);
    const opening = Math.min(1, Math.max(0.05, 1 - (h.opensAt - g.time) / 0.5));
    c.scale(opening, opening * 0.7);
    c.fillStyle = "#100d30e8";
    c.beginPath();
    c.arc(0, 0, h.r, 0, TAU);
    c.fill();
    for (let i = 0; i < 12; i++) {
      c.strokeStyle = `hsl(${(t * 100 + i * 30) % 360} 95% 72%)`;
      c.lineWidth = 4;
      c.shadowColor = c.strokeStyle;
      c.shadowBlur = 10;
      c.beginPath();
      c.arc(
        0,
        0,
        h.r - 3,
        (i * TAU) / 12 + t * 0.4,
        ((i + 1) * TAU) / 12 + t * 0.4,
      );
      c.stroke();
    }
    c.shadowBlur = 12;
    c.fillStyle = `hsl(${(t * 110) % 360} 100% 80%)`;
    c.font = "bold 72px sans-serif";
    c.textAlign = "center";
    c.fillText("?", 0, 26);
    c.restore();
  }
  if (g.mode === "turnpike") {
    const a = g.player,
      gate = g.map.checkpoints[a.raceNext % 16];
    c.strokeStyle = "#e7fba0";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(gate.x, gate.y, 22 + Math.sin(t * 3) * 3, 0, TAU);
    c.stroke();
  }
}
