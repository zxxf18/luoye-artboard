import test from 'node:test';
import assert from 'node:assert/strict';
import { BRUSHES, gradientColorAt, rainbowColorAt } from '../src/brushes.js';

test('儿童友好渐变笔刷提供稳定的画笔入口', () => {
  assert.deepEqual(
    BRUSHES.filter(brush => ['rainbow', 'duotone'].includes(brush.id)).map(brush => brush.id),
    ['rainbow', 'duotone'],
  );
});

test('彩虹颜色由 seed 和位置决定，不依赖调用次数', () => {
  const first = rainbowColorAt({ x: 40, y: 20 }, { x: 0, y: 0 }, 1234, 260);
  // Calling another point in between must not advance a random stream.
  rainbowColorAt({ x: 80, y: 20 }, { x: 0, y: 0 }, 1234, 260);
  assert.equal(rainbowColorAt({ x: 40, y: 20 }, { x: 0, y: 0 }, 1234, 260), first);
  assert.notEqual(first, rainbowColorAt({ x: 40, y: 20 }, { x: 0, y: 0 }, 1235, 260));
});

test('双色渐变从前景色稳定过渡到第二色', () => {
  const start = gradientColorAt({ x: 0, y: 0 }, { x: 0, y: 0 }, '#ff0000', '#0000ff', 160, 0);
  const end = gradientColorAt({ x: 160, y: 0 }, { x: 0, y: 0 }, '#ff0000', '#0000ff', 160, 0);
  assert.equal(start, '#ff0000');
  assert.equal(end, '#0000ff');
  assert.equal(gradientColorAt({ x: 80, y: 0 }, { x: 0, y: 0 }, '#ff0000', '#0000ff', 160, 0), '#800080');
});

test('双色渐变可沿竖直笔划方向推进，不依赖水平坐标', () => {
  const origin = { x: 40, y: 20, direction: { x: 0, y: 1 } };
  assert.equal(gradientColorAt({ x: 40, y: 20 }, origin, '#000000', '#ffffff', 100), '#000000');
  assert.equal(gradientColorAt({ x: 40, y: 120 }, origin, '#000000', '#ffffff', 100), '#ffffff');
});
