import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ERASER_SHAPES,
  normalizeEraserShape,
  shapeEraserBounds,
  shapeEraserSegment,
} from '../src/shape-eraser.js';

function spyContext() {
  const calls = [];
  const ctx = {
    calls,
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    translate(x, y) { calls.push(['translate', x, y]); },
    rotate(angle) { calls.push(['rotate', angle]); },
    beginPath() { calls.push(['beginPath']); },
    moveTo(x, y) { calls.push(['moveTo', x, y]); },
    lineTo(x, y) { calls.push(['lineTo', x, y]); },
    bezierCurveTo(...points) { calls.push(['bezierCurveTo', ...points]); },
    arc(...args) { calls.push(['arc', ...args]); },
    closePath() { calls.push(['closePath']); },
    fill() { calls.push(['fill']); },
    set globalCompositeOperation(value) { calls.push(['composite', value]); },
    set globalAlpha(value) { calls.push(['alpha', value]); },
  };
  return ctx;
}

test('shape eraser accepts supported shapes and safely falls back for unknown values', () => {
  assert.deepEqual(Object.keys(ERASER_SHAPES).sort(), ['cloud', 'heart', 'star']);
  assert.equal(normalizeEraserShape('heart'), 'heart');
  assert.equal(normalizeEraserShape('star'), 'star');
  assert.equal(normalizeEraserShape('cloud'), 'cloud');
  assert.equal(normalizeEraserShape('triangle'), 'star');
  assert.equal(normalizeEraserShape(), 'star');
});

test('shape eraser bounds include the whole dragged path and stay inside the layer', () => {
  assert.deepEqual(shapeEraserBounds({ x: 4, y: 5 }, { x: 20, y: 25 }, 10, 1, 32, 30), {
    x: 0, y: 0, width: 27, height: 30,
  });
  assert.deepEqual(shapeEraserBounds({ x: 40, y: 40 }, { x: 60, y: 50 }, 12, 2, 80, 70), {
    x: 35, y: 35, width: 30, height: 20,
  });
  assert.deepEqual(shapeEraserBounds({ x: 40, y: 40 }, { x: 40, y: 40 }, 0, 0, 80, 70), {
    x: 38, y: 38, width: 4, height: 4,
  });
});

test('shape eraser stamps a continuous path with destination-out and keeps opacity', () => {
  const ctx = spyContext();
  shapeEraserSegment(ctx, {
    layer: { scale: 1 },
    options: { tool: 'eraser', eraserShape: 'heart', size: 20, opacity: .6 },
  }, { x: 10, y: 10 }, { x: 50, y: 10 });
  const translations = ctx.calls.filter(call => call[0] === 'translate');
  assert.ok(translations.length >= 4, 'a dragged path should create multiple shape cutouts');
  assert.equal(ctx.calls.filter(call => call[0] === 'composite' && call[1] === 'destination-out').length, translations.length);
  assert.equal(ctx.calls.filter(call => call[0] === 'alpha' && call[1] === .6).length, translations.length);
  assert.ok(ctx.calls.some(call => call[0] === 'bezierCurveTo'), 'heart uses a recognizable curved path');
});

test('shape eraser carries spacing across pointer updates without duplicating the joint', () => {
  const ctx = spyContext();
  const gesture = {
    layer: { scale: 1 },
    options: { tool: 'eraser', eraserShape: 'star', size: 20, opacity: 1 },
  };
  shapeEraserSegment(ctx, gesture, { x: 0, y: 10 }, { x: 20, y: 10 });
  shapeEraserSegment(ctx, gesture, { x: 20, y: 10 }, { x: 40, y: 10 });
  const xs = ctx.calls.filter(call => call[0] === 'translate').map(call => call[1]);
  assert.equal(new Set(xs).size, xs.length, 'the shared pointer joint is stamped only once');
  assert.ok(xs.includes(0) && xs.some(x => x > 35), 'the final shape reaches the end of the drag');
});

test('shape eraser renders all three silhouettes without relying on canvas fillRect', () => {
  for (const shape of ['star', 'heart', 'cloud']) {
    const ctx = spyContext();
    shapeEraserSegment(ctx, {
      layer: { scale: 1 },
      options: { tool: 'eraser', eraserShape: shape, size: 24, opacity: 1 },
    }, { x: 30, y: 30 }, { x: 30, y: 30 });
    assert.equal(ctx.calls.filter(call => call[0] === 'fill').length, 1, `${shape} should fill one silhouette`);
    assert.equal(ctx.calls.filter(call => call[0] === 'composite' && call[1] === 'destination-out').length, 1);
  }
});
