import test from 'node:test';
import assert from 'node:assert/strict';
import { assistCopies, assistGuideLines, assistPointSets, assistSegments } from '../src/assist.js';

const center = { x: 50, y: 40 };

test('disabled assist preserves the original point', () => {
  assert.deepEqual(assistCopies({ x: 12, y: 18 }, { enabled: false }, center), [{ x: 12, y: 18 }]);
});

test('vertical, horizontal and four-way modes mirror around the configured center', () => {
  assert.deepEqual(assistCopies({ x: 30, y: 18 }, { enabled: true, mode: 'vertical' }, center), [{ x: 30, y: 18 }, { x: 70, y: 18 }]);
  assert.deepEqual(assistCopies({ x: 30, y: 18 }, { enabled: true, mode: 'horizontal' }, center), [{ x: 30, y: 18 }, { x: 30, y: 62 }]);
  assert.deepEqual(assistCopies({ x: 30, y: 18 }, { enabled: true, mode: 'four' }, center), [
    { x: 30, y: 18 }, { x: 70, y: 18 }, { x: 30, y: 62 }, { x: 70, y: 62 },
  ]);
});

test('radial mode creates the requested number of unique copies', () => {
  const points = assistCopies({ x: 70, y: 40 }, { enabled: true, mode: 'radial', axes: 6 }, center);
  assert.equal(points.length, 6);
  assert.deepEqual(points[0], { x: 70, y: 40 });
  assert.ok(Math.abs(points[1].x - 60) < 0.0001);
});

test('center points are not painted repeatedly', () => {
  assert.deepEqual(assistCopies(center, { enabled: true, mode: 'radial', axes: 12 }, center), [center]);
});

test('segments keep start and end paired for each copy', () => {
  assert.deepEqual(assistSegments({ x: 30, y: 18 }, { x: 35, y: 24 }, { enabled: true, mode: 'vertical' }, center), [
    [{ x: 30, y: 18 }, { x: 35, y: 24 }],
    [{ x: 70, y: 18 }, { x: 65, y: 24 }],
]);
});

test('segments preserve rays when the start sits on the symmetry center', () => {
  const segments = assistSegments(center, { x: 70, y: 40 }, { enabled: true, mode: 'radial', axes: 4 }, center);
  assert.equal(segments.length, 4);
  assert.deepEqual(segments.map(([start]) => start), [center, center, center, center]);
  const ends = segments.map(([, end]) => end);
  assert.deepEqual(ends.slice(0, 3), [{ x: 70, y: 40 }, { x: 50, y: 60 }, { x: 30, y: 40 }]);
  assert.ok(Math.abs(ends[3].x - 50) < 0.0001 && Math.abs(ends[3].y - 20) < 0.0001);
});

test('point sets keep a shape transform together even when one endpoint is on an axis', () => {
  const sets = assistPointSets([{ x: 50, y: 20 }, { x: 70, y: 40 }], { enabled: true, mode: 'vertical' }, center);
  assert.equal(sets.length, 2);
  assert.deepEqual(sets[1], [{ x: 50, y: 20 }, { x: 30, y: 40 }]);
});

test('guide lines follow the active assist mode', () => {
  assert.equal(assistGuideLines({ enabled: true, mode: 'four', centerX: 50, centerY: 40 }, 100, 80).length, 2);
  assert.equal(assistGuideLines({ enabled: true, mode: 'radial', axes: 5, centerX: 50, centerY: 40 }, 100, 80).length, 5);
  assert.equal(assistGuideLines({ enabled: false, mode: 'radial' }, 100, 80).length, 0);
});
