import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scratchStyle, paintScratchBase, paintScratchCover } from '../src/engine.js';
import { legacyBrushSegment } from '../src/brushes-legacy.js';
import { validateProject } from '../src/core.js';

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
  const classic = readFileSync(new URL('src/classic-ui.js', root), 'utf8');
  const app = readFileSync(new URL('src/app.js', root), 'utf8');
  assert.match(classic, /\['scratch','刮刮画'\]/);
  assert.match(classic, /我的刮刮画/);
  assert.match(classic, /重新覆盖/);
  assert.match(classic, /覆盖层颜色/);
  assert.match(classic, /刮笔颜色/);
  assert.match(classic, /粗细/);
  assert.match(app, /prepareScratchCard/);
  assert.match(app, /resetScratchCard/);
});
