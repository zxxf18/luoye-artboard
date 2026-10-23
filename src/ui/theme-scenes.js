const THEME_SCENE_IDS = new Set(['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean', 'candy']);

const SCENES = {
  spring: '<path d="M13 43V13m0 14C8 23 6 19 7 15c5 1 8 5 8 10m-2 8c5-5 10-5 14-2-3 5-8 6-14 4"/><path d="M13 19c4-3 7-7 8-11m-8 18c-4-4-7-8-7-12" data-motion="breeze"/>',
  summer: '<circle cx="43" cy="12" r="7"/><path d="M4 35c7-5 13-5 20 0s13 5 20 0 9-5 12-3M4 42c7-5 13-5 20 0s13 5 20 0 9-5 12-3" data-motion="waves"/><path d="M4 47h52"/>',
  autumn: '<path d="M18 17c8-9 24-9 30 0-1 11-8 19-16 23-9-4-15-12-14-23Z" data-motion="leaf-fall"/><path d="M31 39c0-8 4-15 12-21M31 31l-8-8m11 2 8 1"/>',
  winter: '<path d="M30 7v40m-17-30 34 20m0-20L13 37M25 12l5 5 5-5m-5 27 5 5 5-5M16 18l7 1 1-7m17 27-1-7 7-1M41 12l-1 7 7 1M16 36l7-1 1 7" data-motion="snow-crystal"/>',
  mechanical: '<g data-motion="gear-left"><circle cx="21" cy="29" r="12"/><circle cx="21" cy="29" r="4"/><path d="M21 13v5m0 22v5M5 29h5m22 0h5M10 18l4 4m14 14 4 4m0-22-4 4M14 36l-4 4"/></g><g data-motion="gear-right"><circle cx="43" cy="29" r="8"/><circle cx="43" cy="29" r="2.5"/><path d="M43 17v4m0 16v4M31 29h4m16 0h4m-4-8-3 3m-10 10-3 3m0-16 3 3m10 10 3 3"/></g>',
  space: '<circle cx="31" cy="29" r="12"/><path d="M9 29c0-11 10-20 22-20s22 9 22 20-10 20-22 20S9 40 9 29Z"/><g data-motion="planet"><path d="M20 29a11 11 0 0 0 20 7"/><circle cx="36" cy="22" r="2"/></g><circle cx="9" cy="11" r="1.5"/><circle cx="51" cy="12" r="1.2"/><circle cx="8" cy="46" r="1"/>',
  ocean: '<path d="M12 48c3-8-1-14 2-21m-2 13c-5-4-6-8-5-11m7 6c5-5 6-9 4-13m24 26c-2-9 2-14 0-21m0 12c5-4 7-8 6-12m-6 7c-4-5-5-9-3-13"/><path d="M24 27c5-4 11-4 16 0-5 5-11 5-16 0Zm16 0 5-4v8Z" data-motion="fish"/><circle cx="28" cy="26" r=".8"/><path d="M5 52c9-3 17-3 26 0s17 3 26 0"/>',
  candy: '<path d="M9 18 18 9l9 9-9 9zM39 18l9-9 9 9-9 9z"/><path d="M14 43c5-7 10-7 15 0s10 7 15 0 10-7 15 0" data-motion="sprinkles"/><circle cx="31" cy="30" r="4"/><path d="M31 26v8m-4-4h8"/>',
};

/** Return the one compact decorative scene used by the selected theme. */
export function themeScene(id, { animated = false } = {}) {
  const theme = THEME_SCENE_IDS.has(id) ? id : 'autumn';
  const motion = animated ? ' data-theme-motion="on"' : '';
  return `<span class="theme-scene theme-scene-${theme}" aria-hidden="true" focusable="false"><svg viewBox="0 0 62 56" role="presentation" aria-hidden="true" focusable="false"${motion}><g class="scene-art" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SCENES[theme]}</g></svg></span>`;
}
