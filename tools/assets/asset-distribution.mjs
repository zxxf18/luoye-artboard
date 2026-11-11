import { readFile } from 'node:fs/promises';
import path from 'node:path';

const runtimeFields = [
  'id', 'name', 'category', 'collection', 'src', 'thumbnail', 'width', 'height',
  'coloring', 'frames', 'frameDuration', 'fairyMode', 'fairyGroups', 'fairyBehavior', 'legacyOf',
];

// Keep provenance and original resources in catalog.json. The startup script
// needs the displayed artwork, placement metadata, and frame playback data.
export function renderRuntimeAssetCatalog(catalog) {
  const assets = catalog.map(asset =>
    Object.fromEntries(runtimeFields.filter(key => Object.hasOwn(asset, key)).map(key => [key, asset[key]])));
  return 'window.LUOYE_ASSETS = ' + JSON.stringify(assets) + ';\n';
}

// Stable current IDs always select the new artwork. Previous entries are community-only.
export function selectAssetCatalog(current, legacy, distribution = 'community') {
  if (!['community', 'store'].includes(distribution)) throw new Error('Unknown distribution: ' + distribution);
  if (distribution === 'store') return current;
  const previous = legacy.map(item => {
    const namedFairy = item.category === 'fairy' && ['static', 'dynamic'].includes(item.fairyMode);
    return { ...item, id: item.id + '-legacy', name: namedFairy ? item.name : item.name + '（旧版）', legacyOf: item.id };
  });
  const catalog = [...current, ...previous];
  const firstCombination = catalog.findIndex(item => item.category === 'fairy' && item.fairyMode === 'static');
  const candyCar = catalog.findIndex(item => item.id === 'girl-1-9-legacy');
  if (firstCombination >= 0 && candyCar > firstCombination) {
    const [featured] = catalog.splice(candyCar, 1);
    catalog.splice(firstCombination, 0, featured);
  }
  return catalog;
}

export async function readAssetCatalog(root, distribution = 'community') {
  const files = ['public/assets/catalog.json', 'resources/assets/legacy-catalog.json'];
  const [current, legacy] = await Promise.all(files.map(file => readFile(path.join(root, file), 'utf8').then(JSON.parse)));
  return selectAssetCatalog(current, legacy, distribution);
}
