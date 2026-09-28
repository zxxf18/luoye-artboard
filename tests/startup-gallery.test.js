import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const index = readFileSync(new URL('public/index.html', root), 'utf8');
const styles = readFileSync(new URL('public/styles.css', root), 'utf8');
const app = readFileSync(new URL('src/app.js', root), 'utf8');

test('startup keeps the base shell hidden until the mounted UI is ready', () => {
  assert.match(index, /<body class="app-loading">/);
  assert.match(styles, /\.app-loading > \*\{visibility:hidden!important\}/);
  assert.match(app, /document\.body\.classList\.remove\('app-loading'\)/);
});

test('gallery opens with colored backgrounds before stickers', () => {
  const categoryBlock = app.match(/Object\.entries\(\{([\s\S]*?)\}\)/)?.[1];
  assert.ok(categoryBlock, 'gallery category list should be present');
  assert.ok(categoryBlock.indexOf("background: '彩色背景'") < categoryBlock.indexOf("sticker: '小伙伴'"));
  assert.match(app, /let libraryCategory='background'/);
  assert.match(app, /let galleryLocation=\{category:'background'/);
  assert.match(app, /setColor\(color\); chooseCategory\('background'\)/);
});
