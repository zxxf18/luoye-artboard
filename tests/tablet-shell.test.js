import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { renderTabletShell } from '../tools/tablet-shell.mjs';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('tablet shell keeps a desktop minimum while exactly filling every window', async () => {
  const source = await read('public/tablet-shell.js');
  new Script(source, { filename: 'tablet-shell.js' });
  assert.match(source, /MIN_WIDTH = 1600, MIN_HEIGHT = 1000/);
  assert.match(source, /scale = Math\.min\(width \/ MIN_WIDTH, height \/ MIN_HEIGHT\)/);
  assert.match(source, /logicalWidth = width \/ scale, logicalHeight = height \/ scale/);
  assert.match(source, /frame\.style\.transform = `scale\(\$\{scale\}\)`/);
  for (const event of ['native-display-result', 'native-file-result', 'native-music-result', 'native-asset-result']) assert.match(source, new RegExp(event));
  assert.match(source, /LUOYEFlushBeforeClose/);
  assert.match(source, /LUOYERequestClose/);
});

test('tablet entry is isolated to Android tablets and iPad', async () => {
  const [android, ios, index] = await Promise.all([
    read('android/app/src/main/java/cn/com/yebuluo/MainActivity.kt'),
    read('native/ios/LuoyeWebViewController.swift'),
    read('public/index.html'),
  ]);
  assert.match(android, /smallestScreenWidthDp >= 600\) "tablet\.html" else "index\.html"/);
  assert.match(ios, /isPad \? "tablet\.html" : "index\.html"/);
  assert.match(ios, /override var supportedInterfaceOrientations/);
  assert.match(ios, /isPad \? \.landscape : super\.supportedInterfaceOrientations/);
  assert.doesNotMatch(index, /tablet\.html|tablet-shell/);
});

test('iPad is landscape-only without changing iPhone orientation declarations', async () => {
  const plist = await read('ios/Info.plist');
  const ipad = plist.match(/UISupportedInterfaceOrientations~ipad<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1];
  const iphone = plist.match(/UISupportedInterfaceOrientations~iphone<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1];
  assert.match(plist, /<key>UIRequiresFullScreen<\/key>\s*<true\/>/);
  assert(ipad && iphone);
  assert.match(ipad, /LandscapeLeft/);
  assert.match(ipad, /LandscapeRight/);
  assert.doesNotMatch(ipad, /Portrait/);
  assert.match(iphone, /Portrait/);
});

test('iOS accepts only bundled tablet subframes for native bridge messages', async () => {
  const source = await read('native/ios/LuoyeBridge.swift');
  assert.match(source, /isTrustedMessageFrame\(message\.frameInfo\)/);
  assert.match(source, /if frame\.isMainFrame \{ return true \}/);
  assert.match(source, /userInterfaceIdiom == \.pad/);
  assert.match(source, /sourceURL\?\.standardizedFileURL/);
  assert.match(source, /sourceURL\?\.absoluteString == "about:srcdoc"/);
  assert.match(source, /webView\?\.url\?\.lastPathComponent == "tablet\.html"/);
  assert.match(source, /url\.path\.hasPrefix\(root \+ "\/"\)/);
});

test('srcdoc embeds the unchanged app with escaped markup and a single placeholder', () => {
  const output = renderTabletShell('<iframe data-app-srcdoc></iframe>', '<html title="画板 & 创作"><script src="app.js"></script></html>');
  assert.match(output, /srcdoc="&lt;html title=&quot;画板 &amp; 创作&quot;&gt;&lt;script src=&quot;app.js&quot;&gt;&lt;\/script&gt;&lt;\/html&gt;"/);
  assert.throws(() => renderTabletShell('<iframe></iframe>', '<html></html>'), /一个内页占位/);
});

test('Android handles screen layout changes without recreating the painting activity', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:resizeableActivity="true"/);
  assert.match(manifest, /android:configChanges="[^"]*screenLayout[^"]*"/);
});
