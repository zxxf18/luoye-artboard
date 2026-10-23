import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectPointerSamples, isHighFrequencyEraser } from '../src/core/input-sampling.js';

test('only hard and soft erasers opt into high-frequency sampling', () => {
  assert.equal(isHighFrequencyEraser({ tool: 'eraser', eraserMode: 'hard' }), true);
  assert.equal(isHighFrequencyEraser({ tool: 'eraser', eraserMode: 'soft' }), true);
  for (const options of [
    { tool: 'eraser', eraserMode: 'rect' },
    { tool: 'eraser', eraserMode: 'shape' },
    { tool: 'pen', brush: 'pencil' },
    { tool: 'scratch' },
  ]) assert.equal(isHighFrequencyEraser(options), false);
});

test('high-frequency sampling keeps the latest raw pointer event after coalesced samples', () => {
  const first = { clientX: 10, clientY: 10 }, second = { clientX: 20, clientY: 20 };
  const event = { clientX: 30, clientY: 30, getCoalescedEvents: () => [first, second] };
  assert.deepEqual(collectPointerSamples(event, true), [first, second, event]);
  assert.deepEqual(collectPointerSamples(event, false), [first, second]);
});

test('the canvas only listens to raw samples for an active hard or soft eraser', () => {
  const app = readFileSync(new URL('../src/platform/app.js', import.meta.url), 'utf8');
  assert.match(app, /pointerrawupdate/);
  assert.match(app, /isHighFrequencyEraser\(engine\.gesture\?\.options\)/);
});

test('纸面橡皮用更新前的位置连线，快速拖动不留缝隙', () => {
  const paperTools = readFileSync(new URL('../src/core/paper-tools.js', import.meta.url), 'utf8');
  // 修复前 t.last 先被推进再传给 brushSegment，两个端点相同，快速拖动时
  // 橡皮退化成一串圆点。现在必须先取出 previous 再连线。
  assert.match(paperTools, /const previous=t\.last,/);
  assert.match(paperTools, /brushSegment\(t\.canvas\.getContext\('2d'\),gBrush,previous,next\)/);
  assert.match(paperTools, /shapeEraserSegment\(t\.canvas\.getContext\('2d'\),gBrush,previous,next\)/);
  assert.doesNotMatch(paperTools, /brushSegment\(t\.canvas\.getContext\('2d'\),gBrush,t\.last,next\)/);
});
