import test from "node:test";
import assert from "node:assert/strict";
import { Combat, makeFighter } from "./combat-fixture.js";
import { characterPose } from "../src/characters.js";

test("running and target-locked ground movement alternate planted feet with two contact holds", () => {
  for (const element of ["fire", "light", "earth", "mud", "sanctuary"])
    for (const lock of [null, "enemy"])
      for (const [fx, fy, base] of [
        [1, 0, 2],
        [-1, 0, 2],
        [0, 1, 0],
        [0, -1, 4],
      ]) {
        const a = makeFighter("walker", element, 0, 400, 350);
        Object.assign(a, { vx: 150, movingTime: 1, lock, fx, fy });
        const contacts = [];
        for (let phase = 0; phase < 8; phase++) {
          a.gaitDistance = ((phase + 0.1) * 75) / 8;
          const p = characterPose(a);
          assert.equal(p.groundedMoving, true);
          assert.equal(p.gaitFrame, phase);
          contacts.push(p.contactFrame);
          if (p.footContact)
            assert.equal(
              p.bob,
              0,
              "planted feet do not float above their contact plane",
            );
        }
        assert.deepEqual(contacts, [
          null,
          base,
          base,
          null,
          null,
          base + 1,
          base + 1,
          null,
        ]);
      }
});

test("step phase follows distance and stays stable when movement speed changes", () => {
  const g = new Combat({ element: "fire" }),
    a = g.player;
  Object.assign(a, { x: 350, y: 350, fx: 1, fy: 0 });
  g.fighters = [a];
  g.move(a, 1, 0, 0.05);
  assert.ok(Math.abs(a.gaitDistance - 7.5) < 1e-8);
  const before = characterPose(a).gaitFrame;
  a.slow = 2;
  assert.equal(
    characterPose(a).gaitFrame,
    before,
    "slowing must not seek to a different animation phase",
  );
  g.move(a, 1, 0, 0.05);
  assert.ok(Math.abs(a.gaitDistance - 11.1) < 1e-8);
  assert.equal(characterPose(a).footContact, true);
  a.slow = 0;
  g.move(a, 0.25, 0, 0.05);
  assert.ok(Math.abs(a.gaitDistance - 12.975) < 1e-8);
});

test("walls, knockback-only movement, resting and flight cannot play planted steps", () => {
  const g = new Combat({ element: "fire" }),
    a = g.player;
  g.fighters = [a];
  Object.assign(a, { x: 889, y: 350 });
  g.move(a, 1, 0, 0.05);
  assert.equal(a.gaitDistance, 0);
  assert.equal(characterPose(a).groundedMoving, false);
  a.x = 400;
  a.knockX = 120;
  g.move(a, 0, 0, 0.05);
  assert.equal(a.gaitDistance, 0);
  assert.equal(characterPose(a).groundedMoving, false);
  for (const element of ["air", "blaze", "phoenix", "divine"]) {
    const flying = makeFighter("flying", element, 0, 400, 350);
    Object.assign(flying, {
      vx: 150,
      movingTime: 1,
      gaitDistance: 15,
      lock: "enemy",
    });
    assert.equal(characterPose(flying).footContact, false);
  }
});
