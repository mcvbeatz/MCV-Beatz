import strides from "../src/assets/alternating-strides.json" with { type: "json" };
import test from "node:test";
import assert from "node:assert/strict";
import { makeFighter } from "../src/combat.js";
import { characterPose } from "../src/characters.js";
import running from "../src/assets/light-running.json" with { type: "json" };
import dark from "../src/assets/dark-core.json" with { type: "json" };
import core from "../src/assets/light-core.json" with { type: "json" };
test("Light, Dark and Ice use the same four evenly timed, distance-driven running keys", () => {
  for (const element of ["light", "dark", "ice"]) {
    const a = makeFighter("test", element, 0, 0, 0);
    Object.assign(a, { vx: 150, movingTime: 1 });
    const keys = [];
    for (let phase = 0; phase < 8; phase++) {
      a.gaitDistance = (phase * 75) / 8;
      keys.push(characterPose(a).fourStepFrame);
    }
    assert.deepEqual(keys, [0, 0, 1, 1, 2, 2, 3, 3]);
    a.lock = "enemy";
    a.gaitDistance = 37.5;
    assert.equal(characterPose(a).fourStepFrame, 2);
    assert.ok(characterPose(a).sidestepping);
    a.gaitDistance = 75;
    assert.equal(characterPose(a).fourStepFrame, 0);
  }
});
test("Light and Dark atlas frames retain a fixed body axis, baseline and scale within each direction", () => {
  for (const [spec, cols, rows, width, height, groupRows] of [
    [core.light, 6, 6, 1254, 1254, 2],
    [dark.dark, 5, 6, 1145, 1374, 2],
    [running.light, 4, 3, 1448, 1086, 1],
  ]) {
    for (let direction = 0; direction < 3; direction++) {
      const roots = [];
      for (
        let row = direction * groupRows;
        row < (direction + 1) * groupRows;
        row++
      )
        for (let col = 0; col < cols; col++) {
          const f = spec.frames[row * cols + col];
          roots.push([
            f.x + f.anchorX - (col * width) / cols,
            f.y + f.anchorY - (row * height) / rows,
            f.height || spec.height,
          ]);
        }
      for (const root of roots) assert.deepEqual(root, roots[0]);
    }
  }
});

test("Corrected stride rows retain fixed roots and one scale throughout both footfalls", () => {
  for (const spec of [strides.light, strides.dark]) {
    for (let row = 0; row < spec.frames.length / 4; row++) {
      const frames = spec.frames.slice(row * 4, row * 4 + 4);
      const roots = frames.map((f, col) => [
        f.x + f.anchorX - col * 312,
        f.y + f.anchorY,
        f.height,
      ]);
      for (const root of roots) assert.deepEqual(root, roots[0]);
    }
  }
});
