import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assistSegmentCopies,
  assistSegmentCopiesFromGeometry,
  assistTransformDescriptors,
  normalizeAssistConfig,
} from '../src/assist.js';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');

// The engine instantiates canvases and schedules animation frames. Neither
// exists under node:test, so a tiny double keeps the pure decision logic
// testable while the browser build keeps the real surfaces.
class FakeContext {
  constructor(canvas) { this.canvas = canvas; }
  clearRect() {} fillRect() {} drawImage() {} setTransform() {} save() {} restore() {}
  translate() {} scale() {} rotate() {} beginPath() {} moveTo() {} lineTo() {}
  stroke() {} fill() {} arc() {} rect() {} ellipse() {} clip() {}
  getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
  putImageData() {}
}
class FakeCanvas {
  constructor(width = 1, height = 1) { this.width = width; this.height = height; this.context = new FakeContext(this); }
  getContext() { return this.context; }
}
const previousDocument = globalThis.document;
const previousRaf = globalThis.requestAnimationFrame;
const previousCancelRaf = globalThis.cancelAnimationFrame;
let engine;
before(async () => {
  globalThis.document = { createElement: () => new FakeCanvas() };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  const { PaintEngine } = await import('../src/engine.js');
  engine = new PaintEngine(new FakeCanvas(), () => {});
  clearInterval(engine.animationTimer);
});
after(() => {
  // The render fallback timer may still be scheduled; cancel it before the
  // RAF globals are restored so it cannot fire in the bare node environment.
  clearTimeout(engine?.renderDeadline);
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousRaf === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = previousRaf;
  if (previousCancelRaf === undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame = previousCancelRaf;
});

test('宽笔尖在多份辅助下合并密集采样，单份笔触保持原有密度', () => {
  const gesture = overrides => ({ layer: { scale: 1 }, options: { tool: 'pen', brushVersion: 2, brush: 'rainbow', size: 300, ...overrides } });
  // 渐变画笔本身开销大，即使没有对称也合并。
  assert.ok(engine.strokeCoalesceDistance(gesture()) > 0);
  // 16 轴环形对称把同样工作放大 16 份，任何笔刷都合并。
  assert.ok(engine.strokeCoalesceDistance(gesture({ brush: 'pencil', assist: { enabled: true, mode: 'radial', axes: 16 } })) > 0);
  // 四向对称同样合并；普通单份笔触不合并，保留原始采样密度。
  assert.ok(engine.strokeCoalesceDistance(gesture({ brush: 'pencil', assist: { enabled: true, mode: 'four' } })) > 0);
  assert.equal(engine.strokeCoalesceDistance(gesture({ brush: 'pencil' })), 0);
  assert.equal(engine.strokeCoalesceDistance(gesture({ brushVersion: 1 })), 0);
  assert.equal(engine.strokeCoalesceDistance(gesture({ tool: 'eraser' })), 0);
  // 合并距离跟随笔宽但有上限，避免长笔画跳点。
  assert.equal(engine.strokeCoalesceDistance(gesture({ size: 300 })), 72);
  assert.ok(engine.strokeCoalesceDistance(gesture({ size: 24 })) < 72);
});

test('update 使用平方距离比较并且收笔前释放被合并的采样点', () => {
  const engineSource = read('src/engine.js');
  assert.match(engineSource, /distanceSquared < coalesceDistance \* coalesceDistance/);
  assert.match(engineSource, /g\.pending && \['pen', 'eraser', 'scratch'\]\.includes\(g\.options\.tool\)/);
  // 刮刮画粗笔刷按四分之一足迹合并，减少重复磁贴回读。
  assert.match(engineSource, /scratchDistance \* scratchDistance/);
});

test('环形对称的多个副本各自捕获磁贴而不是整张并集', () => {
  const engineSource = read('src/engine.js');
  const drawingSource = read('src/drawing.js');
  assert.match(engineSource, /captureTilesMany\(layer, boundsList, tiles\)/);
  assert.match(drawingSource, /this\.captureTilesMany\(g\.layer,copyBounds,g\.tiles\)/);
});

test('缓存的对称几何与慢速路径给出完全相同的线段副本', () => {
  for (const mode of ['vertical', 'horizontal', 'four', 'radial']) {
    for (const axes of [2, 8, 16]) {
      const config = normalizeAssistConfig({ enabled: true, mode, axes });
      const center = { x: 960, y: 540 };
      const geometry = { config, center, transforms: assistTransformDescriptors(config, center) };
      const start = { x: 1200, y: 700 }, end = { x: 1300, y: 620 };
      assert.deepEqual(
        assistSegmentCopiesFromGeometry(start, end, geometry),
        assistSegmentCopies(start, end, config, center),
        `${mode} ${axes} 轴的快速路径结果必须与慢速路径一致`,
      );
    }
  }
});

test('渐变画笔的九个颜色停靠点按段缓存并在对称副本间共享', () => {
  const brushesSource = read('src/brushes.js');
  const drawingSource = read('src/drawing.js');
  assert.match(brushesSource, /export function prepareGradientStops/);
  assert.match(brushesSource, /gradientStopsSignature===signature&&gesture\.gradientStops\?\.length===9/);
  assert.match(drawingSource, /if \(gradientStops\) copy\.gradientStops = gradientStops;/);
});

test('动画播放时静态前缀只合成一次并按帧复用', () => {
  const staticLayer = engine.layers[0];
  const frame = new FakeCanvas(480, 480);
  engine.addLayer('会动的小伙伴', frame, false, { frames: [frame], frameDuration: 120, insertAt: 1 });
  const prefix = engine.scenePrefixFor(true);
  assert.ok(prefix, '动画场景应返回静态前缀缓存');
  assert.equal(prefix.count, 1, '前缀只包含第一个动画图层之下的静态图层');
  engine.render();
  const cached = engine.scenePrefixFor(true);
  assert.equal(cached.canvas, prefix.canvas, '前缀在同一次文档修订内必须复用同一张缓存面');
  assert.ok(engine.metrics.scenePrefixHits >= 1);
  assert.equal(engine.scenePrefixFor(true, staticLayer), null, '在前缀内部绘画时必须绕过缓存避免陈旧像素');
  // 收尾：移除动画图层，恢复静态场景。
  engine.layers.splice(1, 1); engine.activeId = staticLayer.id; engine.changed();
  assert.equal(engine.scenePrefixFor(false), null, '没有动画时不使用前缀路径');
});

test('弹窗背景不再使用 backdrop-filter 模糊', () => {
  for (const file of ['public/styles.css', 'public/playroom.css']) {
    assert.doesNotMatch(read(file), /backdrop-filter:\s*blur/, `${file} 不应保留模糊滤镜`);
  }
});
