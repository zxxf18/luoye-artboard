import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Stable current IDs always select the new artwork. Previous entries are community-only.
export function selectAssetCatalog(current, legacy, distribution = 'community') {
  if (!['community', 'store'].includes(distribution)) throw new Error('Unknown distribution: ' + distribution);
  if (distribution === 'store') return current;
  return [...current, ...legacy.map(item => ({ ...item, id: item.id + '-legacy', name: item.name + '（旧版）', legacyOf: item.id }))];
}

export async function readAssetCatalog(root, distribution = 'community') {
  const files = ['public/assets/catalog.json', 'resources/assets/legacy-catalog.json'];
  const [current, legacy] = await Promise.all(files.map(file => readFile(path.join(root, file), 'utf8').then(JSON.parse)));
  return selectAssetCatalog(current, legacy, distribution);
}
