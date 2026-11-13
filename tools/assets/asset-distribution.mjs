import { readFile } from 'node:fs/promises';
import path from 'node:path';

const runtimeFields = [
  'id', 'name', 'category', 'collection', 'src', 'thumbnail', 'width', 'height',
  'coloring', 'frames', 'frameDuration', 'fairyMode', 'fairyGroups', 'fairyBehavior',
];

// Keep provenance and original resources in catalog.json. The startup script
// needs the displayed artwork, placement metadata, and frame playback data.
export function renderRuntimeAssetCatalog(catalog) {
  const assets = catalog.map(asset =>
    Object.fromEntries(runtimeFields.filter(key => Object.hasOwn(asset, key)).map(key => [key, asset[key]])));
  return 'window.LUOYE_ASSETS = ' + JSON.stringify(assets) + ';\n';
}

export async function readAssetCatalog(root) {
  return JSON.parse(await readFile(path.join(root, 'public/assets/catalog.json'), 'utf8'));
}
