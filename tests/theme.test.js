import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const theme = readFileSync(new URL('src/theme-ui.js', root), 'utf8');
const app = readFileSync(new URL('src/app.js', root), 'utf8');
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');

test('theme picker defines seven stable themes with autumn as the default', () => {
  const ids = [...theme.matchAll(/id:\s*'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(ids, ['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean']);
  assert.match(theme, /THEME_STORAGE_KEY\s*=\s*'luoye-theme'/);
  assert.match(theme, /DEFAULT_THEME\s*=\s*'autumn'/);
  assert.match(theme, /normalizeTheme\(value\)/);
});

test('theme selection is persisted independently from projects and reset restores autumn', () => {
  assert.match(theme, /localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/);
  assert.match(theme, /localStorage\.removeItem\(THEME_STORAGE_KEY\)/);
  assert.match(theme, /selected = applyTheme\(DEFAULT_THEME\)/);
  assert.match(app, /applyStoredTheme\(\);/);
  assert.match(app, /theme = mountTheme\(\);/);
  assert.match(app, /theme\?\.reset\?\.\(\)/);
});

test('theme visuals are lightweight CSS decoration and do not target canvas pixels or asset images', () => {
  for (const id of ['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean']) {
    assert.match(styles, new RegExp(`data-theme="${id}"`));
  }
  assert.match(styles, /\.theme-decoration\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /animation: theme-(drift|wave|leaves|snow|gear|orbit|bubbles)/);
  assert.doesNotMatch(styles, /data-theme[^{}]*#painting/);
  assert.doesNotMatch(styles, /data-theme[^{}]*\.canvas-sheet/);
  assert.doesNotMatch(styles, /data-theme[^{}]*\.asset img/);
});

test('theme dialog is keyboard and small-window friendly', () => {
  assert.match(theme, /id = 'theme-open'/);
  assert.match(theme, /className = 'theme-dialog'/);
  assert.match(theme, /role="group" aria-label="主题配色"/);
  assert.match(theme, /setAttribute\('aria-pressed'/);
  assert.match(styles, /\.theme-grid\s*\{/);
  assert.match(styles, /@media \(max-width: 520px\), \(max-height: 420px\)/);
});
