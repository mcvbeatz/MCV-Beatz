export const TELEPORT_ARRIVAL_TIME = 0.28;
export function teleportPose(a) {
  if (
    a.element !== "multi-dimensional" ||
    !a.alive ||
    a.ghost ||
    a.victory ||
    a.transit ||
    a.dimension ||
    a.hitReact > 0 ||
    a.swing > 0 ||
    a.clash > 0 ||
    a.charging ||
    a.castTime > 0
  )
    return null;
  const entering = !!a.blink;
  if (!entering && !(a.teleportArrival > 0)) return null;
  const dx = entering ? a.blink.x - a.x : a.teleportFx,
    dy = entering ? a.blink.y - a.y : a.teleportFy;
  const length = Math.hypot(dx, dy) || 1,
    fx = dx / length,
    fy = dy / length;
  const facing = Math.abs(fx) > Math.abs(fy) ? 1 : fy < 0 ? 2 : 0;
  const progress = Math.max(
    0,
    Math.min(
      1,
      entering
        ? 1 - a.blink.remaining / 0.2
        : 1 - a.teleportArrival / TELEPORT_ARRIVAL_TIME,
    ),
  );
  return {
    entering,
    progress,
    fx,
    fy,
    facing,
    flip: facing === 1 && fx < 0,
    frame: facing * 4 + (entering ? 0 : 2) + (progress >= 0.5 ? 1 : 0),
  };
}
export function drawTeleportOpening(c, pose, front = false) {
  const p = pose.progress;
  const openness = Math.sin(
    Math.PI * (pose.entering ? 0.25 + p * 0.75 : 1 - p) * 0.5,
  );
  c.save();
  c.translate(-pose.fx * 6, -30);
  const rx = pose.facing === 1 ? 15 : 24,
    ry = 37;
  c.globalAlpha *= Math.max(0, openness);
  if (!front) {
    const glow = c.createRadialGradient(0, 0, 3, 0, 0, 42);
    glow.addColorStop(0, "#3b146855");
    glow.addColorStop(0.6, "#904eff44");
    glow.addColorStop(1, "#b570ff00");
    c.fillStyle = glow;
    c.beginPath();
    c.ellipse(0, 0, rx + 15, ry + 8, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = front ? "#e9cfff" : "#ac79f3";
  c.lineWidth = front ? 1.6 : 2.8;
  c.shadowColor = "#b06dff";
  c.shadowBlur = front ? 5 : 9;
  c.beginPath();
  c.ellipse(
    0,
    0,
    rx,
    ry,
    0,
    front ? -Math.PI / 2 : 0,
    front ? Math.PI / 2 : Math.PI * 2,
  );
  c.stroke();
  c.restore();
}
