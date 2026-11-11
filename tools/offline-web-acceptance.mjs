import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:4173/offline/';
const browsers = { chromium, webkit };
const names = process.argv.slice(3);
const ipad = {
  viewport: { width: 1024, height: 768 },
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
};

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
    const canvas = page.locator('#painting');
    const before = await canvas.evaluate(element => element.toDataURL());
    const bounds = await canvas.boundingBox();
    assert.ok(bounds?.width > 200 && bounds.height > 100, 'iPad canvas is visible');
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
    assert.deepEqual(errors, []);
    console.log(`${name}: Home Screen setup, offline launch, touch drawing, draft save and recovery passed`);
  } finally {
    await browser.close();
  }
}
