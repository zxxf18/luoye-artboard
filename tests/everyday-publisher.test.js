import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alphaStats, mergeEverydayCatalog, validateEverydayPlan } from '../tools/publish-everyday.mjs';

function rgba(width, height, alpha = 0) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = alpha;
  return { pixels, info: { width, height, channels: 4 } };
}

test('everyday publishing rejects empty, opaque and edge-clipped illustrations', () => {
  const empty = rgba(10, 10);
  assert.throws(() => alphaStats(empty.pixels, empty.info, 'empty'), /is empty/);
  const opaque = rgba(10, 10, 255);
  assert.throws(() => alphaStats(opaque.pixels, opaque.info, 'opaque'), /touches edge/);
  const clipped = rgba(10, 10);
  clipped.pixels[(5 * 10) * 4 + 3] = 255;
  assert.throws(() => alphaStats(clipped.pixels, clipped.info, 'clipped'), /touches edge/);
});

test('everyday publishing checks real transparent pixels, not just an alpha channel', () => {
  const clean = rgba(10, 10);
  clean.pixels[(5 * 10 + 5) * 4 + 3] = 255;
  assert.deepEqual(alphaStats(clean.pixels, clean.info, 'clean'), {
    visible: 1, transparent: 99, transparentRatio: 0.99, bbox: [5, 5, 5, 5],
  });
  const matte = rgba(10, 10, 16);
  matte.pixels[(5 * 10 + 5) * 4 + 3] = 255;
  assert.throws(() => alphaStats(matte.pixels, matte.info, 'matte'), /no usable transparent margin/);
});

test('republishing an everyday batch replaces its IDs and preserves all other catalog records', () => {
  const retained = { id: 'old-background', category: 'background', src: 'assets/old.webp' };
  const first = { id: 'daily-new', width: 1024, contentGroup: '动物' };
  const old = [{ id: 'daily-new', width: 1254 }, retained];
  const published = mergeEverydayCatalog([first], old);
  assert.deepEqual(published, [first, retained]);
  assert.equal(published[1], retained);
  assert.deepEqual(mergeEverydayCatalog([first], published), published);
  assert.throws(() => mergeEverydayCatalog([first, first], old), /Duplicate catalog id/);
  assert.throws(() => mergeEverydayCatalog([], [retained, retained]), /Duplicate catalog id/);
});

test('everyday plan validation rejects incomplete and duplicate entries', () => {
  assert.throws(() => validateEverydayPlan([], 'empty'), /plan is empty/);
  assert.throws(() => validateEverydayPlan([{ id: 'incomplete' }], 'incomplete'), /need id, name/);
  const valid = { id: 'new', name: '小熊', subject: '小熊', style: 'oil', styleName: '油画', collection: 'everyday-oil' };
  assert.doesNotThrow(() => validateEverydayPlan([valid], 'valid'));
  assert.throws(() => validateEverydayPlan([valid, valid], 'duplicate'), /Duplicate/);
  assert.throws(() => validateEverydayPlan([{ ...valid, contentGroup: undefined }], 'v182'), /contentGroup/);
});

test('v181 and v182 use the shared publisher without collapsing topic diversity', () => {
  const previous = JSON.parse(readFileSync(new URL('../tools/art/everyday-v181.json', import.meta.url)));
  const current = JSON.parse(readFileSync(new URL('../tools/art/everyday-v182.json', import.meta.url)));
  assert.doesNotThrow(() => validateEverydayPlan(previous, 'v181'));
  assert.doesNotThrow(() => validateEverydayPlan(current, 'v182'));
  assert.equal(previous.length, 48);
  assert.equal(current.length, 40);
  assert.equal(new Set(current.map((item) => item.subject)).size, 40);
  for (const style of ['watercolor', 'oil', 'pencil', 'sticker']) {
    assert.equal(current.filter((item) => item.style === style && item.collection === `everyday-${style}`).length, 10);
  }
  const groups = {};
  for (const item of current) groups[item.contentGroup] = (groups[item.contentGroup] || 0) + 1;
  assert.deepEqual(groups, { '食物': 8, '乐器': 4, '玩具': 4, '日用品': 8, '建筑': 4, '自然': 8, '动物': 4 });
});
