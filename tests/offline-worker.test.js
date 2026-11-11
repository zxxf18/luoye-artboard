import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/offline-worker.js', import.meta.url), 'utf8');
const scope = 'https://artboard.example/offline/';
const objectCacheName = `luoye-offline-objects:${scope}`;
const hash = body => `sha256-${createHash('sha256').update(body).digest('base64')}`;
const lockManagers = new WeakMap();

function locksFor(storage) {
  if (!lockManagers.has(storage)) {
    let tail = Promise.resolve();
    let queued = 0;
    lockManagers.set(storage, {
      request(name, options, operation) {
        if (options.ifAvailable && queued) return Promise.resolve().then(() => operation(null));
        queued++;
        const task = tail.then(() => operation({ name })).finally(() => { queued--; });
        tail = task.catch(() => {});
        return task;
      },
    });
  }
  return lockManagers.get(storage);
}

function worker(version, { storage = new Map(), brokenFile, unchanged, waiting, beforeDownload } = {}) {
  const handlers = new Map();
  const messages = [];
  const requests = [];
  const client = { url: `${scope}index.html`, postMessage: message => messages.push(message) };
  const files = {
    'index.html': `${version}:index.html`,
    'styles.css': unchanged || `${version}:styles.css`,
  };
  const caches = {
    keys: async () => [...storage.keys()],
    delete: async name => storage.delete(name),
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {
        keys: async () => [...entries.keys()].map(url => new Request(url)),
        put: async (url, response) => entries.set(url, response),
        delete: async request => entries.delete(request.url),
      };
    },
    async match(url, { cacheName }) {
      return storage.get(cacheName)?.get(url)?.clone();
    },
  };
  async function fetch(request, options) {
    const url = request.url || request;
    requests.push({ url, options });
    const path = url.slice(scope.length);
    if (path === 'offline-precache.json') {
      return Response.json({
        version,
        files: Object.keys(files),
        integrity: Object.fromEntries(Object.entries(files).map(([path, body]) => [path, hash(body)])),
        sizes: { 'index.html': 10, 'styles.css': 20 },
        bytes: 30,
      });
    }
    await beforeDownload?.(path);
    return path === brokenFile
      ? new Response('Not found', { status: 404 })
      : new Response(files[path]);
  }
  runInNewContext(source.replace('__LUOYE_OFFLINE_VERSION__', version), {
    URL, Response, AbortController, caches, fetch,
    self: {
      registration: { scope, waiting },
      navigator: { locks: locksFor(storage) },
      clients: { matchAll: async () => [client], claim: async () => {} },
      addEventListener: (type, fn) => handlers.set(type, fn),
    },
  });
  function dispatch(type, properties) {
    let result;
    const capture = value => { result = value; };
    handlers.get(type)({ ...properties, waitUntil: capture, respondWith: capture });
    return result;
  }
  return { dispatch, messages, requests, client, storage };
}

test('offline launch and versioned assets use the installed scope cache', async () => {
  const app = worker('first');
  await app.dispatch('install');
  await app.dispatch('activate');
  const navigated = await app.dispatch('fetch', {
    request: { url: `${scope}?launch=home`, method: 'GET', mode: 'navigate' },
  });
  const stylesheet = await app.dispatch('fetch', {
    request: new Request(`${scope}styles.css?v=1.12.0`),
  });
  assert.equal(await navigated.text(), 'first:index.html');
  assert.equal(await stylesheet.text(), 'first:styles.css');
  assert.equal(app.dispatch('fetch', { request: new Request('https://artboard.example/styles.css') }), undefined);
  assert.equal(app.requests.length, 3);
  assert.equal(app.requests[1].options.integrity, hash('first:index.html'));
  assert.equal(app.messages.at(-1).downloadedBytes, 30);
  await app.dispatch('message', { source: app.client, data: { type: 'LUOYE_OFFLINE_STATUS' } });
  assert.equal(app.messages.at(-1).ready, true);
});

test('a failed update preserves the active pack and retries its completed downloads', async () => {
  const initial = worker('first');
  await initial.dispatch('install');
  await initial.dispatch('activate');
  const { storage } = initial;
  const interrupted = worker('next', { storage, brokenFile: 'styles.css' });
  await assert.rejects(interrupted.dispatch('install'), /returned 404/);
  assert.equal(interrupted.messages.at(-1).type, 'LUOYE_OFFLINE_ERROR');
  await interrupted.dispatch('message', { source: interrupted.client, data: { type: 'LUOYE_OFFLINE_STATUS' } });
  assert.equal(interrupted.messages.at(-1).ready, false);
  const previous = await initial.dispatch('fetch', { request: new Request(`${scope}styles.css`) });
  assert.equal(await previous.text(), 'first:styles.css');

  const retry = worker('next', { storage });
  await retry.dispatch('install');
  assert.deepEqual(retry.requests.map(request => request.url.slice(scope.length)), ['offline-precache.json', 'styles.css']);
  assert.equal(storage.size, 3);
  await retry.dispatch('activate');
  assert.equal(storage.size, 2);
  assert.equal(storage.get(objectCacheName).size, 2);
  const updated = await retry.dispatch('fetch', { request: new Request(`${scope}styles.css`) });
  assert.equal(await updated.text(), 'next:styles.css');
});

test('a legacy flat cache remains available until the shared pack activates', async () => {
  const legacyName = `luoye-offline:${scope}:legacy`;
  const legacy = new Map([
    [`${scope}offline-precache.json`, new Response('legacy')],
    [`${scope}index.html`, new Response('legacy:index.html')],
  ]);
  const unrelated = new Map();
  const storage = new Map([[legacyName, legacy], ['another-app', unrelated]]);
  const app = worker('shared', { storage });
  await app.dispatch('install');
  assert.equal(storage.get(legacyName), legacy);
  assert.equal(await legacy.get(`${scope}index.html`).text(), 'legacy:index.html');
  await app.dispatch('activate');
  assert.equal(storage.has(legacyName), false);
  assert.equal(storage.get('another-app'), unrelated);
  const response = await app.dispatch('fetch', { request: new Request(`${scope}index.html`) });
  assert.equal(await response.text(), 'shared:index.html');
});

test('an update stores unchanged assets once and keeps both releases isolated', async () => {
  const first = worker('first', { unchanged: 'shared CSS' });
  await first.dispatch('install');
  await first.dispatch('activate');
  const { storage } = first;
  const next = worker('next', { storage, unchanged: 'shared CSS' });
  await next.dispatch('install');
  assert.deepEqual(next.requests.map(request => request.url.slice(scope.length)), ['offline-precache.json', 'index.html']);
  assert.equal(storage.get(objectCacheName).size, 3);
  const request = new Request(`${scope}index.html`);
  assert.equal(await (await first.dispatch('fetch', { request })).text(), 'first:index.html');
  assert.equal(await (await next.dispatch('fetch', { request })).text(), 'next:index.html');

  await next.dispatch('activate');
  assert.equal(storage.get(objectCacheName).size, 2);
  const css = await next.dispatch('fetch', { request: new Request(`${scope}styles.css`) });
  assert.equal(await css.text(), 'shared CSS');
});

test('activation does not prune objects while a newer worker installs or waits', async () => {
  const first = worker('first');
  await first.dispatch('install');
  const { storage } = first;
  const started = Promise.withResolvers();
  const resume = Promise.withResolvers();
  const next = worker('next', { storage, beforeDownload: () => {
    started.resolve();
    return resume.promise;
  } });
  const installing = next.dispatch('install');
  await started.promise;
  await first.dispatch('activate');
  resume.resolve();
  await installing;

  const beforeActivation = worker('first', { storage, waiting: {} });
  await beforeActivation.dispatch('activate');
  assert.equal(storage.get(objectCacheName).size, 4);
  await next.dispatch('activate');
  assert.equal(storage.get(objectCacheName).size, 2);
});
