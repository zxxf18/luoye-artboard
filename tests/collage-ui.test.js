import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const ui = readFileSync(new URL('src/collage-ui.js', root), 'utf8');
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');

test('剪贴画入口先给孩子一个可直接使用的场景，再逐步添加彩纸', () => {
  assert.match(ui, /COLLAGE_PRESETS/);
  assert.match(ui, /class="collage-steps"/);
  assert.match(ui, /一键开始/);
  assert.match(ui, /从空白开始/);
  assert.match(ui, /自己加一块/);
  assert.match(ui, /更多形状/);
  assert.match(ui, /model\.applyPreset\('garden'\)/);
  assert.match(ui, /collage-piece-count/);
  assert.match(ui, /model\.applyPreset\(preset\.id\)/);
  assert.match(ui, /放回画板/);
  assert.match(ui, /collage-place.*disabled/);
  assert.match(styles, /\.playroom \.collage-preset-list/);
  assert.match(styles, /\.playroom \.collage-steps/);
  assert.match(styles, /\.playroom \.collage-advanced/);
  assert.match(styles, /\.playroom \.collage-stage-count/);
});
