/**
 * One-stroke shape recognition for child friendly drawing.
 *
 * Recognition is intentionally conservative.  A gesture is only replaced when
 * it has enough points, a meaningful size, and a strong geometric score.  A
 * low-confidence gesture is returned as null so the original freehand stroke
 * remains untouched.
 */
export const SHAPE_SNAP_STORAGE_KEY = 'luoye-shape-snap';
export const SHAPE_SNAP_MIN_POINTS = 8;

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }

export function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index++) total += distance(points[index - 1], points[index]);
  return total;
}

function cleanPoints(points) {
  if (!Array.isArray(points)) return [];
  const result = [];
  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const next = { x: Number(point.x), y: Number(point.y) };
    if (!result.length || distance(result.at(-1), next) >= 1) result.push(next);
  }
  return result;
}

function bounds(points) {
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  return { left, right, top, bottom, width: right - left, height: bottom - top, size: Math.max(right - left, bottom - top) };
}

function pointLineDistance(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (!dx && !dy) return distance(point, start);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy);
}

function simplify(points, epsilon) {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const visit = (start, end) => {
    if (end - start < 2) return;
    let max = epsilon, index = -1;
    for (let i = start + 1; i < end; i++) {
      const error = pointLineDistance(points[i], points[start], points[end]);
      if (error > max) { max = error; index = i; }
    }
    if (index >= 0) { keep[index] = 1; visit(start, index); visit(index, end); }
  };
  visit(0, points.length - 1);
  return points.filter((_, index) => keep[index]);
}

function normalizedEllipseScore(points, box) {
  if (box.width < 1 || box.height < 1) return 0;
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const rx = box.width / 2, ry = box.height / 2;
  const values = points.map(point => Math.hypot((point.x - cx) / rx, (point.y - cy) / ry));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  // A hand drawn ellipse normally has a little wobble.  Penalize strokes that
  // are only a short arc or that wandered far from the bounding ellipse.
  const score = 1 - deviation / .28;
  return clamp(score);
}

function angularCoverage(points, box) {
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const angles = points.map(point => Math.atan2(point.y - cy, point.x - cx)).sort((a, b) => a - b);
  if (angles.length < 3) return 0;
  let largestGap = 0;
  for (let index = 1; index < angles.length; index++) largestGap = Math.max(largestGap, angles[index] - angles[index - 1]);
  largestGap = Math.max(largestGap, Math.PI * 2 - angles.at(-1) + angles[0]);
  return clamp(1 - largestGap / Math.PI);
}

function cornerAngle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y }, cb = { x: c.x - b.x, y: c.y - b.y };
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!denominator) return Math.PI;
  return Math.acos(clamp((ab.x * cb.x + ab.y * cb.y) / denominator, -1, 1));
}

function rectangleScore(vertices) {
  if (vertices.length !== 4) return 0;
  const angles = vertices.map((point, index) => cornerAngle(vertices[(index + 3) % 4], point, vertices[(index + 1) % 4]));
  const angleError = angles.reduce((sum, angle) => sum + Math.abs(angle - Math.PI / 2), 0) / (Math.PI * 2);
  const sides = vertices.map((point, index) => distance(point, vertices[(index + 1) % 4]));
  const oppositeError = (Math.abs(sides[0] - sides[2]) + Math.abs(sides[1] - sides[3])) / Math.max(1, sides.reduce((sum, side) => sum + side, 0));
  return clamp(1 - angleError * 2 - oppositeError * 2);
}

function triangleScore(vertices) {
  if (vertices.length !== 3) return 0;
  const sides = vertices.map((point, index) => distance(point, vertices[(index + 1) % 3]));
  const perimeter = sides.reduce((sum, side) => sum + side, 0);
  return clamp(1 - (perimeter ? Math.max(...sides) / perimeter - .42 : 1));
}

function starScore(vertices, box) {
  if (vertices.length < 8 || vertices.length > 12) return 0;
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const radii = vertices.map(point => Math.hypot(point.x - cx, point.y - cy));
  const average = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  if (!average) return 0;
  let best = 0;
  for (const phase of [0, 1]) {
    const outer = radii.filter((_, index) => index % 2 === phase), inner = radii.filter((_, index) => index % 2 !== phase);
    const outerMean = outer.reduce((sum, radius) => sum + radius, 0) / outer.length;
    const innerMean = inner.reduce((sum, radius) => sum + radius, 0) / inner.length;
    if (outerMean <= innerMean * 1.12) continue;
    const spread = radii.reduce((sum, radius, index) => sum + Math.abs(radius - (index % 2 === phase ? outerMean : innerMean)), 0) / radii.length / average;
    best = Math.max(best, clamp(1 - spread * 2));
  }
  return best;
}

function result(tool, box, confidence, start, end, label) {
  return { tool, start, end, bounds: box, confidence, label };
}

function segmentEndpoints(segment) {
  if (!segment || !segment.start || !segment.end) return null;
  const start = { x: Number(segment.start.x), y: Number(segment.start.y) };
  const end = { x: Number(segment.end.x), y: Number(segment.end.y) };
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return null;
  return { start, end };
}

/**
 * Join the current gesture to recent line segments. The search follows
 * touching endpoints in both directions, so four separate strokes can form a
 * rectangle just like one continuous stroke. The result is still passed
 * through the conservative recognizer below before anything is replaced.
 */
export function combineStrokeWithSegments(input, segments, { maxGap = .12 } = {}) {
  const points = cleanPoints(input);
  if (points.length < SHAPE_SNAP_MIN_POINTS || !Array.isArray(segments)) return [];
  const box = bounds(points), scale = Math.max(1, box.size);
  const gap = Math.max(8, scale * maxGap), candidates = [], seen = new Set(), maxSegments = Math.min(3, segments.length);
  const usable = segments.map((segment, index) => ({ index, segment, endpoints: segmentEndpoints(segment) })).filter(item => item.endpoints);
  const visit = (path, remaining, used) => {
    if (used.length && distance(path.at(-1), path[0]) <= gap) {
      const key = used.map(item => item.index).sort((a, b) => a - b).join(',');
      if (seen.has(key)) return;
      seen.add(key);
      const closed = path.slice();
      if (distance(closed.at(-1), closed[0]) > 1) closed.push({ ...closed[0] });
      candidates.push({ points: closed, segments: used.map(item => item.segment), segment: used[0].segment });
      return;
    }
    if (used.length >= maxSegments) return;
    for (let index = 0; index < remaining.length; index++) {
      const item = remaining[index], { start, end } = item.endpoints;
      for (const oriented of [[start, end], [end, start]]) {
        if (distance(path.at(-1), oriented[0]) > gap) continue;
        const nextPath = path.slice();
        if (distance(nextPath.at(-1), oriented[0]) > 1) nextPath.push({ ...oriented[0] });
        nextPath.push({ ...oriented[1] });
        visit(nextPath, remaining.filter((_, other) => other !== index), used.concat(item));
      }
    }
  };
  // Trying both directions covers a user who starts at either end of the
  // unfinished shape. A reversed path keeps the point order meaningful for
  // the corner simplifier.
  visit(points, usable, []);
  visit(points.slice().reverse(), usable, []);
  return candidates;
}

/**
 * Recognize a single freehand stroke. Returns a shape descriptor or null.
 * Supported tools map directly to DrawingEngine geometry: line, ellipse,
 * rect, triangle and star.
 */
export function recognizeStroke(input, { minSize = 24, minConfidence = .72 } = {}) {
  const points = cleanPoints(input);
  if (points.length < SHAPE_SNAP_MIN_POINTS) return null;
  const box = bounds(points), length = pathLength(points);
  if (box.size < minSize || length < minSize * 1.7) return null;
  const start = points[0], end = points.at(-1);
  const directness = distance(start, end) / Math.max(1, length);
  if (directness >= .94 && distance(start, end) >= minSize * .8) {
    return result('line', box, clamp(.72 + directness * .28), start, end, '直线');
  }

  const closure = distance(start, end) / Math.max(1, box.size);
  if (closure > .34) return null;
  const loop = points.slice();
  if (distance(loop[0], loop.at(-1)) > 0.001) loop.push(loop[0]);
  const simplified = simplify(loop, Math.max(2, box.size * .065));
  const vertices = simplified.slice(0, -1);
  if (vertices.length < 3) return null;

  const ellipse = normalizedEllipseScore(points, box) * angularCoverage(points, box);
  if (ellipse >= minConfidence && vertices.length >= 5) {
    return result('ellipse', box, ellipse, { x: box.left, y: box.top }, { x: box.right, y: box.bottom }, '圆／椭圆');
  }
  const rect = rectangleScore(vertices);
  if (vertices.length === 4 && rect >= minConfidence) {
    return result('rect', box, rect, { x: box.left, y: box.top }, { x: box.right, y: box.bottom }, '方框');
  }
  const triangle = triangleScore(vertices);
  if (vertices.length === 3 && triangle >= minConfidence) {
    return result('triangle', box, triangle, { x: box.left, y: box.top }, { x: box.right, y: box.bottom }, '三角形');
  }
  const star = starScore(vertices, box);
  if (star >= minConfidence) {
    return result('star', box, star, { x: box.left, y: box.top }, { x: box.right, y: box.bottom }, '星星');
  }
  return null;
}

/** Recognise a gesture that may be completed by one or more recent segments. */
export function recognizeStrokeWithSegments(input, segments, options = {}) {
  for (const candidate of combineStrokeWithSegments(input, segments, options)) {
    const shape = recognizeStroke(candidate.points, options);
    if (shape && shape.tool !== 'line') return { ...shape, mergedSegments: candidate.segments };
  }
  const direct = recognizeStroke(input, options);
  if (direct) return direct;
  return null;
}

export function readShapeSnapEnabled() {
  try { return localStorage.getItem(SHAPE_SNAP_STORAGE_KEY) === 'true'; } catch { return false; }
}

/** Add the compact toggle beside the canvas tabs. */
export function mountShapeSnap({ toast } = {}) {
  const button = document.createElement('button');
  button.id = 'shape-snap-open';
  button.type = 'button';
  button.className = 'shape-snap-open';
  button.setAttribute('aria-label', '一笔成形');
  button.title = '画圆、方框、三角形或直线，松手后自动整理';
  button.innerHTML = '<span class="shape-snap-open-mark" aria-hidden="true">✧</span><span>一笔成形</span>';
  let enabled = readShapeSnapEnabled();
  const sync = (announce = false) => {
    button.setAttribute('aria-pressed', String(enabled));
    document.body.dataset.shapeSnapEnabled = enabled ? 'true' : 'false';
    if (announce) toast?.(enabled ? '一笔成形已开启：画完松手，线条会自动整理' : '一笔成形已关闭：保留自由笔迹');
  };
  button.onclick = () => {
    enabled = !enabled;
    try { localStorage.setItem(SHAPE_SNAP_STORAGE_KEY, String(enabled)); } catch { /* optional */ }
    sync(true);
  };
  document.querySelector('.canvas-topbar')?.append(button);
  sync();
  return { enabled: () => enabled, reset: () => { enabled = false; try { localStorage.removeItem(SHAPE_SNAP_STORAGE_KEY); } catch {} sync(); }, sync };
}
