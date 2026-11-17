import { activeForm, extraSkillsFor, isIcicleForm } from "./combat.js";
import { passGridiron, useRaceItem } from "./event-modes.js";
import { useZombieAbility } from "./zombies.js";
import { pullZombieGate, zombieGateAt } from "./zombie-gates.js";
export function control(game, a, command) {
  if (!a || game.finished || game.countingDown || game.gridCelebration) return;
  const { kind, args = [] } = command;
  if (!Array.isArray(args) || args.length > 4) return;
  if (
    ["teleport", "chasm", "portal-place", "portal-close"].includes(kind) &&
    (args.length !== 2 ||
      !args.every((n) => Number.isFinite(n) && Math.abs(n) < 10000))
  )
    return;
  if (
    kind === "telekinesis" &&
    (!Number.isFinite(args[1]) || !Number.isFinite(args[2]))
  )
    return;
  if (["startCharge", "utility"].includes(kind)) {
    const form = kind === "utility" ? args[1] : args[0];
    if (form !== undefined && typeof form !== "string") return;
  }
  if (
    kind === "key" &&
    (!["j", "k", "l", "u", "i", "e", "p", "tab"].includes(args[0]) ||
      typeof args[1] !== "boolean")
  )
    return;
  const target = (id) => game.fighters.find((b) => b.id === id);
  if (kind === "reward") {
    if (a === game.player) game.chooseReward(args[0]);
    return;
  }
  if (game.intermission || game.waveTravel) return;
  if (kind === "gesture") {
    const p = args[0];
    if (!p || ![p.x, p.y, p.dx, p.dy].every(Number.isFinite)) return;
    if (!p.click) {
      const b = target(p.target);
      if (game.mode === "zombies")
        return useZombieAbility(game, a, "telekinesis", true, {
          target: b,
          dx: p.dx,
          dy: p.dy,
        });
      return game.telekinesis(a, b, p.dx, p.dy);
    }
    const gate = zombieGateAt(game, p);
    if (gate) return pullZombieGate(game, a, gate);
    if (game.mode === "gridiron" && game.ball.carrier === a.id) {
      const b = game.fighters.find(
        (b) =>
          b !== a &&
          b.team === a.team &&
          Math.abs(p.x - b.x) <= 38 &&
          p.y >= b.y - 80 &&
          p.y <= b.y + 15,
      );
      if (b && passGridiron(game, a, b)) return;
    }
    if (game.portals.closeAt(a, p.x, p.y)) return;
    if (game.portals.placing === a.id || game.portals.placingOwners?.has(a.id))
      return game.portals.place(a, p.x, p.y);
    if (game.mode === "zombies" && (a.chasmReady || a.zombieTeleportReady))
      return useZombieAbility(
        game,
        a,
        a.chasmReady ? "chasm" : "teleport",
        true,
        p,
      );
    if (activeForm(a) === "terraformer" || a.chasmReady)
      return game.placeChasm(a, p.x, p.y);
    return game.teleport(a, p.x, p.y);
  }
  if (kind === "strike") return game.strike(a);
  if (kind === "startCharge") return game.startCharge(a, args[0]);
  if (kind === "releaseCharge") return game.releaseCharge(a);
  if (kind === "utility") return game.utility(a, args[0], args[1]);
  if (kind === "switchForm") return game.switchForm(a, args[0]);
  if (kind === "teleport") return game.teleport(a, ...args);
  if (kind === "chasm") return game.placeChasm(a, ...args);
  if (kind === "telekinesis")
    return game.telekinesis(a, target(args[0]), args[1], args[2]);
  if (kind === "portal-place") return game.portals.place(a, ...args);
  if (kind === "portal-close") return game.portals.closeAt(a, ...args);
  if (kind === "pass") return passGridiron(game, a, target(args[0]));
  if (kind === "gate")
    return pullZombieGate(
      game,
      a,
      args.length ? zombieGateAt(game, { x: args[0], y: args[1] }) : undefined,
    );
  if (kind === "race") return useRaceItem(game, a);
  if (kind === "zombie") {
    const [id, down, options = {}] = args;
    return useZombieAbility(game, a, id, down, {
      ...options,
      target: target(options.target),
    });
  }
  if (kind === "key") {
    const [key, down = true, tap = false] = args;
    const charge = (form) => {
      if (tap && !isIcicleForm(form)) {
        if (down) {
          if (a.charging && a.chargeForm === form) game.releaseCharge(a);
          else game.startCharge(a, form);
        }
      } else if (down) game.startCharge(a, form);
      else if (a.chargeForm === form) game.releaseCharge(a);
    };
    if (key === "j" && down) game.strike(a);
    if (key === "k") {
      if (game.mode === "turnpike") {
        if (down) useRaceItem(game, a);
      } else charge(activeForm(a));
    }
    if (key === "e" && down) pullZombieGate(game, a);
    if (key === "p" && down) passGridiron(game, a);
    if (game.mode === "zombies" && ["l", "u", "i"].includes(key)) {
      const id = a.zombieSkills[["l", "u", "i"].indexOf(key)];
      if (id) useZombieAbility(game, a, id, down);
      return;
    }
    if (key === "l") game.utility(a, down);
    if (key === "tab" && down) game.switchForm(a);
    if (["u", "i"].includes(key)) {
      const skill = extraSkillsFor(activeForm(a))[key === "u" ? 0 : 1];
      if (skill) {
        if (skill.kind === "utility") game.utility(a, down, skill.form);
        else charge(skill.form);
      }
    }
  }
}
