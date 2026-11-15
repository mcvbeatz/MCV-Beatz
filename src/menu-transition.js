// Keep navigation actions intact. A superseded transition must never render
// a stale destination after a newer tap or a battle launch.
export function createMenuDissolve() {
  let generation = 0,
    active = null;
  function dissolve(update, enabled = true) {
    const ticket = ++generation;
    active?.skipTransition();
    active = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || reduced) return update();
    if (!document.startViewTransition) {
      update();
      for (const node of [
        document.getElementById("app-shell"),
        document.body.dataset.screen === "setup" &&
          document.getElementById("app"),
      ]) {
        if (node) {
          node.getAnimations().forEach((a) => a.cancel());
          node.animate([{ opacity: 0.2 }, { opacity: 1 }], {
            duration: 350,
            easing: "ease-out",
          });
        }
      }
      return;
    }
    const transition = document.startViewTransition(() => {
      if (ticket === generation) update();
    });
    active = transition;
    transition.ready.catch(() => {});
    transition.finished
      .catch(() => {})
      .finally(() => {
        if (active === transition) active = null;
      });
    // A completed navigation includes the dissolve: touch swipes must start
    // after the browser releases its snapshot layer.
    return transition.finished.catch(() => transition.updateCallbackDone);
  }
  dissolve.cancel = () => {
    generation++;
    active?.skipTransition();
    active = null;
    document
      .getElementById("app-shell")
      ?.getAnimations()
      .forEach((a) => a.cancel());
    document
      .getElementById("app")
      ?.getAnimations()
      .forEach((a) => a.cancel());
  };
  return dissolve;
}
