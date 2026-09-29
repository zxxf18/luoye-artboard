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
async function pick(doc, id) {
  doc.querySelector('#more-open').click();
  await pause(15);
  const entry = doc.querySelector('#theme-open');
  assert(entry && entry.getAttribute('aria-label') === '换肤', '换肤入口缺失');
  entry.click();
  await pause(15);
  const dialog = doc.querySelector('#theme-dialog');
  const card = dialog?.querySelector(`.theme-card[data-theme="${id}"]`);
  assert(dialog?.open && card, `主题卡片缺失：${id}`);
  card.click();
  await pause(15);
  assert(doc.body.dataset.theme === id, `主题没有切换到 ${id}`);
  assert(card.getAttribute('aria-pressed') === 'true', `主题选中态没有同步：${id}`);
  return dialog;
}
for (const [width, height] of [[1280, 720], [568, 320]]) {
  try {
    const doc = await load(width, height);
    const painting = doc.querySelector('#painting');
    const canvasSize = `${painting.width}×${painting.height}`;
    const asset = doc.querySelector('#asset-grid .asset img');
    const assetSource = asset?.getAttribute('src') || '';
    for (const id of ['spring', 'summer', 'autumn', 'winter', 'mechanical', 'space', 'ocean']) {
      const dialog = await pick(doc, id);
      const box = dialog.getBoundingClientRect();
      assert(box.left >= 2 && box.top >= 2 && box.right <= width - 2 && box.bottom <= height - 2, `主题弹窗越出窗口：${width}×${height}`);
      assert(dialog.scrollHeight >= dialog.clientHeight, `主题弹窗尺寸异常：${id}`);
      assert(`${painting.width}×${painting.height}` === canvasSize, `换肤改变了画纸分辨率：${id}`);
      assert((doc.querySelector('#asset-grid .asset img')?.getAttribute('src') || '') === assetSource, `换肤改变了素材：${id}`);
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
    assert(reloaded.querySelectorAll('.theme-decoration').length === 1, '主题装饰层重复挂载');
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
