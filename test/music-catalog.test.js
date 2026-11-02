import test from "node:test";
import assert from "node:assert/strict";
import {
  BattlePlaylist,
  BATTLE_TRACKS,
  musicScene,
} from "../src/music-catalog.js";
import { MODES } from "../src/mode-catalog.js";
test("random battle rotation uses all four tracks before repeating, never back to back", () => {
  for (const random of [() => 0, () => 0.99, Math.random]) {
    const playlist = new BattlePlaylist(random),
      songs = Array.from({ length: 40 }, () => playlist.next());
    for (let i = 0; i < songs.length; i += 4)
      assert.deepEqual(
        [...new Set(songs.slice(i, i + 4))].sort(),
        [...BATTLE_TRACKS].sort(),
      );
    for (let i = 1; i < songs.length; i++)
      assert.notEqual(songs[i], songs[i - 1]);
  }
});
test("all modes route battle, map and team outcome music with dedicated War music and map precedence", () => {
  for (const mode of Object.keys(MODES)) {
    const game = { mode, mapId: "garden", finished: false };
    assert.equal(
      musicScene("battle", game),
      mode === "corruption" ? "corruption" : mode === "war" ? "war" : "battle",
    );
    game.mapId = "volcano";
    assert.equal(
      musicScene("battle", game),
      mode === "corruption" ? "corruption" : "volcano",
    );
    for (const result of ["victory", "defeat", "draw"]) {
      game.finished = true;
      game.result = result;
      assert.equal(musicScene("battle", game), result);
      assert.equal(musicScene("setup", game), "menu");
    }
    assert.equal(musicScene("loading", game), "loading");
  }
});
