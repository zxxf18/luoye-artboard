import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scratchStyle, paintScratchBase, paintScratchCover } from '../src/core/engine.js';
import { legacyBrushSegment } from '../src/core/brushes-legacy.js';
import { validateProject } from '../src/core/core.js';

const root = new URL('../', import.meta.url);
const tinyPNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS5kAAAAASUVORK5CYII=';

test('刮刮画样式有稳定的覆盖层与刮笔颜色默认值', () => {
  assert.deepEqual(scratchStyle({}), {
    color: '#c99559', secondaryColor: '#f0d49f', baseMode: 'solid',
    baseColor: '#fffdf8', baseSecondaryColor: '',
  });
  assert.equal(scratchStyle({ baseMode: 'rainbow' }).baseMode, 'rainbow');
});

test('刮笔使用 destination-out，拖动会真正擦开覆盖层', () => {
  const calls = [];
  const ctx = {
    save() { calls.push('save'); }, restore() { calls.push('restore'); },
    beginPath() { calls.push('beginPath'); }, arc() { calls.push('arc'); }, fill() { calls.push('fill'); },
    moveTo() {}, lineTo() {}, stroke() { calls.push('stroke'); }, fillRect() {},
    globalCompositeOperation: 'source-over', globalAlpha: 1,
  };
  legacyBrushSegment(ctx, { layer: { scale: 1 }, options: { tool: 'scratch', size: 24, opacity: 1 } }, { x: 10, y: 10 }, { x: 30, y: 10 });
  assert.equal(ctx.globalCompositeOperation, 'destination-out');
  assert.ok(calls.includes('stroke') || calls.includes('fill'));
});

test('刮刮画底色和覆盖层绘制使用传入样式', () => {
  const fills = [];
  const ctx = {
    fillStyle: '', fillRect(x, y, width, height) { fills.push({ style: this.fillStyle, width, height }); },
    createLinearGradient() { return { addColorStop() {}, toString() { return 'gradient'; } }; },
  };
  paintScratchBase(ctx, 20, 10, { baseColor: '#123456' });
  paintScratchCover(ctx, 20, 10, { color: '#654321', secondaryColor: '' });
  assert.equal(fills.length, 2);
  assert.equal(fills[0].style, '#123456');
  assert.equal(fills[1].style, '#654321');
});

test('工程 schema 接受可保存的 scratch 与 scratch-base 图层', () => {
  const project = {
    format: 'luoye-studio', version: 1, width: 1, height: 1, title: '刮刮画',
    layers: [
      { id: 'base', name: '刮刮画底色', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, role: 'scratch-base', image: tinyPNG },
      { id: 'cover', name: '刮刮画', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, role: 'scratch', scratchStyle: scratchStyle({}), image: tinyPNG },
    ],
  };
  assert.doesNotThrow(() => validateProject(project));
});

test('刮刮画位于第二页，左侧与参数区文案固定', () => {
  const classic = readFileSync(new URL('src/ui/classic-ui.js', root), 'utf8')
    + readFileSync(new URL('src/ui/classic-scratch.js', root), 'utf8');
  const app = readFileSync(new URL('src/platform/app.js', root), 'utf8');
  assert.match(classic, /\['scratch','刮刮画'\]/);
  assert.match(classic, /我的刮刮画/);
  assert.match(classic, /重新覆盖/);
  assert.match(classic, /覆盖层颜色/);
  assert.match(classic, /刮笔颜色/);
  assert.match(classic, /粗细/);
  assert.match(app, /prepareScratchCard/);
  assert.match(app, /resetScratchCard/);
});

// —— 去掉刮刮画：整体移除覆盖层与底色，原作与背景可完整恢复 ——
test('去掉刮刮画一次性移除覆盖层和底色，撤销可整卡找回', async () => {
  const { withCanvasDouble, silenceEngine, CanvasDouble } = await import('./helpers/canvas-double.js');
  await withCanvasDouble(async () => {
    const { DrawingEngine } = await import('../src/core/drawing.js');
    const engine = new DrawingEngine(new CanvasDouble(8, 8), () => {});
    silenceEngine(engine);
    const artwork = engine.active;
    engine.createScratchCard();
    assert.deepEqual(engine.layers.map(layer => layer.role), ['scratch-base', undefined, 'scratch'], '建卡后应为 底色/画笔/覆盖层 三层（底色垫在画作下）');
    assert.ok(engine.layers.includes(artwork), '原画笔图层对象应保持不变');
    assert.equal(engine.removeScratchCard(), true);
    assert.deepEqual(engine.layers.map(layer => layer.role), [undefined], '去掉后应只剩原画笔层');
    assert.ok(engine.layers.includes(artwork), '原画作完好保留');
    engine.undo();
    assert.deepEqual(engine.layers.map(layer => layer.role), ['scratch-base', undefined, 'scratch'], '撤销应整卡找回（含刮痕）');
    engine.redo();
    assert.deepEqual(engine.layers.map(layer => layer.role), [undefined]);
    assert.equal(engine.removeScratchCard(), false, '没有刮刮画时再次移除应无效果');
  });
});

test('去掉刮刮画的入口与提示文案已接线', () => {
  const classic = readFileSync(new URL('src/ui/classic-ui.js', root), 'utf8');
  const app = readFileSync(new URL('src/platform/app.js', root), 'utf8');
  assert.match(classic, /去掉刮刮画/);
  assert.match(classic, /scratch-remove/);
  assert.match(app, /scratch-remove/);
  assert.match(app, /removeScratchCard/);
  // 第一次盖卡时给孩子一句说明，去掉后也有一句恢复提示。
  assert.match(app, /盖上一层刮刮画/);
  assert.match(app, /刮刮画已去掉/);
});
