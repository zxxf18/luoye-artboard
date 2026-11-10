import { mkdir, cp, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, root } from './bundle.mjs';
import { canvasAssets } from './canvas-assets.mjs';
import { renderTabletShell } from './tablet-shell.mjs';
import { runtimeAssetPaths, includeAsset } from './assets/runtime-assets.mjs';
import { readAssetCatalog } from './assets/asset-distribution.mjs';
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

export async function build({ client = false, distribution = 'community', showProjectLink, showDonationLink } = {}) {
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
    const output = path.join(root, 'dist');
    // Remove generated output so old or rejected assets cannot survive a rebuild.
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    const catalog = await readAssetCatalog(root,distribution);
    const assetPaths = runtimeAssetPaths(catalog);
    await cp(path.join(root, 'public'), output, { recursive: true,
      filter: source => includeAsset(path.relative(path.join(root,'public'),source).split(path.sep).join('/'),assetPaths) });
    await writeFile(path.join(output,'assets/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
    await writeFile(path.join(output,'assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(catalog)+';\n');
    const indexPath = path.join(output, 'index.html');
    const index = await readFile(indexPath, 'utf8');
    const outputIndex = buildIndex(index, { client, distribution, showProjectLink, showDonationLink });
    await writeFile(indexPath, outputIndex, 'utf8');
    await cp(path.join(root,'LICENSE'),path.join(output,'LICENSE.txt'));
    await writeFile(path.join(output,'SOURCE.txt'),'Corresponding source: https://github.com/zxxf18/luoye-artboard\nLicense: GNU AGPL version 3.\n');
    const tabletPath = path.join(output, 'tablet.html');
    const tablet = await readFile(tabletPath, 'utf8');
    await writeFile(tabletPath, renderTabletShell(tablet, outputIndex), 'utf8');
    await writeFile(path.join(output, 'app.js'), script);
    await writeFile(path.join(output, 'canvas-assets.js'), await canvasAssets(path.join(root,'public')));
    console.log(`Desktop interface resources built: ${output}${client ? ' (client)' : ''}`);
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) await build({distribution:process.argv.includes('--store')?'store':'community'});
