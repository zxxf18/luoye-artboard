import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, name), 'utf8');

test('1.10.5 版本号在桌面、移动端和资源缓存参数中保持一致', async () => {
  const [packageText, android, ios, windows, installer, index] = await Promise.all([
    read('package.json'), read('android/app/build.gradle'), read('ios/Info.plist'),
    read('native/windows/Luoye.csproj'), read('native/windows-installer/LuoyeInstaller.csproj'), read('public/index.html'),
  ]);
  assert.match(packageText, /"version":\s*"1\.10\.5"/);
  assert.match(android, /versionName\s+'1\.10\.5'/);
  assert.equal((ios.match(/<string>1\.10\.5<\/string>/g) || []).length, 2);
  assert.match(windows, /<Version>1\.10\.5<\/Version>/);
  assert.match(installer, /<Version>1\.10\.5<\/Version>/);
  assert.match(index, /(?:styles|playroom|tool-shelf|theme-scenes)\.css\?v=1\.10\.5/g);
});
