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
