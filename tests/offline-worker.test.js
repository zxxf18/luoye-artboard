import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/offline-worker.js', import.meta.url), 'utf8');
const scope = 'https://artboard.example/offline/';
const integrity = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function worker(version, { storage = new Map(), brokenFile } = {}) {
  const handlers = new Map();
  const messages = [];
  const requests = [];
  const client = { url: `${scope}index.html`, postMessage: message => messages.push(message) };
  const paths = ['index.html', 'styles.css'];
  const caches = {
    keys: async () => [...storage.keys()],
    delete: async name => storage.delete(name),
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {
        keys: async () => [...entries.keys()].map(url => new Request(url)),
        put: async (url, response) => entries.set(url, response),
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
        files: paths,
        integrity: Object.fromEntries(paths.map(path => [path, integrity])),
        sizes: { 'index.html': 10, 'styles.css': 20 },
        bytes: 30,
      });
    }
    return path === brokenFile
      ? new Response('Not found', { status: 404 })
      : new Response(`${version}:${path}`);
  }
  runInNewContext(source.replace('__LUOYE_OFFLINE_VERSION__', version), {
    URL, Response, AbortController, caches, fetch,
    self: {
      registration: { scope },
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
  assert.equal(app.requests[1].options.integrity, integrity);
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
  assert.equal(storage.size, 2);
  await retry.dispatch('activate');
  assert.equal(storage.size, 1);
  const updated = await retry.dispatch('fetch', { request: new Request(`${scope}styles.css`) });
  assert.equal(await updated.text(), 'next:styles.css');
});
