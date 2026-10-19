import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');
const macMain = readFileSync(new URL('native/macos/Main.swift', root), 'utf8');

test('小屏幕统一收敛新画纸和重置文案字号', () => {
  assert.match(styles, /\.playroom\s+\.header-actions #new-quick,\s*\.playroom\s+\.header-actions #reset-settings\s*\{[^}]*font-size:\s*9px\s*!important/);
  assert.match(styles, /\.playroom\s+\.header-actions #new-quick,\s*\.playroom\s+\.header-actions #reset-settings\s*\{[^}]*line-height:\s*1\.1/);
});

test('小屏幕限制主题入口图标尺寸，避免被界面缩放放大', () => {
  assert.match(styles, /\.playroom \.header-actions button \.playful-icon,[\s\S]*?\.playroom\[data-theme\] \.header-actions \.theme-entry > \.playful-icon\s*\{[^}]*width:\s*22px\s*!important[^}]*height:\s*22px\s*!important/);
});

test('顶部工具栏所有命令保持统一盒宽，主题入口不按内容收缩', () => {
  const width = 'calc\\(60px\\s*\\*\\s*var\\(--u\\)\\)';
  assert.match(styles, new RegExp(`\\.playroom \\.header-actions button\\s*\\{[^}]*flex:\\s*0 0 ${width}[^}]*width:\\s*${width}[^}]*min-width:\\s*${width}[^}]*max-width:\\s*${width}`));
  assert.match(styles, new RegExp(`\\.playroom\\[data-theme\\] \\.header-actions \\.theme-entry\\s*\\{[^}]*flex:\\s*0 0 ${width}[^}]*width:\\s*${width}[^}]*min-width:\\s*${width}[^}]*max-width:\\s*${width}`));
  assert.doesNotMatch(styles, /\.playroom\[data-theme\] \.theme-entry\s*\{\s*flex:\s*0 1 auto;\s*min-width:\s*0;\s*\}/);
});

test('桌面画板在原生窗口最小尺寸内保持布局，不挤压控件', () => {
  assert.match(
    styles,
    /@media\s*\(min-width:\s*1024px\)\s*and\s*\(min-height:\s*720px\)[\s\S]*?\.playroom\s*\{[\s\S]*?--app-min-width:\s*1024px;[\s\S]*?--app-min-height:\s*720px;[\s\S]*?min-width:\s*var\(--app-min-width\);[\s\S]*?min-height:\s*var\(--app-min-height\);[\s\S]*?\}[\s\S]*?\.playroom \.workspace\s*\{[\s\S]*?min-width:\s*var\(--app-min-width\);[\s\S]*?min-height:\s*calc\(var\(--app-min-height\)\s*-\s*var\(--header\)\);/
  );
  // Compact iOS/short-window breakpoints remain below the desktop floor.
  assert.match(styles, /@media\s*\(max-width:\s*860px\),\s*\(max-height:\s*600px\)/);
  assert.match(macMain, /contentMinSize\s*=\s*NSSize\(width:\s*1024,\s*height:\s*720\)/);
  assert.match(macMain, /\(1024\.\.\.2560\)\.contains\(width\),\s*\(720\.\.\.1440\)\.contains\(height\)/);
});
