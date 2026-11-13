import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIndex } from '../tools/build.mjs';
import { addOfflineWebShell } from '../tools/offline-web.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('website build keeps the optional remote tracker', () => {
  const output = buildIndex(index);
  assert.match(output, /https:\/\/yebuluo\.com\.cn\/stats\/tracker\.js/);
});

test('the offline privacy template is parsed before the editor starts', () => {
  const policy = '<section lang="en">Privacy Policy</section>';
  const html = buildIndex(index, { client: true, distribution: 'store', privacyPolicy: policy });
  const template = html.indexOf('<template id="bundled-privacy-policy">');
  assert.ok(template >= 0 && template < html.indexOf('<script src="app.js'));
  assert.ok(html.includes(policy));
  assert.doesNotMatch(buildIndex(index, { client: true }), /bundled-privacy-policy/);
});

test('client build removes the remote tracker and keeps local scripts', () => {
  const output = buildIndex(index, { client: true });
  assert.doesNotMatch(output, /https:\/\/yebuluo\.com\.cn/);
  assert.match(output, /<script src="android-bridge\.js"><\/script>/);
  assert.match(output, /<script src="app\.js\?v=1\.12\.0"><\/script>/);
});

test('both web entrances advertise correctly sized home screen icons', async () => {
  const publicFile = name => readFile(new URL(`../public/${name}`, import.meta.url));
  const online = buildIndex(index);
  const offline = addOfflineWebShell(buildIndex(index, { client: true }));
  for (const html of [online, offline]) {
    assert.match(html, /rel="apple-touch-icon" sizes="152x152" href="branding\/apple-touch-icon-152\.png"/);
    assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon\.png"/);
    assert.match(html, /rel="icon" type="image\/png" sizes="192x192" href="branding\/web-app-icon-192\.png"/);
    assert.equal(html.match(/rel="apple-touch-icon"/g).length, 2);
  }
  const manifest = JSON.parse(await publicFile('manifest.webmanifest'));
  assert.match(offline, /rel="manifest" href="manifest\.webmanifest"/);
  for (const [src, size] of [
    ['branding/apple-touch-icon-152.png', '152x152'],
    ['apple-touch-icon.png', '180x180'],
    ...manifest.icons.map(icon => [icon.src, icon.sizes]),
  ]) {
    const png = await publicFile(src);
    assert.equal(png.toString('ascii', 12, 16), 'IHDR', src);
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, size, src);
  }
});

test('native build entrypoints use the client resource variant', async () => {
  const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
  const [mac, windows, ios, android] = await Promise.all([
    read('tools/build-mac.mjs'),
    read('tools/build-windows.mjs'),
    read('tools/build-ios.mjs'),
    read('android/app/build.gradle'),
  ]);
  for (const source of [mac, windows, ios]) assert.match(source, /build\(\{ client: true\b/);
  assert.match(android, /tools\/build-client\.mjs/);
});
