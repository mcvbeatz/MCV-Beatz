const TAU = Math.PI * 2;
function floorPath(c, map) {
  c.beginPath();
  if (map.kind === "garden") {
    const [h, v] = map.shapes,
      right = h.x + h.w,
      bottom = h.y + h.h,
      vr = v.x + v.w,
      vb = v.y + v.h;
    const points = [
      [v.x, v.y],
      [vr, v.y],
      [vr, h.y],
      [right, h.y],
      [right, bottom],
      [vr, bottom],
      [vr, vb],
      [v.x, vb],
      [v.x, bottom],
      [h.x, bottom],
      [h.x, h.y],
      [v.x, h.y],
    ];
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  } else {
    // Continuous silhouette of the circles joined by the 180-unit bridge.
    const [large, small, bridge] = map.shapes,
      half = bridge.h / 2;
    const a = Math.asin(half / large.r),
      b = Math.asin(half / small.r);
    c.arc(large.x, large.y, large.r, a, TAU - a);
    c.lineTo(small.x - Math.sqrt(small.r ** 2 - half ** 2), bridge.y);
    c.arc(small.x, small.y, small.r, Math.PI + b, Math.PI - b);
    c.closePath();
  }
}
function seeded() {
  let seed = 78231;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}
function lamp(c, x, y, t = 0) {
  y += Math.sin(t + x * 0.02) * 5;
  const glow = c.createRadialGradient(x, y, 2, x, y, 45);
  glow.addColorStop(0, "#ffe2a26b");
  glow.addColorStop(1, "#eac08300");
  c.fillStyle = glow;
  c.fillRect(x - 45, y - 45, 90, 90);
  c.strokeStyle = "#b49c73";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, y - 23);
  c.lineTo(x + 9, y - 10);
  c.lineTo(x + 7, y + 10);
  c.lineTo(x, y + 17);
  c.lineTo(x - 7, y + 10);
  c.lineTo(x - 9, y - 10);
  c.closePath();
  c.fillStyle = "#29293e";
  c.fill();
  c.stroke();
  c.fillStyle = "#ffdb8f";
  c.fillRect(x - 4, y - 8, 8, 16);
  c.fillStyle = "#fff5d1";
  c.fillRect(x - 1, y - 7, 2, 13);
}
export function paintBattleMap(c, map) {
  const garden = map.kind === "garden",
    random = seeded();
  c.fillStyle = garden ? "#123b48" : "#070916";
  c.fillRect(0, 0, map.width, map.height);
  if (garden) {
    const water = c.createRadialGradient(1024, 680, 100, 1024, 680, 1080);
    water.addColorStop(0, "#327e87");
    water.addColorStop(1, "#102e43");
    c.fillStyle = water;
    c.fillRect(0, 0, map.width, map.height);
    for (let i = 0; i < 3200; i++) {
      const x = random() * map.width,
        y = random() * map.height;
      c.fillStyle = random() > 0.5 ? "#98e7cf19" : "#0b2e4a2b";
      c.fillRect(x, y, 5 + random() * 30, 1 + random() * 2);
    }
    // Submerged bases, reflections and tall weathered stone columns.
    for (const x of [475, 610, 1438, 1573])
      for (const y of [165, 285, 1090, 1210]) {
        c.fillStyle = "#061e2c55";
        c.beginPath();
        c.ellipse(x + 12, y + 22, 32, 13, 0, 0, TAU);
        c.fill();
        c.strokeStyle = "#9bdac844";
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(x, y + 7, 29, 10, 0, 0, TAU);
        c.stroke();
        c.fillStyle = "#243c43";
        c.fillRect(x - 19, y - 2, 38, 12);
        c.fillStyle = "#536869";
        c.fillRect(x - 13, y - 77, 26, 77);
        c.fillStyle = "#728281";
        c.fillRect(x - 13, y - 77, 8, 77);
        c.fillStyle = "#314c53";
        c.fillRect(x + 6, y - 77, 7, 77);
        c.fillStyle = "#91a19a";
        c.fillRect(x - 20, y - 85, 40, 10);
        c.fillStyle = "#b8c6ac";
        c.fillRect(x - 18, y - 86, 36, 3);
        c.fillStyle = "#426756";
        c.fillRect(x - 13, y - 30, 6, 23);
      }
  } else {
    const abyss = c.createRadialGradient(1024, 680, 200, 1024, 680, 1000);
    abyss.addColorStop(0, "#020410");
    abyss.addColorStop(0.7, "#090d20");
    abyss.addColorStop(1, "#1d1b3300");
    c.fillStyle = abyss;
    c.fillRect(0, 0, 2048, 1360);
    // Receding concentric masonry courses establish a tall, hollow tower.
    c.save();
    c.beginPath();
    c.rect(0, 0, 2048, 1360);
    c.ellipse(1024, 680, 1010, 670, 0, 0, TAU, true);
    c.clip("evenodd");
    c.fillStyle = "#313047";
    c.fillRect(0, 0, 2048, 1360);
    c.restore();
    for (let tier = 0; tier < 12; tier++) {
      const rx = 1010 - tier * 3,
        ry = 670 - tier * 3;
      c.strokeStyle = ["#777082", "#37354e", "#514c64"][tier % 3];
      c.lineWidth = 7;
      c.beginPath();
      c.ellipse(1024, 680, rx, ry, 0, 0, TAU);
      c.stroke();
      c.strokeStyle = "#121529";
      c.lineWidth = 2;
      for (let i = 0; i < 56; i++) {
        const angle = ((i + (tier % 2) * 0.5) * TAU) / 56;
        c.beginPath();
        c.moveTo(1024 + Math.cos(angle) * rx, 680 + Math.sin(angle) * ry);
        c.lineTo(
          1024 + Math.cos(angle) * (rx - 6),
          680 + Math.sin(angle) * (ry - 6),
        );
        c.stroke();
      }
    }
    for (let i = 0; i < 24; i++) {
      const angle = (i * TAU) / 24;
      c.strokeStyle = "#55516e";
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(1024 + Math.cos(angle) * 1000, 680 + Math.sin(angle) * 660);
      c.lineTo(1024 + Math.cos(angle) * 975, 680 + Math.sin(angle) * 635);
      c.stroke();
    }
  }
  // Raised floor edge, with the same silhouette used by collision.
  c.save();
  c.translate(0, garden ? 12 : 22);
  floorPath(c, map);
  c.fillStyle = garden ? "#172d32" : "#1e2338";
  c.fill();
  c.restore();
  floorPath(c, map);
  c.fillStyle = garden ? "#5b8149" : "#d2d3d9";
  c.fill();
  c.save();
  floorPath(c, map);
  c.clip();
  if (garden) {
    const grass = c.createRadialGradient(1024, 680, 100, 1024, 680, 700);
    grass.addColorStop(0, "#7e9a57");
    grass.addColorStop(1, "#456e42");
    c.fillStyle = grass;
    c.fillRect(0, 0, 2048, 1360);
    for (let i = 0; i < 15000; i++) {
      const x = random() * 2048,
        y = random() * 1360;
      c.fillStyle = ["#c1c77e42", "#304f3855", "#a0b46b55"][i % 3];
      c.fillRect(x, y, 1 + random() * 3, 2 + random() * 4);
    }
    for (let i = 0; i < 220; i++) {
      const x = random() * 2048,
        y = random() * 1360;
      if (!map.walkable({ x, y }, 25)) continue;
      c.fillStyle = "#345938";
      c.fillRect(x, y, 2, 7);
      c.fillStyle = ["#f1d9b2", "#d2b8dc", "#eed477", "#f4c0bc"][i % 4];
      c.fillRect(x - 3, y - 1, 8, 3);
      c.fillRect(x, y - 4, 2, 9);
      c.fillStyle = "#d39d42";
      c.fillRect(x, y, 2, 2);
    }
  } else {
    // Low-contrast stone, with broad translucent mineral clouds. The slab
    // colors blend into the floor instead of reading as large square pixels.
    const marble = c.createLinearGradient(250, 150, 1800, 1250);
    marble.addColorStop(0, "#dbdde3");
    marble.addColorStop(0.5, "#d1d5df");
    marble.addColorStop(1, "#c7ccd7");
    c.fillStyle = marble;
    c.fillRect(0, 0, map.width, map.height);
    c.save();
    c.globalAlpha = 0.12;
    for (let y = 80; y < 1320; y += 56)
      for (let x = 160; x < 1970; x += 72) {
        c.fillStyle = ["#c9ccd6", "#d6d7dd", "#bfc5d1", "#dcdde1"][
          Math.floor(random() * 4)
        ];
        c.fillRect(x, y, 72, 56);
      }
    c.restore();
    for (let i = 0; i < 90; i++) {
      const x = random() * map.width,
        y = random() * map.height;
      const radius = 70 + random() * 180;
      const cloud = c.createRadialGradient(x, y, 0, x, y, radius);
      cloud.addColorStop(0, i % 2 ? "#f9f6ec28" : "#8d9ab018");
      cloud.addColorStop(1, i % 2 ? "#f9f6ec00" : "#8d9ab000");
      c.fillStyle = cloud;
      c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // Continuous, softly feathered veins cross the slab joins.
    for (let i = 0; i < 36; i++) {
      const x = random() * map.width,
        y = random() * map.height;
      const length = 100 + random() * 280;
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(
        x + 35,
        y + length * 0.25,
        x - 55,
        y + length * 0.65,
        x + 95,
        y + length,
      );
      c.strokeStyle = "#8b99b008";
      c.lineWidth = 7;
      c.stroke();
      c.strokeStyle = "#8b99b015";
      c.lineWidth = 1;
      c.stroke();
    }
    // Brass inlaid medallions and a tiled bridge link the unequal circles.
    for (const [x, r] of [
      [760, 490],
      [1680, 207],
    ]) {
      for (const inset of [0, 8, 55]) {
        c.strokeStyle = inset === 55 ? "#929cb370" : "#a48b60";
        c.lineWidth = inset === 8 ? 2 : 3;
        c.beginPath();
        c.arc(x, 680, r - inset, 0, TAU);
        c.stroke();
      }
      c.strokeStyle = "#8f96ae66";
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i <= 8; i++) {
        const angle = (i * TAU) / 8;
        const radius = i % 2 ? 50 : 125;
        const px = x + Math.cos(angle) * radius,
          py = 680 + Math.sin(angle) * radius;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();
    }
    c.strokeStyle = "#b29a6b";
    c.lineWidth = 3;
    for (const y of [605, 755]) {
      c.beginPath();
      c.moveTo(1285, y);
      c.lineTo(1450, y);
      c.stroke();
    }
  }
  c.restore();
  floorPath(c, map);
  c.strokeStyle = garden ? "#adc291" : "#f6ead0";
  c.lineWidth = 5;
  c.stroke();
  floorPath(c, map);
  c.strokeStyle = garden ? "#304e3c" : "#9e8a69";
  c.lineWidth = 1;
  c.stroke();
}
export function drawBattleAmbience(c, map, time) {
  if (map.kind !== "tower") return;
  // All lamps occupy the open gap, clear of both platform and tower masonry.
  for (const [x, y] of [
    [375, 235],
    [600, 130],
    [920, 130],
    [1200, 195],
    [1400, 320],
    [1580, 400],
    [1875, 480],
    [1970, 680],
    [1875, 880],
    [1580, 965],
    [1400, 1040],
    [1200, 1160],
    [920, 1230],
    [600, 1230],
    [375, 1125],
    [170, 480],
    [170, 880],
  ])
    lamp(c, x, y, time);
}
export function drawBattleMinimap(c, game, width, height, portrait) {
  const map = game.map,
    w = Math.min(136, width * 0.25),
    h = (w * 1360) / 2048;
  const x = width - w - 10,
    y = portrait ? 10 : Math.min(110, height - h - 15),
    scale = w / 2048;
  c.save();
  c.translate(x, y);
  c.fillStyle = "#091321de";
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "#9caeaa";
  c.strokeRect(0, 0, w, h);
  c.save();
  c.scale(scale, scale);
  floorPath(c, map);
  c.fillStyle = map.kind === "garden" ? "#87a565" : "#bdc4dc";
  c.fill();
  c.restore();
  for (const flag of game.flags) {
    c.fillStyle = flag.team === game.player.team ? "#7ee4ff" : "#ff8b76";
    c.fillRect(flag.x * scale - 2, flag.y * scale - 2, 4, 4);
  }
  for (const p of game.portals.portals) {
    c.fillStyle = "#d4fff4";
    c.fillRect(p.x * scale - 1.5, p.y * scale - 1.5, 3, 3);
  }
  c.fillStyle = "#ffe098";
  c.strokeStyle = "#302619";
  c.beginPath();
  c.arc(game.player.x * scale, game.player.y * scale, 3, 0, TAU);
  c.fill();
  c.stroke();
  c.restore();
}
