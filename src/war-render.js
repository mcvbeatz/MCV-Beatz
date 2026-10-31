export function drawWarSupplies(c, game, time) {
  if (game.mode !== "war") return;
  c.save();
  for (const base of game.warBases) {
    const color = base.team === game.player.team ? "#8ce0c4" : "#ef9a7c";
    c.strokeStyle = color + "aa";
    c.lineWidth = 3;
    c.fillStyle = color + "12";
    c.beginPath();
    c.ellipse(base.x, base.y, 58, 38, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.font = "12px sans-serif";
    c.textAlign = "center";
    c.fillStyle = color;
    c.fillText(`${base.element.toUpperCase()} BASE`, base.x, base.y + 58);
    if (base.element !== "light") {
      c.font = "10px sans-serif";
      c.fillText(
        `HEAL · ${Math.max(0, Math.ceil(game.nextHealthDropAt - game.time))}s`,
        base.x,
        base.y + 73,
      );
    }
  }
  for (const drop of game.healthDrops) {
    const bob = Math.sin(time * 3 + drop.bornAt) * 3;
    c.fillStyle = "#0c292855";
    c.beginPath();
    c.ellipse(drop.x, drop.y + 7, 13, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(drop.x, drop.y - 12 + bob);
    c.shadowColor = "#8dffd5";
    c.shadowBlur = 12;
    c.fillStyle = "#204c40";
    c.strokeStyle = "#b0ffdc";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 12, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = "#e1ffe5";
    c.fillRect(-2, -7, 4, 14);
    c.fillRect(-7, -2, 14, 4);
    c.restore();
  }
  c.restore();
}
