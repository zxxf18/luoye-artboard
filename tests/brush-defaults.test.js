import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_BRUSH_SIZE } from '../src/brushes.js';

const root = new URL('../', import.meta.url);
const classic = readFileSync(new URL('src/classic-ui.js', root), 'utf8');
const app = readFileSync(new URL('src/app.js', root), 'utf8');

test('画笔切换使用统一的适中默认粗细，并保留用户手动调整值', () => {
  assert.equal(DEFAULT_BRUSH_SIZE, 16);
  assert.match(classic, /sizes\[value\]\s*\|\|\s*DEFAULT_BRUSH_SIZE/);
  assert.match(classic, /el\('size'\)\.value=DEFAULT_BRUSH_SIZE/);
  assert.match(app, /size:DEFAULT_BRUSH_SIZE/);
});
