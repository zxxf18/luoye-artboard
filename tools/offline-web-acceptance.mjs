import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readAssetCatalog } from './assets/asset-distribution.mjs';
import { root } from './bundle.mjs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:4173/offline/';
const browsers = { chromium, webkit };
const names = process.argv.slice(3);
const expectedAssetCount = Number(process.env.LUOYE_OFFLINE_ASSET_COUNT || (await readAssetCatalog(root, 'store')).length);
const ipad = {
  viewport: { width: 1024, height: 768 },
  locale: 'zh-CN',
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
};

async function checkLandscapeCanvas(page) {
  const canvas = page.locator('#painting');
  await canvas.waitFor();
  const bounds = await canvas.boundingBox();
  const { width, height } = ipad.viewport;
  assert.ok(bounds && bounds.width >= 835 && bounds.height >= 465,
    `1024×768 iPad needs at least 835×465 of visible canvas, got ${JSON.stringify(bounds)}`);
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height,
    `landscape canvas stays within the screen, got ${JSON.stringify(bounds)}`);
  return bounds;
}

async function checkLockedViewport(page) {
  const viewport = await page.evaluate(() => {
    const settings = document.querySelector('meta[name="viewport"]').content;
    const gesture = new Event('gesturestart', { bubbles: true, cancelable: true });
    document.querySelector('#painting').dispatchEvent(gesture);
    window.scrollTo(100, 100);
    return {
      settings,
      gestureCanceled: gesture.defaultPrevented,
      scroll: [window.scrollX, window.scrollY],
      selection: getComputedStyle(document.querySelector('#layer-menu')).userSelect,
    };
  });
  assert.match(viewport.settings, /(?:^|,)\s*maximum-scale\s*=\s*1\s*(?:,|$)/);
  assert.match(viewport.settings, /(?:^|,)\s*user-scalable\s*=\s*no\s*(?:,|$)/);
  assert.ok(viewport.gestureCanceled, 'the workspace cancels WebKit page zoom gestures');
  assert.deepEqual(viewport.scroll, [0, 0], 'the document stays in place');
  assert.equal(viewport.selection, 'none', 'touching the toolbar cannot select its labels');
}

async function checkCompactLabels(page) {
  const problems = await page.locator(
    '#layer-menu, #palette-open, #classic-left .brush-card, .subtool-box button, #stroke-buttons button, .tool-rail .tool-button',
  ).evaluateAll(buttons => buttons.flatMap(button => {
    const bounds = button.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return [];
    const labels = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    const failures = [];
    while (labels.nextNode()) {
      const label = labels.currentNode;
      if (!label.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(label);
      const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0.5);
      if (rects.length > 1 || rects.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) {
        failures.push(label.textContent.trim());
      }
    }
    return failures;
  }));
  assert.deepEqual(problems, [], 'compact controls keep their labels on one line within the button');
}

async function checkColorSelection(page) {
  const color = page.locator('.swatch[aria-pressed="false"]').first();
  const expected = await color.getAttribute('data-color');
  await color.tap();
  const selected = await page.locator('.swatch[aria-pressed="true"]').evaluate(button => {
    const style = getComputedStyle(button);
    return {
      color: button.dataset.color,
      outline: style.outlineStyle,
      radius: style.borderRadius,
      tapHighlight: style.webkitTapHighlightColor,
    };
  });
  assert.equal(selected.color, expected, 'touch selects the tapped color');
  assert.equal(selected.outline, 'none', 'the selected color has no rectangular outline');
  assert.equal(selected.radius, '50%', 'the selected color stays round');
  assert.match(selected.tapHighlight, /^(transparent|rgba\(0, 0, 0, 0\))$/, 'native touch highlighting is transparent');
}

for (const name of names.length ? names : Object.keys(browsers)) {
  const browser = await browsers[name].launch();
  try {
    const safari = await browser.newContext(ipad);
    const preview = await safari.newPage();
    await preview.goto(url);
    await preview.locator('#offline-setup[data-state="install"]').waitFor();
    await safari.close();

    const context = await browser.newContext(ipad);
    await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    let page = await context.newPage();
    const errors = [];
    const watchErrors = current => current.on('pageerror', error => errors.push(error.message));
    watchErrors(page);
    await page.goto(url);
    await page.locator('#offline-setup[data-state="ready"]').waitFor({ state: 'attached', timeout: 180_000 });

    await context.setOffline(true);
    await page.close();
    page = await context.newPage();
    watchErrors(page);
    await page.goto(new URL('?launch=home', url).href);
    await page.locator('body[data-app-ready="true"]').waitFor();
    await page.locator('#offline-setup[data-state="ready"]').waitFor({ state: 'attached' });
    const dismiss = page.locator('#offline-dismiss');
    if (await dismiss.isVisible()) await dismiss.tap();
    await checkLockedViewport(page);
    await checkCompactLabels(page);
    assert.equal(await page.evaluate(() => window.LUOYE_ASSETS.length), expectedAssetCount, 'offline catalog has the complete edition');
    const offlineBackgrounds = await page.evaluate(async () => {
      const backgrounds = window.LUOYE_ASSETS.filter(item => item.category === 'background' && !item.coloring);
      const samples = new Map(backgrounds.map(item => [item.collection, item.src]));
      for (const src of samples.values()) {
        const image = new Image();
        image.src = src;
        await image.decode();
      }
      return samples.size;
    });
    assert.equal(offlineBackgrounds, 16, 'each colored background collection has a usable offline original');

    await page.locator('#more-open').tap();
    await page.locator('#more-dialog[open]').waitFor();
    await page.locator('#more-done').tap();
    const pencil = page.locator('#classic-left .brush-card[data-brush="pencil"]');
    const pencilBounds = await pencil.boundingBox();
    assert.ok(pencilBounds && pencilBounds.width >= 44 && pencilBounds.height >= 44,
      'the compact brush card keeps a 44×44 touch target');
    await pencil.tap();
    await page.locator('#foreground-palette').tap();
    await page.locator('#palette-dialog[open]').waitFor();
    await page.locator('#palette-cancel').tap();
    await checkColorSelection(page);
    const parameters = await page.locator('.classic-parameters').boundingBox();
    const size = await page.locator('#size').boundingBox();
    const paintColor = await page.locator('#paint-color-open').boundingBox();
    assert.ok(parameters && size && paintColor && size.y >= parameters.y &&
      paintColor.y + paintColor.height <= parameters.y + parameters.height,
    'both parameter rows remain visible beside the drawing area');
    await page.locator('#mode-library').tap();
    await page.locator('#asset-grid img').first().waitFor();
    await page.locator('#library-groups').hover();
    await page.mouse.wheel(0, 160);
    await page.waitForFunction(() => document.querySelector('#library-groups').scrollTop > 0);
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'scrolling Library groups keeps the page in place');
    await page.locator('#library-groups .subtool-card').nth(1).tap();
    await page.locator('#mode-board').tap();
    const toolPage = page.locator('#tool-page-label');
    const initialToolPage = await toolPage.textContent();
    await page.locator('#tool-page').tap();
    assert.notEqual(await toolPage.textContent(), initialToolPage, 'compact tool pager advances');
    await checkCompactLabels(page);
    await page.locator('#tool-page-prev').tap();
    assert.equal(await toolPage.textContent(), initialToolPage, 'compact tool pager goes back');
    for (const tool of ['fill', 'text', 'pen']) {
      await page.locator(`#tools button[data-tool="${tool}"]`).tap();
      await checkCompactLabels(page);
    }
    const canvas = page.locator('#painting');
    const bounds = await checkLandscapeCanvas(page);
    const before = await canvas.evaluate(element => element.toDataURL());
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.waitForFunction(() => document.getElementById('save-state').textContent.includes('草稿已保存在此设备'));
    const after = await canvas.evaluate(element => element.toDataURL());
    assert.notEqual(after, before, 'offline touch input changed the canvas');

    await page.close();
    page = await context.newPage();
    watchErrors(page);
    await page.goto(url);
    await page.locator('#recover-dialog [value="recover"]').click();
    await page.locator('body[data-app-ready="true"]').waitFor();
    assert.equal(await page.locator('#painting').evaluate(element => element.toDataURL()), after, 'offline draft restores the saved drawing');
    const restoredBounds = await checkLandscapeCanvas(page);
    const darkroom = page.locator('#darkroom-dialog');
    await darkroom.waitFor({ state: 'hidden' });
    await page.locator('#darkroom').tap();
    await page.locator('#darkroom-dialog:modal').waitFor();
    assert.deepEqual(await page.locator('#painting').boundingBox(), restoredBounds, 'darkroom opens above the canvas');
    await page.locator('#apply-effect').tap();
    await darkroom.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('#tool-hint').textContent.includes('暗房效果已应用'));
    assert.deepEqual(await page.locator('#painting').boundingBox(), restoredBounds, 'applying a darkroom effect preserves the canvas layout');
    assert.deepEqual(errors, []);
    console.log(`${name}: Home Screen setup, offline launch, iPad layout and gestures, darkroom, touch drawing, draft save and recovery passed`);
  } finally {
    await browser.close();
  }
}
