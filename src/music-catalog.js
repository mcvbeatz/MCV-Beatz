export const BATTLE_TRACKS = [
  "watch-and-learn",
  "kennebeccebennek",
  "none-other",
  "sick",
];
export const TRACK_URLS = {
  "dont-let-up": new URL("./assets/music/dont-let-up.mp3", import.meta.url)
    .href,
  "watch-and-learn": new URL(
    "./assets/music/watch-and-learn.mp3",
    import.meta.url,
  ).href,
  kennebeccebennek: new URL(
    "./assets/music/kennebeccebennek.mp3",
    import.meta.url,
  ).href,
  "none-other": new URL("./assets/music/none-other.mp3", import.meta.url).href,
  sick: new URL("./assets/music/sick.mp3", import.meta.url).href,
  "no-smoke": new URL("./assets/music/no-smoke.mp3", import.meta.url).href,
  "a-win-is-a-win": new URL(
    "./assets/music/a-win-is-a-win.mp3",
    import.meta.url,
  ).href,
  downcast: new URL("./assets/music/downcast.mp3", import.meta.url).href,
  "no-escape": new URL("./assets/music/no-escape.mp3", import.meta.url).href,
};
export class BattlePlaylist {
  constructor(random = Math.random) {
    this.random = random;
    this.remaining = [];
    this.last = null;
  }
  next() {
    if (!this.remaining.length) {
      this.remaining = [...BATTLE_TRACKS];
      for (let i = this.remaining.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.remaining[i], this.remaining[j]] = [
          this.remaining[j],
          this.remaining[i],
        ];
      }
      if (this.remaining[0] === this.last)
        [this.remaining[0], this.remaining[1]] = [
          this.remaining[1],
          this.remaining[0],
        ];
    }
    return (this.last = this.remaining.shift());
  }
}
export function musicScene(screen, game) {
  if (screen === "loading") return "loading";
  if (screen !== "battle") return "menu";
  if (game.finished)
    return game.result === "victory"
      ? "victory"
      : game.result === "defeat"
        ? "defeat"
        : "draw";
  if (game.mode === "corruption") return "corruption";
  if (game.mapId === "volcano") return "volcano";
  return game.mode === "war" ? "war" : "battle";
}
