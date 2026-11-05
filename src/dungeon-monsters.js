import sprites from "./assets/dungeon-monsters.json" with { type: "json" };
const atlas = typeof Image === "undefined" ? null : new Image();
let loaded = false;
export const monstersReady = new Promise((resolve) => {
  if (!atlas) return resolve(false);
  atlas.onload = () => {
    loaded = true;
    resolve(true);
  };
  atlas.onerror = () => resolve(false);
  atlas.src = new URL("./assets/dungeon-monsters.webp", import.meta.url).href;
});
export function drawDungeonMonster(c, a, time = 0) {
  const side = Math.abs(a.fx) > Math.abs(a.fy),
    dir = side ? 1 : a.fy < 0 ? 2 : 0;
  const moving = a.alive && Math.hypot(a.vx, a.vy) > 3;
  const step = moving ? Math.floor((a.gaitDistance || 0) / 22) % 2 : 0;
  const frame = a.swing > 0 && dir !== 2 ? (side ? 7 : 6) : dir * 2 + step;
  c.save();
  if (side && a.fx < 0) c.scale(-1, 1);
  if (a.hitReact > 0) c.translate(-a.fx * 3, -a.fy * 2);
  const spec = sprites[a.monsterKind],
    f = spec?.frames[frame];
  if (loaded && f) {
    const scale = (a.monsterKind === "snake" ? 52 : 62) / spec.height;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.beginPath();
    f.clip.forEach(([x, y], i) => {
      const px = (x - f.anchorX) * scale,
        py = (y - f.anchorY) * scale;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    });
    c.closePath();
    c.clip();
    c.drawImage(
      atlas,
      f.x,
      f.y,
      f.w,
      f.h,
      -f.anchorX * scale,
      -f.anchorY * scale,
      f.w * scale,
      f.h * scale,
    );
  } else {
    // Recognizable creature silhouette remains playable while its atlas loads.
    c.fillStyle = { alligator: "#4e877a", snake: "#7262a8", wolf: "#7c8c9f" }[
      a.monsterKind
    ];
    if (a.monsterKind === "snake") {
      c.lineWidth = 15;
      c.strokeStyle = c.fillStyle;
      c.beginPath();
      c.moveTo(-20, -3);
      c.bezierCurveTo(40, 0, -30, -36, 5, -45);
      c.stroke();
    } else {
      c.beginPath();
      c.ellipse(0, -20, 25, 15, 0, 0, Math.PI * 2);
      c.fill();
      for (const x of [-17, 15])
        for (const y of [-28, -6]) c.fillRect(x, y, 8, 10);
    }
    c.beginPath();
    c.ellipse(10, -36, 13, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#eaffb3";
    c.fillRect(9, -40, 4, 3);
  }
  c.restore();
  return true;
}
