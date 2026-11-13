import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { readAssetCatalog, renderRuntimeAssetCatalog } from '../tools/assets/asset-distribution.mjs';
import { runtimeAssetPaths, includeAsset } from '../tools/assets/runtime-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = await readAssetCatalog(root);

test('the shared release catalog excludes retired artwork and keeps the new candy car first', async () => {
  assert.equal(catalog.find(item => item.fairyMode === 'static').id, 'girl-1-9');
  for (const item of catalog) {
    assert.doesNotMatch(item.id, /-legacy$/);
    assert.doesNotMatch([item.name, item.themeName].join(' '), /特斯拉|Tesla|超级充电/i);
    assert.ok(item.quality !== 'preschool-natural-v16' || item.category === 'frame' || !item.sources?.length,
      item.id + ' still uses an earlier reference redraw');
  }
  const paths = runtimeAssetPaths(catalog);
  for (const file of paths) await access(new URL('../public/' + file, import.meta.url));
  for (const file of ['assets/background/sprites/bg178-parking-comic.webp', 'assets/animation/sprites/animation-0-f0.webp',
    'assets/misc/sprites/role6-53.webp', 'assets/sticker/sprites/car-v179-electric-white.webp', 'assets/legacy-catalog.json']) {
    assert.equal(includeAsset(file, paths), false, file);
  }
});

test('startup catalog retains the gallery, placement and animation fields', async () => {
  const script = renderRuntimeAssetCatalog(catalog);
  assert.equal(await readFile(new URL('../public/assets/catalog.js', import.meta.url), 'utf8'), script);
  const runtime = JSON.parse(runInNewContext(script + 'JSON.stringify(window.LUOYE_ASSETS)', { window: {} }));
  assert.deepEqual(runtime.map(asset => asset.id), catalog.map(asset => asset.id));
  assert.deepEqual(runtimeAssetPaths(runtime), runtimeAssetPaths(catalog));
  const fields = ['name', 'category', 'collection', 'src', 'thumbnail', 'width', 'height', 'coloring', 'frames',
    'frameDuration', 'fairyMode', 'fairyGroups', 'fairyBehavior'];
  for (const [index, asset] of runtime.entries()) {
    for (const field of fields) assert.deepEqual(asset[field], catalog[index][field], asset.id + ' ' + field);
    for (const field of ['sources', 'masterSource', 'artDirection', 'originalFairyGroups']) assert.ok(!Object.hasOwn(asset, field));
  }
  assert.ok(script.length < JSON.stringify(catalog).length);
});
