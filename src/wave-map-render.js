export function paintWaveMap(c, map, floorPath) {
  c.fillStyle = "#080f19";
  c.fillRect(0, 0, map.width, map.height);
  // Recessed masonry surrounds three raised battle chambers.
  for (const room of map.rooms) {
    c.fillStyle = "#142838";
    c.fillRect(room.x - 42, room.y - 42, room.w + 84, room.h + 84);
    c.strokeStyle = "#3a5160";
    c.lineWidth = 6;
    c.strokeRect(room.x - 24, room.y - 24, room.w + 48, room.h + 48);
  }
  c.save();
  floorPath(c, map);
  c.clip();
  const stone = c.createLinearGradient(0, 175, 0, 825);
  stone.addColorStop(0, "#657b80");
  stone.addColorStop(0.5, "#3d5965");
  stone.addColorStop(1, "#263e4c");
  c.fillStyle = stone;
  c.fillRect(0, 0, map.width, map.height);
  c.lineWidth = 1;
  for (let y = 150; y < 900; y += 50) {
    for (let x = y % 100 ? 25 : 0; x < map.width; x += 100) {
      c.fillStyle = (x + y) % 3 ? "#bec5b207" : "#112b3c16";
      c.fillRect(x, y, 100, 50);
      c.strokeStyle = "#bfd2cd22";
      c.strokeRect(x, y, 100, 50);
    }
  }
  for (const corridor of map.shapes.slice(3)) {
    c.fillStyle = "#254b50";
    c.fillRect(corridor.x, 440, corridor.w, 120);
    c.strokeStyle = "#a99b69";
    c.lineWidth = 2;
    c.strokeRect(corridor.x, 440, corridor.w, 120);
    for (let x = corridor.x + 45; x < corridor.x + corridor.w; x += 55) {
      c.beginPath();
      c.moveTo(x, 488);
      c.lineTo(x + 12, 500);
      c.lineTo(x, 512);
      c.strokeStyle = "#b4d6c377";
      c.stroke();
    }
  }
  map.rooms.forEach((room, index) => {
    const x = room.x + room.w / 2;
    c.strokeStyle = "#cbb67b88";
    c.lineWidth = 3;
    c.strokeRect(room.x + 34, room.y + 34, room.w - 68, room.h - 68);
    for (const r of [130, 150]) {
      c.beginPath();
      c.arc(x, 500, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.save();
    c.translate(x, 500);
    c.rotate(Math.PI / 4);
    c.strokeRect(-78, -78, 156, 156);
    c.restore();
    c.textAlign = "center";
    c.font = "36px Georgia";
    c.fillStyle = "#d7ce9b99";
    c.fillText(["I", "II", "III"][index], x, 512);
    c.font = "16px Georgia";
    c.fillStyle = "#d7ce9bb0";
    c.fillText(["THE THRESHOLD", "THE CRUCIBLE", "THE CROWN"][index], x, 260);
  });
  c.restore();
  floorPath(c, map);
  c.strokeStyle = "#c3ae77";
  c.lineWidth = 5;
  c.stroke();
}

export function drawWaveGuidance(c, game, time) {
  const map = game.map;
  if (map?.kind !== "waves") return;
  c.save();
  for (const room of map.rooms) {
    for (const x of [room.x + 55, room.x + room.w - 55]) {
      for (const y of [room.y + 70, room.y + room.h - 70]) {
        const glow = c.createRadialGradient(x, y, 3, x, y, 65);
        glow.addColorStop(0, "#f9d38b88");
        glow.addColorStop(1, "#f9d38b00");
        c.fillStyle = glow;
        c.fillRect(x - 65, y - 65, 130, 130);
        c.fillStyle = "#172f3b";
        c.fillRect(x - 9, y - 9, 18, 24);
        c.fillStyle = "#ffe7aa";
        c.beginPath();
        c.arc(x, y - 2, 5 + Math.sin(time * 3 + x) * 0.8, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  if (game.waveTravel) {
    const p = game.waveRally;
    c.strokeStyle = "#a6ffe0";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(p.x, p.y, 48 + Math.sin(time * 3) * 5, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#d1ffe7";
    c.textAlign = "center";
    c.font = "bold 18px sans-serif";
    c.fillText(`NEXT WAVE · CHAMBER ${game.nextWaveRoom + 1}`, p.x, p.y - 68);
    // A nearby arrow remains visible while the destination is off-screen.
    const sign = Math.sign(p.x - game.player.x);
    if (Math.abs(p.x - game.player.x) > 170) {
      const x = game.player.x + sign * 100,
        y = game.player.y - 30;
      c.beginPath();
      c.moveTo(x - sign * 12, y - 10);
      c.lineTo(x, y);
      c.lineTo(x - sign * 12, y + 10);
      c.stroke();
    }
  } else {
    const room = map.rooms[game.waveRoom];
    c.strokeStyle = "#f0c985bb";
    c.lineWidth = 5;
    for (const x of [room.x + 2, room.x + room.w - 2]) {
      c.beginPath();
      c.moveTo(x, 410);
      c.lineTo(x, 590);
      c.stroke();
    }
  }
  c.restore();
}
