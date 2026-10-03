// Child-friendly eraser silhouettes.  The helper only draws into the caller's
// context; snapshotting, layer masks, undo and paper-mode fan-out stay in the
// existing drawing engine.  This keeps shape erasing compatible with both a
// normal layer and the multi-layer paper workflow.

export const ERASER_SHAPES = Object.freeze({
  star: Object.freeze({ label: '星星' }),
  heart: Object.freeze({ label: '爱心' }),
  cloud: Object.freeze({ label: '云朵' }),
});

const DEFAULT_SHAPE = 'star';
const TAU = Math.PI * 2;

export function normalizeEraserShape(value) {
  return Object.prototype.hasOwnProperty.call(ERASER_SHAPES, value) ? value : DEFAULT_SHAPE;
}

function shapeEraserPath(ctx, shape, radius) {
  if (shape === 'heart') {
    ctx.beginPath();
    ctx.moveTo(0, radius * .9);
    ctx.bezierCurveTo(-radius * .16, radius * .72, -radius, radius * .25, -radius, -radius * .2);
    ctx.bezierCurveTo(-radius, -radius * .66, -radius * .42, -radius, 0, -radius * .46);
    ctx.bezierCurveTo(radius * .42, -radius, radius, -radius * .66, radius, -radius * .2);
    ctx.bezierCurveTo(radius, radius * .25, radius * .16, radius * .72, 0, radius * .9);
    ctx.closePath();
    return;
  }

  if (shape === 'cloud') {
    // A single closed outline keeps the silhouette portable to the Android
    // WebView canvas as well as desktop browsers.
    ctx.beginPath();
    ctx.moveTo(-radius * .82, radius * .62);
    ctx.lineTo(radius * .82, radius * .62);
    ctx.bezierCurveTo(radius * 1.02, radius * .62, radius * 1.02, radius * .34, radius * .82, radius * .22);
    ctx.bezierCurveTo(radius * 1.03, -radius * .06, radius * .83, -radius * .37, radius * .5, -radius * .34);
    ctx.bezierCurveTo(radius * .34, -radius * .76, -radius * .2, -radius * .78, -radius * .34, -radius * .36);
    ctx.bezierCurveTo(-radius * .68, -radius * .54, -radius * .99, -radius * .31, -radius * .84, radius * .02);
    ctx.bezierCurveTo(-radius * 1.04, radius * .16, -radius * 1.02, radius * .58, -radius * .82, radius * .62);
    ctx.closePath();
    return;
  }

  // Star is the default and also the safe fallback for future/unknown values.
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const angle = index * Math.PI / 5 - Math.PI / 2;
    const pointRadius = index % 2 ? radius * .44 : radius;
    const x = Math.cos(angle) * pointRadius;
    const y = Math.sin(angle) * pointRadius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draw one shape cut-out centered at x/y.
 *
 * `size` is the diameter in layer coordinates.  Opacity intentionally uses
 * destination-out alpha, so lower opacity behaves like a gentle partial erase
 * and composes correctly with existing paper erase masks.
 */
export function shapeEraserDab(ctx, shape, x, y, size, opacity = 1, rotation = 0) {
  const diameter = Math.max(1, Number(size) || 1);
  const radius = diameter / 2;
  const parsedOpacity = Number(opacity);
  const alpha = opacity === undefined || Number.isNaN(parsedOpacity)
    ? 1
    : Math.max(0, Math.min(1, parsedOpacity));
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  shapeEraserPath(ctx, normalizeEraserShape(shape), radius);
  ctx.fill();
  ctx.restore();
}

/**
 * Return a layer-local rectangle suitable for tile snapshots.
 *
 * One extra pixel is included for antialiasing.  The result is always clipped
 * to the supplied layer dimensions, which prevents large off-canvas gestures
 * from allocating oversized ImageData buffers.
 */
export function shapeEraserBounds(start, end, size, scale = 1, width = Infinity, height = Infinity) {
  const layerScale = Math.max(.01, Number(scale) || 1);
  const diameter = Math.max(1, Number(size) || 1) / layerScale;
  // Cloud control points extend a few percent beyond its nominal radius.
  // Keep a proportional margin so large brush sizes are still fully captured.
  const pad = diameter * .53 + 1;
  const left = Math.floor(Math.min(start.x, end.x) - pad);
  const top = Math.floor(Math.min(start.y, end.y) - pad);
  const right = Math.ceil(Math.max(start.x, end.x) + pad);
  const bottom = Math.ceil(Math.max(start.y, end.y) + pad);
  const clippedLeft = Math.max(0, left);
  const clippedTop = Math.max(0, top);
  const clippedRight = Math.min(Number.isFinite(width) ? width : right, right);
  const clippedBottom = Math.min(Number.isFinite(height) ? height : bottom, bottom);
  return {
    x: clippedLeft,
    y: clippedTop,
    width: Math.max(0, clippedRight - clippedLeft),
    height: Math.max(0, clippedBottom - clippedTop),
  };
}

/**
 * Stamp a shape along a drag path.  `gesture.shapeTravel` and
 * `gesture.shapeStarted` are intentionally kept on the caller's gesture so
 * successive pointer events join into one evenly spaced sequence.
 */
export function shapeEraserSegment(ctx, gesture, start, end) {
  const options = gesture?.options || {};
  const layerScale = Math.max(.01, Number(gesture?.layer?.scale) || 1);
  const diameter = Math.max(1, Number(options.size) || 1) / layerScale;
  const spacingRatio = Math.max(.2, Math.min(1.5, Number(options.eraserSpacing) || .62));
  const spacing = Math.max(1, diameter * spacingRatio);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const rotation = Number(options.eraserRotation) || 0;
  const draw = (point) => shapeEraserDab(ctx, options.eraserShape, point.x, point.y, diameter, options.opacity, rotation);

  if (!gesture.shapeStarted) {
    draw(start);
    gesture.shapeStarted = true;
    gesture.shapeTravel = 0;
  }
  if (!distance) return;

  const travel = Math.max(0, Number(gesture.shapeTravel) || 0);
  for (let offset = spacing - travel; offset <= distance; offset += spacing) {
    const ratio = offset / distance;
    draw({ x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio });
  }
  gesture.shapeTravel = (travel + distance) % spacing;
}

export { shapeEraserPath };
