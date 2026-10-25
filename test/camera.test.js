import test from "node:test";
import assert from "node:assert/strict";
import { cameraView } from "../src/camera.js";
test("landscape preserves the whole-map camera and ignores player movement", () => {
  const a = cameraView(844, 350, { focus: { x: 135, y: 175 } }),
    b = cameraView(844, 350, { focus: { x: 889, y: 560 } });
  assert.deepEqual(a, b);
  assert.equal(a.scale, 350 / 530);
  assert.ok((0 - a.tx) / a.scale <= 95);
  assert.ok((844 - a.tx) / a.scale >= 929);
});
test("portrait shows fighters at least as large as landscape and never pans outside the map", () => {
  for (const [w, h, screenHeight] of [
    [390, 416, 844],
    [320, 222, 568],
    [430, 470, 932],
  ]) {
    const opts = { portrait: true, screenWidth: w, screenHeight };
    const landscape = cameraView(screenHeight, w - 40);
    for (const x of [135, 300, 512, 700, 889])
      for (const y of [175, 350, 560]) {
        const v = cameraView(w, h, { ...opts, focus: { x, y } });
        assert.ok(v.scale >= landscape.scale);
        assert.ok(-v.tx / v.scale >= 95 - 1e-8);
        assert.ok((w - v.tx) / v.scale <= 929 + 1e-8);
        assert.ok(-v.ty / v.scale >= 100 - 1e-8);
        assert.ok((h - v.ty) / v.scale <= 630 + 1e-8);
      }
  }
});
test("portrait follows the fighter centrally, then clamps at either edge", () => {
  const options = { portrait: true, screenWidth: 390, screenHeight: 844 };
  const left = cameraView(390, 416, { ...options, focus: { x: 135, y: 350 } }),
    leftAgain = cameraView(390, 416, { ...options, focus: { x: 180, y: 350 } });
  assert.equal(left.tx, leftAgain.tx);
  const middle = cameraView(390, 416, {
      ...options,
      focus: { x: 500, y: 350 },
    }),
    next = cameraView(390, 416, { ...options, focus: { x: 550, y: 350 } });
  assert.ok(next.tx < middle.tx);
  assert.equal(500 * middle.scale + middle.tx, 195);
  const right = cameraView(390, 416, { ...options, focus: { x: 889, y: 350 } });
  assert.ok(Math.abs(right.tx - (390 - 929 * right.scale)) < 1e-8);
});
