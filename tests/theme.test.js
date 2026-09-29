import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const theme = readFileSync(new URL('src/theme-ui.js', root), 'utf8');
const app = readFileSync(new URL('src/app.js', root), 'utf8');
const display = readFileSync(new URL('src/display-ui.js', root), 'utf8');
const classic = readFileSync(new URL('src/classic-ui.js', root), 'utf8');
const scenes = readFileSync(new URL('src/theme-scenes.js', root), 'utf8');
const icons = readFileSync(new URL('src/playful-icons.js', root), 'utf8');
const palette = readFileSync(new URL('src/palette-ui.js', root), 'utf8');
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');
const toolStyles = readFileSync(new URL('public/tool-shelf.css', root), 'utf8');
const sceneStyles = readFileSync(new URL('public/theme-scenes.css', root), 'utf8');

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
  assert.match(sceneStyles, /\.theme-scene\s*\{/);
  assert.doesNotMatch(styles, /\.theme-decoration\s*\{/);
  assert.doesNotMatch(sceneStyles, /\.theme-decoration\s*\{/);
  assert.match(sceneStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(sceneStyles, /animation: theme-(breeze|waves|leaf-fall|snow|gear|planet|fish)/);
  assert.match(theme, /brandIcon\(/);
  assert.match(scenes, /class="theme-scene/);
  assert.doesNotMatch(styles, /data-theme[^{}]*#painting/);
  assert.doesNotMatch(styles, /data-theme[^{}]*\.canvas-sheet/);
  assert.doesNotMatch(styles, /data-theme[^{}]*\.asset img/);
});

test('theme and settings entries stay in their intended containers', () => {
  assert.match(theme, /id\s*=\s*'theme-open'/);
  assert.match(theme, /header\.insertBefore\(entry/);
  assert.doesNotMatch(theme, /more-dialog \\.more-actions/);
  assert.match(display, /id='display-open'/);
  assert.match(classic, /id='about-open'/);
  assert.match(classic, /actions\.append\(aboutButton\)/);
  assert.match(app, /mountDisplay\(\)/);
});

test('classic color surfaces are themed separately from actual color controls', () => {
  assert.match(styles, /classic-colors/);
  for (const id of ['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean']) {
    assert.match(styles, new RegExp(`data-theme="${id}"`));
  }
  assert.doesNotMatch(styles, /data-theme[^{}]*#foreground-palette/);
  assert.doesNotMatch(styles, /data-theme[^{}]*#background-palette/);
  assert.doesNotMatch(styles, /data-theme[^{}]*\.color-history/);
});

test('theme scene is confined to the brand and animation is reduced safely', () => {
  assert.match(sceneStyles, /\.theme-scene\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(theme, /document\.querySelector\('\.brand'\)/);
  assert.match(sceneStyles, /\.theme-scene\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(sceneStyles, /prefers-reduced-motion:[^}]+theme-scene/);
});

test('brand and about use the illustrated child logo with dedicated theme slots', () => {
  assert.match(classic, /about-mark/);
  assert.match(classic, /brandIcon\(/);
  assert.match(classic, /themechange/);
  assert.match(theme, /brand-icon(?:-svg)?|about-theme-icon/);
  assert.match(theme, /themechange/);
  assert.match(icons, /theme:/);
  assert.match(icons, /export function brandIcon/);
  assert.match(icons, /branding\/themes\/app-icon-\$\{themeId\}/);
  assert.match(icons, /-windows/);
  assert.match(icons, /\.png/);
  assert.match(styles, /\.about-mark img[^{]*\{[^}]*filter:none/);
  // The true color controls carry explicit classes so global theme selectors
  // cannot overwrite their inline values.
  assert.match(palette, /color-value-control/);
  assert.match(palette, /swap-color-control/);
  assert.match(palette, /color-history-value/);
});

test('theme entry uses the shared command size and the final Chinese label', () => {
  assert.match(theme, /setAttribute\('aria-label', '主题'\)/);
  assert.match(theme, /<span>主题<\/span>/);
  assert.match(styles, /\.theme-entry[\s\S]*?min-width/);
  assert.match(styles, /theme-entry > \.playful-icon[\s\S]*?width/);
});

test('theme CSS exposes global control surfaces and excludes artwork pixels', () => {
  const skinStyles = `${styles}\n${toolStyles}`;
  assert.match(skinStyles, /\.playroom\[data-theme\][\s\S]*\.detail-bar/);
  assert.match(skinStyles, /\.playroom\[data-theme\][\s\S]*\.subtool-card/);
  assert.match(skinStyles, /\.playroom\[data-theme\][\s\S]*\.quick-palette/);
  assert.match(skinStyles, /--theme-control\s*:/);
  assert.match(skinStyles, /--theme-selected\s*:/);
  assert.doesNotMatch(styles, /\.playroom\[data-theme\][^{}]*#painting/);
  assert.doesNotMatch(styles, /\.playroom\[data-theme\][^{}]*\.canvas-sheet/);
  assert.match(toolStyles, /#painting/);
  assert.match(toolStyles, /\.asset img/);
});

test('theme dialog is keyboard and small-window friendly', () => {
  assert.match(theme, /id = 'theme-open'/);
  assert.match(theme, /className = 'theme-dialog'/);
  assert.match(theme, /role="group" aria-label="主题配色"/);
  assert.match(theme, /setAttribute\('aria-pressed'/);
  assert.match(styles, /\.theme-grid\s*\{/);
  assert.match(styles, /@media \(max-width: 520px\), \(max-height: 420px\)/);
});
