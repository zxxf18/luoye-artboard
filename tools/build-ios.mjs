import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resources = path.join(root, 'ios', 'Resources');
const release = path.join(root, 'build', 'releases', 'v' + JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
const configuration = process.env.CONFIGURATION || 'Debug';
const sdk = process.env.SDK || 'iphonesimulator';
const device = process.env.IOS_DEVICE || 'universal';
const distribution = process.env.IOS_DISTRIBUTION || 'community';
const archive = process.env.IOS_ARCHIVE === '1';
const team = process.env.IOS_DEVELOPMENT_TEAM;

if (process.platform !== 'darwin') throw new Error('iOS application must be built on macOS with Xcode.');
const xcode = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8' });
if (xcode.status !== 0 || !/^Xcode /m.test(xcode.stdout || '')) {
  throw new Error('没有检测到完整 Xcode。当前只有 Command Line Tools，无法编译 iPhone/iPad 应用；请安装 Xcode 后重试。');
}
if (!['iphonesimulator', 'iphoneos'].includes(sdk)) throw new Error('SDK 必须是 iphonesimulator 或 iphoneos。');
if (!['universal', 'ipad'].includes(device)) throw new Error('IOS_DEVICE 必须是 universal 或 ipad。');
if (!['community', 'store'].includes(distribution)) throw new Error('IOS_DISTRIBUTION 必须是 community 或 store。');
if (archive && (distribution !== 'store' || device !== 'ipad' || sdk !== 'iphoneos' || configuration !== 'Release')) {
  throw new Error('归档需要 iPad、上架素材、iphoneos SDK 和 Release 配置。');
}
if (team && (!archive || !/^[A-Z0-9]{10}$/.test(team))) throw new Error('签名归档需要有效的 Apple Team ID。');
const deviceSettings = device === 'ipad'
  ? ['TARGETED_DEVICE_FAMILY=2', 'IPHONEOS_DEPLOYMENT_TARGET=15.8']
  : [];

const storeDocs = path.join(root, 'docs', 'release', 'app-store-ipad');
let privacyPolicy = '';
if (distribution === 'store') {
  const policyPage = await readFile(path.join(storeDocs, 'privacy.html'), 'utf8');
  privacyPolicy = policyPage.match(/<main>([\s\S]+)<\/main>/)?.[1];
  if (!privacyPolicy) throw new Error('缺少随包发布的隐私政策。');
}
await build({ client: true, distribution, privacyPolicy });
await rm(resources, { recursive: true, force: true });
await mkdir(path.join(resources, 'audio'), { recursive: true });
await mkdir(path.join(resources, 'Assets.xcassets', 'AppIcon.appiconset'), { recursive: true });
const smoke = path.join(resources, 'smoke');
await mkdir(smoke, { recursive: true });
if (configuration === 'Debug') {
  for (const name of await readdir(path.join(root, 'tests'))) {
    if (/^native-[a-z0-9-]+\.js$/.test(name)) await cp(path.join(root, 'tests', name), path.join(smoke, name));
  }
}
await cp(path.join(root, 'dist'), path.join(resources, 'site'), { recursive: true });
if (distribution === 'store') {
  await cp(path.join(storeDocs, 'credits.txt'), path.join(resources, 'site', 'CREDITS.txt'));
}
await cp(path.join(root, 'native', 'audio'), path.join(resources, 'audio'), { recursive: true });
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
await mkdir(release, { recursive: true });

const output = path.join(release, `落叶画板${device === 'ipad' ? '-ipad-' : '-'}${sdk}${distribution === 'store' ? '-store' : ''}`);
const archivePath = output + (team ? '.xcarchive' : '-unsigned.xcarchive');
const signing = team
  ? ['-allowProvisioningUpdates', 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_STYLE=Automatic', `DEVELOPMENT_TEAM=${team}`]
  : ['CODE_SIGNING_ALLOWED=NO'];
const result = spawnSync('xcodebuild', [
  '-project', 'ios/LuoyeArtboard.xcodeproj',
  '-scheme', 'LuoyeArtboard',
  '-configuration', configuration,
  '-sdk', sdk,
  '-derivedDataPath', 'build/ios-derived',
  ...signing,
  ...deviceSettings,
  ...(archive ? ['-archivePath', archivePath, 'archive'] : ['build']),
], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
if (archive) {
  console.log(`iPad archive built: ${archivePath}`);
} else {
  const product = path.join(root, 'build', 'ios-derived', 'Build', 'Products', `${configuration}-${sdk}`, '落叶画板.app');
  const target = output + '.app';
  await rm(target, { recursive: true, force: true });
  await cp(product, target, { recursive: true });
  console.log(`iOS application built: ${target}`);
}
