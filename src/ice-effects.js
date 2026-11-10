// Smooth canvas effects share the character's baseline and the combat shield state.
export function drawVoidMantle(c, a, time) {
  const rise = Math.min(1, a.shieldTime / 0.16);
  c.save();
  c.translate(0, -24);
  c.scale(rise, rise);
  const glow = c.createRadialGradient(0, 0, 20, 0, 0, 48);
  glow.addColorStop(0, "#12162900");
  glow.addColorStop(0.72, "#392e6e55");
  glow.addColorStop(1, "#76cced00");
  c.fillStyle = glow;
  c.beginPath();
  c.ellipse(0, 0, 48, 44, 0, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 3; i++) {
    const angle = time * 2.5 + (i * Math.PI * 2) / 3;
    c.strokeStyle = ["#367d9ccc", "#8c77c8bb", "#85d7e9cc"][i];
    c.lineWidth = 5 - i;
    c.beginPath();
    c.ellipse(0, 0, 39, 34, -0.2, angle, angle + 1.6);
    c.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const angle = -time * 1.4 + (i * Math.PI * 2) / 7;
    c.save();
    c.translate(Math.cos(angle) * 38, Math.sin(angle) * 32);
    c.rotate(angle);
    c.fillStyle = "#343949";
    c.strokeStyle = "#8fb6c9";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-7, -5);
    c.lineTo(3, -8);
    c.lineTo(8, 1);
    c.lineTo(4, 7);
    c.lineTo(-6, 5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }
  c.restore();
}
export function drawDrainGlow(c, a, time) {
  if (!(a.draining > 0)) return;
  c.save();
  const pulse = 0.7 + Math.sin(time * 9) * 0.15;
  c.globalAlpha *= pulse;
  const glow = c.createRadialGradient(0, -27, 8, 0, -27, 46);
  glow.addColorStop(0, "#b7f6ff33");
  glow.addColorStop(0.55, "#8dd7f755");
  glow.addColorStop(1, "#8964df00");
  c.fillStyle = glow;
  c.fillRect(-48, -78, 96, 100);
  c.strokeStyle = "#aee8f5aa";
  c.lineWidth = 1.5;
  c.beginPath();
  c.ellipse(0, -25, 25, 35, 0, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < 5; i++) {
    const phase = (time * 0.8 + i / 5) % 1;
    c.fillStyle = "#c0f5ff";
    c.beginPath();
    c.arc(Math.sin(i * 2.4 + time) * 22, -phase * 65, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
export function drawIcicle(c, p) {
  c.save();
  c.shadowColor = "#75d5fa";
  c.shadowBlur = 7;
  c.strokeStyle = "#92dcf666";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-Math.min(36, p.trail), 0);
  c.lineTo(0, 0);
  c.stroke();
  c.fillStyle = "#94d6ec";
  c.beginPath();
  c.moveTo(15, 0);
  c.lineTo(-9, -4);
  c.lineTo(-5, 0);
  c.lineTo(-9, 4);
  c.closePath();
  c.fill();
  c.fillStyle = "#e7fbff";
  c.beginPath();
  c.moveTo(15, 0);
  c.lineTo(-9, -4);
  c.lineTo(-5, 0);
  c.closePath();
  c.fill();
  c.restore();
}
