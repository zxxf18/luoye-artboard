import test from 'node:test';
import assert from 'node:assert/strict';
import { brandIcon } from '../src/playful-icons.js';

const themes = ['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean'];

test('brand icon keeps the original palette silhouette across themes', () => {
  const signatures = themes.map(theme => {
    const svg = brandIcon(theme);
    return {
      viewBox: svg.match(/viewBox="([^"]+)"/)?.[1],
      paths: (svg.match(/<path\b/g) || []).length,
      circles: (svg.match(/<circle\b/g) || []).length,
      groups: (svg.match(/<g\b/g) || []).length,
    };
  });
  assert.ok(signatures.every(signature => signature.viewBox === '0 0 68 68'));
  assert.ok(signatures.every(signature => signature.paths === 1 && signature.circles === 5 && signature.groups === 1));
  assert.equal(new Set(signatures.map(signature => JSON.stringify(signature))).size, 1);
});

test('about icon keeps a dedicated slot while changing theme colors', () => {
  const icons = themes.map(theme => brandIcon(theme, { slot: 'about' }));
  assert.ok(icons.every(icon => icon.includes('about-theme-icon')));
  assert.ok(new Set(icons.map(icon => icon.match(/<path fill="([^"]+)"/)?.[1])).size > 1);
});
