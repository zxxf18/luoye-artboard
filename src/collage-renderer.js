import { getCollagePaper } from './collage-editor.js';

/*
 * Canvas renderer for the colour-paper desk.
 *
 * The editor deliberately keeps pieces as a small JSON object (path, paper,
 * transform).  This renderer is the only place that turns those objects into
 * pixels.  A piece is rasterised once at its untransformed size and every
 * subsequent move/rotation/scale uses drawImage.  That matters while a child
 * drags a piece: rebuilding a clipped pattern for every pointer event quickly
 * becomes noticeable on a phone.
 */

export const COLLAGE_RENDERER_MAX_PIECES = 200;
export const COLLAGE_RENDERER_MAX_RASTER_ENTRIES = 64;
export const COLLAGE_RENDERER_MAX_RASTER_PIXELS = 24_000_000;
export const COLLAGE_RENDERER_MAX_TEXTURE_ENTRIES = 16;
export const COLLAGE_RENDERER_MAX_TEXTURE_PIXELS = 1_000_000;
export const COLLAGE_RENDERER_MAX_OUTPUT_SIZE = 2048;

function collageRendererCanvasFactory(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
  }
  throw new Error('彩纸渲染需要一个 canvas 工厂。');
}

function collageRendererSize(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.max(1, Math.min(COLLAGE_RENDERER_MAX_OUTPUT_SIZE, Math.round(number))) : fallback;
}

function collageRendererTarget(target) {
  const canvas = target?.canvas || target;
  if (!canvas || typeof canvas.width !== 'number' || typeof canvas.height !== 'number') throw new TypeError('彩纸渲染目标必须是 canvas 或 2D context。');
  const context = typeof target?.drawImage === 'function' ? target : canvas.getContext?.('2d');
  if (!context) throw new TypeError('彩纸渲染目标缺少 2D context。');
  return { canvas, context };
}

function collageRendererNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function collageRendererOpacity(value) {
  return Math.max(0, Math.min(1, collageRendererNumber(value, 1)));
}

function collageRendererPathKey(path) {
  return (Array.isArray(path) ? path : []).map(point => `${Math.round(collageRendererNumber(point?.x) * 10000)},${Math.round(collageRendererNumber(point?.y) * 10000)}`).join(';');
}

function collageRendererSourceKey(piece) {
  const width = Math.max(8, Math.ceil(collageRendererNumber(piece?.width, 8)));
  const height = Math.max(8, Math.ceil(collageRendererNumber(piece?.height, width)));
  return `${piece?.paperId || 'sun'}|${piece?.pattern || 'solid'}|${width}x${height}|${collageRendererPathKey(piece?.path)}`;
}

function collageRendererTransformKey(piece) {
  return `${collageRendererSourceKey(piece)}|${collageRendererNumber(piece?.x)}|${collageRendererNumber(piece?.y)}|${collageRendererNumber(piece?.scale, 1)}|${collageRendererNumber(piece?.rotation)}|${collageRendererOpacity(piece?.opacity)}`;
}

function collageRendererPath(context, piece, scaleX = 1, scaleY = 1) {
  const width = Math.max(8, collageRendererNumber(piece?.width, 8)) * scaleX;
  const height = Math.max(8, collageRendererNumber(piece?.height, width)) * scaleY;
  const path = Array.isArray(piece?.path) && piece.path.length >= 3 ? piece.path : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  context.beginPath();
  path.forEach((point, index) => {
    const x = (collageRendererNumber(point?.x, .5) - .5) * width;
    const y = (collageRendererNumber(point?.y, .5) - .5) * height;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.closePath();
}

function collageRendererFit(width, height, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / Math.max(1, width), targetHeight / Math.max(1, height));
  return { scale, offsetX: (targetWidth - width * scale) / 2, offsetY: (targetHeight - height * scale) / 2 };
}

function collageRendererPatternPixels(context, paper, pattern, width, height) {
  context.fillStyle = paper.fill;
  context.fillRect(-width / 2, -height / 2, width, height);
  if (pattern === 'solid') return;
  context.save();
  context.globalAlpha = .34;
  context.strokeStyle = paper.accent;
  context.fillStyle = paper.accent;
  if (pattern === 'dots') {
    for (let y = -height / 2 + 12; y < height / 2; y += 24) for (let x = -width / 2 + 12; x < width / 2; x += 24) {
      context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill();
    }
  } else if (pattern === 'stripes') {
    context.lineWidth = 8; context.rotate(-.4);
    for (let x = -width - height; x < width + height; x += 24) { context.beginPath(); context.moveTo(x, -height); context.lineTo(x, height); context.stroke(); }
  } else if (pattern === 'checker') {
    for (let y = -height / 2; y < height / 2; y += 24) for (let x = -width / 2; x < width / 2; x += 24) if ((Math.round(x / 24) + Math.round(y / 24)) % 2 === 0) context.fillRect(x, y, 12, 12);
  } else if (pattern === 'waves') {
    context.lineWidth = 4;
    for (let y = -height / 2 - 8; y < height / 2 + 12; y += 24) {
      context.beginPath();
      for (let x = -width / 2 - 8; x <= width / 2 + 8; x += 8) context.lineTo(x, y + Math.sin(x / 14) * 5);
      context.stroke();
    }
  }
  context.restore();
}

function collageRendererCreateTexture(createCanvas, paper, pattern) {
  const canvas = createCanvas(96, 96);
  const context = canvas.getContext('2d');
  context.save(); context.setTransform?.(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, 96, 96);
  collageRendererPatternPixels(context, paper, pattern, 96, 96);
  context.restore();
  return canvas;
}

function collageRendererPaintPattern(context, piece, paper, texture) {
  const width = Math.max(8, collageRendererNumber(piece?.width, 8));
  const height = Math.max(8, collageRendererNumber(piece?.height, width));
  if (texture && typeof context.createPattern === 'function') {
    try {
      const pattern = context.createPattern(texture, 'repeat');
      if (pattern) { context.fillStyle = pattern; context.fillRect(-width / 2, -height / 2, width, height); return; }
    } catch { /* Test canvases and older WKWebViews can lack createPattern. */ }
  }
  collageRendererPatternPixels(context, paper, piece?.pattern || 'solid', width, height);
}

function collageRendererClear(context, canvas) {
  context.save(); context.setTransform?.(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, canvas.width, canvas.height); context.restore();
}

/**
 * Raster cache and painter-order aware renderer for colour-paper pieces.
 * `createCanvas` is injected so the same implementation works in the DOM and
 * in DOM-free tests.  The default is document/OffscreenCanvas when available.
 */
export class CollageRenderer {
  constructor({ width = 512, height = width, createCanvas = collageRendererCanvasFactory } = {}) {
    this.width = Math.max(1, collageRendererSize(width, 512));
    this.height = Math.max(1, collageRendererSize(height, this.width));
    this.createCanvas = createCanvas;
    this.rasterCache = new Map();
    this.textureCache = new Map();
    this.rasterPixels = 0;
    this.texturePixels = 0;
    this.dragCache = null;
    this.sceneCache = null;
    this.metrics = {
      renders: 0, rasterHits: 0, rasterMisses: 0, textureHits: 0, textureMisses: 0,
      dragCacheHits: 0, dragCacheBuilds: 0, sceneCacheHits: 0, sceneCacheBuilds: 0, skippedPieces: 0, rasterPixels: 0,
      texturePixels: 0,
    };
    this.destroyed = false;
  }

  collageRendererAssertAlive() { if (this.destroyed) throw new Error('彩纸渲染器已经释放。'); }

  collageRendererRemember(map, key, entry, maxEntries, maxPixels, kind) {
    const pixels = entry.pixels || 0;
    const previous = map.get(key);
    if (previous) {
      if (kind === 'raster') this.rasterPixels -= previous.pixels || 0; else this.texturePixels -= previous.pixels || 0;
      map.delete(key);
    }
    map.set(key, entry);
    if (kind === 'raster') this.rasterPixels += pixels; else this.texturePixels += pixels;
    while ((map.size > maxEntries || (kind === 'raster' ? this.rasterPixels : this.texturePixels) > maxPixels) && map.size) {
      const oldestKey = map.keys().next().value, oldest = map.get(oldestKey); map.delete(oldestKey);
      if (kind === 'raster') this.rasterPixels -= oldest.pixels || 0; else this.texturePixels -= oldest.pixels || 0;
    }
    this.metrics.rasterPixels = this.rasterPixels; this.metrics.texturePixels = this.texturePixels;
  }

  collageRendererGetTexture(piece) {
    const paper = getCollagePaper(piece?.paperId);
    const pattern = String(piece?.pattern || paper.pattern);
    const key = `${paper.id}|${pattern}`;
    const cached = this.textureCache.get(key);
    if (cached) { this.textureCache.delete(key); this.textureCache.set(key, cached); this.metrics.textureHits++; return cached.canvas; }
    this.metrics.textureMisses++;
    try { const result = collageRendererCreateTexture(this.createCanvas, paper, pattern); this.collageRendererRemember(this.textureCache, key, { canvas: result, pixels: 96 * 96 }, COLLAGE_RENDERER_MAX_TEXTURE_ENTRIES, COLLAGE_RENDERER_MAX_TEXTURE_PIXELS, 'texture'); return result; } catch {
      // A factory may only provide a minimal context in an embedding. Keep a
      // simple empty tile and let the piece path's direct fallback paint it.
      const canvas = this.createCanvas(96, 96);
      this.collageRendererRemember(this.textureCache, key, { canvas, pixels: 96 * 96 }, COLLAGE_RENDERER_MAX_TEXTURE_ENTRIES, COLLAGE_RENDERER_MAX_TEXTURE_PIXELS, 'texture'); return canvas;
    }
  }

  collageRendererGetRaster(piece) {
    const key = collageRendererSourceKey(piece);
    const cached = this.rasterCache.get(key);
    if (cached) { this.rasterCache.delete(key); this.rasterCache.set(key, cached); this.metrics.rasterHits++; return cached.canvas; }
    this.metrics.rasterMisses++;
    const width = Math.max(8, Math.min(COLLAGE_RENDERER_MAX_OUTPUT_SIZE, Math.ceil(collageRendererNumber(piece?.width, 8))));
    const height = Math.max(8, Math.min(COLLAGE_RENDERER_MAX_OUTPUT_SIZE, Math.ceil(collageRendererNumber(piece?.height, width))));
    const canvas = this.createCanvas(width, height), context = canvas.getContext('2d');
    context.save(); context.setTransform?.(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, width, height);
    const local = { ...piece, width, height };
    collageRendererPath(context, local);
    context.save(); context.clip(); collageRendererPaintPattern(context, local, getCollagePaper(piece?.paperId), this.collageRendererGetTexture(piece)); context.restore();
    // A soft pale edge gives each cut piece the look of paper layered on the
    // board. It is drawn into the cached raster, so dragging remains cheap.
    collageRendererPath(context, local);
    context.strokeStyle = 'rgba(255,255,255,.78)'; context.lineWidth = 3; context.stroke();
    context.restore();
    const entry = { canvas, pixels: width * height };
    this.collageRendererRemember(this.rasterCache, key, entry, COLLAGE_RENDERER_MAX_RASTER_ENTRIES, COLLAGE_RENDERER_MAX_RASTER_PIXELS, 'raster');
    return canvas;
  }

  collageRendererDrawPiece(context, piece, targetWidth, targetHeight) {
    if (!piece) return;
    const fit = collageRendererFit(this.width, this.height, targetWidth, targetHeight);
    const x = fit.offsetX + collageRendererNumber(piece.x, this.width / 2) * fit.scale;
    const y = fit.offsetY + collageRendererNumber(piece.y, this.height / 2) * fit.scale;
    const scale = Math.max(.01, collageRendererNumber(piece.scale, 1));
    const raster = this.collageRendererGetRaster(piece);
    // The source raster is capped at 2048px to keep the cache bounded. Draw it
    // at the piece's logical size so a very large piece is downsampled rather
    // than silently shrinking to the cache cap.
    const drawWidth = Math.max(8, collageRendererNumber(piece.width, raster.width));
    const drawHeight = Math.max(8, collageRendererNumber(piece.height, raster.height));
    context.save(); context.translate(x, y); context.rotate(collageRendererNumber(piece.rotation) * Math.PI / 180); context.scale(scale * fit.scale, scale * fit.scale);
    context.globalAlpha = collageRendererOpacity(piece.opacity);
    context.shadowColor = 'rgba(91,55,32,.24)'; context.shadowBlur = 8; context.shadowOffsetY = 4;
    context.drawImage(raster, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
  }

  collageRendererDragKey(pieces, selectedIndex, targetWidth, targetHeight) {
    return `${targetWidth}x${targetHeight}|${selectedIndex}|${pieces.map((piece, index) => index === selectedIndex ? `selected:${piece?.id || index}` : collageRendererTransformKey(piece)).join('||')}`;
  }

  collageRendererBuildDragCache(pieces, selectedIndex, targetWidth, targetHeight) {
    const under = this.createCanvas(targetWidth, targetHeight), above = this.createCanvas(targetWidth, targetHeight);
    const underContext = under.getContext('2d'), aboveContext = above.getContext('2d');
    collageRendererClear(underContext, under); collageRendererClear(aboveContext, above);
    for (let index = 0; index < selectedIndex; index++) this.collageRendererDrawPiece(underContext, pieces[index], targetWidth, targetHeight);
    for (let index = selectedIndex + 1; index < pieces.length; index++) this.collageRendererDrawPiece(aboveContext, pieces[index], targetWidth, targetHeight);
    this.dragCache = { key: this.collageRendererDragKey(pieces, selectedIndex, targetWidth, targetHeight), under, above, selectedIndex, targetWidth, targetHeight };
    this.metrics.dragCacheBuilds++;
    return this.dragCache;
  }

  collageRendererSceneKey(pieces, targetWidth, targetHeight) {
    return `${targetWidth}x${targetHeight}|${pieces.map(piece => collageRendererTransformKey(piece)).join('||')}`;
  }

  collageRendererBuildSceneCache(pieces, targetWidth, targetHeight) {
    const canvas = this.createCanvas(targetWidth, targetHeight), context = canvas.getContext('2d');
    collageRendererClear(context, canvas);
    for (const piece of pieces) this.collageRendererDrawPiece(context, piece, targetWidth, targetHeight);
    this.sceneCache = { key: this.collageRendererSceneKey(pieces, targetWidth, targetHeight), canvas, targetWidth, targetHeight };
    this.metrics.sceneCacheBuilds++;
    return this.sceneCache;
  }

  collageRendererDrawSelection(context, piece, targetWidth, targetHeight) {
    const fit = collageRendererFit(this.width, this.height, targetWidth, targetHeight), scale = Math.max(.01, collageRendererNumber(piece.scale, 1));
    context.save(); context.translate(fit.offsetX + collageRendererNumber(piece.x, this.width / 2) * fit.scale, fit.offsetY + collageRendererNumber(piece.y, this.height / 2) * fit.scale); context.rotate(collageRendererNumber(piece.rotation) * Math.PI / 180); context.scale(scale * fit.scale, scale * fit.scale);
    collageRendererPath(context, piece); context.setLineDash?.([8 / scale, 5 / scale]); context.strokeStyle = '#ffffff'; context.lineWidth = 2 / scale; context.stroke(); context.setLineDash?.([]); context.strokeStyle = '#b86835'; context.lineWidth = 4 / scale; context.stroke(); context.restore();
  }

  collageRendererDrawFreePoints(context, points, targetWidth, targetHeight) {
    if (!Array.isArray(points) || points.length < 2) return;
    const fit = collageRendererFit(this.width, this.height, targetWidth, targetHeight);
    context.save(); context.setTransform?.(1, 0, 0, 1, 0, 0); context.setLineDash?.([8, 5]); context.strokeStyle = '#b86835'; context.lineWidth = 3; context.beginPath();
    points.forEach((point, index) => { const x = fit.offsetX + collageRendererNumber(point?.x) * fit.scale, y = fit.offsetY + collageRendererNumber(point?.y) * fit.scale; if (index) context.lineTo(x, y); else context.moveTo(x, y); }); context.stroke(); context.setLineDash?.([]); context.restore();
  }

  /** Render onto an existing canvas/context. Pieces are always painted in array order. */
  render(target, pieces, { selectedId = null, dragging = false, freePoints = null, showSelection = true, clear = true } = {}) {
    this.collageRendererAssertAlive();
    const { canvas, context } = collageRendererTarget(target), targetWidth = Math.max(1, canvas.width), targetHeight = Math.max(1, canvas.height);
    const allPieces = Array.isArray(pieces) ? pieces : [], visiblePieces = allPieces.slice(0, COLLAGE_RENDERER_MAX_PIECES);
    this.metrics.renders++; this.metrics.skippedPieces += Math.max(0, allPieces.length - visiblePieces.length);
    if (clear) collageRendererClear(context, canvas);
    const selectedIndex = selectedId == null ? -1 : visiblePieces.findIndex(piece => piece?.id === selectedId);
    if (dragging && selectedIndex >= 0) {
      const key = this.collageRendererDragKey(visiblePieces, selectedIndex, targetWidth, targetHeight);
      const reused = this.dragCache?.key === key;
      const cache = reused ? this.dragCache : this.collageRendererBuildDragCache(visiblePieces, selectedIndex, targetWidth, targetHeight);
      if (reused) this.metrics.dragCacheHits++;
      context.drawImage(cache.under, 0, 0); this.collageRendererDrawPiece(context, visiblePieces[selectedIndex], targetWidth, targetHeight); context.drawImage(cache.above, 0, 0);
    } else {
      const key = this.collageRendererSceneKey(visiblePieces, targetWidth, targetHeight);
      const reused = this.sceneCache?.key === key;
      const cache = reused ? this.sceneCache : this.collageRendererBuildSceneCache(visiblePieces, targetWidth, targetHeight);
      if (reused) this.metrics.sceneCacheHits++;
      context.drawImage(cache.canvas, 0, 0);
    }
    if (showSelection && selectedIndex >= 0) this.collageRendererDrawSelection(context, visiblePieces[selectedIndex], targetWidth, targetHeight);
    if (freePoints) this.collageRendererDrawFreePoints(context, freePoints, targetWidth, targetHeight);
    return canvas;
  }

  /** Flatten the collage to one transparent raster layer, clipped to the workbench. */
  toCanvas(pieces, sizeOrWidth = 512, height = undefined) {
    this.collageRendererAssertAlive();
    let width, outputHeight;
    if (sizeOrWidth && typeof sizeOrWidth === 'object') { width = collageRendererSize(sizeOrWidth.width, 512); outputHeight = collageRendererSize(sizeOrWidth.height, width); }
    else { width = collageRendererSize(sizeOrWidth, 512); outputHeight = collageRendererSize(height, width); }
    const canvas = this.createCanvas(width, outputHeight);
    this.render(canvas, pieces, { showSelection: false, dragging: false, clear: true });
    return canvas;
  }

  invalidate() {
    this.collageRendererAssertAlive();
    this.rasterCache.clear(); this.textureCache.clear(); this.clearCompositeCache(); this.rasterPixels = 0; this.texturePixels = 0;
    this.metrics.rasterPixels = 0; this.metrics.texturePixels = 0;
  }

  /** Release full-canvas composites while retaining reusable piece rasters. */
  clearCompositeCache() { this.collageRendererAssertAlive(); this.dragCache = null; this.sceneCache = null; }

  destroy() { this.rasterCache.clear(); this.textureCache.clear(); this.clearCompositeCache(); this.rasterPixels = 0; this.texturePixels = 0; this.createCanvas = null; this.destroyed = true; }
}
