import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIXEL_GRID_SIZES,
  PixelArtModel,
  cellAtPoint,
  normalizePixelColor,
} from '../src/pixel-art.js';

test('像素画模型使用固定网格并安全处理单元格坐标', () => {
  assert.deepEqual(PIXEL_GRID_SIZES, [8, 16, 24, 32]);
  const model = new PixelArtModel({ width: 8, height: 8 });
  assert.equal(model.width, 8);
  assert.equal(model.height, 8);
  assert.equal(model.isEmpty(), true);
  assert.equal(model.setCell(3, 4, '#FF0000'), true);
  assert.equal(model.getCell(3, 4), '#ff0000');
  assert.equal(model.setCell(-1, 0, '#00ff00'), false);
  assert.equal(model.setCell(8, 0, '#00ff00'), false);
  assert.equal(model.setCell(3, 4, null), true);
  assert.equal(model.isEmpty(), true);
});

test('拖动画笔用离散线段补齐中间像素，橡皮可以擦除', () => {
  const model = new PixelArtModel({ width: 8, height: 8 });
  assert.equal(model.stroke({ x: 0, y: 0 }, { x: 7, y: 7 }, '#285b49'), 8);
  assert.equal(model.getCell(4, 4), '#285b49');
  assert.equal(model.stroke({ x: 0, y: 0 }, { x: 7, y: 7 }, null), 8);
  assert.equal(model.isEmpty(), true);
});

test('油漆桶只填充同色的四连通区域', () => {
  const model = new PixelArtModel({ width: 6, height: 5 });
  model.fill(0, 0, '#ffffff');
  for (let y = 0; y < 5; y++) model.setCell(2, y, '#000000');
  assert.equal(model.fill(0, 0, '#ffcc66'), 10);
  assert.equal(model.getCell(1, 4), '#ffcc66');
  assert.equal(model.getCell(3, 1), '#ffffff');
  assert.equal(model.fill(0, 0, '#ffcc66'), 0);
});

test('网格调整会用最近邻保留已有图案', () => {
  const model = new PixelArtModel({ width: 8, height: 8 });
  model.setCell(0, 0, '#123456');
  model.setCell(7, 7, '#abcdef');
  model.resize(16, 16);
  assert.equal(model.getCell(0, 0), '#123456');
  assert.equal(model.getCell(15, 15), '#abcdef');
  assert.equal(model.toJSON().pixels.length, 256);
});

test('屏幕坐标可以稳定映射到像素单元，边界外返回空值', () => {
  const rect = { left: 10, top: 20, width: 160, height: 80 };
  assert.deepEqual(cellAtPoint(10, 20, rect, 16, 8), { x: 0, y: 0 });
  assert.deepEqual(cellAtPoint(169.9, 99.9, rect, 16, 8), { x: 15, y: 7 });
  assert.equal(cellAtPoint(9, 20, rect, 16, 8), null);
  assert.equal(cellAtPoint(170, 20, rect, 16, 8), null);
});

test('颜色输入统一为小写六位十六进制，非法颜色被拒绝', () => {
  assert.equal(normalizePixelColor('#ABC'), '#aabbcc');
  assert.equal(normalizePixelColor('00ff88'), '#00ff88');
  assert.equal(normalizePixelColor('transparent'), null);
  assert.throws(() => normalizePixelColor('#12'), /颜色/);
});

test('放回画板的画布保留透明格，不把预览棋盘格烘焙进作品', async () => {
  const previousDocument = globalThis.document;
  class Context {
    constructor() { this.fills = []; }
    save() {}
    restore() {}
    clearRect() {}
    fillRect(x, y, width, height) { this.fills.push({ style: this.fillStyle, x, y, width, height }); }
    beginPath() {}
    moveTo() {}
    lineTo() {}
    stroke() {}
  }
  class Canvas {
    constructor() { this.width = 0; this.height = 0; this.context = new Context(); }
    getContext() { return this.context; }
  }
  globalThis.document = { createElement: () => new Canvas() };
  try {
    const model = new PixelArtModel({ width: 8, height: 8 });
    model.setCell(3, 4, '#ff0000');
    const output = model.toCanvas(64);
    assert.equal(output.width, 64);
    assert.deepEqual(output.context.fills.map(fill => fill.style), ['#ff0000']);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
