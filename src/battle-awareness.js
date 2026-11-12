import { inWorld } from "./portals.js";
import { dungeonActorAvailable } from "./dungeon.js";

export const ALLY_MAP_COLOR = "#72e6a2";
export const ENEMY_MAP_COLOR = "#ff9b57";
export const teamMapColor = (team, viewer) =>
  team === viewer.team ? ALLY_MAP_COLOR : ENEMY_MAP_COLOR;

export const clearAllyHealth = (a, viewer) =>
  a.alive &&
  !a.ghost &&
  inWorld(a) &&
  a.id !== viewer.id &&
  a.team === viewer.team &&
  (a.element === "divine" || a.zombieSkills?.includes("invisibility"));

export function minimapFighters(game) {
  return game.fighters
    .filter(
      (a) =>
        a.alive &&
        inWorld(a) &&
        dungeonActorAvailable(game, a) &&
        (a.team === game.player.team || game.canSee(game.player, a)),
    )
    .sort(
      (a, b) =>
        Number(a.id === game.player.id) - Number(b.id === game.player.id),
    );
}
export function drawMinimapFighters(c, game, scale, cx = 0, cy = 0) {
  for (const a of minimapFighters(game)) {
    const self = a.id === game.player.id;
    c.fillStyle = teamMapColor(a.team, game.player);
    c.strokeStyle = self ? "#fff0bc" : "#152b24";
    c.lineWidth = self ? 1.3 : 0.8;
    c.beginPath();
    c.arc(
      (a.x - cx) * scale,
      (a.y - cy) * scale,
      self ? 3 : 2.3,
      0,
      Math.PI * 2,
    );
    c.fill();
    c.stroke();
  }
}
