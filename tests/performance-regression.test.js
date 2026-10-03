import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingEngine } from '../src/drawing.js';
import { History } from '../src/core.js';

/*
 * These tests deliberately use a small canvas shim instead of a browser.  The
 * shim records readbacks and lets the real drawing engine execute its hot
 * paths, which makes the budgets repeatable on CI and on native WebViews.
 * Browser acceptance scripts still exercise the actual Canvas implementation.
 */
function fakeContext(width, height) {
  const stats = { reads: 0, writes: 0, draws: 0, gradients: 0 };
  const image = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
  return {
    stats,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save() {}, restore() {}, setTransform() {}, translate() {}, rotate() {}, scale() {},
    clearRect() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, rect() {}, setLineDash() {},
    createLinearGradient() { stats.gradients++; return { addColorStop() {} }; },
    createRadialGradient() { stats.gradients++; return { addColorStop() {} }; },
    createPattern() { return {}; },
    getImageData(_x, _y, w, h) { stats.reads++; return image(Math.max(1, w), Math.max(1, h)); },
    putImageData() { stats.writes++; },
    createImageData(w, h) { return image(w, h); },
    drawImage() { stats.draws++; },
  };
}

function fakeCanvas(width, height) {
  const context = fakeContext(width, height);
  return { width, height, context, getContext: () => context, toDataURL: () => 'data:image/png;base64,' };
}

const previousDocument = globalThis.document;
const previousImageData = globalThis.ImageData;
before(() => {
  globalThis.document = { createElement: () => fakeCanvas(1, 1) };
  // EditorEngine uses ImageData for fill operations.  Keeping this shim here
  // avoids making the benchmark depend on a DOM implementation.
  globalThis.ImageData = class ImageData {
    constructor(data, width, height = Math.floor(data.length / 4 / width)) {
      this.data = data; this.width = width; this.height = height;
    }
  };
});
after(() => {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousImageData === undefined) delete globalThis.ImageData; else globalThis.ImageData = previousImageData;
});

function makeEngine(width = 1920, height = 1080) {
  const canvas = fakeCanvas(width, height);
  const value = Object.create(DrawingEngine.prototype);
  Object.assign(value, {
    canvas, ctx: canvas.context, width, height, layers: [], activeId: '', history: new History(),
    playing: false, animationTime: 0, gesture: null, drawQueued: false,
    paperMode: false, paintTexture: null, paperTexture: null,
    compositeSurfaces: new WeakMap(), metrics: { frames: 0, submissionMs: 0, maxSubmissionMs: 0, staticCacheHits: 0, gestureCacheBuilds: 0, gestureCacheHits: 0 },
    render() {}, changed() {}, onChange() {},
  });
  value.addLayer('我的画笔', fakeCanvas(width, height), false);
  return value;
}

const penOptions = (extra = {}) => ({
  tool: 'pen', brush: 'pencil', brushVersion: 2, size: 22, opacity: 1,
  color: '#285b49', secondaryColor: '#ef8572', seed: 42, ...extra,
});

test('large 1920×1080 projects keep layer capacity bounded before edits', () => {
  const value = makeEngine();
  for (let i = 0; i < 20; i++) value.addLayer(`图层 ${i}`, fakeCanvas(value.width, value.height), false);
  assert.equal(value.layers.length, 21);
  assert.throws(() => value.addLayer('超出预算', fakeCanvas(value.width, value.height), false), /内存预算/);
  assert.ok(value.scenePixels() <= 90_000_000);
});

test('continuous strokes snapshot only touched 128px tiles and keep one history item', () => {
  const value = makeEngine();
  const layer = value.active, beforeReads = layer.canvas.context.stats.reads;
  value.begin({ x: 80, y: 120 }, penOptions());
  for (let i = 1; i <= 240; i++) {
    const t = i / 240;
    value.update({ x: 80 + t * 1760, y: 120 + Math.sin(t * Math.PI * 3) * 250 });
  }
  value.end();
  const reads = layer.canvas.context.stats.reads - beforeReads;
  const touched = Math.ceil(value.width / 128) * Math.ceil(value.height / 128);
  assert.equal(value.history.past.length, 1);
  assert.ok(reads <= touched * 2, `read back ${reads} tiles for at most ${touched}`);
  assert.ok(value.history.pastBytes <= touched * 128 * 128 * 8);
  value.undo(); value.redo();
  assert.equal(value.history.past.length, 1, 'undo/redo does not duplicate stroke history');
});

test('textured strokes avoid a full-canvas readback on every pointer sample', () => {
  const value = makeEngine(1024, 768), layer = value.active;
  const texture = fakeCanvas(32, 32);
  value.setPaintTexture(texture);
  value.setPaperTexture(texture);
  const beforeReads = layer.canvas.context.stats.reads;
  value.begin({ x: 40, y: 80 }, penOptions({ fillSource: 'texture', paperGrain: .7, size: 48 }));
  for (let i = 1; i <= 180; i++) {
    const t = i / 180;
    value.update({ x: 40 + t * 940, y: 80 + t * 500 });
  }
  value.end();
  const reads = layer.canvas.context.stats.reads - beforeReads;
  const tileCount = Math.ceil(value.width / 128) * Math.ceil(value.height / 128);
  assert.ok(reads <= tileCount * 2, `texture path read back ${reads} times for ${tileCount} tiles`);
  assert.ok(value.history.pastBytes < value.width * value.height * 8, 'texture stroke history stays tile sized');
});

test('scratch reveal, reset, undo and redo stay within the dirty-tile budget', () => {
  const value = makeEngine(1600, 900);
  const cover = value.prepareScratchCard();
  value.begin({ x: 60, y: 80 }, penOptions({ tool: 'scratch', size: 64 }));
  for (let i = 1; i <= 80; i++) value.update({ x: 60 + i * 18, y: 80 + i * 6 });
  value.end();
  const dirty = cover.scratchDirtyTiles.size;
  assert.ok(dirty > 0 && dirty < 200, `expected bounded dirty tiles, got ${dirty}`);
  const beforeResetBytes = value.history.pastBytes;
  value.resetScratchCard();
  assert.equal(cover.scratchDirtyTiles.size, 0);
  assert.ok(value.history.pastBytes - beforeResetBytes < dirty * 128 * 128 * 8);
  value.undo(); assert.equal(cover.scratchDirtyTiles.size, dirty);
  value.redo(); assert.equal(cover.scratchDirtyTiles.size, 0);
});

test('scratch history records new tile keys without iterating the full dirty set', () => {
  class NoScanSet extends Set {
    constructor(values = []) { super(); for (const value of values) Set.prototype.add.call(this, value); }
    [Symbol.iterator]() { throw new Error('scratch dirty set was copied in full'); }
  }
  const value = makeEngine(1024, 768), cover = value.prepareScratchCard();
  const existing = new NoScanSet(Array.from({ length: 5000 }, (_, index) => `old:${index}`));
  cover.scratchDirtyTiles = existing;
  value.begin({ x: 40, y: 40 }, penOptions({ tool: 'scratch', size: 28 }));
  value.update({ x: 220, y: 80 }); value.end();
  assert.ok(existing.size > 5000);
  value.undo(); assert.equal(existing.size, 5000);
  value.redo(); assert.ok(existing.size > 5000);
});

test('history budget evicts old snapshots while preserving undo/redo correctness', () => {
  const history = new History(4 * 1024 * 1024), state = { value: 0 };
  for (let i = 0; i < 80; i++) {
    const previous = state.value, next = i + 1;
    history.push({ bytes: 128 * 1024, undo: () => { state.value = previous; }, redo: () => { state.value = next; } });
    state.value = next;
  }
  assert.ok(history.pastBytes <= history.budget);
  assert.ok(history.past.length < 80, 'old snapshots are evicted instead of growing without bound');
  const before = state.value; history.undo(); assert.equal(state.value, before - 1); history.redo(); assert.equal(state.value, before);
});
