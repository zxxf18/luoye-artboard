import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FRACTAL_MAX_DEPTH,
  FRACTAL_PRESETS,
  FRACTAL_PRESET_ICONS,
  FRACTAL_SIZE_RANGE,
  fractalPercentToSize,
  fractalSizeToPercent,
  fractalState,
  normalizeFractalDepth,
  placeFractal,
  renderFractalCanvas,
} from '../src/fractal-studio.js';
import { CanvasDouble, withCanvasDouble, silenceEngine } from './helpers/canvas-double.js';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');

test('分形次数限制在 1 到 6，越界值被拒绝', () => {
  assert.equal(normalizeFractalDepth(1), 1);
  assert.equal(normalizeFractalDepth(6), 6);
  assert.equal(normalizeFractalDepth(3.6), 4);
  assert.equal(FRACTAL_MAX_DEPTH, 6);
  for (const bad of [0, 7, -1, Number.NaN, 'x']) assert.throws(() => normalizeFractalDepth(bad), /分形次数/);
});

test('十三种图案都能在正方形画布上完成绘制', async () => {
  await withCanvasDouble(async () => {
    const ids = FRACTAL_PRESETS.map(preset => preset.id);
    assert.equal(ids.length, 13);
    for (const preset of FRACTAL_PRESETS) {
      assert.ok(FRACTAL_PRESET_ICONS[preset.id], preset.id + ' 缺少卡通图标');
      assert.match(FRACTAL_PRESET_ICONS[preset.id], /^</, preset.id + ' 图标应为 SVG 片段');
      const canvas = renderFractalCanvas({ preset: preset.id, size: 200, color: '#285b49', depth: 2 });
      assert.equal(canvas.width, 200);
      assert.equal(canvas.height, 200, '分形画布必须是正方形');
      // 最大次数也要能安全收尾：填色图形按尺寸截断递归，不会失控。
      renderFractalCanvas({ preset: preset.id, size: FRACTAL_SIZE_RANGE.min, color: '#c94f4f', depth: FRACTAL_MAX_DEPTH });
    }
    assert.throws(() => renderFractalCanvas({ preset: 'nope' }), /未知的分形图案/);
  });
});

test('大小滑杆按百分比换算，满格对应加大的上限', () => {
  assert.equal(FRACTAL_SIZE_RANGE.max, 920);
  assert.equal(fractalPercentToSize(0), FRACTAL_SIZE_RANGE.min);
  assert.equal(fractalPercentToSize(100), FRACTAL_SIZE_RANGE.max);
  assert.equal(fractalSizeToPercent(FRACTAL_SIZE_RANGE.max), 100);
  assert.equal(fractalSizeToPercent(FRACTAL_SIZE_RANGE.min), 0);
  for (const size of [FRACTAL_SIZE_RANGE.min, 420, 700, FRACTAL_SIZE_RANGE.max]) {
    assert.ok(Math.abs(fractalPercentToSize(fractalSizeToPercent(size)) - size) <= 9, size + ' 百分比往返误差过大');
  }
  assert.throws(() => fractalPercentToSize(101), /百分比/);
  assert.throws(() => fractalSizeToPercent(50), /分形大小/);
});

test('大小跟随参数并受范围约束', async () => {
  await withCanvasDouble(async () => {
    const big = renderFractalCanvas({ preset: 'tree', size: FRACTAL_SIZE_RANGE.max, depth: 2 });
    assert.equal(big.width, FRACTAL_SIZE_RANGE.max);
    const small = renderFractalCanvas({ preset: 'tree', size: FRACTAL_SIZE_RANGE.min, depth: 6 });
    assert.equal(small.width, FRACTAL_SIZE_RANGE.min);
  });
});

test('点击画纸放置分形会新增可移动图层', async () => {
  await withCanvasDouble(async () => {
    const { DrawingEngine } = await import('../src/drawing.js');
    const engine = new DrawingEngine(new CanvasDouble(64, 64), () => {});
    silenceEngine(engine);
    const before = engine.layers.length;
    const layer = placeFractal(engine, { x: 32, y: 32 }, { preset: 'star', size: 96, depth: 2, color: '#123456' });
    assert.equal(engine.layers.length, before + 1, '分形应作为新图层加入');
    assert.equal(layer.x, 32);
    assert.equal(layer.y, 32);
    assert.match(layer.name, /星星花/);
    engine.undo();
    assert.equal(engine.layers.length, before, '放置分形可以撤销');
  });
});

test('分形入口从工具第三页进入，旧的像素分形对话框已移除', () => {
  const classic = read('src/classic-ui.js');
  const app = read('src/app.js');
  const creative = read('src/creative-ui.js');
  const bundle = read('tools/bundle.mjs');
  // 分形排在最后一位（第三页），左侧列表与参数栏接线齐全。
  assert.match(classic, /\['clone','仿制印章'\],\['fractal','分形'\],\['scratch','刮刮画'\]/);
  assert.match(classic, /fractal-presets/);
  assert.match(classic, /fractal-depth-up/);
  assert.match(app, /placeFractal\(engine,point\)/);
  assert.doesNotMatch(creative, /fractal/);
  assert.doesNotMatch(creative, /generateFractal/);
  assert.match(bundle, /fractal-studio\.js/);
  assert.doesNotMatch(bundle, /'fractals\.js'/);
  assert.equal(fractalState.depth >= 1 && fractalState.depth <= 6, true);
});
