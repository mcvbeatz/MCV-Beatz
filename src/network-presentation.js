// Smooth authoritative snapshots for drawing only. Combat and hit tests always
// retain the server's coordinates; teleports and respawns snap immediately.
export function samplePresentation(game, now = performance.now()) {
  const blend = Math.min(
    1,
    Math.max(0, (now - (game.presentationAt || 0)) / 100),
  );
  return new Map(
    game.fighters.map((a) => {
      const from = game.presentationFrom?.get(a.id);
      const smooth =
        from &&
        from.alive === a.alive &&
        from.portal === a.portal &&
        Math.hypot(from.x - a.x, from.y - a.y) < 90;
      return [
        a.id,
        {
          x: smooth ? from.x + (a.x - from.x) * blend : a.x,
          y: smooth ? from.y + (a.y - from.y) * blend : a.y,
          gaitDistance: smooth
            ? from.gaitDistance +
              ((a.gaitDistance || 0) - from.gaitDistance) * blend
            : a.gaitDistance || 0,
          alive: a.alive,
          portal: a.portal,
        },
      ];
    }),
  );
}
export function drawNetwork(renderer, game) {
  const positions = samplePresentation(game);
  const original = game.fighters.map((a) => [a, a.x, a.y, a.gaitDistance]);
  try {
    for (const [a] of original) {
      const p = positions.get(a.id);
      a.x = p.x;
      a.y = p.y;
      a.gaitDistance = p.gaitDistance;
    }
    renderer.draw(game, false);
  } finally {
    for (const [a, x, y, gait] of original) {
      a.x = x;
      a.y = y;
      a.gaitDistance = gait;
    }
  }
}
