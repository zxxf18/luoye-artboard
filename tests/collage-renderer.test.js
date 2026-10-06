import test from 'node:test';
import assert from 'node:assert/strict';
import { CollageRenderer, COLLAGE_RENDERER_MAX_PIECES } from '../src/collage-renderer.js';

class FakeContext {
  constructor(canvas) { this.canvas = canvas; this.ops = []; this.globalAlpha = 1; this.globalCompositeOperation = 'source-over'; }
  save() { this.ops.push(['save']); }
  restore() { this.ops.push(['restore']); }
  setTransform(...args) { this.ops.push(['setTransform', ...args]); }
  clearRect(...args) { this.ops.push(['clearRect', ...args]); }
  fillRect(...args) { this.ops.push(['fillRect', ...args]); }
  beginPath() { this.ops.push(['beginPath']); }
  closePath() { this.ops.push(['closePath']); }
  moveTo(...args) { this.ops.push(['moveTo', ...args]); }
  lineTo(...args) { this.ops.push(['lineTo', ...args]); }
  arc(...args) { this.ops.push(['arc', ...args]); }
  clip() { this.ops.push(['clip']); }
  stroke() { this.ops.push(['stroke']); }
  fill() { this.ops.push(['fill']); }
  translate(...args) { this.ops.push(['translate', ...args]); }
  rotate(...args) { this.ops.push(['rotate', ...args]); }
  scale(...args) { this.ops.push(['scale', ...args]); }
  drawImage(source, ...args) { this.ops.push(['drawImage', source.label || source, ...args]); }
  createPattern(source, repeat) { this.ops.push(['createPattern', source.label || source, repeat]); return { source, repeat }; }
  setLineDash(value) { this.ops.push(['setLineDash', ...value]); }
}

let canvasNumber = 0;
function fakeCanvas(width, height) {
  const canvas = { width, height, label: `canvas-${++canvasNumber}` };
  canvas.context = new FakeContext(canvas);
  canvas.getContext = () => canvas.context;
  return canvas;
}

function piece(id, { x = 120, y = 140, width = 80, height = 60, scale = 1, rotation = 0, opacity = 1, paperId = 'sun', pattern = 'solid' } = {}) {
  return { id, x, y, width, height, scale, rotation, opacity, paperId, pattern, path: [{ x: .05, y: .05 }, { x: .95, y: .05 }, { x: .95, y: .95 }, { x: .05, y: .95 }] };
}

test('piece rasters center their local path before clipping', () => {
  const renderer = new CollageRenderer({ width: 512, height: 512, createCanvas: fakeCanvas });
  renderer.render(fakeCanvas(512, 512), [piece('one', { width: 80, height: 60 })], { showSelection: false });
  const rasterContext = renderer.rasterCache.values().next().value.canvas.context;
  const translateIndex = rasterContext.ops.findIndex(op => op[0] === 'translate');
  const clipIndex = rasterContext.ops.findIndex(op => op[0] === 'clip');
  assert.ok(translateIndex >= 0, 'the raster path must be moved into the canvas');
  assert.ok(translateIndex < clipIndex, 'the path transform must happen before clipping');
  assert.deepEqual(rasterContext.ops[translateIndex].slice(1), [40, 30]);
});

test('texture tiles center their pattern so the whole tile is painted', () => {
  const renderer = new CollageRenderer({ width: 512, height: 512, createCanvas: fakeCanvas });
  renderer.render(fakeCanvas(512, 512), [piece('one', { pattern: 'dots' })], { showSelection: false });
  const textureContext = renderer.textureCache.values().next().value.canvas.context;
  const translate = textureContext.ops.find(op => op[0] === 'translate');
  assert.deepEqual(translate?.slice(1), [48, 48]);
});

test('toCanvas returns a transparent flattened canvas at the requested size', () => {
  const renderer = new CollageRenderer({ width: 512, height: 512, createCanvas: fakeCanvas });
  const output = renderer.toCanvas([piece('one', { rotation: 35, opacity: .55 }), piece('two', { x: 360, y: 340, paperId: 'sky', pattern: 'waves' })], { width: 1024, height: 768 });
  assert.equal(output.width, 1024);
  assert.equal(output.height, 768);
  assert.equal(output.context.ops.filter(op => op[0] === 'drawImage').length, 1, 'the flattened output composites one cached scene');
  assert.equal(renderer.sceneCache.canvas.context.ops.filter(op => op[0] === 'drawImage').length, 2);
  assert.equal(output.context.ops.some(op => op[0] === 'setLineDash'), false, 'flattened export must not contain selection outline');
  assert.equal(renderer.metrics.rasterMisses, 2);
  assert.equal(renderer.metrics.rasterHits, 0);
});

test('non-square output fits the square workbench uniformly instead of stretching shapes', () => {
  const renderer = new CollageRenderer({ width: 512, height: 512, createCanvas: fakeCanvas });
  const output = renderer.toCanvas([piece('one', { x: 120, y: 140 })], { width: 1024, height: 768 });
  const translate = renderer.sceneCache.canvas.context.ops.find(op => op[0] === 'translate');
  // scale=768/512=1.5; the 128px horizontal letterbox keeps the piece's
  // circle/heart geometry undistorted on a landscape board.
  assert.deepEqual(translate.slice(1), [308, 210]);
});

test('raster and texture caches are reused across moves, rotations and repeated renders', () => {
  const renderer = new CollageRenderer({ width: 512, height: 512, createCanvas: fakeCanvas });
  const target = fakeCanvas(512, 512), first = piece('one', { pattern: 'dots' });
  renderer.render(target, [first]);
  const missesAfterFirst = renderer.metrics.rasterMisses;
  renderer.render(target, [{ ...first, x: 300, y: 240, rotation: 90, scale: 1.4 }]);
  assert.equal(renderer.metrics.rasterMisses, missesAfterFirst);
  assert.ok(renderer.metrics.rasterHits >= 1);
  assert.equal(renderer.metrics.textureMisses, 1);
  // A different source raster with the same paper/pattern reuses the texture
  // tile even though its clipped raster has to be rebuilt.
  renderer.render(target, [{ ...first, width: 81, height: 61 }]);
  assert.ok(renderer.metrics.textureHits >= 1);
  renderer.render(target, [{ ...first, width: 81, height: 61 }]);
  assert.ok(renderer.metrics.sceneCacheHits >= 1, 'a static scene is reused when only the preview changes');
  renderer.invalidate();
  renderer.render(target, [first]);
  assert.equal(renderer.metrics.rasterMisses, missesAfterFirst + 2);
});

test('drag cache paints lower and upper pieces around the selected piece without reordering them', () => {
  const renderer = new CollageRenderer({ width: 512, height: 512, createCanvas: fakeCanvas });
  const target = fakeCanvas(512, 512), pieces = [piece('bottom', { x: 100 }), piece('selected', { x: 220 }), piece('top', { x: 340 })];
  renderer.render(target, pieces, { selectedId: 'selected', dragging: true });
  assert.equal(renderer.metrics.dragCacheBuilds, 1);
  renderer.render(target, [{ ...pieces[0] }, { ...pieces[1], x: 260, rotation: 25 }, { ...pieces[2] }], { selectedId: 'selected', dragging: true });
  assert.equal(renderer.metrics.dragCacheBuilds, 1, 'moving the selected piece reuses the two surrounding composites');
  assert.ok(renderer.metrics.dragCacheHits >= 1);
  // The selected outline is rendered after the three painter-order draws.
  const drawImages = target.context.ops.filter(op => op[0] === 'drawImage');
  assert.ok(drawImages.length >= 6, 'under, selected and above are each composited');
  assert.ok(target.context.ops.some(op => op[0] === 'setLineDash'));
});

test('renderer skips pieces above its bounded render budget and preserves opacity/transform calls', () => {
  const renderer = new CollageRenderer({ width: 512, height: 512, createCanvas: fakeCanvas });
  const target = fakeCanvas(512, 512), pieces = Array.from({ length: COLLAGE_RENDERER_MAX_PIECES + 3 }, (_, index) => piece(`piece-${index}`, { x: index, y: index, opacity: .5 }));
  renderer.render(target, pieces, { showSelection: false });
  assert.equal(renderer.metrics.skippedPieces, 3);
  assert.equal(target.context.ops.filter(op => op[0] === 'drawImage').length, 1, 'the target receives one cached scene composite');
  assert.equal(renderer.sceneCache.canvas.context.ops.filter(op => op[0] === 'drawImage').length, COLLAGE_RENDERER_MAX_PIECES);
  // All pieces intentionally share one source geometry, so only one clipped
  // raster is needed; transforms are applied with drawImage for every item.
  assert.equal(renderer.metrics.rasterMisses, 1);
  const scales = renderer.sceneCache.canvas.context.ops.filter(op => op[0] === 'scale');
  assert.equal(scales.length, COLLAGE_RENDERER_MAX_PIECES);
  assert.equal(renderer.metrics.rasterPixels <= 24_000_000, true);
});

test('destroy releases caches and rejects accidental reuse', () => {
  const renderer = new CollageRenderer({ createCanvas: fakeCanvas });
  renderer.render(fakeCanvas(512, 512), [piece('one')]);
  renderer.destroy();
  assert.throws(() => renderer.toCanvas([]), /已经释放/);
  assert.equal(renderer.rasterCache.size, 0);
  assert.equal(renderer.textureCache.size, 0);
});
