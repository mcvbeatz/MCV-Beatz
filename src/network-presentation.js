import {
  PRESENTATION_FIELDS,
  PREDICTION_LIMITS,
} from "./movement-prediction.js";
// Drawing only: separate presentation objects never mutate authoritative state.
export function samplePresentation(game, now = performance.now()) {
  const blend = Math.min(
    1,
    Math.max(
      0,
      (now - (game.presentationAt || 0)) /
        PREDICTION_LIMITS.remoteInterpolationMs,
    ),
  );
  return new Map(
    game.fighters.map((a) => {
      const local = a === game.player && game.localPrediction?.enabled;
      const predicted = local ? game.localPrediction.presentation() : null;
      const from = game.presentationFrom?.get(a.id);
      const smooth =
        from &&
        from.alive === a.alive &&
        from.portal === a.portal &&
        (from.element === undefined || from.element === a.element) &&
        from.dimension === a.dimension &&
        from.transit === a.transit &&
        !a.teleportArrival &&
        !a.spawnFlash &&
        Math.hypot(from.x - a.x, from.y - a.y) <
          PREDICTION_LIMITS.snapDistance &&
        (!game.map?.lineClear || game.map.lineClear(from, a, 13));
      const p = {
        x: smooth ? from.x + (a.x - from.x) * blend : a.x,
        y: smooth ? from.y + (a.y - from.y) * blend : a.y,
        gaitDistance: smooth
          ? from.gaitDistance +
            ((a.gaitDistance || 0) - from.gaitDistance) * blend
          : a.gaitDistance || 0,
        alive: a.alive,
        portal: a.portal,
        element: a.element,
        dimension: a.dimension,
        transit: a.transit,
      };
      if (local)
        for (const key of PRESENTATION_FIELDS)
          p[key] = predicted?.[key] ?? a[key];
      return [a.id, p];
    }),
  );
}
const scenes = new WeakMap(),
  actors = new WeakMap();
export function drawNetwork(renderer, game) {
  const positions = samplePresentation(game);
  let scene = scenes.get(game);
  if (!scene) {
    scene = Object.create(game);
    scenes.set(game, scene);
  }
  scene.fighters = game.fighters.map((a) => {
    let view = actors.get(a);
    if (!view) {
      view = Object.create(a);
      actors.set(a, view);
    }
    const p = positions.get(a.id);
    for (const k of PRESENTATION_FIELDS) view[k] = p[k] ?? a[k];
    if (a.swing > 0 || a.castTime > 0) {
      view.fx = a.fx;
      view.fy = a.fy;
    }
    return view;
  });
  scene.player =
    scene.fighters[game.fighters.indexOf(game.player)] || game.player;
  renderer.draw(scene, false);
  game.localPrediction?.diagnostics?.drawPosition(scene.player);
}
