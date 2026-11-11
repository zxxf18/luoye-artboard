import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readAssetCatalog } from '../tools/assets/asset-distribution.mjs';
import { selectOfflineAssets } from '../tools/assets/offline-assets.mjs';
import { runtimeAssetPaths } from '../tools/assets/runtime-assets.mjs';

test('offline selection accounts for shared files and includes animations whole or not at all', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'luoye-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sizes = { shared: 2, duplicateStyle: 3, secondStyle: 4, otherCollection: 1, sticker: 1, cover: 1, frame: 2, lastFrame: 9 };
  await Promise.all(Object.entries(sizes).map(([name, bytes]) => writeFile(path.join(root, name), Buffer.alloc(bytes))));
  const catalog = [
    { id: 'a1', category: 'background', collection: 'a', style: 'comic', src: 'shared' },
    { id: 'a2', category: 'background', collection: 'a', style: 'comic', src: 'duplicateStyle' },
    { id: 'a3', category: 'background', collection: 'a', style: 'oil', src: 'secondStyle' },
    { id: 'b1', category: 'background', collection: 'b', style: 'comic', src: 'otherCollection' },
    { id: 'paper', category: 'paper', src: 'shared' },
    { id: 'sticker', category: 'sticker', src: 'sticker', thumbnail: 'shared' },
    { id: 'fairy', category: 'fairy', fairyMode: 'dynamic', src: 'cover', fairyGroups: [{ frames: ['frame', 'lastFrame'] }] },
  ];

  const small = await selectOfflineAssets(catalog, root, { maxBytes: 8, coloredPerCollection: 2 });
  assert.deepEqual(small.catalog.map(item => item.id), ['a1', 'a3', 'b1', 'paper', 'sticker']);
  assert.deepEqual(small.coloredBackgrounds, { a: 2, b: 1 });
  assert.equal(small.bytes, 8);
  assert.ok(!small.paths.has('frame'));

  const full = await selectOfflineAssets(catalog, root, { maxBytes: 20, coloredPerCollection: 2 });
  assert.equal(full.bytes, 20);
  assert.ok(full.catalog.some(item => item.id === 'fairy'));
  assert.deepEqual(full.paths, runtimeAssetPaths(full.catalog));
});

test('the current offline pack covers every background collection and keeps drawing library categories usable', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const catalog = await readAssetCatalog(root, 'store');
  const offline = await selectOfflineAssets(catalog, path.join(root, 'public'));

  const groups = Map.groupBy(catalog.filter(item => item.category === 'background' && !item.coloring), item => item.collection);
  for (const [collection, items] of groups) {
    const samples = offline.catalog.filter(item => item.category === 'background' && !item.coloring && item.collection === collection);
    assert.equal(samples.length, Math.min(4, items.length), collection);
    assert.equal(new Set(samples.map(item => item.style)).size, Math.min(samples.length, new Set(items.map(item => item.style)).size), collection);
  }
  for (const item of catalog.filter(item => item.coloring || ['frame', 'paper'].includes(item.category))) {
    assert.ok(offline.catalog.includes(item), item.id);
  }
  assert.ok(offline.bytes <= 192 * 1024 ** 2);
  assert.ok(offline.catalog.length > 500);
  assert.deepEqual(offline.paths, runtimeAssetPaths(offline.catalog));
});
