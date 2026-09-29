import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { brandIcon } from '../src/playful-icons.js';

const themes = ['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean', 'candy'];

test('brand icon uses the illustrated child logo for every theme', () => {
  const images = themes.map(theme => brandIcon(theme));
  assert.ok(images.every(icon => icon.startsWith('<img ')));
  assert.ok(images.every(icon => icon.includes('src="branding/themes/app-icon-')));
  assert.ok(images.every(icon => icon.includes('class="playful-icon brand-icon brand-logo')));
  assert.ok(images.every(icon => icon.includes('.png"')));
  assert.equal(new Set(images.map(icon => icon.match(/brand-logo-([a-z]+)/)?.[1])).size, themes.length);
});

test('about icon keeps a dedicated slot and platform source', () => {
  const icons = themes.map(theme => brandIcon(theme, { slot: 'about' }));
  assert.ok(icons.every(icon => icon.includes('about-theme-icon')));
  assert.ok(icons.every(icon => icon.includes('src="branding/themes/app-icon-')));
  assert.ok(icons.every(icon => icon.includes('data-theme-logo=')));
  globalThis.LUOYE_PLATFORM = 'windows';
  assert.match(brandIcon('spring', { slot: 'about' }), /src="branding\/themes\/app-icon-spring-windows\.png"/);
  delete globalThis.LUOYE_PLATFORM;
});

test('theme cards use the matching mascot logo slot', () => {
  const icons = themes.map(theme => brandIcon(theme, { slot: 'theme' }));
  assert.ok(icons.every(icon => icon.includes('theme-card-logo')));
  assert.ok(icons.every(icon => icon.includes('data-theme-logo=')));
  assert.equal(new Set(icons.map(icon => icon.match(/data-theme-logo="([a-z]+)"/)?.[1])).size, themes.length);
});

test('theme mascot files use transparent non-black corners', () => {
  for (const theme of themes) {
    for (const suffix of ['', '-windows']) {
      const bytes = readFileSync(new URL(`../public/branding/themes/app-icon-${theme}${suffix}.png`, import.meta.url));
      const ihdrOffset = bytes.indexOf(Buffer.from('IHDR'));
      const width = bytes.readUInt32BE(ihdrOffset + 4);
      const height = bytes.readUInt32BE(ihdrOffset + 8);
      const colorType = bytes[ihdrOffset + 13];
      assert.equal(`${width}x${height}`, '192x192');
      assert.equal(colorType, 6, `${theme}${suffix} 必须是 RGBA PNG`);
      let pos = 8;
      const idat = [];
      while (pos < bytes.length) {
        const length = bytes.readUInt32BE(pos);
        const type = bytes.subarray(pos + 4, pos + 8).toString('ascii');
        if (type === 'IDAT') idat.push(bytes.subarray(pos + 8, pos + 8 + length));
        pos += length + 12;
      }
      const raw = inflateSync(Buffer.concat(idat));
      const stride = width * 4;
      assert.equal(raw[0], 0, `${theme}${suffix} 角点测试要求无滤波行`);
      for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
        const offset = 1 + y * (stride + 1) + x * 4;
        assert.equal(raw[offset + 3], 0, `${theme}${suffix} 角点必须透明`);
        assert.notDeepEqual([...raw.subarray(offset, offset + 3)], [0, 0, 0], `${theme}${suffix} 透明角点不能保留黑色 RGB`);
      }
    }
  }
});
