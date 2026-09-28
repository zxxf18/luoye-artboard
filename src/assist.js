const EPSILON = 0.0001;

export const ASSIST_MODES = Object.freeze([
  { value: 'vertical', label: '左右对称' },
  { value: 'horizontal', label: '上下对称' },
  { value: 'four', label: '四向对称' },
  { value: 'radial', label: '环形对称' },
]);

function finite(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

function addUnique(points, point) {
  if (!points.some(existing => samePoint(existing, point))) points.push(point);
}

function transforms(options, origin) {
  const mirrorX = point => ({ x: origin.x * 2 - point.x, y: point.y });
  const mirrorY = point => ({ x: point.x, y: origin.y * 2 - point.y });
  const mirrorBoth = point => ({ x: origin.x * 2 - point.x, y: origin.y * 2 - point.y });
  if (options.mode === 'vertical') return [point => ({ ...point }), mirrorX];
  if (options.mode === 'horizontal') return [point => ({ ...point }), mirrorY];
  if (options.mode === 'four') return [point => ({ ...point }), mirrorX, mirrorY, mirrorBoth];
  if (options.mode === 'radial') return Array.from({ length: options.axes }, (_, index) => point => {
    const angle = Math.PI * 2 * index / options.axes, cos = Math.cos(angle), sin = Math.sin(angle), dx = point.x - origin.x, dy = point.y - origin.y;
    return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
  });
  return [point => ({ ...point })];
}

export function normalizeAssistConfig(config = {}) {
  const mode = ASSIST_MODES.some(item => item.value === config.mode) ? config.mode : 'vertical';
  const axes = Math.max(2, Math.min(16, Math.round(finite(config.axes, 8))));
  return {
    enabled: config.enabled === true,
    mode,
    axes,
    centerX: config.centerX == null ? null : finite(config.centerX, 0),
    centerY: config.centerY == null ? null : finite(config.centerY, 0),
    showGuides: config.showGuides !== false,
    showGrid: config.showGrid === true,
    stamp: config.stamp === true,
  };
}

export function assistCopies(point, config, center) {
  const options = normalizeAssistConfig(config);
  const origin = { x: finite(center?.x, 0), y: finite(center?.y, 0) };
  const source = { x: finite(point?.x, origin.x), y: finite(point?.y, origin.y) };
  if (!options.enabled) return [source];
  const copies = [];
  for (const transform of transforms(options, origin)) addUnique(copies, transform(source));
  return copies;
}

export function assistPointSetCopies(points, config, center) {
  const options = normalizeAssistConfig(config);
  const source = points.map(point => ({ x: finite(point?.x, 0), y: finite(point?.y, 0) }));
  const origin = { x: finite(center?.x, 0), y: finite(center?.y, 0) };
  if (!options.enabled) return [{ points: source, transformIndex: 0 }];
  const sets = [];
  for (const [transformIndex, transform] of transforms(options, origin).entries()) {
    const set = source.map(transform);
    if (!sets.some(existing => existing.points.length === set.length && existing.points.every((point, index) => samePoint(point, set[index])))) sets.push({ points: set, transformIndex });
  }
  return sets;
}

export function assistPointSets(points, config, center) {
  return assistPointSetCopies(points, config, center).map(copy => copy.points);
}

export function assistSegmentCopies(start, end, config, center) {
  return assistPointSetCopies([start, end], config, center).map(copy => ({ start: copy.points[0], end: copy.points[1], transformIndex: copy.transformIndex }));
}

export function assistSegments(start, end, config, center) {
  return assistSegmentCopies(start, end, config, center).map(copy => [copy.start, copy.end]);
}

export function assistGuideLines(config, width, height) {
  const options = normalizeAssistConfig(config);
  if (!options.enabled || !options.showGuides) return [];
  const center = { x: Number.isFinite(options.centerX) ? options.centerX : width / 2, y: Number.isFinite(options.centerY) ? options.centerY : height / 2 };
  if (options.mode === 'vertical') return [{ start: { x: center.x, y: 0 }, end: { x: center.x, y: height } }];
  if (options.mode === 'horizontal') return [{ start: { x: 0, y: center.y }, end: { x: width, y: center.y } }];
  if (options.mode === 'four') return [
    { start: { x: center.x, y: 0 }, end: { x: center.x, y: height } },
    { start: { x: 0, y: center.y }, end: { x: width, y: center.y } },
  ];
  const lines = [];
  const length = Math.hypot(width, height) * 1.5;
  for (let index = 0; index < options.axes; index++) {
    const angle = Math.PI * 2 * index / options.axes;
    lines.push({ start: { x: center.x - Math.cos(angle) * length, y: center.y - Math.sin(angle) * length }, end: { x: center.x + Math.cos(angle) * length, y: center.y + Math.sin(angle) * length } });
  }
  return lines;
}
