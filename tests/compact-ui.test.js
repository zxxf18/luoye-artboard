import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');

test('小屏幕统一收敛新画纸和重置文案字号', () => {
  assert.match(styles, /\.playroom\s+\.header-actions #new-quick,\s*\.playroom\s+\.header-actions #reset-settings\s*\{[^}]*font-size:\s*9px\s*!important/);
  assert.match(styles, /\.playroom\s+\.header-actions #new-quick,\s*\.playroom\s+\.header-actions #reset-settings\s*\{[^}]*line-height:\s*1\.1/);
});

test('小屏幕限制主题入口图标尺寸，避免被界面缩放放大', () => {
  assert.match(styles, /\.playroom(?:\[data-theme\])?\s+\.header-actions \.theme-entry > \.playful-icon\s*\{[^}]*width:\s*20px\s*!important[^}]*height:\s*20px\s*!important/);
});
