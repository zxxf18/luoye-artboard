import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildIndex } from './build.mjs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT || 'playwright');
const url = new URL('/', process.env.LUOYE_TEST_URL || 'http://127.0.0.1:4173').href;

async function verifyDialogs(engine) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(url, async route => {
      const response = await route.fetch();
      const index = buildIndex(await response.text(), {
        client: true,
        privacyPolicy: '<section lang="zh-CN">隐私政策</section><section lang="en">Privacy Policy</section>',
      });
      await route.fulfill({ response, body: index.replace('<html', '<html data-offline-web="true"') });
    });
    await page.goto(url);
    const ready = page.locator('body[data-app-ready=true]');
    await ready.waitFor();

    const checked = new Set();
    const click = selector => page.locator(selector).click();
    const focus = () => page.evaluate(() => {
      const element = document.activeElement;
      return {
        id: element.id,
        dialog: element.closest('dialog')?.id,
        outline: getComputedStyle(element).outlineStyle,
        focusVisible: element.matches(':focus-visible'),
      };
    });
    async function check(id, opener, { settings = false, leaveOpen = false } = {}) {
      if (settings) await click('#more-open');
      if (opener) await click(opener);
      const dialog = page.locator(`#${id}[open]`);
      await dialog.waitFor();
      const title = await dialog.locator('h2, [role="heading"]').first().evaluate(element => ({
        id: element.id, tabIndex: element.tabIndex,
      }));
      assert.ok(title.id, id);
      assert.equal(title.tabIndex, -1, id);
      assert.equal(await dialog.getAttribute('aria-labelledby'), title.id, id);
      const current = await focus();
      assert.equal(current.dialog, id, id);
      assert.equal(current.id, title.id, id);
      assert.equal(current.outline, 'none', id);
      checked.add(id);
      if (!leaveOpen) await dialog.evaluate(element => element.close());
    }

    await check('about-dialog', '#about-open', { leaveOpen: true });
    await check('privacy-dialog', '#privacy-open');
    await click('#about-close');
    for (const [id, opener] of [
      ['more-dialog', 'more-open'], ['theme-dialog', 'theme-open'], ['music-dialog', 'music-open'],
      ['palette-dialog', 'foreground-palette'], ['layer-dialog', 'layer-menu'], ['assist-dialog', 'assist-open'],
      ['darkroom-dialog', 'darkroom'], ['choice-dialog', 'ui-language-choose'],
    ]) await check(id, '#' + opener);
    for (const [id, opener] of [
      ['gallery-dialog', 'gallery'], ['new-dialog', 'paper-size-open'], ['export-dialog', 'export'],
      ['title-dialog', 'rename-open'], ['recording-dialog', 'recordings'], ['selection-dialog', 'selection-menu'],
      ['display-dialog', 'display-open'],
    ]) await check(id, '#' + opener, { settings: true });
    for (const [tool, id, opener] of [
      ['animation', 'animation-editor-dialog'], ['pixel', 'pixel-art-dialog'],
      ['text', 'text-dialog', '#text-options-open'], ['board-filter', 'board-filter-dialog', '#filter-preview-button'],
    ]) {
      const selector = `#tools [data-tool="${tool}"]`;
      for (let pageIndex = 0; pageIndex < 3 && !(await page.locator(selector).isVisible()); pageIndex++) {
        await click('#tool-page');
      }
      await click(selector);
      await check(id, opener);
    }

    await page.locator('#theme-open').focus();
    await page.keyboard.press('Enter');
    assert.equal((await focus()).id, 'theme-dialog-heading');
    // macOS WebKit uses Option+Tab for links and buttons by default.
    await page.keyboard.press(engine === webkit && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    const keyboardFocus = await focus();
    assert.equal(keyboardFocus.dialog, 'theme-dialog');
    assert.notEqual(keyboardFocus.outline, 'none');
    assert.ok(await page.locator('#theme-dialog [aria-pressed=true]').count());
    await page.keyboard.press('Escape');
    assert.equal((await focus()).id, 'theme-open');

    await page.evaluate(() => {
      const title = document.getElementById('title');
      title.value = 'Focus verification';
      title.dispatchEvent(new Event('input', { bubbles: true }));
      window.closeResult = window.LUOYERequestClose();
    });
    await check('close-dialog', null, { leaveOpen: true });
    await page.keyboard.press('Enter');
    assert.ok(await page.locator('#close-dialog[open]').count());
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.closeResult), { action: 'cancel' });
    await page.evaluate(() => window.LUOYEFlushBeforeClose());
    const mounted = await page.locator('dialog').evaluateAll(dialogs => dialogs.map(dialog => dialog.id));
    await page.reload();
    await check('recover-dialog', null, { leaveOpen: true });
    await page.keyboard.press('Escape');
    await ready.waitFor();
    assert.deepEqual(checked, new Set(mounted));
    assert.deepEqual(errors, []);
    console.log(`${engine.name()}: ${checked.size} dialogs, keyboard focus and dismissal passed`);
  } finally {
    await browser.close();
  }
}

await Promise.all([chromium, webkit].map(verifyDialogs));
