import { mkdir, cp, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, root } from './bundle.mjs';
import { canvasAssets } from './canvas-assets.mjs';
import { renderTabletShell } from './tablet-shell.mjs';
import { runtimeAssetPaths, includeAsset } from './assets/runtime-assets.mjs';
import { readAssetCatalog, renderRuntimeAssetCatalog } from './assets/asset-distribution.mjs';
import { addOfflineWebShell, finalizeOfflineWeb, offlineWebFiles } from './offline-web.mjs';
import { Script } from 'node:vm';
import {mkdirSync,rmSync} from 'node:fs';

const TRACKER_ORIGIN = 'https://yebuluo.com.cn';
const TRACKER_SCRIPT = /<script\b[^>]*\bsrc=["']https:\/\/yebuluo\.com\.cn\/stats\/tracker\.js["'][^>]*><\/script>/gi;

export function stripRemoteTracker(html) {
  return html.replace(TRACKER_SCRIPT, '').replaceAll(` ${TRACKER_ORIGIN}`, '');
}

export function buildIndex(html, { client = false, distribution = 'community', showProjectLink = distribution !== 'store', showDonationLink = distribution !== 'store' } = {}) {
  const output = client ? stripRemoteTracker(html) : html;
  if (!['community', 'store'].includes(distribution)) throw new Error('Unknown distribution: '+distribution);
  return output.replace('<html', `<html data-project-link="${showProjectLink}" data-donation-link="${showDonationLink}"`);
}

export async function build({ client = false, distribution = 'community', showProjectLink, showDonationLink, offlineWeb = false } = {}) {
  const lock = path.join(root, 'build/desktop-build.lock');
  mkdirSync(path.dirname(lock), { recursive: true });
  try {
    mkdirSync(lock);
  } catch (error) {
    throw new Error('另一个桌面构建正在使用资源目录，请等它完成后重试。', { cause: error });
  }

  try {
    const script = await bundle();
    new Script(script, { filename: 'app.js' });
    const output = path.join(root, offlineWeb ? 'build/offline' : 'dist');
    // Remove generated output so old or rejected assets cannot survive a rebuild.
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    const publicRoot = path.join(root, 'public');
    const catalog = await readAssetCatalog(root, distribution);
    const assetPaths = runtimeAssetPaths(catalog);
    await cp(publicRoot, output, { recursive: true, filter: source => {
      const relative = path.relative(publicRoot, source).split(path.sep).join('/');
      if (offlineWebFiles.has(relative)) return offlineWeb;
      if (offlineWeb && /^(?:tablet(?:-shell\.(?:js|css)|\.html)|branding\/.+\.(?:ico|icns))$/.test(relative)) return false;
      return includeAsset(relative, assetPaths);
    } });
    await writeFile(path.join(output,'assets/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
    await writeFile(path.join(output,'assets/catalog.js'),renderRuntimeAssetCatalog(catalog));
    const indexPath = path.join(output, 'index.html');
    const index = await readFile(indexPath, 'utf8');
    const outputIndex = buildIndex(index, { client: client || offlineWeb, distribution, showProjectLink, showDonationLink });
    await writeFile(indexPath, offlineWeb ? addOfflineWebShell(outputIndex) : outputIndex, 'utf8');
    await cp(path.join(root,'LICENSE'),path.join(output,'LICENSE.txt'));
    await writeFile(path.join(output,'SOURCE.txt'),'Corresponding source: https://github.com/zxxf18/luoye-artboard\nLicense: GNU AGPL version 3.\n');
    if (!offlineWeb) {
      const tabletPath = path.join(output, 'tablet.html');
      const tablet = await readFile(tabletPath, 'utf8');
      await writeFile(tabletPath, renderTabletShell(tablet, outputIndex), 'utf8');
    }
    await writeFile(path.join(output, 'app.js'), script);
    await writeFile(path.join(output, 'canvas-assets.js'), await canvasAssets(path.join(root,'public')));
    if (offlineWeb) {
      const { bytes } = await finalizeOfflineWeb(output);
      console.log(`离线 Web App：${catalog.length} 项素材，下载约 ${Math.ceil(bytes / 1024 ** 2)} MiB。`);
    }
    console.log(`Desktop interface resources built: ${output}${client ? ' (client)' : ''}`);
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  await build({ distribution: process.argv.includes('--store') ? 'store' : 'community', offlineWeb: process.argv.includes('--offline-web') });
}
