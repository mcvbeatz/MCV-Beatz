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
  if (!portrait) {
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
  const scale = Math.max(
    landscapeScale,
    width / bounds.width,
    height / bounds.height,
  );
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
