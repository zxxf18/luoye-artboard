/* global self, caches */
const version = '__LUOYE_OFFLINE_VERSION__';
const scope = new URL(self.registration.scope);
const cachePrefix = `luoye-offline:${scope.href}:`;
const cacheName = `${cachePrefix}${version}`;
const manifestURL = new URL('offline-precache.json', scope).href;
const indexURL = new URL('index.html', scope).href;
const concurrency = 4;

function inScope(url) {
  return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
}

function marker(name = cacheName) {
  return caches.match(manifestURL, { cacheName: name });
}

async function broadcast(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    if (inScope(new URL(client.url))) client.postMessage({ ...message, version });
  }
}

async function readManifest() {
  const response = await fetch(manifestURL, { cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error(`Offline manifest returned ${response.status}`);
  const manifest = await response.json();
  if (manifest.version !== version || !Array.isArray(manifest.files)) {
    throw new Error('Offline manifest does not match this release');
  }
  const files = new Map();
  for (const path of manifest.files) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes(':')) {
      throw new Error(`Invalid offline file: ${path}`);
    }
    const url = new URL(path, scope);
    const integrity = manifest.integrity?.[path];
    if (!inScope(url) || url.search || url.hash ||
        url.href === manifestURL || files.has(url.href) ||
        !/^sha256-[A-Za-z0-9+/]{43}=$/.test(integrity)) {
      throw new Error(`Invalid offline file: ${path}`);
    }
    files.set(url.href, { integrity, size: manifest.sizes?.[path] || 0 });
  }
  if (!files.has(indexURL)) throw new Error('Offline pack has no entry page');
  return { files, totalBytes: manifest.sizes ? manifest.bytes : undefined };
}

async function pruneCaches(includeComplete) {
  const names = await caches.keys();
  await Promise.allSettled(names.map(async name => {
    if (name !== cacheName && name.startsWith(cachePrefix) &&
        (includeComplete || !await marker(name))) {
      await caches.delete(name);
    }
  }));
}

async function install() {
  try {
    if (await marker()) return;
    const { files, totalBytes } = await readManifest();
    await pruneCaches(false);
    const cache = await caches.open(cacheName);
    const pending = new Map(files);
    let downloadedBytes = 0;
    for (const request of await cache.keys()) {
      const file = pending.get(request.url);
      if (!file) continue;
      downloadedBytes += file.size;
      pending.delete(request.url);
    }
    let completed = files.size - pending.size;
    let lastReport = 0;
    function report() {
      lastReport = Date.now();
      return broadcast({
        type: 'LUOYE_OFFLINE_PROGRESS',
        completed,
        total: files.size,
        downloadedBytes: totalBytes === undefined ? undefined : downloadedBytes,
        totalBytes,
      }).catch(() => {});
    }
    await report();

    const downloads = pending.entries();
    const controller = new AbortController();
    async function download() {
      try {
        for (const [url, { integrity, size }] of downloads) {
          if (controller.signal.aborted) break;
          const response = await fetch(url, {
            cache: 'reload',
            integrity,
            redirect: 'error',
            signal: controller.signal,
          });
          if (response.status !== 200) throw new Error(`Offline file returned ${response.status}: ${url}`);
          await cache.put(url, response);
          completed++;
          downloadedBytes += size;
          if (Date.now() - lastReport >= 250) await report();
        }
      } catch (error) {
        controller.abort();
        throw error;
      }
    }
    const results = await Promise.allSettled(Array.from({ length: concurrency }, download));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;

    // The marker is written only after every file is verified and cached.
    // Retries can reuse verified downloads for this immutable release.
    await cache.put(manifestURL, new Response(version));
    await report();
  } catch (error) {
    await broadcast({ type: 'LUOYE_OFFLINE_ERROR' }).catch(() => {});
    throw error;
  }
}

self.addEventListener('install', event => event.waitUntil(install()));

self.addEventListener('activate', event => {
  // No skipWaiting: keep the old release in use until its drawing sessions close.
  event.waitUntil(pruneCaches(true).catch(() => {}).then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'LUOYE_OFFLINE_STATUS' || !event.source?.url ||
      !inScope(new URL(event.source.url))) return;
  event.waitUntil(marker().then(Boolean, () => false).then(ready => {
    event.source.postMessage({ type: 'LUOYE_OFFLINE_STATUS', ready, version });
  }));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !inScope(url) || url.href === manifestURL) return;
  url.search = '';
  const cacheKey = request.mode === 'navigate' && url.pathname === scope.pathname ? indexURL : url.href;
  event.respondWith(caches.match(cacheKey, { cacheName })
    .catch(() => undefined)
    .then(cached => cached || fetch(request)));
});
