import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveUILanguage } from '../src/ui/i18n.js';
import { messagesEN } from '../src/ui/locales/en.js';
import { messagesJA } from '../src/ui/locales/ja.js';
import { messagesDE } from '../src/ui/locales/de.js';
import { messagesKO } from '../src/ui/locales/ko.js';
import { messagesFR } from '../src/ui/locales/fr.js';

test('an explicit language overrides browser preferences', () => {
  for (const locale of ['zh-CN', 'en', 'ja', 'de', 'ko', 'fr']) {
    assert.equal(resolveUILanguage(locale, ['es-ES', 'zh-TW']), locale);
  }
});

test('automatic language selection respects the order of supported preferences', () => {
  for (const [regional, locale] of [['en-GB', 'en'], ['fr-CA', 'fr'], ['ja-JP', 'ja'],
    ['de-AT', 'de'], ['ko-KR', 'ko'], ['zh-Hant-TW', 'zh-CN']]) {
    assert.equal(resolveUILanguage('auto', ['es-ES', regional, 'en-US']), locale);
  }
  assert.equal(resolveUILanguage('invalid', ['zh-Hans-SG']), 'zh-CN');
  assert.equal(resolveUILanguage('auto', ['es-ES']), 'en');
  assert.equal(resolveUILanguage(null), 'en');
});

test('all locales cover the same UI keys and the shipped asset names', async () => {
  const keys = Object.keys(messagesEN);
  const assets = JSON.parse(await readFile(new URL('../public/assets/catalog.json', import.meta.url), 'utf8'));
  for (const [locale, messages] of Object.entries({ en: messagesEN, ja: messagesJA, de: messagesDE, ko: messagesKO, fr: messagesFR })) {
    assert.deepEqual(Object.keys(messages), keys, locale);
    for (const name of new Set(assets.map(asset => asset.name).filter(name => /\p{Script=Han}/u.test(name)))) {
      assert.ok(messages[name], `${locale}: ${name}`);
    }
    for (const [source, translation] of Object.entries(messages)) {
      assert.ok(translation.trim(), `${locale}: ${source}`);
      if (locale !== 'ja') assert.doesNotMatch(translation, /\p{Script=Han}/u, `${locale}: ${source}`);
    }
  }
});
