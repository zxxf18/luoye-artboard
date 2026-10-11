import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const styles = readFileSync(new URL('public/palette.css', root), 'utf8');
const index = readFileSync(new URL('public/index.html', root), 'utf8');

test('画笔和文字共享的颜色入口在窄窗口保持紧凑', () => {
  assert.match(styles, /\.playroom \.primary-brush-options #paint-color-open\s*\{[\s\S]*?max-width:\s*150px/);
  assert.match(styles, /@media \(max-width: 860px\), \(max-height: 600px\)[\s\S]*?\.primary-brush-options #paint-color-open[\s\S]*?max-width:\s*128px/);
  assert.match(styles, /#paint-color-open i\s*\{[\s\S]*?width:\s*18px[\s\S]*?height:\s*18px/);
});

test('小屏快捷色板和常用颜色预设不会撑高操作区', () => {
  assert.match(styles, /data-mobile-panel="options"\] \.tool-dock \.quick-palette[\s\S]*?height:\s*44px !important/);
  assert.match(styles, /data-mobile-panel="options"\] \.tool-dock \.quick-palette \.swatch[\s\S]*?width:\s*32px/);
  assert.match(styles, /#palette-dialog \.palette-presets[\s\S]*?grid-auto-columns:\s*minmax\(58px/);
  assert.match(styles, /#palette-dialog \.preset-color i[\s\S]*?width:\s*20px/);
});

test('调色板样式作为独立覆盖层在主页面最后加载', () => {
  assert.match(index, /drawing-games\.css\?v=1\.10\.5"><link rel="stylesheet" href="palette\.css\?v=1\.10\.5/);
});

test('魔法袋在侧栏逐行显示，窄屏分类条明确横向布局', () => {
  assert.match(styles, /\.playroom \.fairy-modes\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /\.playroom \.fairy-modes \{ grid-template-columns: repeat\(3/);
  assert.match(styles, /#library-groups:not\(:empty\)[\s\S]*?flex-direction: row/);
  assert.match(styles, /#library-groups \.subtool-card[\s\S]*?flex: 0 0 110px/);
  assert.match(styles, /#library-groups \.playful-icon \{ width: 22px; height: 22px;/);
});

test('矮屏图库只保留一个纵向滚动容器并使分页不收缩', () => {
  assert.match(styles, /\.tool-dock \.right-panel[\s\S]*?overflow: hidden !important/);
  assert.match(styles, /\.tool-dock \.library[\s\S]*?overflow-y: auto !important/);
  assert.match(styles, /\.tool-dock \.asset-grid[\s\S]*?overflow: visible !important/);
  assert.match(styles, /#library-pagination[\s\S]*?flex-shrink: 0 !important/);
});
