const bounds = { left: 95, top: 100, width: 834, height: 530 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// The same transform drives drawing and world-space touch input.
export function cameraView(
  width,
  height,
  {
    portrait = false,
    screenWidth = width,
    screenHeight = height,
    focus,
    map,
    overview = false,
    spectating = false,
  } = {},
) {
  if (map) {
    const b = map.bounds;
    const scale = overview
      ? Math.min(width / (b.width + 40), height / (b.height + 40))
      : Math.max(
          Math.min(
            Math.max(screenWidth, screenHeight) / bounds.width,
            Math.max(1, Math.min(screenWidth, screenHeight) - 40) /
              bounds.height,
          ),
          width / b.width,
          height / b.height,
        );
    const halfW = width / scale / 2,
      halfH = height / scale / 2;
    const x = overview
      ? map.cx
      : clamp(focus?.x ?? map.cx, b.left + halfW, b.left + b.width - halfW);
    const y = overview
      ? map.cy
      : clamp(focus?.y ?? map.cy, b.top + halfH, b.top + b.height - halfH);
    return { scale, tx: width / 2 - x * scale, ty: height / 2 - y * scale };
  }
  if (!portrait && !spectating) {
    const scale = Math.min(width / bounds.width, height / bounds.height);
    return {
      scale,
      tx: (width - bounds.width * scale) / 2 - bounds.left * scale,
      ty: (height - bounds.height * scale) / 2 - bounds.top * scale,
    };
  }
  const landscapeScale = Math.min(
    Math.max(screenWidth, screenHeight) / bounds.width,
    Math.max(1, Math.min(screenWidth, screenHeight) - 40) / bounds.height,
  );
  const scale =
    Math.max(landscapeScale, width / bounds.width, height / bounds.height) *
    (spectating && !portrait ? 1.35 : 1);
  const halfW = width / scale / 2,
    halfH = height / scale / 2;
  const x = clamp(
    focus?.x ?? 512,
    bounds.left + halfW,
    bounds.left + bounds.width - halfW,
  );
  const y = clamp(
    focus?.y ?? 350,
    bounds.top + halfH,
    bounds.top + bounds.height - halfH,
  );
  return { scale, tx: width / 2 - x * scale, ty: height / 2 - y * scale };
}

// Camera-only movement: never move a corpse, token, flag or respawn location.
export function updateRespawnCamera(game, dt, input) {
  const a = game.player;
  if (game.finished || a.alive || a.ghost || !(a.respawnAt > game.time)) {
    game.spectatorFocus = null;
    return;
  }
  const focus = (game.spectatorFocus ??= { x: a.x, y: a.y });
  const b = game.map?.bounds || bounds;
  const x = Number.isFinite(input.x) ? input.x : 0;
  const y = Number.isFinite(input.y) ? input.y : 0;
  const magnitude = Math.max(1, Math.hypot(x, y));
  focus.x = clamp(
    focus.x + (x / magnitude) * 360 * dt,
    b.left,
    b.left + b.width,
  );
  focus.y = clamp(
    focus.y + (y / magnitude) * 360 * dt,
    b.top,
    b.top + b.height,
  );
}
