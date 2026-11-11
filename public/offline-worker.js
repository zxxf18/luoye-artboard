/* global self, caches */
const version = '__LUOYE_OFFLINE_VERSION__';
const scope = new URL(self.registration.scope);
const legacyCachePrefix = `luoye-offline:${scope.href}:`;
const releaseCachePrefix = `luoye-offline-release:${scope.href}:`;
const cacheName = `${releaseCachePrefix}${version}`;
const objectCacheName = `luoye-offline-objects:${scope.href}`;
const manifestURL = new URL('offline-precache.json', scope).href;
const indexURL = new URL('index.html', scope).href;
const concurrency = 4;
let activeFiles;

function inScope(url) {
  return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
}

function marker(name = cacheName) {
  return caches.match(manifestURL, { cacheName: name });
}

function withCacheLock(action, options = {}) {
  const locks = self.navigator?.locks;
  return locks ? locks.request(objectCacheName, options, action) : action(null);
}

async function cachedFiles(name = cacheName) {
  const manifest = await marker(name);
  return manifest ? new Map(await manifest.json()) : new Map();
}

async function ready() {
  const indexKey = (await cachedFiles()).get(indexURL);
  return !!indexKey && !!await caches.match(indexKey, { cacheName: objectCacheName });
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
    const objectURL = new URL(url);
    objectURL.searchParams.set('luoye-offline-integrity', integrity);
    files.set(url.href, { key: objectURL.href, integrity, size: manifest.sizes?.[path] || 0 });
  }
  if (!files.has(indexURL)) throw new Error('Offline pack has no entry page');
  return { files, totalBytes: manifest.sizes ? manifest.bytes : undefined };
}

async function pruneObjects(cache, requests, keep = new Set()) {
  for (const name of await caches.keys()) {
    if (!name.startsWith(releaseCachePrefix)) continue;
    for (const key of (await cachedFiles(name)).values()) keep.add(key);
  }
  const unused = requests.filter(request => !keep.has(request.url));
  for (let offset = 0; offset < unused.length; offset += concurrency) {
    await Promise.allSettled(unused.slice(offset, offset + concurrency).map(request => cache.delete(request)));
  }
}

async function install(lock) {
  if (await ready()) return;
  const { files, totalBytes } = await readManifest();
  const cache = await caches.open(objectCacheName);
  const requests = await cache.keys();
  const entries = [...files].map(([url, file]) => [url, file.key]);
  if (lock) await pruneObjects(cache, requests, new Set(entries.map(([, key]) => key)));
  const available = new Set(requests.map(request => request.url));
  const pending = new Map();
  let downloadedBytes = 0;
  for (const [url, file] of files) {
    if (available.has(file.key)) downloadedBytes += file.size;
    else pending.set(url, file);
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
      for (const [url, { key, integrity, size }] of downloads) {
        if (controller.signal.aborted) break;
        const response = await fetch(url, {
          cache: 'no-store',
          integrity,
          redirect: 'error',
          signal: controller.signal,
        });
        if (response.status !== 200) throw new Error(`Offline file returned ${response.status}: ${url}`);
        await cache.put(key, response);
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

  // Publish the immutable mapping only after every object is verified and cached.
  const releaseCache = await caches.open(cacheName);
  await releaseCache.put(manifestURL, new Response(JSON.stringify(entries)));
  await report();
}

async function activate(lock) {
  // A newer worker can already be waiting. Its manifest and objects must survive.
  if (!lock || self.registration.installing || self.registration.waiting) return;
  const names = await caches.keys();
  for (const name of names) {
    if (name !== cacheName && (name.startsWith(releaseCachePrefix) || name.startsWith(legacyCachePrefix))) {
      await caches.delete(name);
    }
  }
  const cache = await caches.open(objectCacheName);
  await pruneObjects(cache, await cache.keys());
}

self.addEventListener('install', event => {
  event.waitUntil(withCacheLock(install).catch(async error => {
    await broadcast({ type: 'LUOYE_OFFLINE_ERROR' }).catch(() => {});
    throw error;
  }));
});

self.addEventListener('activate', event => {
  // No skipWaiting: keep the old release in use until its drawing sessions close.
  // A long-running install should not block activation of a complete release.
  event.waitUntil(withCacheLock(activate, { ifAvailable: true }).catch(() => {}).then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'LUOYE_OFFLINE_STATUS' || !event.source?.url ||
      !inScope(new URL(event.source.url))) return;
  event.waitUntil(ready().catch(() => false).then(available => {
    event.source.postMessage({ type: 'LUOYE_OFFLINE_STATUS', ready: available, version });
  }));
});

async function serve(request, url) {
  activeFiles ||= cachedFiles().catch(() => new Map());
  const key = (await activeFiles).get(url);
  if (!key) return fetch(request);
  const cached = await caches.match(key, { cacheName: objectCacheName }).catch(() => undefined);
  if (cached) return cached;
  // In case storage was cleared, only fall back to the same version of this file.
  const integrity = new URL(key).searchParams.get('luoye-offline-integrity');
  return fetch(url, { integrity, redirect: 'error' });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !inScope(url) || url.href === manifestURL) return;
  url.search = '';
  const cacheKey = request.mode === 'navigate' && url.pathname === scope.pathname ? indexURL : url.href;
  event.respondWith(serve(request, cacheKey));
});
