import test from 'node:test';
import assert from 'node:assert/strict';
import { brandIcon } from '../src/playful-icons.js';

const themes = ['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean'];

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
