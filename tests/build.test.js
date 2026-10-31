import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIndex } from '../tools/build.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('website build keeps the optional remote tracker', () => {
  const output = buildIndex(index);
  assert.match(output, /https:\/\/yebuluo\.com\.cn\/stats\/tracker\.js/);
});

test('client build removes the remote tracker and keeps local scripts', () => {
  const output = buildIndex(index, { client: true });
  assert.doesNotMatch(output, /https:\/\/yebuluo\.com\.cn/);
  assert.match(output, /<script src="android-bridge\.js"><\/script>/);
  assert.match(output, /<script src="app\.js\?v=1\.12\.0"><\/script>/);
});

test('native build entrypoints use the client resource variant', async () => {
  const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
  const [mac, windows, ios, android] = await Promise.all([
    read('tools/build-mac.mjs'),
    read('tools/build-windows.mjs'),
    read('tools/build-ios.mjs'),
    read('android/app/build.gradle'),
  ]);
  for (const source of [mac, windows, ios]) assert.match(source, /build\(\{ client: true \}\)/);
  assert.match(android, /tools\/build-client\.mjs/);
});
