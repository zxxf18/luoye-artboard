import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DrawingEngine } from '../src/drawing.js';
import { History, validateProject } from '../src/core.js';
import { validateRecording } from '../src/recording.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS5kAAAAASUVORK5CYII=';

function context(width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  return {
    pixels, globalAlpha: 1, globalCompositeOperation: 'source-over',
    save() {}, restore() {}, setTransform() {}, translate() {}, rotate() {}, scale() {},
    clearRect() { pixels.fill(0); }, fillRect() { for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255; },
    beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {},
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }; },
    putImageData() {}, drawImage() {},
  };
}
function canvas(width, height) {
  const ctx = context(width, height);
  return {
    width, height, getContext: () => ctx,
    toBlob(callback) { callback(new Blob([Buffer.from(png.slice(22), 'base64')], { type: 'image/png' })); },
  };
}

const previousDocument = globalThis.document;
const previousFileReader = globalThis.FileReader;
before(() => {
  globalThis.document = { createElement: () => canvas(1, 1) };
  globalThis.FileReader = class {
    readAsDataURL(blob) { blob.arrayBuffer().then(bytes => { this.result = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`; this.onload?.(); }); }
  };
});
after(() => { globalThis.document = previousDocument; globalThis.FileReader = previousFileReader; });

function engine() {
  const value = Object.create(DrawingEngine.prototype);
  Object.assign(value, {
    width: 64, height: 48, layers: [], activeId: '', history: new History(), playing: false,
    animationTime: 0, changed() {}, render() {}, onChange() {},
  });
  return value;
}

test('scratch cards are represented by a validated persistent layer role', () => {
  const layer = { id: 'scratch', name: '刮刮画', role: 'scratch', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, image: png };
  const project = { format: 'luoye-studio', version: 1, width: 1, height: 1, title: '刮刮画', layers: [layer] };
  assert.equal(validateProject(project).layers[0].role, 'scratch');
  assert.throws(() => validateProject({ ...project, layers: [{ ...layer, role: 'scratch-card' }] }), /图层类型/);
});

test('scratch role is included in saved project metadata', async () => {
  const value = engine(); value.width = 1; value.height = 1;
  value.createScratchCard({ color: '#123456', baseMode: 'rainbow', baseColor: '#123456', pattern: 'dots', patternSpacing: 24 });
  const saved = await value.serialize('刮刮画作品');
  const cover = saved.layers.find(layer => layer.role === 'scratch');
  assert.equal(cover.scratchStyle.pattern, 'dots');
  assert.equal(cover.scratchStyle.patternSpacing, 24);
  assert.equal(cover.scratchStyle.baseMode, 'rainbow');
  assert.equal(saved.layers.find(layer => layer.role === 'scratch-base')?.sourceId, 'scratch-base');
});

test('scratch style validates rainbow reveal metadata and scratch base role', () => {
  const base = { id: 'base', name: '底色', role: 'scratch-base', sourceId: 'scratch-base', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, image: png };
  const cover = { ...base, id: 'cover', name: '覆盖层', role: 'scratch', sourceId: undefined,
    scratchStyle: { baseMode: 'rainbow', baseColor: '#ff6b6b', baseSecondaryColor: '#67c5e8', color: '#9faeba', secondaryColor: '#dec8a9' } };
  assert.equal(validateProject({ format: 'luoye-studio', version: 1, width: 1, height: 1, title: 'x', layers: [base, cover] }).layers[1].scratchStyle.baseMode, 'rainbow');
  assert.throws(() => validateProject({ format: 'luoye-studio', version: 1, width: 1, height: 1, title: 'x', layers: [{ ...cover, scratchStyle: { baseMode: 'neon' } }, base] }), /底色模式/);
});

test('scratch style changes repaint base and cover once and are undoable', () => {
  const value = engine(), cover = value.prepareScratchCard();
  const base = value.layers.find(layer => layer.role === 'scratch-base');
  const originalCover = cover.canvas, originalBase = base.canvas;
  value.setScratchStyle({ baseMode: 'rainbow', color: '#23395d', secondaryColor: '#f4b860' });
  assert.equal(cover.scratchStyle.baseMode, 'rainbow');
  assert.notEqual(cover.canvas, originalCover); assert.notEqual(base.canvas, originalBase);
  value.undo(); assert.equal(cover.canvas, originalCover); assert.equal(base.canvas, originalBase);
  value.redo(); assert.equal(cover.scratchStyle.color, '#23395d');
});

test('empty secondary colours stay solid for custom palettes', () => {
  const value = engine(); value.width = 1; value.height = 1; const cover = value.prepareScratchCard();
  value.setScratchStyle({ baseMode: 'solid', baseColor: '#fefefe', baseSecondaryColor: '', color: '#ff80ab', secondaryColor: '' });
  assert.equal(cover.scratchStyle.baseSecondaryColor, '');
  assert.equal(cover.scratchStyle.secondaryColor, '');
  const saved = value.serialize('自选颜色');
  return saved.then(project => {
    const restored = project.layers.find(layer => layer.role === 'scratch').scratchStyle;
    assert.equal(restored.baseSecondaryColor, '');
    assert.equal(restored.secondaryColor, '');
  });
});

test('scratch setup and reset are valid recording commands', () => {
  const base = { format: 'luoye-studio', version: 1, width: 1, height: 1, title: '刮刮画', layers: [{ id: 'base', name: '画稿', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, image: png }] };
  const recording = { format: 'luoye-recording', version: 1, slots: [{ base, events: [
    { method: 'prepareScratchCard', args: [], activeId: 'base', time: 0, resultId: 'scratch' },
    { method: 'resetScratchCard', args: [], activeId: 'scratch', time: 1 },
  ] }, null, null, null, null] };
  assert.doesNotThrow(() => validateRecording(recording));
});

test('recording accepts scratch cover metadata when it is created', () => {
  const base = { format: 'luoye-studio', version: 1, width: 1, height: 1, title: '刮刮画', layers: [{ id: 'base', name: '画稿', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, image: png }] };
  const recording = { format: 'luoye-recording', version: 1, slots: [{ base, events: [
    { method: 'addLayer', args: ['刮刮画', { width: 1, height: 1, image: png }, true, { role: 'scratch', scratchStyle: { color: '#a7b2bd', pattern: 'none', patternSpacing: 32 } }], activeId: 'base', time: 0, resultId: 'scratch' },
  ] }, null, null, null, null] };
  assert.doesNotThrow(() => validateRecording(recording));
});

test('recording accepts scratch style changes', () => {
  const base = { format: 'luoye-studio', version: 1, width: 1, height: 1, title: '刮刮画', layers: [{ id: 'base', name: '画稿', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, image: png }] };
  const recording = { format: 'luoye-recording', version: 1, slots: [{ base, events: [
    { method: 'setScratchStyle', args: [{ baseMode: 'rainbow', color: '#7b61ff', secondaryColor: '' }], activeId: 'base', time: 0 },
  ] }, null, null, null, null] };
  assert.doesNotThrow(() => validateRecording(recording));
  assert.throws(() => validateRecording({ ...recording, slots: [{ ...recording.slots[0], events: [{ ...recording.slots[0].events[0], args: [{ baseMode: 'neon' }] }] }, null, null, null, null] }), /底色模式/);
});

test('prepare creates one cover and repeated selection reuses it', () => {
  const value = engine();
  const first = value.prepareScratchCard();
  assert.equal(first.role, 'scratch');
  assert.equal(value.layers.filter(layer => layer.role === 'scratch').length, 1);
  const second = value.prepareScratchCard();
  assert.equal(second, first);
  assert.equal(value.layers.filter(layer => layer.role === 'scratch').length, 1);
});

test('secret artwork stays below the scratch cover when switching back to a brush', () => {
  const value = engine();
  const artwork = value.addLayer('秘密画稿', canvas(64, 48), false);
  const cover = value.prepareScratchCard();
  value.activeId = cover.id;
  const hidden = value.ensureDrawingLayer();
  assert.equal(value.layers.indexOf(hidden), value.layers.indexOf(cover) - 1);
  assert.equal(value.layers.at(-1), cover);
  value.activeId = artwork.id;
  assert.equal(value.ensureDrawingLayer(), artwork, '覆盖层下的普通画稿可以复用');
});

test('scratch strokes are undoable, cancellable, and resettable', () => {
  const value = engine();
  const layer = value.prepareScratchCard();
  value.begin({ x: 10, y: 10 }, { tool: 'scratch', brush: 'pencil', size: 8, opacity: 1, color: '#000000' });
  value.update({ x: 30, y: 10 });
  value.end();
  assert.equal(value.history.past.length, 2, '创建覆盖层和刮擦各有一条历史');
  assert.ok(layer.scratchDirtyTiles.size > 0, '刮擦记录脏区域');
  value.undo();
  assert.equal(layer.scratchDirtyTiles.size, 0, '撤销刮擦恢复脏区域状态');
  value.redo();
  assert.ok(layer.scratchDirtyTiles.size > 0, '重做刮擦恢复脏区域状态');
  value.undo();
  value.begin({ x: 10, y: 10 }, { tool: 'scratch', brush: 'pencil', size: 8, opacity: 1, color: '#000000' });
  value.end(true);
  assert.equal(value.history.past.length, 1, '取消刮擦不会新增历史');
  const historyBeforeNoopReset = value.history.past.length;
  value.resetScratchCard();
  assert.equal(value.active, layer);
  assert.equal(value.history.past.length, historyBeforeNoopReset, '未刮开时重新盖住不新增历史');
});

test('reset snapshots only revealed scratch tiles and remains undoable', () => {
  const value = engine(), layer = value.prepareScratchCard();
  value.begin({ x: 8, y: 8 }, { tool: 'scratch', brush: 'pencil', size: 8, opacity: 1, color: '#000000' });
  value.update({ x: 56, y: 8 }); value.end();
  const beforeReset = value.history.past.length;
  value.resetScratchCard();
  assert.equal(value.history.past.length, beforeReset + 1);
  assert.equal(layer.scratchDirtyTiles.size, 0);
  value.undo(); assert.ok(layer.scratchDirtyTiles.size > 0, '撤销重新盖住恢复已刮区域');
  value.redo(); assert.equal(layer.scratchDirtyTiles.size, 0, '重做重新盖住清空已刮区域');
  assert.ok(value.history.pastBytes < 96 * 1024 * 1024, '重置历史按脏区域计费');
});
