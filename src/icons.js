const shapes = {
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
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.fusion}</svg>`;
