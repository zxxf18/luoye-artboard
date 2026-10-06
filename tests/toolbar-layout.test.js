import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const classic = readFileSync(new URL('src/classic-ui.js', root), 'utf8');
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');
const shelfStyles = readFileSync(new URL('public/tool-shelf.css', root), 'utf8');

test('compact header folds infrequent actions into the existing settings sheet', () => {
  assert.match(classic, /const foldedToolbarIds = \['reset-settings','open','export','gallery','music-open','animation-open','pixel-art-open','collage-open','drawing-games-open','shape-snap-open'\]/);
  assert.match(classic, /matchMedia\('\(max-width: 1080px\), \(max-height: 600px\)'\)/);
  assert.match(classic, /toolbarObserver\.observe\(header, \{ childList: true \}\)/);
  assert.match(classic, /toolbarResize\.observe\(header\)/);
  assert.match(classic, /button\.dataset\.toolbarFolded = 'true'/);
  assert.match(classic, /const about = el\('about-open'\);[\s\S]*actions\.append\(about\)/, '关于按钮没有固定在设置末尾');
});

test('folded header keeps compact touch targets and removes horizontal scroll affordance', () => {
  assert.match(styles, /@media \(max-width: 380px\) \{[\s\S]*?\.playroom \.header-actions button,[\s\S]*?width: 40px;[\s\S]*?height: 42px;/);
  assert.match(styles, /\.playroom \.header-actions\[data-folded="true"\] \{ overflow-x: hidden; \}/);
});

test('gallery pagination stays beside the cards on the wide shelf', () => {
  assert.match(classic, /document\.body\.classList\.toggle\('library-open',open\);[\s\S]*?syncMobileShelfControls\(open\?'library':'focus'\)/);
  assert.match(classic, /if\(pager&&library&&pager\.parentElement!==library\)library\.append\(pager\)/);
  assert.match(`${styles}\n${shelfStyles}`, /\.playroom\.library-open #library-pagination/);
});
