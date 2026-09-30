import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
const materialBody = source.slice(source.indexOf('export function materialSegment'));

test('material strokes avoid per-sample full pixel readback', () => {
  assert.match(source, /materialScratch/);
  assert.match(materialBody, /source-in/);
  assert.match(materialBody, /destination-in/);
  assert.doesNotMatch(materialBody, /tmp\.getImageData\(/);
  assert.doesNotMatch(materialBody, /tmp\.putImageData\(/);
});

test('paper textures precompute reusable luminance masks', () => {
  assert.match(source, /paperMask/);
  assert.match(source, /maskCanvas/);
  assert.match(source, /paper\.maskCanvases\.size > 4/);
});

test('textured segments reuse transformable patterns instead of allocating per sample', () => {
  assert.match(source, /entry\?\.transformable/);
  assert.match(source, /entry\.pattern\.setTransform/);
});

test('large textured pointer jumps are split into bounded material segments', () => {
  const drawingSource = readFileSync(new URL('../src/drawing.js', import.meta.url), 'utf8');
  assert.match(drawingSource, /maxSpan=material\?Math\.max\(96,Math\.min\(320,width\*1\.5\)\)/);
  assert.match(drawingSource, /Math\.ceil\(distance\/Math\.max\(1,maxSpan\)\)/);
});
