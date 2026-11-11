import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workerFile = 'offline-worker.js';
const metadataFile = 'offline-precache.json';
export const offlineWebFiles = new Set([workerFile, 'offline-web.js', 'offline-web.css', 'manifest.webmanifest']);

export function addOfflineWebShell(html) {
  return html.replace('<html', '<html data-offline-web="true"')
    .replace('initial-scale=1,viewport-fit=cover', 'initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover')
    .replace('</head>', `  <link rel="manifest" href="manifest.webmanifest">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="落叶画板">
  <meta name="theme-color" content="#f4ead8">
  <link rel="stylesheet" href="offline-web.css">
  <script defer src="offline-web.js"></script>
</head>`)
    .replace('</body>', `  <aside id="offline-setup" aria-label="离线画板">
    <p id="offline-state" role="status">正在检查离线资源…</p>
    <progress id="offline-progress" max="100" aria-label="离线资源下载进度" hidden></progress>
    <button id="offline-retry" type="button" hidden>重试下载</button>
    <button id="offline-dismiss" type="button" aria-label="关闭离线提示" hidden>关闭</button>
  </aside>
</body>`);
}

export async function finalizeOfflineWeb(output) {
  const entries = await readdir(output, { recursive: true, withFileTypes: true });
  const paths = entries.filter(entry => entry.isFile()).map(entry => path.relative(output, path.join(entry.parentPath, entry.name)))
    .filter(file => file !== workerFile && file !== metadataFile && !path.basename(file).startsWith('.')).sort();
  const files = [];
  const sizes = {};
  const integrity = {};
  let bytes = 0;
  for (const file of paths) {
    const url = file.split(path.sep).map(encodeURIComponent).join('/');
    const contents = await readFile(path.join(output, file));
    files.push(url);
    sizes[url] = contents.byteLength;
    bytes += contents.byteLength;
    integrity[url] = `sha256-${createHash('sha256').update(contents).digest('base64')}`;
  }
  const workerPath = path.join(output, workerFile);
  const worker = await readFile(workerPath, 'utf8');
  const version = createHash('sha256').update(worker).update(JSON.stringify(integrity)).digest('hex').slice(0, 24);
  await writeFile(workerPath, worker.replace('__LUOYE_OFFLINE_VERSION__', version));
  await writeFile(path.join(output, metadataFile), JSON.stringify({ version, files, bytes, sizes, integrity }) + '\n');
  return { bytes };
}
