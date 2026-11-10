import { VOID_MANTLE_RANGE } from "./combat.js";
// Smooth canvas effects share the character's baseline and the combat shield state.
export function drawVoidMantle(c, a, time) {
  const rise = Math.min(1, a.shieldTime / 0.16);
  const orbit = VOID_MANTLE_RANGE + 18;
  c.save();
  c.scale(rise, rise);
  c.strokeStyle = "#80dce688";
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 0, VOID_MANTLE_RANGE, 0, Math.PI * 2);
  c.stroke();
  c.translate(0, -34);
  const glow = c.createRadialGradient(0, 0, 32, 0, 0, orbit + 18);
  glow.addColorStop(0, "#12162900");
  glow.addColorStop(0.62, "#43337966");
  glow.addColorStop(0.82, "#51c3df66");
  glow.addColorStop(1, "#76cced00");
  c.fillStyle = glow;
  c.beginPath();
  c.ellipse(0, 0, orbit + 18, 80, 0, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 6; i++) {
    const angle = time * (i % 2 ? -3.8 : 4.4) + (i * Math.PI) / 3;
    const radius = orbit - (i % 3) * 5;
    c.strokeStyle = ["#193751ee", "#60c5e6cc", "#a38bea99"][i % 3];
    c.lineWidth = 8 - (i % 3) * 2;
    c.beginPath();
    c.ellipse(0, 0, radius, radius * 0.83, -0.2, angle, angle + 1.8);
    c.stroke();
    c.strokeStyle = "#c1f4ffbb";
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(
      0,
      0,
      radius + 2,
      radius * 0.83 + 2,
      -0.2,
      angle + 0.2,
      angle + 0.9,
    );
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const angle = -time * 2.5 + (i * Math.PI) / 6;
    c.save();
    c.translate(Math.cos(angle) * orbit, Math.sin(angle) * 64);
    c.rotate(angle);
    c.fillStyle = i % 2 ? "#272d42" : "#3f4660";
    c.strokeStyle = "#87d3e8";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-9, -6);
    c.lineTo(4, -10);
    c.lineTo(11, 1);
    c.lineTo(5, 9);
    c.lineTo(-8, 6);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = "#b8efff";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-3, -6);
    c.lineTo(1, 0);
    c.lineTo(-2, 5);
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
