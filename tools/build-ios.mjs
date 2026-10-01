import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resources = path.join(root, 'ios', 'Resources');
const release = path.join(root, 'build', 'releases', 'v' + JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
const configuration = process.env.CONFIGURATION || 'Debug';
const sdk = process.env.SDK || 'iphonesimulator';

if (process.platform !== 'darwin') throw new Error('iOS application must be built on macOS with Xcode.');
const xcode = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
if (xcode.status !== 0 || !/^Xcode /m.test(xcode.stdout || '')) {
  throw new Error('没有检测到完整 Xcode。当前只有 Command Line Tools，无法编译 iPhone/iPad 应用；请安装 Xcode 后重试。');
}
if (!['iphonesimulator', 'iphoneos'].includes(sdk)) throw new Error('SDK 必须是 iphonesimulator 或 iphoneos。');

const webBuild = spawnSync('node', ['tools/build.mjs'], { cwd: root, stdio: 'inherit' });
if (webBuild.status !== 0) process.exit(webBuild.status || 1);
await rm(resources, { recursive: true, force: true });
await mkdir(path.join(resources, 'audio'), { recursive: true });
await mkdir(path.join(resources, 'Assets.xcassets', 'AppIcon.appiconset'), { recursive: true });
await cp(path.join(root, 'dist'), path.join(resources, 'site'), { recursive: true });
await cp(path.join(root, 'native', 'windows', 'audio', 'GeneralUser-GS.sf2'), path.join(resources, 'audio', 'GeneralUser-GS.sf2'));
await cp(path.join(root, 'native', 'windows', 'audio', 'LICENSE.txt'), path.join(resources, 'audio', 'GeneralUser-GS-LICENSE.txt'));
const icon = spawnSync('sips', [
  '-z', '1024', '1024',
  path.join(root, 'public', 'branding', 'app-icon.png'),
  '--out', path.join(resources, 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-1024.png'),
], { encoding: 'utf8', stdio: 'inherit' });
if (icon.status !== 0) throw new Error('无法生成 1024x1024 iOS 应用图标。');
await writeFile(path.join(resources, 'Assets.xcassets', 'Contents.json'), JSON.stringify({ info: { author: 'xcode', version: 1 } }) + '\n');
await writeFile(path.join(resources, 'Assets.xcassets', 'AppIcon.appiconset', 'Contents.json'), JSON.stringify({
  images: [{ filename: 'AppIcon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 },
}) + '\n');
// The desktop page keeps an optional remote usage tracker. The iOS bundle is
// fully offline and does not need a network request during launch.
const indexPath = path.join(resources, 'site', 'index.html');
const index = await readFile(indexPath, 'utf8');
await writeFile(indexPath, index.replace(/<script defer src="https:\/\/yebuluo\.com\.cn\/stats\/tracker\.js"[^>]*><\/script>/, ''), 'utf8');
await mkdir(release, { recursive: true });

const result = spawnSync('xcodebuild', [
  '-project', 'ios/LuoyeArtboard.xcodeproj',
  '-scheme', 'LuoyeArtboard',
  '-configuration', configuration,
  '-sdk', sdk,
  '-derivedDataPath', 'build/ios-derived',
  'CODE_SIGNING_ALLOWED=NO',
  'build',
], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const product = path.join(root, 'build', 'ios-derived', 'Build', 'Products', `${configuration}-${sdk}`, '落叶画板.app');
const target = path.join(release, `落叶画板-${sdk}.app`);
await rm(target, { recursive: true, force: true });
await cp(product, target, { recursive: true });
console.log(`iOS application built: ${target}`);
