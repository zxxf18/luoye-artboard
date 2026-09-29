const frame = document.querySelector('iframe');
const results = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw Error(message); }
function inside(el, root) {
  const a = el.getBoundingClientRect(), b = root.getBoundingClientRect();
  return a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
}
async function load(width, height) {
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.contentWindow?.localStorage?.removeItem('luoye-theme');
  await new Promise(resolve => { frame.onload = resolve; frame.src = '/'; });
  const doc = frame.contentDocument;
  for (let i = 0; i < 240 && doc.body.dataset.appReady !== 'true'; i++) await pause(25);
  assert(doc.body.dataset.appReady === 'true', `${width}×${height} 应用未完成初始化`);
  await pause(120);
  return doc;
}
function visible(node) { return node && node.getClientRects().length > 0; }
function box(node) {
  const rect = node?.getBoundingClientRect?.();
  return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
}
function overlaps(a, b, margin = 1) {
  const x = box(a), y = box(b);
  return x && y && x.left < y.right - margin && x.right > y.left + margin && x.top < y.bottom - margin && x.bottom > y.top + margin;
}
function iconSignature(icon) {
  if (!icon) return null;
  const rect = box(icon), viewBox = icon.getAttribute('viewBox') || '';
  const shape = [...icon.querySelectorAll('path, circle, rect, ellipse, polygon')].map(node => [
    node.tagName, node.getAttribute('d') || '', node.getAttribute('cx') || '', node.getAttribute('cy') || '',
    node.getAttribute('r') || '', node.getAttribute('rx') || '', node.getAttribute('ry') || '',
  ].join(':')).join('|');
  return {
    tag: icon.tagName,
    viewBox,
    shape,
    paths: icon.querySelectorAll('path').length,
    circles: icon.querySelectorAll('circle').length,
    groups: icon.querySelectorAll('g').length,
    width: Math.round(rect?.width || 0),
    height: Math.round(rect?.height || 0),
  };
}
function themedIcon(doc, selector) {
  return doc.querySelector(selector);
}
function warmYellow(value) {
  const channels = value.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (channels.length < 3 || channels[3] === 0) return false;
  const [r, g, b] = channels;
  // Old playroom controls use high-red, warm-yellow fills (#ffefd1, #ffe3b2,
  // #ffdb97, #f6c979, ...). Cream paper and white surfaces are excluded by
  // the blue-channel threshold; real swatches are excluded by selector.
  return r > 230 && g > 165 && b < 220 && g - b > 18;
}
function themedControlResiduals(doc) {
  // Autumn is the preserved original skin; its warm amber controls are the
  // intentional baseline. Other skins must not inherit those legacy fills.
  if (doc.body.dataset.theme === 'autumn') return [];
  const selector = [
    '.header-actions button', '.workspace-tabs button', '.tool-button',
    '.brush-card', '.subtool-card', '.detail-bar > label', '.parameter-slider',
    '.left-actions button', '.more-colors',
    '#palette-open', '#more-open', '#theme-open', '#display-open',
    '.tool-page',
  ].join(',');
  return [...doc.querySelectorAll(selector)].filter(visible).filter(node => {
    if (node.matches('.theme-card, .theme-card-preview, .swatch, .preset-color, .color-value-control, .color-history-value')) return false;
    return warmYellow(getComputedStyle(node).backgroundColor);
  });
}
async function inspectAboutIcon(doc, themeId) {
  const themeDialog = doc.querySelector('#theme-dialog');
  if (themeDialog?.open) themeDialog.close();
  doc.querySelector('#more-open')?.click();
  await pause(20);
  const aboutButton = doc.querySelector('#about-open');
  assert(visible(aboutButton), `关于入口不可见：${themeId}`);
  aboutButton.click();
  await pause(20);
  const about = doc.querySelector('#about-dialog');
  assert(about?.open, `关于弹窗未打开：${themeId}`);
  const icon = themedIcon(about, '.about-mark .about-theme-icon, .about-mark [data-theme-icon], .about-mark svg');
  assert(icon && visible(icon), `关于缺少主题图标：${themeId}`);
  const mark = icon.closest('.about-mark');
  const painted = icon.querySelector('path, circle, rect, ellipse, polygon') || icon;
  const iconStyle = getComputedStyle(painted), markStyle = getComputedStyle(mark);
  const variant = [
    iconStyle.fill, iconStyle.stroke, iconStyle.color,
    markStyle.backgroundColor, icon.dataset.theme || icon.dataset.themeIcon || '',
  ].join('|');
  const signature = iconSignature(icon);
  about.querySelector('#about-close')?.click();
  await pause(20);
  doc.querySelector('#theme-open')?.click();
  await pause(20);
  return { signature, variant };
}
function contrast(fg, bg) {
  const parse = value => { const m = value.match(/\d+(?:\.\d+)?/g)?.map(Number) || []; return m.length >= 3 ? m.slice(0, 3).map(v => v / 255) : null; };
  const luminance = value => { const rgb = parse(value); if (!rgb) return null; return rgb.reduce((sum, channel, i) => sum + (channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i], 0); };
  const a = luminance(fg), b = luminance(bg); return a === null || b === null ? 99 : (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
async function pick(doc, id) {
  const entry = doc.querySelector('#theme-open');
  assert(visible(entry), '换肤入口不可见');
  assert(entry && entry.getAttribute('aria-label') === '主题', '主题入口缺失');
  entry.click();
  await pause(15);
  const dialog = doc.querySelector('#theme-dialog');
  const card = dialog?.querySelector(`.theme-card[data-theme="${id}"]`);
  assert(dialog?.open && card, `主题卡片缺失：${id}`);
  card.click();
  await pause(180);
  assert(doc.body.dataset.theme === id, `主题没有切换到 ${id}`);
  assert(card.getAttribute('aria-pressed') === 'true', `主题选中态没有同步：${id}`);
  return dialog;
}
for (const [width, height] of [[1280, 720], [568, 320], [375, 240], [2560, 1440]]) {
  try {
    const doc = await load(width, height);
    const painting = doc.querySelector('#painting');
    const canvasSize = `${painting.width}×${painting.height}`;
    const asset = doc.querySelector('#asset-grid .asset img');
    const assetSource = asset?.getAttribute('src') || '';
    const canvasPixels = painting.toDataURL();
    const foreground = doc.querySelector('#foreground-palette')?.style.backgroundColor;
    const background = doc.querySelector('#background-palette')?.style.backgroundColor;
    const history = doc.querySelector('#foreground-history')?.innerHTML;
    const brandIcon = themedIcon(doc, '.brand .brand-icon-svg, .brand .brand-icon, .brand [data-brand-icon]');
    assert(brandIcon && visible(brandIcon), '左上缺少独立应用图标');
    assert(!brandIcon.closest('.theme-scene'), '主题动效不应替换左上应用图标');
    const brandSignature = iconSignature(brandIcon);
    const aboutVariants = [];
    const aboutSignatures = [];
    assert(doc.querySelector('#theme-open')?.closest('.header-actions'), '换肤入口不在主工具栏');
    assert(doc.querySelector('#display-open')?.closest('#more-dialog .more-actions'), '界面大小入口未放入设置');
    assert(doc.querySelector('#about-open')?.parentElement?.lastElementChild === doc.querySelector('#about-open'), '关于必须是设置最后一项');
    assert(inside(brandIcon, doc.querySelector('.app-header')), '左上应用图标超出顶部栏边界');
    for (const id of ['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean']) {
      const dialog = await pick(doc, id);
      const box = dialog.getBoundingClientRect();
      assert(box.left >= 2 && box.top >= 2 && box.right <= width - 2 && box.bottom <= height - 2, `主题弹窗越出窗口：${width}×${height}`);
      assert(dialog.scrollHeight <= dialog.clientHeight + 2, `主题弹窗需要滚动：${width}×${height} / ${id}`);
      assert(`${painting.width}×${painting.height}` === canvasSize, `换肤改变了画纸分辨率：${id}`);
      assert(painting.toDataURL() === canvasPixels, `换肤改变了画布像素：${id}`);
      assert(doc.querySelector('#foreground-palette')?.style.backgroundColor === foreground, `换肤改变了前景色：${id}`);
      assert(doc.querySelector('#background-palette')?.style.backgroundColor === background, `换肤改变了第二色：${id}`);
      assert(doc.querySelector('#foreground-history')?.innerHTML === history, `换肤改变了历史色：${id}`);
      assert((doc.querySelector('#asset-grid .asset img')?.getAttribute('src') || '') === assetSource, `换肤改变了素材：${id}`);
      const scenes = [...doc.querySelectorAll('.theme-scene')];
      assert(scenes.every(scene => scene.closest('.brand') && !scene.closest('#painting, .canvas-sheet, .asset img, .asset canvas')), `主题动效越界：${id}`);
      assert(!doc.querySelector('.theme-decoration'), '不应存在全屏主题装饰层');
      const currentBrandIcon = themedIcon(doc, '.brand .brand-icon-svg, .brand .brand-icon, .brand [data-brand-icon]');
      assert(currentBrandIcon && !currentBrandIcon.closest('.theme-scene'), `左上图标被主题动效替换：${id}`);
      assert(JSON.stringify(iconSignature(currentBrandIcon)) === JSON.stringify(brandSignature), `主题切换改变左上图标结构：${id}`);
      assert(inside(currentBrandIcon, doc.querySelector('.app-header')), `主题图标超出顶部栏边界：${id}`);
      const residuals = themedControlResiduals(doc);
      assert(!residuals.length, `主题 ${id} 仍有未换肤的暖黄色控件：${residuals.slice(0, 4).map(node => node.id || node.className).join(', ')}`);
      const classic = doc.querySelector('.classic-colors'), panel = doc.querySelector('.classic-left');
      if (classic && panel) {
        assert(contrast(getComputedStyle(classic).backgroundColor, getComputedStyle(panel).backgroundColor) >= 1.05, `颜色面板层次不足：${id}`);
        const heading = classic.querySelector('h3');
        if (heading) assert(contrast(getComputedStyle(heading).color, getComputedStyle(classic).backgroundColor) >= 4.5, `颜色面板文字对比度不足：${id}`);
      }
      const cards = [...dialog.querySelectorAll('.theme-card')];
      for (const button of dialog.querySelectorAll('button')) assert(visible(button), `主题按钮不可点击：${id}`);
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
        assert(!overlaps(cards[i], cards[j]), `主题卡片重叠：${id} / ${i + 1}-${j + 1}`);
      }
      const about = await inspectAboutIcon(doc, id);
      aboutVariants.push(about.variant);
      aboutSignatures.push(about.signature);
    }
    assert(new Set(aboutVariants).size >= 2, '关于图标没有随主题更换视觉配色');
    for (const signature of aboutSignatures) {
      assert(signature && signature.paths + signature.circles > 0, '关于主题图标缺少可绘制轮廓');
      assert(signature.width > 0 && signature.height > 0, '关于主题图标没有可见尺寸');
    }
    doc.querySelector('#theme-done').click();
    await pause(15);
    assert(!doc.querySelector('#theme-dialog').open, '主题弹窗没有关闭');
    const persisted = await doc.defaultView.localStorage.getItem('luoye-theme');
    assert(persisted === 'ocean', '主题没有写入本地配置');
    await new Promise(resolve => { frame.onload = resolve; frame.src = '/'; });
    const reloaded = frame.contentDocument;
    for (let i = 0; i < 240 && reloaded.body.dataset.appReady !== 'true'; i++) await pause(25);
    assert(reloaded.body.dataset.theme === 'ocean', `重新打开没有保持主题：${width}×${height}`);
    assert(reloaded.querySelectorAll('.theme-scene').length <= 1, '主题场景重复挂载');
    reloaded.querySelector('#reset-settings').click();
    await pause(80);
    assert(reloaded.body.dataset.theme === 'autumn', '重置设置没有恢复秋季主题');
    assert(reloaded.defaultView.localStorage.getItem('luoye-theme') === null, '重置设置没有清除主题偏好');
    const controls = [...reloaded.querySelectorAll('.theme-card, #theme-open')].filter(node => node.getClientRects().length);
    assert(controls.every(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0), '主题控件没有可用尺寸');
    results.push({ name: `${width}×${height} · 七主题、持久化、画布与素材`, passed: true });
  } catch (error) {
    results.push({ name: `${width}×${height} · 七主题、持久化、画布与素材`, passed: false, error: error.message });
  }
}
document.querySelector('#results').replaceChildren(...results.map(result => {
  const li = document.createElement('li');
  li.textContent = `${result.passed ? '通过' : '失败'} ${result.name}${result.error ? ` — ${result.error}` : ''}`;
  return li;
}));
document.querySelector('#summary').textContent = `${results.filter(result => result.passed).length}/${results.length} passed`;
document.body.dataset.results = JSON.stringify(results);
