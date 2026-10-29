// Older combat scenarios use fixed coordinates in the original rectangle.
// Keep that deterministic fixture while map integration tests use Combat directly.
export * from "../src/combat.js";
import { Combat as GameCombat } from "../src/combat.js";
export class Combat extends GameCombat {
  constructor(options = {}) {
    super({ mapId: "classic", ...options });
  }
}
