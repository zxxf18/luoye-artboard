import { makeCanvas } from './engine.js';
import { brushSegment } from './brushes.js';

function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

/**
 * Decode a material once. Paper textures also get a small luminance mask so
 * drawing can use Canvas compositing instead of reading and rewriting every
 * brush pixel for every pointer sample.
 */
export function textureData(image) {
  if (!image) return null;
  if (image.width < 1 || image.height < 1 || image.width > 2048 || image.height > 2048) throw new Error('纹理边长最多 2048。');
  const canvas = makeCanvas(image.width, image.height);
  const source = canvas.getContext('2d');
  source.drawImage(image, 0, 0);
  const pixels = source.getImageData(0, 0, canvas.width, canvas.height).data;
  // At strength 1 this is the alpha multiplier used by the previous
  // per-pixel implementation. Strength 0 is represented by a fully opaque
  // mask and therefore costs no visible compositing work.
  const paperMask = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < paperMask.length; i++, p += 4) {
    const light = (pixels[p] + pixels[p + 1] + pixels[p + 2]) / 765;
    paperMask[i] = Math.round((1 - (1 - light) * .8) * 255);
  }
  return { canvas, width: canvas.width, height: canvas.height, pixels, paperMask, maskCanvases: new Map() };
}

function paperMaskCanvas(paper, strength) {
  const amount = clamp01(strength), key = Math.round(amount * 100);
  let mask = paper.maskCanvases?.get(key);
  if (mask) {
    // Keep recently used strengths hot without allowing a slider sweep to
    // retain one full-size RGBA canvas for every possible value.
    paper.maskCanvases.delete(key); paper.maskCanvases.set(key, mask);
    return mask;
  }
  paper.maskCanvases ??= new Map();
  // The mask is generated with one write and then sampled as a pattern; it
  // never needs readback, so keep it on the normal compositing path.
  mask = makeCanvas(paper.width, paper.height, false);
  const context = mask.getContext('2d'), image = context.createImageData(paper.width, paper.height);
  for (let i = 0, p = 0; i < paper.paperMask.length; i++, p += 4) {
    const alpha = 255 - (255 - paper.paperMask[i]) * amount;
    image.data[p] = 255; image.data[p + 1] = 255; image.data[p + 2] = 255; image.data[p + 3] = alpha;
  }
  context.putImageData(image, 0, 0);
  paper.maskCanvases.set(key, mask);
  while (paper.maskCanvases.size > 4) paper.maskCanvases.delete(paper.maskCanvases.keys().next().value);
  return mask;
}

function patternAt(cache, context, source, left, top) {
  if (!source || typeof context.createPattern !== 'function') return null;
  let entry = cache.get(source);
  // Modern engines let us move the phase on an existing pattern. Reusing the
  // pattern avoids one native object allocation per pointer sample.
  if (entry?.transformable) {
    if (entry.left !== left || entry.top !== top) {
      entry.pattern.setTransform(new DOMMatrix().translate(-left, -top));
      entry.left = left; entry.top = top;
    }
    return entry.pattern;
  }
  if (entry?.left === left && entry.top === top) return entry.pattern;
  const pattern = entry?.pattern ?? context.createPattern(source, 'repeat');
  if (!pattern) return null;
  // Older WebViews often lack CanvasPattern.setTransform; creating the pattern
  // while the context is translated retains the same phase without falling
  // back to a JS pixel loop.
  if (typeof pattern.setTransform === 'function' && typeof DOMMatrix === 'function') {
    pattern.setTransform(new DOMMatrix().translate(-left, -top));
    cache.set(source, { left, top, pattern, transformable: true });
    return pattern;
  }
  context.save(); context.translate(-left, -top);
  const translated = context.createPattern(source, 'repeat');
  context.restore();
  if (!translated) return null;
  cache.set(source, { left, top, pattern: translated, transformable: false });
  return translated;
}

function scratchFor(gesture, width, height) {
  let scratch = gesture.materialScratch;
  if (!scratch || scratch.canvas.width < width || scratch.canvas.height < height) {
    const canvas = makeCanvas(width, height, false);
    scratch = gesture.materialScratch = { canvas, context: canvas.getContext('2d'), patterns: new WeakMap() };
  }
  return scratch;
}

// Kept only for browsers that do not expose CanvasPattern/createPattern. The
// normal path below never calls getImageData during a pointer gesture.
function applyPixelFallback(context, width, height, left, top, texture, paper, strength) {
  const image = context.getImageData(0, 0, width, height), amount = clamp01(strength);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4;
    if (!image.data[p + 3]) continue;
    if (texture) {
      const n = (((y + top) % texture.height) * texture.width + (x + left) % texture.width) * 4;
      image.data[p] = texture.pixels[n]; image.data[p + 1] = texture.pixels[n + 1]; image.data[p + 2] = texture.pixels[n + 2];
      image.data[p + 3] *= texture.pixels[n + 3] / 255;
    }
    if (paper && amount > 0) {
      const n = ((y + top) % paper.height) * paper.width + (x + left) % paper.width;
      image.data[p + 3] *= 1 - amount * (1 - paper.paperMask[n] / 255);
    }
  }
  context.putImageData(image, 0, 0);
}

export function materialSegment(ctx, gesture, a, b, texture, paper, bounds) {
  const left = Math.max(0, Math.floor(bounds.x)), top = Math.max(0, Math.floor(bounds.y));
  const right = Math.min(gesture.layer.width, Math.ceil(bounds.x + bounds.width)), bottom = Math.min(gesture.layer.height, Math.ceil(bounds.y + bounds.height));
  const width = right - left, height = bottom - top;
  if (width <= 0 || height <= 0) return;

  const materialOwner = gesture.materialScratchOwner ?? gesture;
  const scratch = scratchFor(materialOwner, width, height), canvas = scratch.canvas, context = scratch.context;
  context.setTransform(1, 0, 0, 1, 0, 0); context.globalCompositeOperation = 'source-over'; context.globalAlpha = 1; context.clearRect(0, 0, width, height);
  context.save(); context.translate(-left, -top); brushSegment(context, gesture, a, b); context.restore();

  const strength = clamp01(gesture.options.paperGrain), paperMask = paper && strength > 0 ? paperMaskCanvas(paper, strength) : null;
  const paintPattern = texture ? patternAt(scratch.patterns, context, texture.canvas, left, top) : null;
  const paperPattern = paperMask ? patternAt(scratch.patterns, context, paperMask, left, top) : null;
  if ((texture && !paintPattern) || (paperMask && !paperPattern)) {
    applyPixelFallback(context, width, height, left, top, texture, paper, strength);
  } else {
    if (paintPattern) {
      context.globalCompositeOperation = 'source-in'; context.globalAlpha = 1; context.fillStyle = paintPattern; context.fillRect(0, 0, width, height);
    }
    if (paperPattern) {
      context.globalCompositeOperation = 'destination-in'; context.globalAlpha = 1; context.fillStyle = paperPattern; context.fillRect(0, 0, width, height);
    }
  }
  context.globalCompositeOperation = 'source-over'; context.globalAlpha = 1;
  ctx.drawImage(canvas, 0, 0, width, height, left, top, width, height);
}
