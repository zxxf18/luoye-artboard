import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');
const shelf = readFileSync(new URL('public/tool-shelf.css', root), 'utf8');
const macMain = readFileSync(new URL('native/macos/Main.swift', root), 'utf8');

test('顶部工具栏保持单行和可读字号', () => {
  assert.match(shelf, /\.header-actions > button > span[^}]*font-size:\s*max\(14px,[^}]*white-space:\s*nowrap/);
});

test('小屏幕限制主题入口图标尺寸，避免被界面缩放放大', () => {
  assert.match(styles, /\.playroom \.header-actions button \.playful-icon,[\s\S]*?\.playroom\[data-theme\] \.header-actions \.theme-entry > \.playful-icon\s*\{[^}]*width:\s*19px\s*!important[^}]*height:\s*19px\s*!important/);
});

test('顶部工具栏所有命令使用同一盒宽', () => {
  assert.match(shelf, /\.header-actions > button\s*\{[^}]*flex:\s*0 0 var\(--header-command-width\)/);
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
