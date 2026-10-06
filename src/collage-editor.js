/**
 * 彩色剪贴的 DOM-free 模型。
 *
 * 彩纸只记录颜色、纹理和一块轻量的几何路径，不保存图片资源。UI 可以
 * 用 paper.fill/paper.accent/paper.pattern 生成 CSS 或 canvas 图案，再用
 * piece.path 裁剪出纸片。这样切纸过程可以留在小弹窗里，放回主画板时
 * 仍然只是一个普通的可移动图层。
 */

export const COLLAGE_PAPERS = Object.freeze([
  Object.freeze({ id: 'sun', label: '向日葵黄', fill: '#ffd36a', accent: '#e99a35', pattern: 'dots' }),
  Object.freeze({ id: 'berry', label: '草莓红', fill: '#f28b82', accent: '#c94d59', pattern: 'solid' }),
  Object.freeze({ id: 'sky', label: '天空蓝', fill: '#83c9e8', accent: '#4b93c4', pattern: 'waves' }),
  Object.freeze({ id: 'leaf', label: '叶子绿', fill: '#a9d58d', accent: '#5f9c69', pattern: 'dots' }),
  Object.freeze({ id: 'lavender', label: '葡萄紫', fill: '#c6a6d9', accent: '#8b6aa7', pattern: 'stripes' }),
  Object.freeze({ id: 'orange', label: '橘子橙', fill: '#f7aa68', accent: '#d36b43', pattern: 'solid' }),
  Object.freeze({ id: 'snow', label: '牛奶白', fill: '#fff9eb', accent: '#ddcaa3', pattern: 'checker' }),
  Object.freeze({ id: 'night', label: '夜空蓝', fill: '#637fb0', accent: '#3f547d', pattern: 'dots' }),
]);

export const COLLAGE_PATTERNS = Object.freeze([
  Object.freeze({ id: 'solid', label: '纯色', description: '一张干净的彩纸' }),
  Object.freeze({ id: 'dots', label: '小圆点', description: '轻轻撒上彩色小点' }),
  Object.freeze({ id: 'stripes', label: '斜条纹', description: '像手工剪出的彩条' }),
  Object.freeze({ id: 'checker', label: '小方格', description: '两种颜色交错的小格子' }),
  Object.freeze({ id: 'waves', label: '水波纹', description: '柔软的弯弯波纹' }),
]);

/** Templates are normalized to a 0..1 square. The first and last point match. */
function collageClosedShape(points) {
  const clean = points.slice();
  if (clean.length && (clean[0].x !== clean.at(-1).x || clean[0].y !== clean.at(-1).y)) clean.push({ ...clean[0] });
  return Object.freeze(clean.map(point => Object.freeze({ x: point.x, y: point.y })));
}

function collageRegularShape(sides, outer = .46, inner = outer, rotation = -Math.PI / 2) {
  const points = [];
  for (let index = 0; index < sides; index++) {
    const angle = rotation + Math.PI * 2 * index / sides;
    points.push({ x: .5 + Math.cos(angle) * outer, y: .5 + Math.sin(angle) * outer });
  }
  if (inner < outer) {
    for (let index = sides - 1; index >= 0; index--) {
      const angle = rotation + Math.PI * 2 * (index + .5) / sides;
      points.push({ x: .5 + Math.cos(angle) * inner, y: .5 + Math.sin(angle) * inner });
    }
  }
  return collageClosedShape(points);
}

function collageEllipse(rx = .46, ry = rx, count = 24) {
  return collageClosedShape(Array.from({ length: count }, (_, index) => {
    const angle = Math.PI * 2 * index / count;
    return { x: .5 + Math.cos(angle) * rx, y: .5 + Math.sin(angle) * ry };
  }));
}

function collageTemplate(id, label, icon, points) {
  return Object.freeze({ id, label, icon, points: collageClosedShape(points) });
}

export const COLLAGE_TEMPLATES = Object.freeze([
  collageTemplate('circle', '圆形', '○', collageEllipse()),
  collageTemplate('heart', '爱心', '♡', [
    { x: .50, y: .88 }, { x: .12, y: .55 }, { x: .10, y: .33 }, { x: .19, y: .16 },
    { x: .36, y: .12 }, { x: .50, y: .27 }, { x: .64, y: .12 }, { x: .81, y: .16 },
    { x: .90, y: .33 }, { x: .88, y: .55 },
  ]),
  collageTemplate('star', '星星', '★', Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / 10;
    const radius = index % 2 ? .22 : .47;
    return { x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius };
  })),
  collageTemplate('cloud', '云朵', '☁', [
    { x: .08, y: .67 }, { x: .10, y: .50 }, { x: .23, y: .43 }, { x: .26, y: .24 },
    { x: .42, y: .12 }, { x: .58, y: .16 }, { x: .68, y: .33 }, { x: .81, y: .30 },
    { x: .92, y: .44 }, { x: .91, y: .64 }, { x: .80, y: .75 }, { x: .20, y: .77 },
  ]),
  collageTemplate('leaf', '叶子', '◈', [
    { x: .50, y: .92 }, { x: .28, y: .73 }, { x: .12, y: .48 }, { x: .18, y: .22 },
    { x: .48, y: .08 }, { x: .77, y: .18 }, { x: .88, y: .46 }, { x: .72, y: .72 },
  ]),
  collageTemplate('triangle', '三角形', '△', [{ x: .50, y: .08 }, { x: .92, y: .88 }, { x: .08, y: .88 }]),
  collageTemplate('square', '方形', '□', [{ x: .10, y: .10 }, { x: .90, y: .10 }, { x: .90, y: .90 }, { x: .10, y: .90 }]),
  collageTemplate('oval', '椭圆', '⬭', collageEllipse(.46, .31)),
  collageTemplate('diamond', '菱形', '◇', [{ x: .50, y: .06 }, { x: .92, y: .50 }, { x: .50, y: .94 }, { x: .08, y: .50 }]),
  collageTemplate('pentagon', '五边形', '⬠', collageRegularShape(5)),
  collageTemplate('hexagon', '六边形', '⬡', collageRegularShape(6)),
  collageTemplate('flower', '花朵', '✿', collageRegularShape(16, .46, .29)),
  collageTemplate('sun', '太阳', '☀', collageRegularShape(20, .47, .35)),
  collageTemplate('moon', '月亮', '☾', [
    { x: .67, y: .08 }, { x: .49, y: .11 }, { x: .31, y: .22 }, { x: .18, y: .39 },
    { x: .16, y: .59 }, { x: .25, y: .77 }, { x: .41, y: .89 }, { x: .60, y: .92 },
    { x: .77, y: .85 }, { x: .86, y: .72 }, { x: .69, y: .75 }, { x: .55, y: .69 },
    { x: .45, y: .57 }, { x: .42, y: .42 }, { x: .47, y: .28 }, { x: .56, y: .17 },
  ]),
  collageTemplate('raindrop', '水滴', '💧', [
    { x: .50, y: .06 }, { x: .35, y: .26 }, { x: .20, y: .49 }, { x: .19, y: .67 },
    { x: .28, y: .82 }, { x: .50, y: .92 }, { x: .72, y: .82 }, { x: .81, y: .67 },
    { x: .80, y: .49 }, { x: .65, y: .26 },
  ]),
  collageTemplate('lightning', '闪电', '⚡', [
    { x: .57, y: .05 }, { x: .18, y: .52 }, { x: .43, y: .51 }, { x: .33, y: .95 },
    { x: .82, y: .38 }, { x: .56, y: .39 },
  ]),
  collageTemplate('balloon', '气球', '🎈', [
    { x: .50, y: .07 }, { x: .30, y: .13 }, { x: .17, y: .31 }, { x: .16, y: .53 },
    { x: .28, y: .70 }, { x: .44, y: .77 }, { x: .47, y: .89 }, { x: .39, y: .95 },
    { x: .50, y: .89 }, { x: .61, y: .95 }, { x: .53, y: .89 }, { x: .56, y: .77 },
    { x: .72, y: .70 }, { x: .84, y: .53 }, { x: .83, y: .31 }, { x: .70, y: .13 },
  ]),
  collageTemplate('fish', '小鱼', '🐟', [
    { x: .08, y: .50 }, { x: .27, y: .30 }, { x: .53, y: .22 }, { x: .73, y: .29 },
    { x: .92, y: .16 }, { x: .83, y: .50 }, { x: .92, y: .84 }, { x: .73, y: .71 },
    { x: .53, y: .78 }, { x: .27, y: .70 },
  ]),
  collageTemplate('butterfly', '蝴蝶', '🦋', [
    { x: .50, y: .50 }, { x: .38, y: .28 }, { x: .18, y: .10 }, { x: .08, y: .16 },
    { x: .11, y: .39 }, { x: .33, y: .58 }, { x: .11, y: .81 }, { x: .18, y: .91 },
    { x: .40, y: .72 }, { x: .50, y: .55 }, { x: .60, y: .72 }, { x: .82, y: .91 },
    { x: .89, y: .81 }, { x: .67, y: .58 }, { x: .89, y: .39 }, { x: .92, y: .16 },
    { x: .82, y: .10 }, { x: .62, y: .28 },
  ]),
  collageTemplate('mushroom', '蘑菇', '🍄', [
    { x: .08, y: .49 }, { x: .12, y: .31 }, { x: .28, y: .15 }, { x: .50, y: .10 },
    { x: .72, y: .15 }, { x: .88, y: .31 }, { x: .92, y: .49 }, { x: .78, y: .52 },
    { x: .75, y: .91 }, { x: .25, y: .91 }, { x: .22, y: .52 },
  ]),
  collageTemplate('apple', '苹果', '🍎', [
    { x: .50, y: .26 }, { x: .38, y: .14 }, { x: .20, y: .18 }, { x: .09, y: .34 },
    { x: .12, y: .63 }, { x: .28, y: .84 }, { x: .50, y: .92 }, { x: .72, y: .84 },
    { x: .88, y: .63 }, { x: .91, y: .34 }, { x: .80, y: .18 }, { x: .62, y: .14 },
  ]),
  collageTemplate('house', '小房子', '⌂', [
    { x: .08, y: .48 }, { x: .50, y: .09 }, { x: .92, y: .48 }, { x: .83, y: .48 },
    { x: .83, y: .91 }, { x: .58, y: .91 }, { x: .58, y: .66 }, { x: .42, y: .66 },
    { x: .42, y: .91 }, { x: .17, y: .91 }, { x: .17, y: .48 },
  ]),
  collageTemplate('rocket', '火箭', '🚀', [
    { x: .50, y: .05 }, { x: .68, y: .24 }, { x: .76, y: .52 }, { x: .68, y: .72 },
    { x: .58, y: .66 }, { x: .64, y: .90 }, { x: .50, y: .80 }, { x: .36, y: .90 },
    { x: .42, y: .66 }, { x: .32, y: .72 }, { x: .24, y: .52 }, { x: .32, y: .24 },
  ]),
  collageTemplate('rainbow', '彩虹', '🌈', [
    { x: .07, y: .82 }, { x: .12, y: .55 }, { x: .25, y: .33 }, { x: .42, y: .18 },
    { x: .62, y: .15 }, { x: .80, y: .24 }, { x: .92, y: .45 }, { x: .94, y: .82 },
    { x: .77, y: .82 }, { x: .75, y: .53 }, { x: .64, y: .38 }, { x: .50, y: .32 },
    { x: .35, y: .39 }, { x: .25, y: .53 }, { x: .23, y: .82 },
  ]),
]);

// Ready-made scenes make the collage desk useful on the first click. Each
// scene is still made from ordinary editable pieces, so children can move,
// resize or remove any part after choosing a starting idea.
export const COLLAGE_PRESETS = Object.freeze([
  Object.freeze({
    id: 'garden', label: '小花园', icon: '🌼', description: '太阳、花朵和叶子',
    pieces: Object.freeze([
      Object.freeze({ template: 'sun', paperId: 'sun', pattern: 'dots', x: 150, y: 120, width: 132, height: 132, rotation: -8 }),
      Object.freeze({ template: 'flower', paperId: 'berry', pattern: 'solid', x: 258, y: 364, width: 116, height: 116, rotation: -5 }),
      Object.freeze({ template: 'flower', paperId: 'lavender', pattern: 'stripes', x: 392, y: 354, width: 94, height: 94, rotation: 8 }),
      Object.freeze({ template: 'leaf', paperId: 'leaf', pattern: 'dots', x: 328, y: 402, width: 110, height: 155, rotation: 26 }),
    ]),
  }),
  Object.freeze({
    id: 'space', label: '小小宇宙', icon: '🚀', description: '火箭、星星和月亮',
    pieces: Object.freeze([
      Object.freeze({ template: 'moon', paperId: 'night', pattern: 'dots', x: 376, y: 126, width: 132, height: 132, rotation: 12 }),
      Object.freeze({ template: 'rocket', paperId: 'berry', pattern: 'solid', x: 242, y: 278, width: 126, height: 176, rotation: -16 }),
      Object.freeze({ template: 'star', paperId: 'sun', pattern: 'dots', x: 112, y: 142, width: 72, height: 72, rotation: 10 }),
      Object.freeze({ template: 'star', paperId: 'lavender', pattern: 'stripes', x: 412, y: 352, width: 68, height: 68, rotation: -8 }),
    ]),
  }),
  Object.freeze({
    id: 'undersea', label: '海底朋友', icon: '🐟', description: '小鱼、气泡和水草',
    pieces: Object.freeze([
      Object.freeze({ template: 'fish', paperId: 'orange', pattern: 'solid', x: 184, y: 222, width: 176, height: 126, rotation: -7 }),
      Object.freeze({ template: 'fish', paperId: 'berry', pattern: 'dots', x: 372, y: 330, width: 132, height: 94, rotation: 8 }),
      Object.freeze({ template: 'raindrop', paperId: 'sky', pattern: 'waves', x: 118, y: 112, width: 58, height: 76, rotation: 0 }),
      Object.freeze({ template: 'leaf', paperId: 'leaf', pattern: 'stripes', x: 404, y: 432, width: 78, height: 142, rotation: -18 }),
    ]),
  }),
]);

export const COLLAGE_DEFAULT_PAPER = 'sun';
export const COLLAGE_DEFAULT_TEMPLATE = 'circle';
export const COLLAGE_MAX_PIECES = 200;
export const COLLAGE_MAX_POINTS = 128;
export const COLLAGE_MIN_POINTS = 3;
export const COLLAGE_HISTORY_LIMIT = 100;
export const COLLAGE_MAX_INPUT_POINTS = 4096;

function collageFinite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function collageClamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function collageDistance(first, second) { return Math.hypot(first.x - second.x, first.y - second.y); }

function collageSamePoint(first, second, epsilon = .0001) { return collageDistance(first, second) <= epsilon; }

function collageUniquePoints(points) {
  const result = [];
  const input = Array.isArray(points) ? points : [];
  const length = Math.min(input.length, COLLAGE_MAX_INPUT_POINTS);
  for (let index = 0; index < length; index++) {
    const point = input[index];
    if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) continue;
    const next = { x: collageFinite(point.x), y: collageFinite(point.y) };
    if (!result.length || !collageSamePoint(result.at(-1), next)) result.push(next);
  }
  // Keep the final sample when an overly dense pointer trace was capped. This
  // preserves a user's closing gesture instead of turning a valid loop into an
  // apparently open path.
  if (input.length > length) {
    const point = input[input.length - 1];
    if (point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))) {
      const next = { x: collageFinite(point.x), y: collageFinite(point.y) };
      if (!result.length || !collageSamePoint(result.at(-1), next)) result.push(next);
    }
  }
  return result;
}

function collagePointLineDistance(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (!dx && !dy) return collageDistance(point, start);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy);
}

function collageSimplify(points, epsilon, limit = COLLAGE_MAX_POINTS) {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const pending = [[0, points.length - 1]];
  while (pending.length) {
    const [start, end] = pending.pop();
    if (end - start < 2) continue;
    let maxDistance = epsilon, split = -1;
    for (let index = start + 1; index < end; index++) {
      const distance = collagePointLineDistance(points[index], points[start], points[end]);
      if (distance > maxDistance) { maxDistance = distance; split = index; }
    }
    if (split >= 0) { keep[split] = 1; pending.push([start, split], [split, end]); }
  }
  let result = points.filter((_, index) => keep[index]);
  // A busy freehand cut should stay responsive on a phone. Uniform sampling
  // is only the final fallback after preserving the corners above.
  if (result.length > limit) {
    const sampled = [];
    for (let index = 0; index < limit; index++) sampled.push(result[Math.round(index * (result.length - 1) / (limit - 1))]);
    result = sampled;
  }
  return result;
}

export function normalizeCollagePaperId(value) {
  const id = String(value || COLLAGE_DEFAULT_PAPER);
  return COLLAGE_PAPERS.some(paper => paper.id === id) ? id : COLLAGE_DEFAULT_PAPER;
}

export function getCollagePaper(value) {
  const id = normalizeCollagePaperId(value);
  return COLLAGE_PAPERS.find(paper => paper.id === id) || COLLAGE_PAPERS[0];
}

export function normalizeCollagePattern(value) {
  const id = String(value || 'solid');
  return COLLAGE_PATTERNS.some(pattern => pattern.id === id) ? id : 'solid';
}

export function normalizeCollagePoints(points, { close = false, maxPoints = COLLAGE_MAX_POINTS, epsilon = .004 } = {}) {
  let result = collageUniquePoints(points);
  if (close && result.length && !collageSamePoint(result[0], result.at(-1), epsilon * 2)) result.push({ ...result[0] });
  if (result.length > maxPoints) result = collageSimplify(result, epsilon, maxPoints);
  if (close && result.length >= 2 && !collageSamePoint(result[0], result.at(-1), epsilon * 2)) result.push({ ...result[0] });
  return result.map(point => Object.freeze({ x: point.x, y: point.y }));
}

export function collagePathIsClosed(points, { maxGap = .10 } = {}) {
  const clean = collageUniquePoints(points);
  if (clean.length < COLLAGE_MIN_POINTS) return false;
  const box = collageBounds(clean);
  const scale = Math.max(box.width, box.height, .0001);
  if (collageDistance(clean[0], clean.at(-1)) / scale > maxGap) return false;
  // A line folded back on itself is technically closed but cannot produce a
  // useful paper piece. Scale the area threshold so tiny child drawings still
  // work while zero-area paths are rejected early.
  let twiceArea = 0;
  for (let index = 0; index < clean.length; index++) {
    const current = clean[index], next = clean[(index + 1) % clean.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) > scale * scale * .0001;
}

export function collageBounds(points) {
  const clean = collageUniquePoints(points);
  if (!clean.length) return { x: 0, y: 0, width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 };
  let left = clean[0].x, right = clean[0].x, top = clean[0].y, bottom = clean[0].y;
  for (let index = 1; index < clean.length; index++) {
    const point = clean[index];
    left = Math.min(left, point.x); right = Math.max(right, point.x);
    top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
  }
  return { x: left, y: top, width: right - left, height: bottom - top, left, right, top, bottom };
}

export function collageNormalizePath(points, { close = true, maxPoints = COLLAGE_MAX_POINTS } = {}) {
  const clean = normalizeCollagePoints(points, { close, maxPoints });
  const box = collageBounds(clean);
  const width = Math.max(box.width, .0001), height = Math.max(box.height, .0001);
  const path = clean.map(point => Object.freeze({ x: (point.x - box.left) / width, y: (point.y - box.top) / height }));
  // A path is always rendered against a non-zero box. Keep the source ratio so
  // circles and hand-cut shapes do not unexpectedly stretch in the editor.
  return Object.freeze({ path: Object.freeze(path), bounds: Object.freeze({ ...box }), aspect: box.width && box.height ? box.width / box.height : 1 });
}

export function createCollageTemplate(template = COLLAGE_DEFAULT_TEMPLATE, { width = 180, height = width, padding = 0 } = {}) {
  const definition = COLLAGE_TEMPLATES.find(item => item.id === template) || COLLAGE_TEMPLATES[0];
  const safeWidth = Math.max(8, collageFinite(width, 180)), safeHeight = Math.max(8, collageFinite(height, safeWidth));
  const insetX = Math.min(safeWidth / 2 - 1, Math.max(0, collageFinite(padding))), insetY = Math.min(safeHeight / 2 - 1, Math.max(0, collageFinite(padding)));
  const points = definition.points.map(point => ({ x: insetX + point.x * (safeWidth - insetX * 2), y: insetY + point.y * (safeHeight - insetY * 2) }));
  return Object.freeze({
    template: definition.id,
    label: definition.label,
    icon: definition.icon,
    points: Object.freeze(points.map(point => Object.freeze(point))),
    bounds: Object.freeze(collageBounds(points)),
    width: safeWidth,
    height: safeHeight,
  });
}

export function createCollageFreeCut(points, { width = 180, height = width, maxGap = .10 } = {}) {
  if (!collagePathIsClosed(points, { maxGap })) throw new Error('自由剪需要把线条围成一个圈。');
  const normalized = collageNormalizePath(points);
  return Object.freeze({
    template: 'free', label: '自由剪', icon: '✂',
    points: normalized.path,
    bounds: normalized.bounds,
    width: Math.max(8, collageFinite(width, 180)),
    height: Math.max(8, collageFinite(height, width)),
    aspect: normalized.aspect,
  });
}

function collageClonePiece(piece) {
  return {
    id: piece.id,
    paperId: piece.paperId,
    pattern: piece.pattern,
    template: piece.template,
    label: piece.label,
    icon: piece.icon,
    path: piece.path.map(point => ({ x: point.x, y: point.y })),
    width: piece.width,
    height: piece.height,
    x: piece.x,
    y: piece.y,
    scale: piece.scale,
    rotation: piece.rotation,
    opacity: piece.opacity,
  };
}

function collageNormalizeTransform(value, defaults) {
  return {
    x: collageFinite(value?.x, defaults.x),
    y: collageFinite(value?.y, defaults.y),
    scale: collageClamp(collageFinite(value?.scale, defaults.scale), .15, 5),
    rotation: collageFinite(value?.rotation, defaults.rotation),
    opacity: collageClamp(collageFinite(value?.opacity, defaults.opacity), .1, 1),
  };
}

export function createCollagePiece({ paperId = COLLAGE_DEFAULT_PAPER, pattern, cut, template, points, width = 180, height = width, x = 0, y = 0, scale = 1, rotation = 0, opacity = 1, id } = {}) {
  let source = cut;
  if (!source) source = template === 'free' ? createCollageFreeCut(points || []) : createCollageTemplate(template || COLLAGE_DEFAULT_TEMPLATE, { width, height });
  const normalized = source.template === 'free' ? source : collageNormalizePath(source.points || [], { close: true });
  const path = source.template === 'free' ? source.points : normalized.path;
  const paper = getCollagePaper(paperId);
  const piece = {
    id: id || null,
    paperId: paper.id,
    pattern: normalizeCollagePattern(pattern || paper.pattern),
    template: source.template,
    label: source.label || (source.template === 'free' ? '自由剪' : source.template),
    icon: source.icon || '✂',
    path: Object.freeze(path.map(point => Object.freeze({ x: collageClamp(point.x, 0, 1), y: collageClamp(point.y, 0, 1) }))),
    width: Math.max(8, collageFinite(source.width, width)),
    height: Math.max(8, collageFinite(source.height, height)),
    ...collageNormalizeTransform({ x, y, scale, rotation, opacity }, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }),
  };
  return Object.freeze(piece);
}

function collageStateView(state) {
  return Object.freeze({ pieces: state.pieces, selectedId: state.selectedId });
}

/**
 * Small undoable model used by the collage dialog. Coordinates are in the
 * dialog's logical square. The model deliberately knows nothing about DOM or
 * canvas, so it is easy to exercise on phones, tablets and desktop browsers.
 */
export class CollageEditorModel {
  constructor({ width = 512, height = width, paperId = COLLAGE_DEFAULT_PAPER, pattern } = {}) {
    this.width = Math.max(64, collageFinite(width, 512));
    this.height = Math.max(64, collageFinite(height, this.width));
    this.paperId = normalizeCollagePaperId(paperId);
    this.pattern = normalizeCollagePattern(pattern || getCollagePaper(this.paperId).pattern);
    // Paths and piece records are immutable. History snapshots can therefore
    // share references instead of copying every path on every edit.
    this.pieces = Object.freeze([]);
    this.selectedId = null;
    this.history = [];
    this.future = [];
    this.nextId = 1;
    this.gesture = null;
  }

  get paper() { return getCollagePaper(this.paperId); }

  snapshot() { return collageStateView(this); }

  state() { return Object.freeze({ width: this.width, height: this.height, paperId: this.paperId, pattern: this.pattern, ...this.snapshot() }); }

  _record(before) {
    this.history.push(before);
    if (this.history.length > COLLAGE_HISTORY_LIMIT) this.history.shift();
    this.future.length = 0;
  }

  _commit(mutator) {
    const before = this.snapshot();
    const draft = { pieces: this.pieces.slice(), selectedId: this.selectedId };
    mutator(draft);
    const nextPieces = Object.freeze(draft.pieces.slice());
    const changed = nextPieces.length !== this.pieces.length || nextPieces.some((piece, index) => piece !== this.pieces[index]) || draft.selectedId !== this.selectedId;
    if (!changed) return this.selected();
    this.pieces = nextPieces;
    this.selectedId = draft.selectedId;
    this._record(before);
    return this.selected();
  }

  setPaper(paperId, pattern = undefined) {
    // The selected paper is a tool setting, not an artwork edit.
    this.paperId = normalizeCollagePaperId(paperId);
    this.pattern = normalizeCollagePattern(pattern || getCollagePaper(this.paperId).pattern);
    return this.paper;
  }

  setPattern(pattern) { this.pattern = normalizeCollagePattern(pattern); return this.pattern; }

  addPiece(piece) {
    if (this.pieces.length >= COLLAGE_MAX_PIECES) throw new Error(`最多先放 ${COLLAGE_MAX_PIECES} 块彩纸。`);
    const hasPosition = piece && Number.isFinite(Number(piece.x)) && Number.isFinite(Number(piece.y));
    const next = createCollagePiece({ ...(piece || {}), id: piece?.id || `collage-piece-${this.nextId++}` });
    const positioned = hasPosition ? next : Object.freeze({ ...next, x: this.width / 2, y: this.height / 2 });
    this._commit(draft => { draft.pieces.push(positioned); draft.selectedId = positioned.id; });
    return collageClonePiece(positioned);
  }

  cutTemplate(template = COLLAGE_DEFAULT_TEMPLATE, options = {}) {
    const cut = createCollageTemplate(template, { width: options.width || 180, height: options.height || options.width || 180 });
    return this.addPiece({ ...options, cut, paperId: options.paperId || this.paperId, pattern: options.pattern || this.pattern, x: options.x ?? this.width / 2, y: options.y ?? this.height / 2 });
  }

  cutFree(points, options = {}) {
    const cut = createCollageFreeCut(points, { width: options.width || 180, height: options.height || options.width || 180, maxGap: options.maxGap });
    return this.addPiece({ ...options, cut, paperId: options.paperId || this.paperId, pattern: options.pattern || this.pattern, x: options.x ?? this.width / 2, y: options.y ?? this.height / 2 });
  }

  applyPreset(preset = 'garden', { replace = true } = {}) {
    const definition = COLLAGE_PRESETS.find(item => item.id === preset) || COLLAGE_PRESETS[0];
    const available = COLLAGE_MAX_PIECES - (replace ? 0 : this.pieces.length);
    if (definition.pieces.length > available) throw new Error(`最多先放 ${COLLAGE_MAX_PIECES} 块彩纸。`);
    const pieces = definition.pieces.map(options => {
      const width = Math.max(8, options.width * this.width / 512);
      const height = Math.max(8, options.height * this.height / 512);
      return createCollagePiece({
        ...options,
        id: `collage-piece-${this.nextId++}`,
        cut: createCollageTemplate(options.template, { width, height }),
        x: options.x * this.width / 512,
        y: options.y * this.height / 512,
      });
    });
    this._commit(draft => {
      draft.pieces = replace ? pieces : draft.pieces.concat(pieces);
      draft.selectedId = pieces.at(-1)?.id || draft.selectedId;
    });
    return pieces.at(-1) ? collageClonePiece(pieces.at(-1)) : null;
  }

  // Never expose the mutable entry stored in the history state. UI code often
  // keeps the selected piece around while a pointer gesture is in progress;
  // returning a copy keeps that stale reference from changing underneath it.
  selected() { const piece = this.pieces.find(item => item.id === this.selectedId); return piece ? collageClonePiece(piece) : null; }

  select(id) { this.selectedId = this.pieces.some(piece => piece.id === id) ? id : null; return this.selected(); }

  remove(id = this.selectedId) {
    const index = this.pieces.findIndex(piece => piece.id === id);
    if (index < 0) return false;
    this._commit(draft => { draft.pieces.splice(index, 1); draft.selectedId = draft.pieces[Math.max(0, index - 1)]?.id || null; });
    return true;
  }

  _replacePiece(id, patch) {
    const piece = this.pieces.find(item => item.id === id);
    if (!piece) return null;
    const transform = collageNormalizeTransform(patch, piece);
    if (['x', 'y', 'scale', 'rotation', 'opacity'].every(key => transform[key] === piece[key])) return piece;
    const index = this.pieces.indexOf(piece);
    const next = Object.freeze({ ...piece, ...transform });
    const nextPieces = this.pieces.slice(); nextPieces[index] = next;
    this.pieces = Object.freeze(nextPieces);
    return next;
  }

  /** Start a transform that will result in at most one history entry. */
  beginTransform(id = this.selectedId) {
    if (this.gesture) this.cancelTransform();
    const piece = this.pieces.find(item => item.id === id);
    if (!piece) return false;
    this.selectedId = piece.id;
    this.gesture = { id: piece.id, before: this.snapshot() };
    return true;
  }

  /** Apply a live transform without recording every pointer update. */
  updateTransform(patch = {}, id = this.gesture?.id) {
    if (!this.gesture || this.gesture.id !== id) return null;
    const piece = this._replacePiece(id, patch);
    return piece ? collageClonePiece(piece) : null;
  }

  /** Commit the active transform as one undo point. */
  endTransform() {
    if (!this.gesture) return false;
    const before = this.gesture.before;
    const changed = this.pieces.length !== before.pieces.length || this.pieces.some((piece, index) => piece !== before.pieces[index]) || this.selectedId !== before.selectedId;
    this.gesture = null;
    if (changed) this._record(before);
    return changed;
  }

  /** Cancel the active transform without touching undo or redo history. */
  cancelTransform() {
    if (!this.gesture) return false;
    const before = this.gesture.before;
    this.pieces = before.pieces;
    this.selectedId = before.selectedId;
    this.gesture = null;
    return true;
  }

  begin(id = this.selectedId) { return this.beginTransform(id); }

  update(idOrPatch = this.selectedId, patch = {}) {
    if (this.gesture && idOrPatch && typeof idOrPatch === 'object') return this.updateTransform(idOrPatch);
    if (this.gesture && idOrPatch === this.gesture.id) return this.updateTransform(patch, idOrPatch);
    const id = typeof idOrPatch === 'string' ? idOrPatch : this.selectedId;
    const piece = this.pieces.find(item => item.id === id);
    if (!piece) return null;
    const transform = collageNormalizeTransform(patch, piece);
    if (['x', 'y', 'scale', 'rotation', 'opacity'].every(key => transform[key] === piece[key])) return collageClonePiece(piece);
    let result;
    this._commit(draft => {
      const index = draft.pieces.findIndex(item => item.id === id);
      const next = Object.freeze({ ...piece, ...transform });
      draft.pieces[index] = next;
      result = next;
    });
    return result ? collageClonePiece(result) : null;
  }

  end(commit = true) { return commit ? this.endTransform() : this.cancelTransform(); }
  cancel() { return this.cancelTransform(); }

  move(dx, dy, id = this.selectedId) {
    const piece = this.pieces.find(item => item.id === id);
    if (!piece) return null;
    const patch = { x: piece.x + collageFinite(dx), y: piece.y + collageFinite(dy) };
    if (this.gesture?.id === id) return this.updateTransform(patch, id);
    return this.update(id, patch);
  }
  rotate(degrees, id = this.selectedId) {
    const piece = this.pieces.find(item => item.id === id);
    if (!piece) return null;
    const patch = { rotation: piece.rotation + collageFinite(degrees) };
    if (this.gesture?.id === id) return this.updateTransform(patch, id);
    return this.update(id, patch);
  }
  scale(factor, id = this.selectedId) {
    const piece = this.pieces.find(item => item.id === id);
    if (!piece) return null;
    const patch = { scale: piece.scale * collageFinite(factor, 1) };
    if (this.gesture?.id === id) return this.updateTransform(patch, id);
    return this.update(id, patch);
  }

  hitTest(x, y) {
    const pointX = collageFinite(x), pointY = collageFinite(y);
    for (let index = this.pieces.length - 1; index >= 0; index--) {
      const piece = this.pieces[index], radians = -piece.rotation * Math.PI / 180;
      const dx = pointX - piece.x, dy = pointY - piece.y;
      const halfDiagonal = Math.hypot(piece.width, piece.height) * piece.scale / 2;
      if (Math.abs(dx) > halfDiagonal || Math.abs(dy) > halfDiagonal) continue;
      const localX = (dx * Math.cos(radians) - dy * Math.sin(radians)) / piece.scale / piece.width + .5;
      const localY = (dx * Math.sin(radians) + dy * Math.cos(radians)) / piece.scale / piece.height + .5;
      if (localX < 0 || localX > 1 || localY < 0 || localY > 1) continue;
      if (collagePointInsidePolygon({ x: localX, y: localY }, piece.path)) { this.selectedId = piece.id; return collageClonePiece(piece); }
    }
    return null;
  }

  undo() {
    if (this.gesture) this.cancelTransform();
    const previous = this.history.pop();
    if (!previous) return false;
    this.future.push(this.snapshot());
    this.pieces = previous.pieces; this.selectedId = previous.selectedId;
    return true;
  }

  redo() {
    if (this.gesture) this.cancelTransform();
    const next = this.future.pop();
    if (!next) return false;
    this.history.push(this.snapshot());
    this.pieces = next.pieces; this.selectedId = next.selectedId;
    return true;
  }

  clear() { if (!this.pieces.length) return false; this._commit(draft => { draft.pieces = []; draft.selectedId = null; }); return true; }

  toJSON() { return { width: this.width, height: this.height, paperId: this.paperId, pattern: this.pattern, pieces: this.pieces.map(collageClonePiece), selectedId: this.selectedId }; }
}

export function collagePointInsidePolygon(point, polygon) {
  const points = Array.isArray(polygon) ? polygon : [];
  if (points.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const current = points[index], prior = points[previous];
    if (((current.y > point.y) !== (prior.y > point.y)) && point.x < (prior.x - current.x) * (point.y - current.y) / (prior.y - current.y || Number.EPSILON) + current.x) inside = !inside;
  }
  return inside;
}
