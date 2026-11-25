const shapes = {
  healing: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
  magma:
    '<ellipse cx="12" cy="17" rx="10" ry="4"/><path d="M5 15c-3-4 4-4 1-8M12 14c-3-4 4-4 1-10M18 15c-3-4 4-4 1-8"/>',
  portals:
    '<ellipse cx="6" cy="12" rx="4" ry="9"/><ellipse cx="18" cy="12" rx="4" ry="9"/><path d="M7 12h10m-3-3 3 3-3 3"/>',
  revival: '<path d="M4 10a8 8 0 1 1 0 5M4 3v7h7M12 9v8m-3-5h6"/>',
  gravity:
    '<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/>',
  chasm: '<path d="m14 2-5 7 5 3-6 10M3 10l5 2m9 1 4-3M4 19l3-2"/>',
  explosion:
    '<path d="m12 1 2 7 6-4-3 7 6 3-8 1 2 7-6-5-6 5 2-8-6-2 7-3-2-7 6 5Z"/>',

  practice:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 9-9M16 3h5v5"/>',
  trophy:
    '<path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 15v6M7 21h10"/>',
  account:
    '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3Z"/>',
  settings:
    '<path d="m9 3 1-2h4l1 2 3 2 2-1 2 4-2 2v4l2 2-2 4-2-1-3 2-1 2h-4l-1-2-3-2-2 1-2-4 2-2v-4L2 8l2-4 2 1Z"/><circle cx="12" cy="12" r="4"/>',
  book: '<path d="M12 5C9 2 4 2 2 3v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-2-1-7-1-10 2Zm0 0v16"/>',
  team: '<circle cx="8" cy="7" r="3"/><path d="M2 21v-5a6 6 0 0 1 12 0v5ZM15 4a3 3 0 0 1 0 6M17 12a5 5 0 0 1 5 5v4"/>',
  random:
    '<path d="M3 5h3c4 0 8 14 12 14h3m-4-4 4 4-4 4M3 19h3c4 0 8-14 12-14h3m-4-4 4 4-4 4"/>',

  ice: '<path d="M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-2V5M21 13l-4 2v4"/>',
  abyssal:
    '<path d="m12 2 9 5v8l-9 7-9-7V7Z"/><path d="M6 11c4-5 6 5 12 0M7 15c4-4 6 4 10 0"/>',
  fire: '<path d="M13 2c2 6-3 6-1 10 1-1 2-2 3-4 4 4 6 7 4 11-2 5-11 5-14 0C1 13 6 10 7 6c0 6 4 7 4 3 0-3 2-5 2-7Z"/>',
  water:
    '<path d="M12 2S4 11 4 16a8 8 0 0 0 16 0c0-5-8-14-8-14Z"/><path d="M7 16c0 3 2 5 5 5"/>',
  air: '<path d="M3 7c5-6 10 6 18 0M3 12c5-6 10 6 18 0M3 17c5-6 10 6 18 0"/>',
  earth:
    '<path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
  light: '<path d="m12 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/>',
  dark: '<path d="M17 3a10 10 0 1 0 4 16A10 10 0 0 1 17 3Z"/>',
  lightning: '<path d="m14 1-10 13h7l-1 9L21 9h-8Z"/>',
  invincible:
    '<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Z"/><path d="M8 9h8M8 14h8M10 8v8M14 8v8"/>',
  strike:
    '<path d="m4 3 3 1 12 13-3 3L4 7Zm16 0-3 1-5 6M8 14l-4 4 3 3 4-4M14 19l5-5M2 16l6 6M16 20l3 3M5 20l-3 3"/>',
  fusion:
    '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path d="m18 2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name === "blindness" ? "dark" : name] || shapes.fusion}</svg>`;
