import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingEngine } from '../src/drawing.js';

// These tests exercise the drawing integration without relying on a native
// canvas implementation. The context records the transform at which each
// stamp or material stroke is painted, which makes misplaced mirrored copies
// and accidental extra copies deterministic to detect.
function makeSpyCanvas(width, height) {
  const calls = [];
  const state = { x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0 };
  const ctx = {
    calls,
    save() { calls.push({ type: 'save' }); },
    restore() { calls.push({ type: 'restore' }); },
    translate(x, y) { state.x = x; state.y = y; calls.push({ type: 'translate', x, y }); },
    scale(x, y) { state.scaleX *= x; state.scaleY *= y; calls.push({ type: 'scale', x, y }); },
    rotate(angle) { state.angle += angle; calls.push({ type: 'rotate', angle }); },
    drawImage(...args) { calls.push({ type: 'drawImage', args, transform: { ...state } }); },
    clearRect() {},
    setTransform() {},
    beginPath() {},
    arc() {},
    clip() {},
    putImageData() {},
    getImageData() { return { data: new Uint8ClampedArray(width * height * 4) }; },
  };
  return { width, height, ctx, getContext: () => ctx };
}

function makeStampEngine(config) {
  const layer = makeSpyCanvas(100, 80);
  Object.assign(layer, { id: 'layer', x: 50, y: 40, scale: 1, rotation: 0, flipX: false, flipY: false });
  layer.canvas = layer;
  const engine = Object.create(DrawingEngine.prototype);
  Object.assign(engine, {
    width: 100,
    height: 80,
    paperMode: false,
    layers: [layer],
    activeId: layer.id,
    stampImages: [{ width: 8, height: 4 }],
    fairyMode: 'static',
    fairyStampIndex: 0,
    assistConfig: config,
    gesture: { kind: 'stamp', layer, options: { tool: 'stamp', size: 8, opacity: 1, assist: config }, tiles: new Map(), stampIndex: 0 },
  });
  engine.captureTiles = () => {};
  engine.layerMask = () => null;
  engine.maskTiles = () => {};
  engine.render = () => {};
  return { engine, layer };
}

function drawImageRecords(layer) {
  return layer.ctx.calls.filter(call => call.type === 'drawImage');
}

function positions(layer) {
  return drawImageRecords(layer).map(call => [call.transform.x, call.transform.y]);
}

const previousDocument = globalThis.document;
before(() => {
  globalThis.document = { createElement: () => makeSpyCanvas(1, 1) };
});
after(() => {
  globalThis.document = previousDocument;
});

test('static stamp assist keeps the source position and mirrors it around the canvas center', () => {
  const vertical = makeStampEngine({ enabled: true, mode: 'vertical', centerX: 50, centerY: 40, stamp: true });
  DrawingEngine.prototype.specialDab.call(vertical.engine, { x: 20, y: 30 });
  assert.deepEqual(positions(vertical.layer), [[20, 30], [80, 30]]);

  const horizontal = makeStampEngine({ enabled: true, mode: 'horizontal', centerX: 50, centerY: 40, stamp: true });
  DrawingEngine.prototype.specialDab.call(horizontal.engine, { x: 20, y: 30 });
  assert.deepEqual(positions(horizontal.layer), [[20, 30], [20, 50]]);
});

test('four-way and radial stamp assist produce unique, centered positions', () => {
  const four = makeStampEngine({ enabled: true, mode: 'four', centerX: 50, centerY: 40, stamp: true });
  DrawingEngine.prototype.specialDab.call(four.engine, { x: 20, y: 30 });
  assert.deepEqual(positions(four.layer), [[20, 30], [80, 30], [20, 50], [80, 50]]);

  const radial = makeStampEngine({ enabled: true, mode: 'radial', axes: 4, centerX: 50, centerY: 40, stamp: true });
  DrawingEngine.prototype.specialDab.call(radial.engine, { x: 60, y: 40 });
  assert.deepEqual(positions(radial.layer), [[60, 40], [50, 50], [40, 40], [50, 30]]);
  const angles = drawImageRecords(radial.layer).map(call => (call.transform.angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
  assert.deepEqual(angles, [0, Math.PI / 2, Math.PI, Math.PI * 1.5]);

  const center = makeStampEngine({ enabled: true, mode: 'radial', axes: 16, centerX: 50, centerY: 40, stamp: true });
  DrawingEngine.prototype.specialDab.call(center.engine, { x: 50, y: 40 });
  assert.equal(drawImageRecords(center.layer).length, 1, '中心点不能重复盖章');
});

test('stamp assist is opt-in and dynamic fairy remains a single sprite', () => {
  const disabled = makeStampEngine({ enabled: true, mode: 'vertical', centerX: 50, centerY: 40, stamp: false });
  DrawingEngine.prototype.specialDab.call(disabled.engine, { x: 20, y: 30 });
  assert.deepEqual(positions(disabled.layer), [[20, 30]]);

  const dynamic = makeStampEngine({ enabled: true, mode: 'four', centerX: 50, centerY: 40, stamp: true });
  const group = { frames: [{ width: 8, height: 4 }], frameDuration: 160 };
  const spriteLayer = Object.assign(makeSpyCanvas(100, 80), { id: 'sprite-layer', x: 50, y: 40, scale: 1, rotation: 0, flipX: false, flipY: false, sprites: [], spriteGroups: [] });
  Object.assign(dynamic.engine, {
    fairyGroups: [group], fairyMode: 'dynamic', layers: [spriteLayer], activeId: spriteLayer.id,
    playing: false, animationTime: 0, animationStart: 0, stampName: '动态魔法袋',
    gesture: { kind: 'fairy-dynamic', options: { tool: 'stamp', size: 8, opacity: 1, stampSpacing: .7 }, stampIndex: 0 },
  });
  dynamic.engine.assertSceneCapacity = () => {};
  dynamic.engine.addLayer = () => spriteLayer;
  DrawingEngine.prototype.dynamicDab.call(dynamic.engine, { x: 20, y: 30 });
  assert.equal(spriteLayer.sprites.length, 1);
  assert.deepEqual([spriteLayer.sprites[0].x, spriteLayer.sprites[0].y], [20, 30]);
});

test('assist geometry maps world center through a transformed layer before painting', () => {
  const engine = makeStampEngine({ enabled: true, mode: 'vertical', centerX: 60, centerY: 40, stamp: true }).engine;
  engine.active.scale = 2;
  engine.active.x = 50;
  engine.active.y = 40;
  const geometry = engine.assistGeometry(engine.gesture.options, engine.active);
  assert.deepEqual(geometry.center, { x: 55, y: 40 });
});
