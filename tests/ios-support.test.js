import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, name), 'utf8');

test('iOS target declares a universal iPhone/iPad, landscape-first app', async () => {
  const plist = await read('ios/Info.plist');
  const index = await read('public/index.html');
  assert.match(plist, /UIDeviceFamily/);
  assert.match(plist, /<integer>1<\/integer>/);
  assert.match(plist, /<integer>2<\/integer>/);
  assert.match(plist, /UISupportedInterfaceOrientations/);
  assert.match(plist, /UIInterfaceOrientationLandscapeLeft/);
  assert.match(plist, /UIInterfaceOrientationLandscapeRight/);
  assert.match(plist, /UIInterfaceOrientationPortrait/);
  assert.match(index, /viewport-fit=cover/);
});

test('iOS bridge handles every native channel used by the web app', async () => {
  const source = await read('native/ios/LuoyeBridge.swift');
  for (const channel of ['ready', 'files', 'music', 'display', 'assets']) {
    assert.match(source, new RegExp('"' + channel + '"'));
  }
  assert.match(source, /WKScriptMessageHandler/);
  assert.match(source, /UIDocumentPickerViewController/);
  assert.match(source, /native-file-result/);
  assert.match(source, /native-music-result/);
  assert.match(source, /native-asset-result/);
});

test('iOS host keeps local resources sandboxed and enables safe-area layout', async () => {
  const source = await read('native/ios/LuoyeWebViewController.swift');
  const display = await read('src/display-ui.js');
  assert.match(source, /loadFileURL/);
  assert.match(source, /allowingReadAccessTo/);
  assert.match(source, /viewport-fit=cover/);
  assert.match(source, /safe-area-inset/);
  assert.match(source, /WKWebsiteDataStore\.default/);
  assert.match(source, /sceneWillResignActive/);
  assert.match(source, /LUOYEFlushBeforeClose/);
  assert.match(source, /LUOYE_PLATFORM = 'ios'/);
  assert.match(display, /isIOS/);
  assert.match(display, /windowChoices=isIOS/);
});

test('iOS build helper refuses to claim a build without Xcode and copies the current dist', async () => {
  const source = await read('tools/build-ios.mjs');
  const project = await read('ios/LuoyeArtboard.xcodeproj/project.pbxproj');
  const music = await read('native/ios/LuoyeMusic.swift');
  assert.match(source, /xcodebuild/);
  assert.match(source, /iphoneos|iphonesimulator/);
  assert.match(source, /dist/);
  assert.match(source, /GeneralUser-GS\.sf2/);
  assert.match(source, /GeneralUser-GS-LICENSE\.txt/);
  assert.match(source, /Assets\.xcassets/);
  assert.match(source, /resources, 'audio'/);
  assert.match(project, /path = Resources\/audio;/);
  assert.match(project, /audio in Resources/);
  assert.doesNotMatch(project, /GeneralUser-GS\.sf2 in Resources/);
  assert.doesNotMatch(project, /Info\.plist in Resources/);
  assert.match(source, /sips/);
  assert.match(source, /1024/);
  assert.match(music, /subdirectory: "audio"/);
  assert.match(source, /throw new Error/);
});
