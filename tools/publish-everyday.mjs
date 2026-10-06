import { readFile, access, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root } from './bundle.mjs';

const runtimeMax = 1024;
const thumbnailSize = 240;
const maxRuntimeBytes = 900 * 1024;

export function validateEverydayPlan(plan, batch) {
  if (!Array.isArray(plan) || plan.length === 0) throw new Error(`${batch} plan is empty`);
  if (new Set(plan.map((item) => item.id)).size !== plan.length) throw new Error(`Duplicate ${batch} asset id`);
  const topicGroupsRequired = /v182$/.test(batch);
  if (plan.some((item) => !item.id || !item.name || !item.subject || !item.style || !item.styleName || !item.collection || (topicGroupsRequired && !item.contentGroup))) {
    throw new Error(`${batch} plan entries need id, name, subject, style, styleName and collection${topicGroupsRequired ? ', plus contentGroup' : ''}`);
  }
}

export function alphaStats(data, info, id) {
  let visible = 0;
  let transparent = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + info.channels - 1];
      if (alpha === 0) transparent += 1;
      if (alpha > 16) {
        visible += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!visible) throw new Error(`Everyday asset is empty: ${id}`);
  if (minX < 2 || minY < 2 || info.width - 1 - maxX < 2 || info.height - 1 - maxY < 2) {
    throw new Error(`Everyday asset touches edge: ${id}`);
  }
  const transparentRatio = transparent / (info.width * info.height);
  if (transparentRatio < 0.01) throw new Error(`Everyday asset has no usable transparent margin: ${id}`);
  return { visible, transparent, transparentRatio, bbox: [minX, minY, maxX, maxY] };
}

export function mergeEverydayCatalog(additions, catalog) {
  const additionIds = new Set(additions.map((item) => item.id));
  const next = [...additions, ...catalog.filter((item) => !additionIds.has(item.id))];
  const ids = new Set();
  for (const item of next) {
    if (ids.has(item.id)) throw new Error(`Duplicate catalog id: ${item.id}`);
    ids.add(item.id);
  }
  return next;
}

export async function publishEveryday(version, { correctV180 = false } = {}) {
  if (!/^v\d+$/.test(version)) throw new Error(`Invalid everyday version: ${version}`);
  const batch = `everyday-${version}`;
  const sharp = createRequire(import.meta.url)(
    process.env.LUOYE_SHARP || '/Users/zhaoxin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp',
  );
  const plan = JSON.parse(await readFile(path.join(root, `tools/art/${batch}.json`), 'utf8'));
  const source = path.join(root, `local-only/${batch}/masters`);
  const out = path.join(root, `public/assets/${batch}`);
  const catalogPath = path.join(root, 'public/assets/catalog.json');
  validateEverydayPlan(plan, batch);
  await Promise.all(plan.map((item) => access(path.join(source, `${item.id}.png`))));
  await Promise.all(['sprites', 'thumbs'].map((dir) => mkdir(path.join(out, dir), { recursive: true })));

  async function inspectAlpha(file, id) {
    const meta = await sharp(file).metadata();
    if (!meta.hasAlpha) throw new Error(`Everyday asset lacks alpha: ${id}`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { meta, stats: alphaStats(data, info, id) };
  }

  const additions = [];
  for (const item of plan) {
    const input = path.join(source, `${item.id}.png`);
    const inspected = await inspectAlpha(input, item.id);
    if (inspected.meta.width > 1600 || inspected.meta.height > 1600) {
      throw new Error(`Everyday master is too large: ${item.id} ${inspected.meta.width}x${inspected.meta.height}`);
    }
    const sprite = path.join(out, 'sprites', `${item.id}.webp`);
    const thumbnail = path.join(out, 'thumbs', `${item.id}.webp`);
    await sharp(input)
      .resize({ width: runtimeMax, height: runtimeMax, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(sprite);
    await sharp(input)
      .resize(thumbnailSize, thumbnailSize, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(thumbnail);
    const runtime = await inspectAlpha(sprite, item.id);
    const runtimeSize = await stat(sprite);
    if (runtimeSize.size > maxRuntimeBytes) throw new Error(`Everyday runtime image is too large: ${item.id} ${runtimeSize.size} bytes`);
    if (runtime.meta.width > runtimeMax || runtime.meta.height > runtimeMax) throw new Error(`Everyday runtime image exceeds ${runtimeMax}px: ${item.id}`);
    additions.push({
      id: item.id,
      name: item.name,
      category: 'sticker',
      collection: item.collection,
      kind: item.subject,
      contentGroup: item.contentGroup,
      style: item.style,
      styleName: item.styleName,
      quality: `original-imagegen-${version}`,
      src: `assets/${batch}/sprites/${item.id}.webp`,
      thumbnail: `assets/${batch}/thumbs/${item.id}.webp`,
      width: runtime.meta.width,
      height: runtime.meta.height,
      alphaRequired: true,
      artDirection: '独立生成的高质量儿童绘画素材；透明背景、完整主体、边缘留白，可直接贴到画板，不含文字和水印。',
    });
  }

  let catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (correctV180) {
    catalog = await Promise.all(catalog.map(async (item) => {
      if (item.quality !== 'original-imagegen-v180' || !item.src?.includes('/everyday-v180/')) return item;
      try {
        const meta = await sharp(path.join(root, 'public', item.src)).metadata();
        return { ...item, width: meta.width, height: meta.height };
      } catch {
        return item;
      }
    }));
  }
  const next = mergeEverydayCatalog(additions, catalog);
  await writeFile(catalogPath, `${JSON.stringify(next, null, 2)}\n`);
  await writeFile(path.join(root, 'public/assets/catalog.js'), `window.LUOYE_ASSETS = ${JSON.stringify(next)};\n`);
  console.log(`Published ${additions.length} ${batch} illustration assets${correctV180 ? '; corrected v180 dimensions' : ''}; catalog ${next.length}`);
}
