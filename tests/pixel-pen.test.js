import test from 'node:test';
import assert from 'node:assert/strict';
import { BRUSHES, PIXEL_PEN_SIZES, brushSegment, snapPixelPenSize } from '../src/core/brushes.js';
import { History } from '../src/core/core.js';
import { DrawingEngine } from '../src/core/drawing.js';
import { EditorEngine } from '../src/core/editor.js';

function pixelPenPath(points, { width = 16, height = 16, size = 4 } = {}) {
  const fills = [];
  const ctx = {
    save() {},
    restore() {},
    fillRect(...rect) { fills.push([...rect, this.fillStyle, this.globalAlpha]); },
  };
  const gesture = { layer: { width, height, scale: 1 }, options: { tool: 'pen', brush: 'pixel-pen', size, color: '#36985c', opacity: .5 } };
  for (let i = 0; i < points.length; i++) brushSegment(ctx, gesture, points[i - 1] ?? points[i], points[i]);
  return fills;
}

test('pixel pen is a regular brush with ten discrete sizes and a 16px default', () => {
  assert.equal(BRUSHES.find(brush => brush.id === 'pixel-pen').size, 16);
  assert.deepEqual(PIXEL_PEN_SIZES, [1, 4, 8, 12, 16, 24, 32, 48, 64, 96]);
  assert.equal(snapPixelPenSize(22), 24);
  assert.equal(snapPixelPenSize(5), 4);
  assert.equal(snapPixelPenSize(0), 1);
  assert.equal(snapPixelPenSize(320), 96);
  assert.equal(snapPixelPenSize(NaN), 16);
});

test('old pixel pen recordings retain their retired cell sizes', () => {
  for (const size of [2, 6]) {
    assert.deepEqual(pixelPenPath([{ x: 7, y: 7 }], { size }), [
      [6, 6, size, size, '#36985c', .5],
    ]);
  }
});

test('pixel pen fills an entire fast diagonal with one deposit per cell at any sample density', () => {
  const start = { x: 1, y: 11 }, end = { x: 11, y: 1 };
  const sparse = pixelPenPath([start, end]);
  const dense = pixelPenPath([start, { x: 4, y: 8 }, { x: 8, y: 4 }, end, start, end]);
  assert.deepEqual(dense, sparse);
  assert.deepEqual(dense, [
    [0, 8, 4, 4, '#36985c', .5],
    [4, 4, 4, 4, '#36985c', .5],
    [8, 0, 4, 4, '#36985c', .5],
  ]);
});

test('pixel pen clips long outside segments and partial cells at the paper edge', () => {
  assert.deepEqual(pixelPenPath([{ x: -100000, y: 5 }, { x: 100000, y: 5 }], { width: 10, height: 7 }), [
    [0, 4, 4, 3, '#36985c', .5],
    [4, 4, 4, 3, '#36985c', .5],
    [8, 4, 2, 3, '#36985c', .5],
  ]);
  assert.deepEqual(pixelPenPath([{ x: -100000, y: 7 }, { x: 100000, y: 7 }], { width: 10, height: 7 }), []);
});

function pixelPenEngine(width, height) {
  const pixels = new Uint8Array(width * height);
  const ctx = {
    save() {},
    restore() {},
    fillRect(x, y, w, h) {
      for (let row = 0; row < h; row++) pixels.fill(1, (y + row) * width + x, (y + row) * width + x + w);
    },
    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row++)
        for (let col = 0; col < w; col++) data[(row * w + col) * 4] = pixels[(y + row) * width + x + col];
      return { data, width: w, height: h };
    },
    putImageData({ data, width: w, height: h }, x, y) {
      for (let row = 0; row < h; row++)
        for (let col = 0; col < w; col++) pixels[(y + row) * width + x + col] = data[(row * w + col) * 4];
    },
  };
  const layer = {
    id: 'paper', width, height, x: width / 2, y: height / 2, rotation: 0, scale: 1, visible: true,
    canvas: { width, height, getContext: () => ctx },
  };
  const engine = Object.assign(Object.create(DrawingEngine.prototype), {
    width, height, layers: [layer], activeId: layer.id, metrics: {}, history: new History(),
    render() {}, changed() {}, operations: { record() {} },
  });
  return { engine, pixels, layer };
}

test('a long one-pixel stroke captures only crossed undo tiles and redoes the original raster', () => {
  const { engine, pixels } = pixelPenEngine(300, 300);
  engine.begin({ x: 1, y: 1 }, { tool: 'pen', brush: 'pixel-pen', size: 1, color: '#010203', opacity: 1 });
  engine.update({ x: 290.1, y: 290.1 });
  assert.equal(engine.gesture.tiles.size, 3);
  engine.end();
  assert.equal(pixels.filter(Boolean).length, 290);
  const painted = pixels.slice();
  engine.history.undo();
  assert.ok(!pixels.some(Boolean));
  engine.history.redo();
  assert.deepEqual(pixels, painted);
});

test('radial pixel pen copies are quantized in the paper grid and never use paper textures', () => {
  const { engine, pixels, layer } = pixelPenEngine(100, 84);
  const fills = [], ctx = layer.canvas.getContext('2d'), fillRect = ctx.fillRect.bind(ctx);
  ctx.fillRect = (...bounds) => { fills.push(bounds); fillRect(...bounds); };
  engine.paperTexture = {};
  engine.paintTexture = {};
  engine.begin({ x: 66, y: 42 }, {
    tool: 'pen', brush: 'pixel-pen', size: 4, color: '#010203', opacity: 1,
    fillSource: 'texture', paperGrain: 'grain', assist: { enabled: true, mode: 'radial', axes: 3 },
  });
  engine.end();
  assert.deepEqual(fills, [[64, 40, 4, 4], [40, 52, 4, 4], [40, 28, 4, 4]]);
  assert.equal(pixels.filter(Boolean).length, 48);
});

test('pixel pen masks the touched part of a selection without clearing earlier in-stroke paint', () => {
  const { engine, pixels } = pixelPenEngine(30, 20);
  pixels[1] = 2;
  engine.selection = new Uint8ClampedArray(pixels.length);
  for (const row of [2, 3]) engine.selection.fill(255, row * 30 + 2, row * 30 + 7);
  engine.begin({ x: 1, y: 1 }, { tool: 'pen', brush: 'pixel-pen', size: 4, color: '#010203', opacity: 1 });
  engine.update({ x: 8.5, y: 1 });
  engine.update({ x: 8.5, y: 8.5 });
  assert.equal(pixels[1], 2, 'ink outside the current selection survives the stroke');
  assert.deepEqual(Array.from(pixels.entries()).filter(([, value]) => value === 1).map(([index]) => index),
    [62, 63, 64, 65, 66, 92, 93, 94, 95, 96]);
  engine.end(true);
  assert.equal(pixels.filter(Boolean).length, 1);
  assert.equal(pixels[1], 2);
});

test('a straight pixel pen preview matches the committed stroke at a clipped endpoint', t => {
  const { engine, pixels } = pixelPenEngine(21, 17);
  const documentBefore = globalThis.document;
  t.after(() => { globalThis.document = documentBefore; });
  globalThis.document = {
    createElement() {
      const fills = [], ctx = {
        save() {}, restore() {}, translate() {}, setTransform() {}, clearRect() {}, drawImage() {},
        fillRect(...bounds) { fills.push(bounds); },
      };
      return { fills, getContext: () => ctx };
    },
  };
  t.mock.method(EditorEngine.prototype, 'paint', function () {});
  engine.begin({ x: 13, y: 5 }, { tool: 'pen', brush: 'pixel-pen', strokeMode: 'line', size: 4, color: '#010203', opacity: 1 });
  engine.update({ x: 30, y: 5 });
  engine.paint({}, true);
  const preview = engine.gesture.previewStroke.fills;
  assert.deepEqual(preview, [[12, 4, 4, 4], [16, 4, 4, 4], [20, 4, 1, 4]]);
  engine.end();
  const expected = new Uint8Array(pixels.length);
  for (const [x, y, width, height] of preview)
    for (let row = y; row < y + height; row++) expected.fill(1, row * 21 + x, row * 21 + x + width);
  assert.deepEqual(pixels, expected);
});
