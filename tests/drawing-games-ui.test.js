import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('点点迷宫入口和资源被纳入桌面构建', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const bundle = readFileSync(new URL('../tools/bundle.mjs', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(app, /mountDrawingGames/);
  assert.match(bundle, /'drawing-games\.js','drawing-games-ui\.js'/);
  assert.match(index, /drawing-games\.css/);
});

test('点点迷宫面板保留可达的绘画与提交操作', () => {
  const ui = readFileSync(new URL('../src/drawing-games-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /id="game-canvas" width="800" height="560"/);
  assert.match(ui, /data-game-mode="dots"/);
  assert.match(ui, /data-game-mode="maze"/);
  assert.match(ui, /id="game-undo"/);
  assert.match(ui, /id="game-reset"/);
  assert.match(ui, /id="game-place"/);
  assert.match(ui, /model\.trace/);
  assert.match(ui, /engine\.addLayer/);
});

test('点点迷宫在矮屏保持画布比例并重置残留指针状态', () => {
  const ui = readFileSync(new URL('../src/drawing-games-ui.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../public/drawing-games.css', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('./drawing-games-layout.html', import.meta.url), 'utf8');
  assert.match(ui, /function fitCanvas\(\)/);
  assert.match(ui, /new ResizeObserver\(fitCanvas\)/);
  assert.match(ui, /drawing = false; pointerId = undefined; lastPoint = null/);
  assert.match(css, /width: min\(100%, 800px, calc\(\(min\(58dvh, 560px\) - 28px\) \* 10 \/ 7\)\)/);
  assert.match(css, /width: calc\(100% - 8px\)/);
  assert.match(layout, /4\/4 通过/);
});
