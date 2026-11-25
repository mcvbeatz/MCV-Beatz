// Reflow only when the available buttons change (forms, pickups, Pass). The
// controls themselves keep their existing pointer handlers and keyboard keys.
export function installAbilityLayout(root) {
  let previous = [];
  const arrange = () => {
    const buttons = [...root.querySelectorAll(":scope > .ability")].filter(
      (b) => !b.hidden,
    );
    if (
      buttons.length === previous.length &&
      buttons.every((button, i) => button === previous[i])
    )
      return;
    previous = buttons;
    const extraRows = Math.max(0, Math.ceil((buttons.length - 5) / 3));
    const slots = [
      [1, 3],
      [1, 2],
      [2, 1],
      [3, 1],
      [1, 1],
    ];
    root.style.setProperty("--cluster-rows", 3 + extraRows);
    buttons.forEach((button, index) => {
      const [row, col] =
        index < 5
          ? [slots[index][0] + extraRows, slots[index][1]]
          : [1 + Math.floor((index - 5) / 3), 1 + ((index - 5) % 3)];
      const area = `${row} / ${col}`;
      if (button.style.gridArea !== area) button.style.gridArea = area;
    });
  };
  const observer = new MutationObserver(arrange);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });
  arrange();
  return () => observer.disconnect();
}
