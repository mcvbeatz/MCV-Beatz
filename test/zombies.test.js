import test from "node:test";
import assert from "node:assert/strict";
import { Combat, visibility, canUseSkill, distance } from "../src/combat.js";
import {
  ZOMBIE_ABILITIES,
  spawnZombie,
  updateZombies,
  useZombieAbility,
  refreshZombieTeams,
} from "../src/zombies.js";
import { updateGridironEvolution, updateGridiron } from "../src/event-modes.js";
const tick = (g, seconds, ai = false) => {
  for (let i = 0; i < Math.ceil(seconds / 0.02) && !g.finished; i++)
    g.update(0.02, { x: 0, y: 0 }, ai);
};
test("CTF ends at three captures or the three-minute leader and ties continue to the next capture", () => {
  for (const scores of [
    [3, 1],
    [2, 1],
  ]) {
    const g = new Combat({ mode: "ctf" });
    g.scores = scores;
    g.time = scores[0] === 3 ? 40 : 180;
    assert.equal(g.timeLimit, 180);
    assert.ok(g.checkMatchEnd());
    assert.equal(g.winnerTeam, 0);
  }
  const g = new Combat({ mode: "ctf" });
  g.time = 180;
  g.scores = [1, 1];
  assert.equal(g.checkMatchEnd(), false);
  assert.equal(g.suddenDeath, true);
  g.scores[1]++;
  assert.ok(g.checkMatchEnd());
  assert.equal(g.winnerTeam, 1);
  assert.match(g.finishReason, /Sudden/);
});
test("Gridiron starts all Earth and each trailing team grants one persistent Gravity evolution to its most-felled player", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0.2 });
  assert.ok(g.fighters.every((a) => a.element === "earth"));
  const a = g.fighters[2];
  a.deaths = 4;
  g.fell(a);
  g.scores = [0, 1];
  updateGridironEvolution(g);
  assert.equal(a.element, "gravity");
  assert.equal(a.alive, false);
  g.respawn(a);
  assert.equal(a.element, "gravity");
  g.fighters[0].deaths = 20;
  updateGridironEvolution(g);
  assert.equal(
    g.fighters.filter((b) => b.team === 0 && b.element === "gravity").length,
    1,
  );
  g.scores = [2, 1];
  g.fighters[6].deaths = 10;
  updateGridironEvolution(g);
  assert.equal(g.fighters[6].element, "gravity");
  assert.equal(a.element, "gravity");
});
test("Zombies clamps a 2–8 Ice team, opens the dungeon and distributes 17 unique abilities outside start and boss rooms", () => {
  for (const [players, count] of [
    [1, 2],
    [5, 5],
    [10, 8],
  ]) {
    const g = new Combat({ mode: "zombies", players });
    assert.equal(g.fighters.length, count);
    assert.ok(
      g.fighters.every(
        (a) => a.element === "ice" && a.team === 0 && g.map.walkable(a),
      ),
    );
    assert.equal(g.map.dungeonStage, 2);
    assert.equal(g.checkMatchEnd(), false);
    assert.equal(g.zombieDrops.length, 17);
    assert.equal(new Set(g.zombieDrops.map((d) => d.id)).size, 17);
    for (const d of g.zombieDrops) {
      const r = g.map.rooms[d.room];
      assert.ok(![0, 4].includes(d.room));
      assert.ok(d.x > r.x && d.x < r.x + r.w && d.y > r.y && d.y < r.y + r.h);
      assert.ok(g.map.walkable(d));
    }
  }
});
test("Fire spawns only at boss-room edges and each two-hit defeat adds one spawn per second", () => {
  const g = new Combat({ mode: "zombies", random: () => 0.1 });
  tick(g, 2);
  assert.equal(g.zombies.spawned, 2);
  for (const a of g.fighters.filter((a) => a.zombieEnemy)) {
    const r = g.map.rooms[4];
    assert.ok(g.map.walkable(a));
    assert.ok(
      Math.min(a.x - r.x, r.x + r.w - a.x, a.y - r.y, r.y + r.h - a.y) <= 29,
    );
  }
  const a = g.fighters.find((a) => a.zombieEnemy);
  assert.equal(g.damage(g.player, a, 10000), 1);
  assert.equal(a.alive, true);
  assert.equal(a.hp, 1);
  g.damage(g.player, a, 0.01);
  assert.equal(a.alive, false);
  assert.equal(g.zombies.rate, 2);
  assert.equal(g.zombies.kills, 1);
  assert.equal(g.healthDrops.length, 1);
  tick(g, 1);
  assert.equal(g.zombies.spawned, 4);
  assert.equal(g.fighters.includes(a), false);
});
test("contact Drain does not turn two-hit enemies into a frame-rate-dependent instant kill", () => {
  const g = new Combat({ mode: "zombies" }),
    b = spawnZombie(g);
  for (let i = 0; i < 20; i++)
    g.damage(g.player, b, 0.06, true, false, "ice", false);
  assert.equal(b.hp, 1);
  g.time = 1;
  g.damage(g.player, b, 0.06, true, false, "ice", false);
  assert.equal(b.alive, false);
});
test("room runes are team-wide unique and each Ice survivor can collect at most three", () => {
  const g = new Combat({ mode: "zombies" }),
    a = g.player,
    b = g.fighters[1];
  for (const d of g.zombieDrops.slice(0, 4)) {
    Object.assign(a, { x: d.x, y: d.y });
    updateZombies(g);
  }
  assert.equal(a.zombieSkills.length, 3);
  const d = g.zombieDrops[3];
  assert.ok(!d.owner);
  Object.assign(b, { x: d.x, y: d.y });
  updateZombies(g);
  assert.deepEqual(b.zombieSkills, [d.id]);
  Object.assign(b, { x: g.zombieDrops[0].x, y: g.zombieDrops[0].y });
  updateZombies(g);
  assert.equal(b.zombieSkills.length, 1);
});
for (const s of ZOMBIE_ABILITIES)
  test(`Ice can use collected ${s.name} without changing form`, () => {
    const g = new Combat({ mode: "zombies" }),
      a = g.player;
    Object.assign(a, { x: 1200, y: 450, fx: 1, fy: 0 });
    a.zombieSkills = [s.id];
    const b = spawnZombie(g);
    Object.assign(b, { x: 1280, y: 450 });
    refreshZombieTeams(g);
    if (s.id === "rebirth") {
      g.fell(a);
      assert.equal(a.alive, true);
      assert.ok(g.rebirthUsed.has(a.id));
    } else if (s.id === "invisibility") {
      assert.equal(visibility(a), 0);
      assert.equal(g.canSee(b, a), false);
      g.damage(b, a, 10);
      assert.ok(a.hp < 120);
    } else {
      if (s.id === "revival") g.fell(g.fighters[1]);
      if (s.id === "healing") a.hp = 40;
      assert.ok(useZombieAbility(g, a, s.id), s.id);
      if (["teleport", "chasm"].includes(s.id))
        assert.ok(useZombieAbility(g, a, s.id, true, { x: 1100, y: 450 }));
      if (s.id === "shield") {
        assert.ok(a.shield);
        useZombieAbility(g, a, s.id, false);
        assert.equal(a.shield, 0);
        assert.ok(a.zombieCooldowns.shield > g.time);
      }
      if (s.id === "revival") {
        assert.ok(g.fighters[1].alive);
        assert.deepEqual(g.fighters[1].forms, ["ice"]);
      }
      if (s.id === "prison") assert.ok(b.prisonHp > 0);
      if (
        s.id === "lightning" ||
        s.id === "explosion" ||
        s.id === "telekinesis"
      )
        assert.equal(b.hp, 1);
      if (s.id === "portals") {
        assert.ok(g.portals.place(a, 1400, 450));
        assert.ok(g.portals.place(a, 1500, 650));
      }
      if (s.cooldown && s.id !== "shield")
        assert.equal(useZombieAbility(g, a, s.id), false);
    }
    assert.equal(a.element, "ice");
    assert.equal(canUseSkill(a, "fire", "ability"), false);
  });
test("Zombies continues after the player falls, Revival keeps collected abilities and team wipe records survival time", () => {
  const g = new Combat({ mode: "zombies", players: 2 }),
    a = g.player,
    b = g.fighters[1];
  a.zombieSkills = ["invisibility", "healing"];
  b.zombieSkills = ["revival"];
  g.fell(a);
  assert.equal(g.checkMatchEnd(), false);
  assert.ok(useZombieAbility(g, b, "revival"));
  assert.deepEqual(a.zombieSkills, ["invisibility", "healing"]);
  assert.equal(a.element, "ice");
  g.fell(a);
  g.fell(b);
  g.time = 73;
  assert.ok(g.checkMatchEnd());
  assert.match(g.finishReason, /73 seconds/);
});

test("Zombies Explosion protects teammates and normal input release keeps Rock shield on cooldown", () => {
  const g = new Combat({ mode: "zombies" }),
    a = g.player,
    b = g.fighters[1];
  a.zombieSkills = ["shield", "explosion"];
  Object.assign(b, { x: a.x + 30, y: a.y });
  useZombieAbility(g, a, "explosion");
  assert.equal(b.hp, b.maxHp);
  assert.equal(b.knockX, 0);
  useZombieAbility(g, a, "shield");
  g.utility(a, false);
  assert.ok(a.zombieCooldowns.shield > g.time);
  assert.equal(useZombieAbility(g, a, "shield"), false);
});
test("fatal quicksand damage retains its sinking animation in Zombies", () => {
  const g = new Combat({ mode: "zombies" }),
    b = spawnZombie(g),
    h = { kind: "quicksand", x: b.x, y: b.y, r: 90 };
  g.damage(g.player, b, 5, true, false, "mud", false, false, h);
  g.damage(g.player, b, 5, true, false, "mud", false, false, h);
  assert.equal(g.fallenAnimations.at(-1).terrain.kind, "quicksand");
});

test("Gridiron gives the next possession to the conceding team's highest-kill player", () => {
  const g = new Combat({ mode: "gridiron", random: () => 0.5 });
  assert.equal(g.ball.carrier, null);
  assert.equal(g.ball.x, g.map.cx);
  const receiver = g.fighters[6];
  receiver.kills = 8;
  g.fighters[1].kills = 30;
  g.ball.x = 1550;
  g.ball.y = 550;
  updateGridiron(g);
  assert.deepEqual(g.scores, [1, 0]);
  assert.equal(g.ball.carrier, receiver.id);
  assert.equal(g.ball.x, receiver.spawn.x);
  assert.equal(g.ball.y, receiver.spawn.y);
  assert.ok(
    g.fighters.every((a) => a.alive && a.x === a.spawn.x && a.y === a.spawn.y),
  );
  g.ball.carrier = null;
  g.ball.x = 250;
  g.ball.y = 550;
  updateGridiron(g);
  assert.deepEqual(g.scores, [1, 1]);
  assert.equal(g.ball.carrier, g.fighters[1].id);
});
