const TAU = Math.PI * 2;
export function paintVolcanicMap(c, map) {
  let seed = 7531;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lava = c.createRadialGradient(1024, 680, 400, 1024, 680, 1150);
  lava.addColorStop(0, "#ffb13e");
  lava.addColorStop(0.55, "#c7471f");
  lava.addColorStop(1, "#25131b");
  c.fillStyle = lava;
  c.fillRect(0, 0, map.width, map.height);
  for (let i = 0; i < 90; i++) {
    const x = random() * map.width,
      y = random() * map.height;
    c.strokeStyle = i % 2 ? "#ffda7540" : "#72252355";
    c.lineWidth = 2 + random() * 5;
    c.beginPath();
    c.ellipse(x, y, 30 + random() * 110, 8 + random() * 20, -0.3, 0, TAU);
    c.stroke();
  }
  // Jagged basalt crags rise out of the lava around the central caldera.
  for (let i = 0; i < 44; i++) {
    const angle = (i / 44) * TAU,
      radius = 655 + random() * 200;
    const x = map.cx + Math.cos(angle) * radius,
      y = map.cy + Math.sin(angle) * radius;
    const w = 25 + random() * 65,
      h = 50 + random() * 130;
    c.fillStyle = "#100f18";
    c.beginPath();
    c.moveTo(x - w, y + 10);
    c.lineTo(x - w * 0.6, y - h * 0.6);
    c.lineTo(x, y - h);
    c.lineTo(x + w * 0.8, y - h * 0.55);
    c.lineTo(x + w, y + 15);
    c.closePath();
    c.fill();
    c.fillStyle = "#40303a";
    c.beginPath();
    c.moveTo(x, y - h);
    c.lineTo(x + w * 0.8, y - h * 0.55);
    c.lineTo(x + w, y + 15);
    c.lineTo(x + 5, y - 10);
    c.fill();
  }
  c.save();
  c.beginPath();
  c.arc(map.cx, map.cy, 590, 0, TAU);
  c.shadowColor = "#ffb44d";
  c.shadowBlur = 34;
  c.fillStyle = "#52404a";
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = "#b87850";
  c.lineWidth = 10;
  c.stroke();
  c.clip();
  const rock = c.createRadialGradient(1024, 680, 10, 1024, 680, 590);
  rock.addColorStop(0, "#5a5050");
  rock.addColorStop(0.7, "#403c43");
  rock.addColorStop(1, "#302c36");
  c.fillStyle = rock;
  c.fillRect(400, 80, 1250, 1200);
  for (let i = 0; i < 1800; i++) {
    c.fillStyle = i % 2 ? "#c7a58b16" : "#15131b22";
    c.beginPath();
    c.ellipse(
      430 + random() * 1190,
      90 + random() * 1180,
      2 + random() * 10,
      1 + random() * 4,
      random() * TAU,
      0,
      TAU,
    );
    c.fill();
  }
  for (let i = 0; i < 38; i++) {
    const x = 460 + random() * 1130,
      y = 130 + random() * 1100;
    c.beginPath();
    c.moveTo(x, y);
    let xx = x,
      yy = y;
    for (let j = 0; j < 5; j++) {
      xx += random() * 70 - 25;
      yy += random() * 70 - 25;
      c.lineTo(xx, yy);
    }
    c.strokeStyle = "#211c27";
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = i % 3 ? "#b75c3855" : "#fca75f88";
    c.lineWidth = 1.4;
    c.stroke();
  }
  c.strokeStyle = "#ad8b6a55";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(1024, 680, 135, 0, TAU);
  c.stroke();
  for (const x of [560, 1488]) {
    c.fillStyle = "#51494b";
    c.strokeStyle = "#b9a082";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, 680, 100, 0, TAU);
    c.fill();
    c.stroke();
    c.strokeStyle = "#c4ad8244";
    c.beginPath();
    c.arc(x, 680, 86, 0, TAU);
    c.stroke();
  }
  c.restore();
}
export function drawVolcanicAmbience(c, map, time) {
  c.save();
  for (let i = 0; i < 32; i++) {
    const angle = i * 2.4,
      r = 620 + (i % 5) * 34;
    const x = map.cx + Math.cos(angle) * r,
      y = map.cy + Math.sin(angle) * r - ((time * 24 + i * 17) % 70);
    c.globalAlpha = 0.25 + Math.sin(time * 2 + i) * 0.2;
    c.fillStyle = i % 2 ? "#ffcc75" : "#ff7951";
    c.beginPath();
    c.arc(x, y, 2 + (i % 3), 0, TAU);
    c.fill();
  }
  c.restore();
}
