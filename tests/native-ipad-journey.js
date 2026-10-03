// iPad-specific journey. The host runs this file inside the bundled WKWebView
// on an actual iPad simulator viewport; it deliberately does not resize the
// window. Drawing uses the same synthetic pointer-event harness as the other
// native journeys, so OS-level touch capture still needs device verification.
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const el = id => document.getElementById(id);
const checks = [];
const runtimeErrors = [];
window.addEventListener('error', event => runtimeErrors.push(event.message));
window.addEventListener('unhandledrejection', event => runtimeErrors.push(String(event.reason)));

function visible(node) { return Boolean(node?.getClientRects().length); }
function rect(node) { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; }
function assert(value, message) { if (!value) throw new Error(message); }
async function idle() {
  await pause(30);
  for (let i = 0; i < 500 && document.body.hasAttribute('aria-busy'); i++) await pause(20);
  assert(!document.body.hasAttribute('aria-busy'), '界面操作没有恢复响应');
  await pause(30);
}
async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, passed: true, detail: detail ?? null });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    document.body.dataset.mobilePanel = 'focus';
    await pause(80);
  }
}
async function click(id) { assert(el(id), `找不到 ${id}`); el(id).click(); await idle(); }
async function project() {
  const flushed = await window.LUOYEFlushBeforeClose();
  return flushed.project;
}
function pixels() {
  const canvas = el('painting');
  return new Uint8ClampedArray(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
}
function changed(before, after) {
  let count = 0;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) count++;
  return count;
}
function stroke(x = .25, y = .3, endX = .65, endY = .55) {
  const canvas = el('painting'), box = canvas.getBoundingClientRect();
  const originalCapture = canvas.setPointerCapture;
  canvas.setPointerCapture = () => {};
  try {
    for (const [type, px, py, buttons] of [['pointerdown', x, y, 1], ['pointermove', endX, endY, 1], ['pointerup', endX, endY, 0]]) {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 91, pointerType: 'mouse', button: 0, buttons,
        clientX: box.x + box.width * px, clientY: box.y + box.height * py,
      }));
    }
  } finally { canvas.setPointerCapture = originalCapture; }
}
async function closeMobilePanel() {
  const focus = document.querySelector('.mobile-command[data-mobile-panel="focus"]');
  if (focus && document.body.dataset.mobilePanel !== 'focus') { focus.click(); await pause(120); }
}
async function openMobilePanel(name) {
  const button = document.querySelector(`.mobile-command[data-mobile-panel="${name}"]`);
  assert(button, `找不到 iPad 抽屉入口 ${name}`);
  button.click();
  await pause(120);
  assert(document.body.dataset.mobilePanel === name, `${name} 抽屉没有打开`);
}

await check('iPad 实际视口足够容纳画板', () => {
  const viewport = rect(el('viewport'));
  assert(innerWidth >= 700 && innerHeight >= 700, `不是 iPad 视口：${innerWidth}x${innerHeight}`);
  assert(viewport.width >= 360 && viewport.height >= 240, `画板空间过小：${viewport.width}x${viewport.height}`);
  return { viewport: { width: innerWidth, height: innerHeight }, paper: viewport };
});

await check('iPad 工具栏和按钮不发生溢出', () => {
  const header = rect(document.querySelector('.app-header'));
  assert(header.height <= 96, `顶部工具栏过高：${header.height}`);
  const targets = [...document.querySelectorAll('.header-actions button,.brush-card,.tool-button,.swatch,.left-actions button')].filter(visible);
  // Brush/tool shelves intentionally scroll on an iPad when all choices do
  // not fit in one row. Validate the shelf itself stays in the viewport while
  // allowing its reachable children to extend inside that scrollport.
  const inViewportScrollport = node => {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (!/(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`)) continue;
      const r = rect(parent);
      return r.x >= -1 && r.right <= innerWidth + 1 && r.y >= -1 && r.bottom <= innerHeight + 1;
    }
    return false;
  };
  const overflow = targets.filter(node => { const r = rect(node); return !inViewportScrollport(node) && (r.x < -1 || r.right > innerWidth + 1 || r.y < -1 || r.bottom > innerHeight + 1); });
  assert(!overflow.length, `有 ${overflow.length} 个按钮超出 iPad 窗口`);
  return { headerHeight: header.height, targetCount: targets.length };
});

await check('八个主题都可切换且不修改画布像素', async () => {
  const before = el('painting').toDataURL();
  await click('theme-open');
  const cards = [...document.querySelectorAll('#theme-dialog [data-theme]')];
  assert(cards.length === 8, `主题数量错误：${cards.length}`);
  for (const card of cards) {
    card.click();
    await pause(50);
    assert(document.body.dataset.theme === card.dataset.theme, `主题没有切换到 ${card.dataset.theme}`);
    assert(document.querySelector('.brand [data-theme-logo]')?.dataset.themeLogo === card.dataset.theme, `Logo 没有同步到 ${card.dataset.theme}`);
  }
  assert(el('painting').toDataURL() === before, '主题切换改变了画布内容');
  document.querySelector('#theme-done').click();
  return { themes: cards.map(card => card.dataset.theme), selected: document.body.dataset.theme };
});

await check('画笔盒包含彩虹笔和双色渐变笔并能实际落笔', async () => {
  await openMobilePanel('brushes');
  const canvas = el('painting');
  for (const brush of ['rainbow', 'duotone']) {
    const button = document.querySelector(`[data-brush="${brush}"]`);
    assert(button, `找不到 ${brush}`);
    button.click();
    const before = pixels();
    stroke(.2, .2, .7, .35);
    await idle();
    assert(canvas.dataset.brush === brush, `${brush} 没有成为当前画笔`);
    assert(changed(before, pixels()) > 20, `${brush} 没有画出笔迹`);
  }
  await closeMobilePanel();
});

await check('工具抽屉中的橡皮、填色和形状入口可达', async () => {
  await openMobilePanel('tools');
  for (const tool of ['eraser', 'fill', 'line']) {
    const button = document.querySelector(`[data-tool="${tool}"]`);
    assert(button, `找不到工具 ${tool}`);
    button.click();
    await idle();
    assert(el('painting').dataset.tool === tool, `${tool} 没有成为当前工具`);
  }
  for (const shape of ['rect', 'ellipse']) {
    const label = [...el('geometry').options].find(option => option.value === shape)?.textContent;
    const option = [...document.querySelectorAll('.subtool-box .subtool-card')].find(node => node.textContent.includes(label));
    assert(option, `找不到图形 ${shape}`);
    option.click();
    await idle();
    assert(el('geometry').value === shape, `图形 ${shape} 没有生效`);
  }
  await closeMobilePanel();
});

await check('辅助绘画在 iPad 弹窗中可设置并驱动新笔触', async () => {
  await click('assist-open');
  assert(el('assist-dialog').open, '辅助绘画弹窗没有打开');
  el('assist-enabled').checked = true;
  el('assist-enabled').dispatchEvent(new Event('change', { bubbles: true }));
  el('assist-mode').value = 'radial';
  el('assist-mode').dispatchEvent(new Event('change', { bubbles: true }));
  el('assist-axes').value = 6;
  el('assist-axes').dispatchEvent(new Event('input', { bubbles: true }));
  assert(document.body.dataset.assistEnabled === 'true', '辅助状态没有开启');
  assert(el('assist-dialog').dataset.assistMode === 'radial', '环形辅助没有生效');
  el('assist-dialog').close();
  const before = pixels();
  document.querySelector('[data-tool="pen"]').click();
  stroke(.35, .2, .55, .3);
  await idle();
  assert(changed(before, pixels()) > 20, '开启辅助后画布没有响应笔触');
});

await check('图库抽屉完整显示素材并保持入口在窗口内', async () => {
  await openMobilePanel('library');
  const tray = rect(document.querySelector('.right-panel'));
  assert(tray.x >= 0 && tray.right <= innerWidth + 1 && tray.y >= 0 && tray.bottom <= innerHeight + 1, '图库抽屉超出 iPad 窗口');
  const categories = document.querySelectorAll('#categories button');
  assert(categories.length >= 3, '图库分类没有完整显示');
  const beforeLayers = Number(el('layer-count').textContent);
  document.querySelector('[data-category="sticker"]')?.click();
  await pause(80);
  const asset = el('asset-grid').querySelector('button');
  assert(asset, '贴图列表为空或无法点击');
  asset.click();
  await idle();
  assert(Number(el('layer-count').textContent) > beforeLayers, '贴图没有生成新图层');
  await closeMobilePanel();
  return { tray, categories: categories.length, layers: Number(el('layer-count').textContent) };
});

await check('贴图保存后恢复仍保留图层位置和缩放', async () => {
  const before = await project();
  const layer = before.layers.at(-1);
  assert(layer && layer.role !== 'background', '没有可验证的贴图层');
  const folder = `iPad-${Date.now()}`;
  await click('gallery');
  el('gallery-folder').value = folder;
  await click('gallery-save');
  await click('gallery-close');
  await click('new');
  await click('gallery');
  const card = [...el('gallery-items').children].find(node => node.textContent.includes(folder));
  assert(card, '画夹中没有找到 iPad 测试作品');
  card.querySelector('button')?.click();
  await idle();
  const after = await project();
  const restored = after.layers.find(item => item.id === layer.id) || after.layers.at(-1);
  assert(restored && restored.x === layer.x && restored.y === layer.y && restored.scale === layer.scale, '恢复后贴图位置或缩放发生变化');
  return { layer: { x: restored.x, y: restored.y, scale: restored.scale } };
});

await check('纸张纹理和连续笔触保持响应', async () => {
  await openMobilePanel('options');
  const grain = el('paper-grain-choose');
  assert(grain, '找不到纸感设置');
  grain.click();
  await pause(50);
  const grainOption = document.querySelector('#choice-grid [data-value="grain-0"]');
  assert(grainOption, '纸纹选项没有显示');
  grainOption.click();
  await idle();
  await closeMobilePanel();
  document.querySelector('[data-tool="pen"]').click();
  const started = performance.now();
  for (let i = 0; i < 10; i++) stroke(.1 + i * .07, .65, .12 + i * .07, .75);
  await idle();
  assert(performance.now() - started < 8000, '连续笔触响应超过 8 秒');
  return { elapsedMilliseconds: Math.round(performance.now() - started) };
});

await check('iPad 测试过程没有未处理运行错误', () => {
  assert(!runtimeErrors.length, runtimeErrors.join('; '));
});

return {
  passed: checks.every(check => check.passed),
  checks,
  viewport: { width: innerWidth, height: innerHeight },
  runtimeErrors,
};
