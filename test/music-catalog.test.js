import test from "node:test";
import assert from "node:assert/strict";
import {
  BattlePlaylist,
  BATTLE_TRACKS,
  RACING_TRACKS,
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
      ["corruption", "war", "gridiron", "turnpike", "dungeon"].includes(mode)
        ? mode
        : "battle",
    );
    game.mapId = "volcano";
    assert.equal(
      musicScene("battle", game),
      ["turnpike", "dungeon", "corruption"].includes(mode) ? mode : "volcano",
    );
    for (const result of ["victory", "defeat", "draw"]) {
      game.finished = true;
      game.result = result;
      assert.equal(
        musicScene("battle", game),
        ["turnpike", "dungeon"].includes(mode) ? mode : result,
      );
      assert.equal(musicScene("setup", game), "menu");
    }
    assert.equal(musicScene("loading", game), "loading");
  }
});

test("racing alternates its two songs independently of the ordinary battle playlist", () => {
  const racing = new BattlePlaylist(() => 0.5, RACING_TRACKS);
  const songs = Array.from({ length: 8 }, () => racing.next());
  assert.deepEqual(songs, [
    "kuuler",
    "good-golly",
    "kuuler",
    "good-golly",
    "kuuler",
    "good-golly",
    "kuuler",
    "good-golly",
  ]);
  assert.equal(new Set(songs).size, 2);
});
