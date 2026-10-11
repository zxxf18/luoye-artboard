import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, name), 'utf8');

test('iOS target declares a universal iPhone/iPad landscape-only app', async () => {
  const plist = await read('ios/Info.plist');
  const index = await read('public/index.html');
  assert.match(plist, /UIDeviceFamily/);
  assert.match(plist, /<integer>1<\/integer>/);
  assert.match(plist, /<integer>2<\/integer>/);
  assert.match(plist, /UISupportedInterfaceOrientations/);
  assert.match(plist, /UIInterfaceOrientationLandscapeLeft/);
  assert.match(plist, /UIInterfaceOrientationLandscapeRight/);
  assert.doesNotMatch(plist, /UIInterfaceOrientationPortrait/);
  assert.doesNotMatch(plist, /UIInterfaceOrientationPortraitUpsideDown/);
  assert.match(plist, /UIApplicationSupportsMultipleScenes<\/key>\s*<false\/>/);
  assert.match(index, /viewport-fit=cover/);
});

test('iOS shell keeps the desktop workspace and scales every control surface in landscape', async () => {
  const styles = await read('public/playroom.css');
  assert.match(styles, /html\.ios-shell \.playroom/);
  assert.match(styles, /grid-template-columns:\s*var\(--left\)\s+minmax\(0,1fr\)\s+var\(--right\)/);
  assert.match(styles, /--ios-ui-scale/);
  assert.match(styles, /transform:\s*scale\(var\(--ios-ui-scale\)\)/);
  assert.match(styles, /position:\s*absolute/);
  assert.match(styles, /width:\s*calc\(100vw\s*\/\s*var\(--ios-ui-scale\)\)/);
  assert.match(styles, /height:\s*calc\(100%\s*-\s*var\(--header\)/);
  assert.match(styles, /html\.ios-shell dialog/);
  assert.match(styles, /html\.ios-shell dialog[\s\S]*transform:\s*scale\(var\(--ios-ui-scale\)\)/);
  assert.match(styles, /html\.ios-shell \.playroom \.playful-icon/);
});

test('Xcode target defaults to iPhone and iPad platforms instead of macOS', async () => {
  const project = await read('ios/LuoyeArtboard.xcodeproj/project.pbxproj');
  assert.equal((project.match(/SDKROOT = iphoneos;/g) || []).length, 2);
  assert.equal((project.match(/SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";/g) || []).length, 2);
});

test('iOS keeps the desktop workspace instead of enabling the web mobile drawer layout', async () => {
  const source = await read('src/classic-ui.js');
  assert.match(source, /const iosDesktopShell=window\.LUOYE_PLATFORM==='ios'/);
  assert.match(source, /document\.documentElement\.classList\.add\('ios-shell'\)/);
  assert.match(source, /const compact = !iosDesktopShell &&/);
  assert.match(source, /const next=!iosDesktopShell &&/);
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
  assert.match(source, /view\.safeAreaLayoutGuide/);
  assert.match(source, /webView\.topAnchor\.constraint\(equalTo: safe\.topAnchor\)/);
  assert.doesNotMatch(source, /\.app-header \{ padding-top/);
  assert.match(source, /preferredInterfaceOrientationForPresentation:\s*UIInterfaceOrientation\s*\{\s*\.landscapeRight\s*\}/);
  assert.match(source, /supportedInterfaceOrientations:\s*UIInterfaceOrientationMask\s*\{\s*\[\.landscapeLeft,\s*\.landscapeRight\]\s*\}/);
  assert.match(source, /document\.documentElement\?\.classList\.add\('ios-shell'\)/);
  assert.match(source, /DOMContentLoaded/);
  assert.match(source, /injectionTime:\s*\.atDocumentStart/);
  assert.doesNotMatch(source, /case "portrait":/);
  assert.match(source, /initialGeometryRequested/);
  assert.match(source, /WKWebsiteDataStore\.default/);
  assert.match(source, /sceneWillResignActive/);
  assert.match(source, /LUOYEFlushBeforeClose/);
  assert.match(source, /LUOYE_PLATFORM = 'ios'/);
  assert.match(source, /final class LuoyeSceneDelegate/);
  assert.match(source, /requestLandscape/);
  assert.match(source, /sizeRestrictions/);
  assert.match(source, /sceneDidBecomeActive/);
  assert.match(display, /isIOS/);
  assert.match(display, /windowChoices=isIOS/);
  assert.match(display, /--ios-user-scale/);
  assert.match(display, /syncIOSViewportScale/);
  assert.match(display, /requestAnimationFrame\(\(\)=>requestAnimationFrame/);
});

test('Debug iOS host can run bundled native smoke scripts and export evidence', async () => {
  const host = await read('native/ios/LuoyeWebViewController.swift');
  const bridge = await read('native/ios/LuoyeBridge.swift');
  const build = await read('tools/build-ios.mjs');
  const project = await read('ios/LuoyeArtboard.xcodeproj/project.pbxproj');
  assert.match(host, /LUOYE_SMOKE_SCRIPT/);
  assert.match(host, /LUOYE_SMOKE_ORIENTATION/);
  assert.match(host, /callAsyncJavaScript\(script/);
  assert.match(host, /appendingPathExtension\("checks\.json"\)/);
  assert.match(host, /takeSnapshot/);
  assert.match(host, /appendingPathExtension\("png"\)/);
  assert.match(bridge, /runSmokeIfRequested/);
  assert.match(bridge, /smokeFileOutputURL/);
  assert.match(build, /path\.join\(resources, 'smoke'\)/);
  assert.match(build, /configuration === 'Debug'/);
  assert.match(build, /native-\[a-z0-9-\]\+\\\.js/);
  assert.match(project, /path = Resources\/smoke;/);
  assert.match(project, /smoke in Resources/);
  assert.match(project, /SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;/);
});

test('iPad journey covers compact layout, themes, drawing, assets and recovery', async () => {
  const journey = await read('tests/native-ipad-journey.js');
  assert.match(journey, /iPad 实际视口足够容纳画板/);
  assert.match(journey, /八个主题都可切换且不修改画布像素/);
  assert.match(journey, /彩虹笔和双色渐变笔/);
  assert.match(journey, /工具抽屉中的橡皮、填色和形状入口/);
  assert.match(journey, /辅助绘画在 iPad 弹窗中/);
  assert.match(journey, /图库抽屉完整显示素材/);
  assert.match(journey, /贴图保存后恢复/);
  assert.match(journey, /纸张纹理和连续笔触/);
  assert.match(journey, /runtimeErrors/);
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

test('compact mobile library keeps fairy mode choices reachable', async () => {
  const classic = await read('src/classic-ui.js');
  const styles = await read('public/playroom.css');
  assert.match(classic, /fairyGroups\.parentElement!==library/);
  assert.match(classic, /library\?\.prepend\(fairyGroups\)/);
  assert.match(styles, /data-mobile-panel="library"\]\[data-library-surface="fairy"\].*#library-groups/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});
