import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const ui = readFileSync(new URL('src/collage-ui.js', root), 'utf8');
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');

test('剪贴画入口把操作拆成场景、形状、舞台三步，并提供快速组合', () => {
  assert.match(ui, /COLLAGE_PRESETS/);
  assert.match(ui, /class="collage-steps"/);
  assert.match(ui, /快速组合/);
  assert.match(ui, /model\.applyPreset\(preset\.id\)/);
  assert.match(ui, /贴到画板/);
  assert.match(styles, /\.playroom \.collage-preset-list/);
  assert.match(styles, /\.playroom \.collage-steps/);
});
