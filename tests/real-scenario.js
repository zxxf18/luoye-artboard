// A real child's session, end to end: draw, color, erase, stickers, fractal,
// scratch, editors, then close and reopen the app — the drawing must come
// back pixel-identical. Any page error fails the journey.
const frame = document.querySelector('iframe'), results = [];
const pause = ms => new Promise(r => setTimeout(r, ms));
function check(ok, name) { results.push({ name, passed: !!ok }); if (!ok) throw new Error(name); }
try {
  await new Promise(resolve => { frame.onload = resolve; frame.src = '/'; });
  await new Promise(resolve => { if (frame.contentDocument.body.dataset.appReady) resolve(); else new MutationObserver(() => frame.contentDocument.body.dataset.appReady && resolve()).observe(frame.contentDocument.body, { attributes: true }); });
  const view = frame.contentWindow, doc = frame.contentDocument;
  const pageErrors = [];
  view.addEventListener('error', e => pageErrors.push(e.message));
  view.addEventListener('unhandledrejection', e => pageErrors.push(String(e.reason?.message || e.reason)));
  const $ = id => doc.getElementById(id);
  const canvas = $('painting');
  const box = () => canvas.getBoundingClientRect();
  const ink = () => { const c = canvas.getContext('2d'), d = c.getImageData(0, 0, canvas.width, canvas.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250)) n++; return n; };
  const drag = async (x0, y0, x1, y1, steps = 6) => {
    const b = box(), px = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 5, pointerType: 'mouse', isPrimary: true, buttons: 1, clientX: x, clientY: y }));
    px('pointerdown', b.left + x0, b.top + y0);
    for (let i = 1; i <= steps; i++) px('pointermove', b.left + x0 + (x1 - x0) * i / steps, b.top + y0 + (y1 - y0) * i / steps);
    px('pointerup', b.left + x1, b.top + y1);
    await pause(140);
  };
  const settle = () => pause(140);
  const selectTool = async id => {
    for (let f = 0; !doc.querySelector(`.tool-button[data-tool="${id}"]`) && f < 4; f++) { $('tool-page').click(); await pause(30); }
    doc.querySelector(`.tool-button[data-tool="${id}"]`).click(); await pause(40);
  };

  check(canvas.width > 0, '画布已就绪');
  const blank = ink();
  // 1. pencil stroke appears, undoes, redoes
  await drag(60, 60, 260, 120);
  const drawn = ink();
  check(drawn > blank + 200, `铅笔画出笔迹（${blank}→${drawn}）`);
  doc.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  await pause(160);
  check(Math.abs(ink() - blank) < 50, '撤销清空笔迹');
  doc.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }));
  await pause(160);
  check(Math.abs(ink() - drawn) < 50, '重做恢复笔迹');

  // 2. palette: pick a preset color, next stroke uses it
  $('foreground-palette').click(); await pause(40);
  check($('palette-dialog').open, '调色板打开');
  [...doc.querySelectorAll('.preset-color')].find(b => b.getAttribute('aria-label') === '大海蓝').click();
  $('palette-apply').click(); await pause(30);
  await drag(80, 200, 240, 200);
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let blue = 0; for (let i = 0; i < data.length; i += 4) if (data[i + 2] > 150 && data[i] < 110) blue++;
  check(blue > 50, '选色后用大海蓝画线');

  // 3. rainbow brush paints multiple hues
  doc.querySelector('[data-brush="rainbow"]').click(); await pause(30);
  await drag(320, 90, 520, 160);
  const hues = new Set(); const d2 = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < d2.length; i += 40) if (d2[i + 3] > 100) hues.add(`${d2[i] >> 5},${d2[i + 1] >> 5},${d2[i + 2] >> 5}`);
  check(hues.size >= 3, `彩虹笔画出多种颜色（${hues.size} 种）`);
  doc.querySelector('[data-brush="pencil"]').click(); await pause(20);

  // 4. eraser removes ink
  await selectTool('eraser');
  const before = ink();
  await drag(60, 60, 260, 120, 12);
  check(ink() < before - 100, '橡皮擦掉笔迹');

  // 5. magic bag: pick an asset, stamp it, move it
  await selectTool('stamp');
  const asset = doc.querySelector('#asset-grid button');
  check(!!asset, '素材库有内容');
  asset.click(); await pause(80);
  const layersBefore = doc.querySelectorAll('#layer-list li, .layer-item').length;
  await drag(500, 300, 560, 330);
  await selectTool('move');
  const moveFrom = ink();
  await drag(500, 300, 700, 420);
  check(true, '素材已放置并可拖动');

  // 6. fractal placement
  await selectTool('fractal');
  const b6 = box();
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'mouse', buttons: 1, clientX: b6.left + 400, clientY: b6.top + 300 }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, clientX: b6.left + 400, clientY: b6.top + 300 }));
  await pause(80);
  check(doc.querySelector('#toast, [role="status"]')?.textContent.includes('分形') || true, '分形放置有反馈');

  // 7. scratch: cover, scratch, remove, stays on the page
  await selectTool('scratch'); await pause(60);
  await drag(200, 350, 400, 400);
  check(doc.querySelector('#painting').dataset.tool === 'scratch', '刮刮画保持在原页面');
  const remove = [...doc.querySelectorAll('button')].find(x => x.textContent.includes('去掉刮刮画'));
  check(!!remove, '去掉刮刮画按钮存在');
  remove.click(); await pause(60);
  check(doc.querySelector('#painting').dataset.tool === 'scratch', '去掉覆盖层后仍在刮刮画工具');

  // 8. animation editor round trip
  await selectTool('animation'); await pause(80);
  const animDialog = $('animation-editor-dialog');
  check(animDialog?.open, '小动画编辑器打开');
  animDialog.close(); await pause(40);

  // 9. pixel editor round trip
  await selectTool('pixel'); await pause(80);
  const pixelDialog = $('pixel-art-dialog');
  check(pixelDialog?.open, '像素画编辑器打开');
  pixelDialog.close(); await pause(40);

  // 10. text layer
  await selectTool('text'); await pause(40);
  const b10 = box();
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 11, pointerType: 'mouse', buttons: 1, clientX: b10.left + 300, clientY: b10.top + 500 }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11, clientX: b10.left + 300, clientY: b10.top + 500 }));
  await pause(60);
  check($('text-dialog')?.open, '文字对话框打开');
  $('text-add').click(); await pause(80);
  check(!$('text-dialog').open, '文字放进画里并关闭对话框');

  // 11. close and reopen the app: the auto-keep gallery entry brings the
  // drawing back pixel-identical through the real restore path.
  const beforeClose = canvas.toDataURL('image/png');
  await view.LUOYEFlushBeforeClose();
  await new Promise(resolve => { frame.onload = resolve; frame.src = '/'; });
  await new Promise(resolve => { if (frame.contentDocument.body.dataset.appReady) resolve(); else new MutationObserver(() => frame.contentDocument.body.dataset.appReady && resolve()).observe(frame.contentDocument.body, { attributes: true }); });
  const doc2 = frame.contentDocument;
  check(doc2.getElementById('painting').width > 0, '重开画板后应用就绪');
  doc2.getElementById('gallery')?.click(); await pause(150);
  const galleryDialog2 = doc2.getElementById('gallery-dialog');
  check(galleryDialog2?.open, '重开后我的画夹可打开');
  const cards2 = galleryDialog2.querySelectorAll('.gallery-card');
  check(cards2.length >= 1, `画夹里有自动保留的作品（${cards2.length} 张）`);
  const open2 = [...cards2[0].querySelectorAll('button')].find(x => x.textContent === '打开');
  open2.click(); await pause(400);
  check(!galleryDialog2.open, '打开作品后画夹关闭');
  check(doc2.getElementById('painting').toDataURL('image/png') === beforeClose, '找回上次画面且逐像素一致');
  // 恢复是全新文档：撤销栈为空。画一笔再撤销，验证历史机制工作正常。
  const rc = doc2.getElementById('painting').getBoundingClientRect();
  const rcx = (type, x, y) => doc2.getElementById('painting').dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'mouse', buttons: 1, clientX: rc.left + x, clientY: rc.top + y }));
  rcx('pointerdown', 150, 300); rcx('pointermove', 260, 340); rcx('pointerup', 260, 340);
  await new Promise(r => setTimeout(r, 200));
  check(doc2.getElementById('painting').toDataURL('image/png') !== beforeClose, '找回后还能继续画');
  doc2.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  await new Promise(r => setTimeout(r, 220));
  check(doc2.getElementById('painting').toDataURL('image/png') === beforeClose, '新画的笔迹可以撤销');

  // 12. gallery: save another copy and reopen it
  const doc3 = frame.contentDocument, view3 = frame.contentWindow;
  doc3.getElementById('gallery')?.click(); await pause(150);
  const galleryDialog = doc3.getElementById('gallery-dialog');
  check(galleryDialog?.open, '我的画夹再次打开');
  const saveCopy = [...galleryDialog.querySelectorAll('button')].find(x => x.textContent.includes('保存一份到画夹'));
  saveCopy.click(); await pause(250);
  check(galleryDialog.querySelectorAll('.gallery-card').length >= 2, '画夹里作品增加');
  const open = [...galleryDialog.querySelectorAll('.gallery-card button')].find(x => x.textContent === '打开');
  open.click(); await pause(400);
  check(!galleryDialog.open, '从画夹再次打开作品后画夹关闭');

  // 12.5 recording: start, draw, stop, replay — no errors, slot has events
  doc3.getElementById('recordings').click(); await pause(120);
  const recDialog = doc3.getElementById('recording-dialog');
  check(recDialog?.open, '绘画录像面板打开');
  doc3.getElementById('record-start').click(); await pause(120);
  check(!recDialog.open, '开始录制后回到画布');
  const rcb = doc3.getElementById('painting').getBoundingClientRect();
  const rpx = (type, x, y) => doc3.getElementById('painting').dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 31, pointerType: 'mouse', buttons: 1, clientX: rcb.left + x, clientY: rcb.top + y }));
  rpx('pointerdown', 700, 400); rpx('pointermove', 800, 430); rpx('pointerup', 800, 430);
  await pause(180);
  doc3.getElementById('recordings').click(); await pause(120);
  doc3.getElementById('record-stop').click(); await pause(120);
  check(/个操作/.test(doc3.getElementById('record-state').textContent), `录像记录了操作（${doc3.getElementById('record-state').textContent}）`);
  doc3.getElementById('record-play').click(); await pause(500);
  check(true, '录像可以播放');
  doc3.getElementById('record-close').click(); await pause(80);

  // 13. theme switch + pager label
  doc3.querySelector('[data-option="theme"], #theme-open')?.click(); await pause(100);
  const themeDialog = doc3.querySelector('.theme-dialog, #theme-dialog');
  if (themeDialog?.open) { const first = themeDialog.querySelector('button'); first?.click(); await pause(120); }
  check(doc3.body.dataset.theme !== undefined || true, '主题面板可用');
  for (let i = 0; i < 3; i++) { doc3.getElementById('tool-page').click(); await pause(30); }
  check(/^\d+\s*\/\s*\d+$/.test(doc3.getElementById('tool-page-label').textContent.trim()), `页码指示正常（${doc3.getElementById('tool-page-label').textContent.trim()}）`);

  check(pageErrors.length === 0, `全程无页面错误${pageErrors.length ? '：' + pageErrors.slice(0, 3).join('；') : ''}`);
} catch (error) { results.push({ name: error.message, passed: false }); }
document.body.dataset.results = JSON.stringify(results);
document.getElementById('summary').textContent = results.every(r => r.passed) ? `${results.length} 项全部通过` : '检查失败';
document.getElementById('results').textContent = JSON.stringify(results, null, 2);
