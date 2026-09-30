import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewBoundsForLine } from '../src/drawing.js';
const drawingSource = readFileSync(new URL('../src/drawing.js', import.meta.url), 'utf8');

test('material line previews stay bounded to the active stroke', () => {
  const bounds = previewBoundsForLine({ x: 640, y: 360 }, { x: 652, y: 366 }, 14, 1, 1920, 1080);
  assert.ok(bounds.width < 100, `preview width unexpectedly spans ${bounds.width}px`);
  assert.ok(bounds.height < 100, `preview height unexpectedly spans ${bounds.height}px`);
});

test('paper-grain preview samples a bounded source region instead of full canvas bounds', () => {
  assert.match(drawingSource, /previewBoundsForLine\(/);
  assert.match(drawingSource, /line\.previewStroke\.width!==bounds\.width/);
  assert.doesNotMatch(drawingSource, /drawAssistSegment\([^\n]+\{x:0,y:0,width:c\.width,height:c\.height\}/);
});

test('assisted strokes reuse normalized geometry during a gesture', () => {
  assert.match(drawingSource, /assistGeometryCache/);
  assert.match(drawingSource, /gesture\.assistCopies/);
});
