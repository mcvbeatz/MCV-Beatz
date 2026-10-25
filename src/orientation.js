let preference = "landscape",
  angle = 0;
const root = document.createElement("div");
root.id = "orientation-root";
for (const child of [...document.body.children])
  if (child.tagName !== "SCRIPT") root.append(child);
document.body.prepend(root);
export function setOrientation(value = preference) {
  preference = value;
  const w = window.innerWidth,
    h = window.innerHeight;
  const landscape = preference === "landscape";
  angle = landscape && h > w ? 90 : !landscape && w > h ? -90 : 0;
  const width = landscape ? Math.max(w, h) : Math.min(w, h);
  const height = landscape ? Math.min(w, h) : Math.max(w, h);
  for (const [key, val] of Object.entries({
    "app-width": `${width}px`,
    "app-height": `${height}px`,
    "app-rotation": `${angle}deg`,
  }))
    document.documentElement.style.setProperty(`--${key}`, val);
  root.dataset.orientation = preference;
  root.dataset.rotation = String(angle);
}
export const orientationAngle = () => angle;
export function orientationPoint(el, x, y) {
  const r = el.getBoundingClientRect();
  return angle === 90
    ? { x: y - r.top, y: r.right - x }
    : angle === -90
      ? { x: r.bottom - y, y: x - r.left }
      : { x: x - r.left, y: y - r.top };
}
window.addEventListener("resize", () => setOrientation());
for (const event of ["gesturestart", "gesturechange"])
  document.addEventListener(event, (e) => e.preventDefault(), {
    passive: false,
  });
document.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { passive: false },
);
setOrientation();

// Native touch scrolling follows physical screen axes on some rotated browsers.
// Translate drags into the app's coordinates; plain taps still reach buttons.
const scrollBindings = new WeakSet();
export function enableOrientedScroll(el, axis = "y") {
  if (scrollBindings.has(el)) return;
  scrollBindings.add(el);
  let drag = null,
    suppressClick = false;
  const position = axis === "x" ? "scrollLeft" : "scrollTop";
  el.addEventListener("pointerdown", (e) => {
    if (drag) return;
    suppressClick = false;
    if (!angle || e.pointerType === "mouse") return;
    const overflow =
      axis === "x"
        ? el.scrollWidth > el.clientWidth
        : el.scrollHeight > el.clientHeight;
    if (!overflow) return;
    drag = {
      id: e.pointerId,
      angle,
      start: orientationPoint(el, e.clientX, e.clientY)[axis],
      scroll: el[position],
      moved: false,
      button: e.target.closest("button"),
    };
  });
  el.addEventListener(
    "pointermove",
    (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (drag.angle !== angle) {
        drag = null;
        return;
      }
      const delta =
        orientationPoint(el, e.clientX, e.clientY)[axis] - drag.start;
      if (!drag.moved && Math.abs(delta) < 8) return;
      if (!drag.moved) {
        drag.moved = true;
        el.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
      el[position] = drag.scroll - delta;
    },
    { passive: false },
  );
  const end = (e) => {
    if (drag?.id !== e.pointerId) return;
    const tapButton =
      e.type === "pointerup" && !drag.moved ? drag.button : null;
    suppressClick = drag.moved;
    drag = null;
    // Rotated touch scrollers can swallow the first compatibility click after
    // a drag. Activate a stationary button tap directly, once per gesture.
    if (tapButton && el.contains(tapButton) && !tapButton.disabled) {
      e.preventDefault();
      tapButton.click();
      suppressClick = true;
    }
  };
  for (const event of ["pointerup", "pointercancel"])
    el.addEventListener(event, end);
  el.addEventListener("lostpointercapture", (e) => {
    // Ignore the child button losing its implicit capture when the scroller takes over.
    if (e.target === el) end(e);
  });
  el.addEventListener(
    "click",
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
  el.addEventListener(
    "wheel",
    (e) => {
      if (!angle || e.ctrlKey) return;
      e.preventDefault();
      el[position] +=
        (axis === "x" ? e.deltaX || e.deltaY : e.deltaY || e.deltaX) *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
    },
    { passive: false },
  );
}
