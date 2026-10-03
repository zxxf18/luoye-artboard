// Responsive drawer regression tests. The app is loaded in an iframe so a
// single browser page can exercise real WebView-sized layout viewports.
const frame = document.querySelector('iframe');
const results = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw Error(message); };
const visible = node => {
  if (!node || node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
  const css = frame.contentWindow.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  return css.display !== 'none' && css.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
};
const rect = node => node.getBoundingClientRect();
const intersects = (a, b, margin = 1) => a.right > b.left + margin && a.left < b.right - margin && a.bottom > b.top + margin && a.top < b.bottom - margin;
const inside = (node, root, margin = 1) => {
  const a = rect(node), b = rect(root);
  return a.left >= b.left - margin && a.right <= b.right + margin && a.top >= b.top - margin && a.bottom <= b.bottom + margin;
};
const horizontallyInside = (node, root, margin = 1) => {
  const a = rect(node), b = rect(root);
  return a.left >= b.left - margin && a.right <= b.right + margin;
};
const overlap = (a, b, margin = 1) => intersects(rect(a), rect(b), margin);
function noOverlap(nodes, label) {
  const items = nodes.filter(visible);
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    assert(!overlap(items[i], items[j]), `${label}重叠: ${items[i].id || items[i].className || items[i].tagName} / ${items[j].id || items[j].className || items[j].tagName}`);
  }
}
function inViewport(node, message) {
  const body = frame.contentDocument.documentElement;
  assert(inside(node, body), message);
}
function intersectsViewport(node, message) {
  const body = frame.contentDocument.documentElement;
  assert(intersects(rect(node), rect(body), 0), message);
}
async function waitReady(doc) {
  for (let i = 0; i < 240 && doc.body.dataset.appReady !== 'true'; i++) await pause(25);
  assert(doc.body.dataset.appReady === 'true', '应用未完成初始化');
  doc.querySelector('#recover-dialog[open] [value="cancel"]')?.click();
  await pause(180);
}
async function clickPanel(doc, panel) {
  const button = doc.querySelector(`.mobile-command[data-mobile-panel="${panel}"]`);
  assert(button && visible(button), `小屏入口不可见: ${panel}`);
  button.click();
  await pause(80);
  assert(doc.body.dataset.mobilePanel === panel, `未打开小屏面板: ${panel}`);
}
function drawerFor(doc, panel) {
  return panel === 'brushes' ? doc.querySelector('.classic-left')
    : panel === 'tools' ? doc.querySelector('.tool-rail')
      : doc.querySelector('.tool-dock');
}
function assertDrawerFrame(doc, panel) {
  const drawer = drawerFor(doc, panel);
  assert(drawer && visible(drawer), `抽屉不可见: ${panel}`);
  inViewport(drawer, `${panel} 抽屉超出窗口`);
  const style = frame.contentWindow.getComputedStyle(drawer);
  assert(style.overflowX !== 'visible', `${panel} 抽屉横向内容未隔离`);
  assert(rect(drawer).width >= Math.min(220, frame.contentWindow.innerWidth - 8), `${panel} 抽屉宽度过小`);
  return drawer;
}
function assertScrollReachable(scrollbox, first, last, label) {
  if (!scrollbox || !visible(scrollbox) || !first || !last) return;
  const horizontal = scrollbox.scrollWidth > scrollbox.clientWidth + 2;
  const vertical = scrollbox.scrollHeight > scrollbox.clientHeight + 2;
  const left = scrollbox.scrollLeft, top = scrollbox.scrollTop;
  if (horizontal) {
    assert(first.offsetLeft >= 0 && last.offsetLeft > first.offsetLeft, `${label} 横向内容顺序异常`);
    scrollbox.scrollLeft = Math.max(0, scrollbox.scrollWidth - scrollbox.clientWidth);
    assert(last.offsetLeft - scrollbox.scrollLeft < scrollbox.clientWidth + last.offsetWidth, `${label} 末项无法横向滚动到`);
  }
  if (vertical) {
    const maxTop = Math.max(0, scrollbox.scrollHeight - scrollbox.clientHeight);
    scrollbox.scrollTop = maxTop;
    assert(scrollbox.scrollTop === maxTop, `${label} 无法纵向滚动到末端`);
  }
  scrollbox.scrollLeft = left; scrollbox.scrollTop = top;
}
function checkCompactHeader(doc, width, height) {
  const narrow = width <= 860 || height <= 600;
  if (!narrow) return;
  const view = frame.contentWindow;
  const newQuick = doc.querySelector('#new-quick');
  const reset = doc.querySelector('#reset-settings');
  const themeIcon = doc.querySelector('#theme-open > .playful-icon');
  const save = doc.querySelector('#save');
  const more = doc.querySelector('#more-open');
  assert(newQuick && reset && themeIcon && save && more, '小屏顶栏缺少快捷操作或主题图标');
  assert(parseFloat(view.getComputedStyle(newQuick).fontSize) <= 9.1, '小屏新画纸文案仍然过大');
  // Reset/open/export/gallery are intentionally folded into 设置 on compact
  // windows. They remain the same button nodes so their handlers and keyboard
  // semantics are preserved, but they should not compete with the canvas in
  // the top row.
  assert(reset.closest('#more-dialog .more-actions'), '小屏重置没有收进设置面板');
  assert(doc.querySelector('#open')?.closest('#more-dialog .more-actions'), '小屏打开没有收进设置面板');
  assert(doc.querySelector('#export')?.closest('#more-dialog .more-actions'), '小屏导出没有收进设置面板');
  assert(doc.querySelector('#gallery')?.closest('#more-dialog .more-actions'), '小屏画夹没有收进设置面板');
  const moreActions = doc.querySelector('#more-dialog .more-actions');
  const actionIds = moreActions ? [...moreActions.children].map(node => node.id).filter(Boolean) : [];
  assert(actionIds.at(-1) === 'about-open', '关于没有保持在设置面板最后');
  assert(doc.querySelectorAll('.header-actions > button').length <= 6, '小屏顶部快捷栏仍放入过多按钮');
  assert(rect(themeIcon).width <= 20.5 && rect(themeIcon).height <= 20.5, '小屏主题图标仍然过大');
}
function checkBrushDrawer(doc) {
  const drawer = assertDrawerFrame(doc, 'brushes');
  const rows = [drawer.querySelector('.classic-colors'), drawer.querySelector('.brush-box:not([hidden])'), drawer.querySelector('.subtool-box:not([hidden])'), drawer.querySelector('#stroke-buttons:not([hidden])'), drawer.querySelector('.left-actions')];
  noOverlap(rows, '画笔抽屉分区');
  for (const row of rows.filter(visible)) assert(horizontallyInside(row, drawer), '画笔抽屉分区横向溢出');
  const colors = [drawer.querySelector('#foreground-palette'), drawer.querySelector('#background-palette'), drawer.querySelector('#swap-colors')];
  noOverlap(colors, '前景/背景色控件');
  const box = drawer.querySelector('.brush-box:not([hidden])');
  if (box) {
    const cards = [...box.querySelectorAll('.brush-card')];
    assert(cards.length >= 9, '画笔抽屉缺少画笔卡片');
    noOverlap(cards, '画笔卡片');
    assert(box.scrollWidth >= box.clientWidth, '画笔卡片滚动容器尺寸异常');
    for (const card of cards) {
      assert(rect(card).width >= 96 && rect(card).height >= 48, '画笔卡片被压扁');
      const internals = [card.querySelector('.playful-icon'), ...card.querySelectorAll(':scope > span:not(.brush-sample)'), card.querySelector('.brush-sample')];
      noOverlap(internals, '画笔卡片内容');
    }
    assertScrollReachable(box, cards[0], cards.at(-1), '画笔卡片');
  }
  const actions = drawer.querySelector('.left-actions');
  if (actions && visible(actions)) noOverlap([...actions.querySelectorAll(':scope > button')], '画笔操作按钮');
}
function checkToolDrawer(doc) {
  const drawer = assertDrawerFrame(doc, 'tools');
  const bar = drawer.querySelector('#tools');
  const cards = [...drawer.querySelectorAll('.tool-button')];
  assert(bar && cards.length >= 10, '工具抽屉缺少工具');
  noOverlap(cards, '工具卡片');
  for (const card of cards) assert(rect(card).height <= rect(drawer).height + 1, '工具卡片纵向溢出');
  const page = drawer.querySelector('#tool-page');
  if (page && visible(page)) inViewport(page, '工具分页按钮超出窗口');
  assert(bar.scrollWidth >= bar.clientWidth, '工具横向滚动区域尺寸异常');
  assertScrollReachable(bar, cards[0], cards.at(-1), '工具卡片');
}
function checkOptionsDrawer(doc) {
  const drawer = assertDrawerFrame(doc, 'options');
  const parameters = drawer.querySelector('.classic-parameters');
  assert(parameters && visible(parameters), '参数抽屉缺少参数区');
  assert(parameters.scrollWidth <= parameters.clientWidth + 2, '参数抽屉横向溢出');
  const groups = [parameters.querySelector('.brush-inspector'), parameters.querySelector('.options-bar'), parameters.querySelector('.primary-brush-options'), parameters.querySelector('#stroke-buttons'), parameters.querySelector('#library-pagination'), parameters.querySelector('#library-instruction')];
  noOverlap(groups, '参数抽屉分区');
  for (const group of groups.filter(visible)) assert(horizontallyInside(group, parameters), '参数分区横向溢出');
  const controls = [...parameters.querySelectorAll('input,button,.choice-button,output')].filter(visible);
  assert(controls.length > 5, '参数抽屉内容不足');
  noOverlap(controls.filter(control => control.parentElement === parameters), '参数控件');
  for (const id of ['size', 'opacity', 'brush-ratio', 'paint-color-open']) {
    const control = doc.getElementById(id);
    if (control && visible(control)) assert(horizontallyInside(control, parameters), `参数控件横向超出滚动容器: ${id}`);
  }
}
function checkLibraryDrawer(doc) {
  const drawer = assertDrawerFrame(doc, 'library');
  const panel = drawer.querySelector('.right-panel'), library = drawer.querySelector('.library'), grid = drawer.querySelector('#asset-grid');
  assert(panel && library && grid && visible(panel), '素材抽屉内容不可见');
  assert(grid.scrollWidth <= grid.clientWidth + 2, '素材卡片横向溢出');
  const sections = [library.querySelector('.panel-heading'), library.querySelector('.panel-description'), library.querySelector('.categories'), grid, library.querySelector('.library-tip'), library.querySelector('#library-pagination'), library.querySelector('#library-instruction')];
  noOverlap(sections, '素材抽屉分区');
  for (const section of sections.filter(visible)) assert(horizontallyInside(section, library), '素材抽屉分区横向溢出');
  const categories = [...library.querySelectorAll('.categories button')].filter(visible);
  noOverlap(categories, '素材分类按钮');
  const assets = [...grid.querySelectorAll('.asset')];
  assert(assets.length > 0, '素材抽屉没有卡片');
  noOverlap(assets, '素材卡片');
  for (const asset of assets) {
    assert(rect(asset).width >= 76 && rect(asset).height >= 54, '素材卡片被压扁');
    assert(rect(asset).width <= grid.clientWidth + 2, '素材卡片宽度超出网格');
    const image = asset.querySelector('img'), label = asset.querySelector('span:not(.asset-add)');
    if (image && visible(image)) assert(inside(image, asset), '素材缩略图超出卡片');
    if (label && visible(label)) assert(inside(label, asset), '素材名称超出卡片');
  }
  const pager = library.querySelector('#library-pagination'), instruction = library.querySelector('#library-instruction');
  if (pager && visible(pager)) {
    const narrow = frame.contentWindow.innerWidth <= 640 || frame.contentWindow.innerHeight <= 500;
    if (narrow) assert(horizontallyInside(pager, drawer), '素材分页横向超出抽屉'); else inViewport(pager, '素材分页超出窗口');
    noOverlap([...pager.querySelectorAll('button')], '素材分页按钮');
    // At the narrowest height the page count may be visually collapsed to
    // preserve the two touch buttons; the buttons and their scroll container
    // are the actionable contract we verify here.
  }
  if (instruction && visible(instruction)) { assert(inside(instruction, library), '素材提示超出图库'); noOverlap([...instruction.children], '素材提示内容'); }
  assertScrollReachable(library, library.querySelector('.panel-heading'), assets.at(-1), '图库内容');
}
function checkAssistDialog(doc) {
  const open = doc.querySelector('#assist-open');
  assert(open && visible(open), '辅助入口不可见');
  open.click();
  const dialog = doc.querySelector('#assist-dialog');
  assert(dialog?.open && visible(dialog), '辅助面板未打开');
  inViewport(dialog, '辅助面板超出窗口');
  const form = dialog.querySelector('.assist-form');
  assert(form && form.scrollWidth <= form.clientWidth + 2, '辅助面板横向溢出');
  const rows = [...form.children].filter(visible);
  noOverlap(rows, '辅助面板分区');
  for (const row of rows) assert(inside(row, form), '辅助面板分区超出表单');
  const mode = dialog.querySelector('#assist-mode'), axes = dialog.querySelector('#assist-axes');
  assert(mode && axes, '辅助模式控件缺失');
  mode.value = 'radial'; mode.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
  axes.value = '8'; axes.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
  assert(dialog.querySelector('#assist-axes-value')?.textContent.includes('8'), '辅助轴数控件未生效');
  dialog.querySelector('.assist-close')?.click();
  assert(!dialog.open, '辅助面板无法关闭');
}
async function runCase(width, height) {
  frame.style.width = `${width}px`; frame.style.height = `${height}px`;
  frame.src = `/?responsive-layout=${width}x${height}`;
  await new Promise(resolve => { frame.onload = resolve; });
  const doc = frame.contentDocument;
  await waitReady(doc);
  checkCompactHeader(doc, width, height);
  const viewport = doc.querySelector('#viewport');
  assert(viewport && rect(viewport).width >= 200 && rect(viewport).height >= 100, `${width}×${height} 画布被挤压`);
  for (const panel of ['brushes', 'tools', 'options', 'library']) {
    await clickPanel(doc, panel);
    if (panel === 'brushes') checkBrushDrawer(doc);
    if (panel === 'tools') checkToolDrawer(doc);
    if (panel === 'options') checkOptionsDrawer(doc);
    if (panel === 'library') checkLibraryDrawer(doc);
    doc.querySelector('.mobile-focus-command')?.click();
    await pause(40);
    assert(doc.body.dataset.mobilePanel === 'focus', `${panel} 抽屉关闭后未回到画布`);
  }
  checkAssistDialog(doc);
  return { width, height, viewport: { width: Math.round(rect(viewport).width), height: Math.round(rect(viewport).height) } };
}
for (const [width, height] of [[320, 240], [480, 320], [640, 360], [800, 400], [1280, 400]]) {
  try { results.push({ name: `${width}×${height} 小屏抽屉与辅助面板`, passed: true, detail: await runCase(width, height) }); }
  catch (error) { results.push({ name: `${width}×${height} 小屏抽屉与辅助面板`, passed: false, error: error.message }); }
}
const passed = results.filter(result => result.passed).length;
document.querySelector('#summary').textContent = `${passed}/${results.length} 通过`;
document.body.dataset.results = JSON.stringify(results);
document.title = `${passed}/${results.length} passed`;
document.querySelector('#results').replaceChildren(...results.map(result => { const li = document.createElement('li'); li.textContent = `${result.passed ? '通过' : '失败'} ${result.name}${result.error ? ` — ${result.error}` : ''}`; return li; }));
