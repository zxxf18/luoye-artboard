import { stat } from 'node:fs/promises';
import path from 'node:path';
import { runtimeAssetPaths } from './runtime-assets.mjs';

const defaultMaxBytes = 192 * 1024 ** 2;
const defaultColoredPerCollection = 4;

const isColoredBackground = item => item.category === 'background' && !item.coloring;
const collectionKey = item => JSON.stringify([item.category, item.collection, item.fairyMode]);
const preferCurrentThenSmaller = (a, b) => Number(Boolean(a.item.legacyOf)) - Number(Boolean(b.item.legacyOf)) || a.bytes - b.bytes;

// Cycle through collections so small libraries and different animation modes
// get a share of the pack alongside the larger sticker collections.
function* roundRobin(groups) {
  const depth = Math.max(0, ...groups.map(group => group.length));
  for (let index = 0; index < depth; index++) {
    for (const group of groups) {
      if (index < group.length) yield group[index];
    }
  }
}

export async function selectOfflineAssets(catalog, assetRoot, {
  maxBytes = defaultMaxBytes,
  coloredPerCollection = defaultColoredPerCollection,
} = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 ||
      !Number.isSafeInteger(coloredPerCollection) || coloredPerCollection < 0) {
    throw new RangeError('Offline asset limits must be non-negative integers.');
  }

  const sizes = new Map(await Promise.all([...runtimeAssetPaths(catalog)].map(async relative => {
    const file = await stat(path.join(assetRoot, relative));
    return [relative, file.size];
  })));
  const entries = catalog.map(item => {
    const files = [...runtimeAssetPaths([item])];
    const bytes = files.reduce((total, relative) => total + sizes.get(relative), 0);
    return { item, files, bytes };
  }).sort(preferCurrentThenSmaller);

  const selected = new Set();
  const paths = new Set();
  const coloredBackgrounds = {};
  let bytes = 0;

  function include({ item, files }) {
    if (selected.has(item)) return;
    const newFiles = files.filter(relative => !paths.has(relative));
    const addedBytes = newFiles.reduce((total, relative) => total + sizes.get(relative), 0);
    if (bytes + addedBytes > maxBytes) return;
    selected.add(item);
    for (const relative of newFiles) paths.add(relative);
    bytes += addedBytes;
  }

  const backgrounds = Map.groupBy(entries.filter(({ item }) => isColoredBackground(item)), ({ item }) => item.collection);
  const colorSamples = [...backgrounds.values()].map(group => {
    // The first pass takes one scene per style before considering repeats.
    const styles = [...Map.groupBy(group, ({ item }) => item.style).values()];
    return [...roundRobin(styles)].slice(0, coloredPerCollection);
  });
  for (const entry of roundRobin(colorSamples)) {
    include(entry);
    if (selected.has(entry.item)) {
      const key = entry.item.collection;
      coloredBackgrounds[key] = (coloredBackgrounds[key] ?? 0) + 1;
    }
  }

  const otherEntries = entries.filter(({ item }) => !isColoredBackground(item));
  const collections = [...Map.groupBy(otherEntries, ({ item }) => collectionKey(item)).values()];
  for (const [first] of collections) include(first);
  for (const entry of otherEntries) {
    const { item } = entry;
    if (item.coloring || item.category === 'paper' || item.category === 'frame') include(entry);
  }

  for (const entry of roundRobin(collections)) {
    if (!entry.item.legacyOf) include(entry);
  }
  for (const entry of otherEntries) include(entry);

  return { catalog: catalog.filter(item => selected.has(item)), paths, bytes, coloredBackgrounds };
}
