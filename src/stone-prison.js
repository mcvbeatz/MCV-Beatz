export const PRISON_HOLD = 2;
export const PRISON_COLLAPSE = 0.65;
export function drawStoneShell(c, rise = 1, collapse = 0) {
  c.save();
  c.translate(0, 9);
  c.scale(1, rise);
  c.globalAlpha *= (1 - collapse) ** 1.3;
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
    c.save();
    c.translate((i - 2.5) * 9 * collapse, 45 * collapse * collapse);
    c.rotate((i % 2 ? 1 : -1) * collapse * 0.18);
    c.scale(1, 1 - 0.65 * collapse);
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
    c.restore();
  }
  c.restore();
}
export function drawEmptyPrison(c, e) {
  const elapsed = e.max - e.life;
  const collapse = Math.max(
    0,
    Math.min(1, (elapsed - PRISON_HOLD) / PRISON_COLLAPSE),
  );
  c.save();
  c.translate(e.x, e.y);
  drawStoneShell(c, 1, collapse);
  if (collapse > 0 && collapse < 1) {
    c.globalAlpha *= Math.sin(Math.PI * collapse) * 0.35;
    c.fillStyle = "#c8b98b";
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.ellipse(
        (i - 3) * (8 + collapse * 5),
        5 - Math.sin(i * 2) * 5,
        9 + collapse * 10,
        3 + collapse * 4,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
  c.restore();
}
