import test from 'node:test';
import assert from 'node:assert/strict';
import { pathLength, recognizeStroke } from '../src/shape-snap.js';

function line(a, b, count = 16) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}
function loop(points, steps = 8) {
  const result = [];
  for (let index = 0; index < points.length; index++) {
    const start = points[index], end = points[(index + 1) % points.length];
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      result.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
    }
  }
  result.push(points[0]);
  return result;
}
function ellipse(cx, cy, rx, ry, count = 48) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = Math.PI * 2 * index / count;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

test('一笔成形识别长直线', () => {
  const points = line({ x: 20, y: 40 }, { x: 180, y: 80 });
  const shape = recognizeStroke(points);
  assert.equal(shape?.tool, 'line');
  assert.ok(shape.confidence >= .9);
});

test('一笔成形识别圆和椭圆', () => {
  assert.equal(recognizeStroke(ellipse(100, 80, 65, 65))?.tool, 'ellipse');
  assert.equal(recognizeStroke(ellipse(100, 80, 80, 42))?.tool, 'ellipse');
});

test('一笔成形识别矩形和三角形', () => {
  const rect = loop([{ x: 30, y: 25 }, { x: 190, y: 25 }, { x: 190, y: 130 }, { x: 30, y: 130 }]);
  const triangle = loop([{ x: 110, y: 20 }, { x: 190, y: 140 }, { x: 30, y: 140 }]);
  assert.equal(recognizeStroke(rect)?.tool, 'rect');
  assert.equal(recognizeStroke(triangle)?.tool, 'triangle');
});

test('一笔成形识别星星', () => {
  const points = [];
  for (let index = 0; index <= 10; index++) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 10;
    const radius = index % 2 ? 34 : 72;
    points.push({ x: 100 + Math.cos(angle) * radius, y: 100 + Math.sin(angle) * radius });
  }
  assert.equal(recognizeStroke(points)?.tool, 'star');
});

test('一笔成形对短笔迹和自由线条保持原样', () => {
  assert.equal(recognizeStroke(line({ x: 0, y: 0 }, { x: 4, y: 2 })), null);
  const scribble = Array.from({ length: 30 }, (_, index) => ({ x: index * 4, y: 50 + Math.sin(index * 1.8) * 24 }));
  assert.equal(recognizeStroke(scribble), null);
});

test('路径长度按点序计算', () => {
  assert.equal(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 4 }]), 8);
});
