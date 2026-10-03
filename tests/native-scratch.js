// Native smoke test for the scratch-card tool.  This deliberately checks the
// serialized raster pixels, instead of relying on the visible preview alone.
const $ = id => document.getElementById(id);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ name, passed: !!ok, detail });
  if (!ok) throw Error(name);
};
const idle = async () => {
  for (let i = 0; i < 1000 && document.body.hasAttribute('aria-busy'); i++) await pause(16);
  check(!document.body.hasAttribute('aria-busy'), '界面操作完成');
  await pause(60);
};
const snapshot = async () => (await window.LUOYEFlushBeforeClose()).project;
const layerByRole = (project, role) => project.layers.find(layer => layer.role === role);
const layerById = (project, id) => project.layers.find(layer => layer.id === id);
const imagePixels = async dataUrl => {
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = dataUrl; });
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
};
const imagePixelsAt = async (dataUrl, width, height) => {
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = dataUrl; });
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
};
const pixelDifference = (a, b) => {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let different = 0, alpha = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) different++;
    alpha += Math.abs(a[i + 3] - b[i + 3]);
  }
  return { different, alpha };
};
const alphaSum = pixels => { let sum = 0; for (let i = 3; i < pixels.length; i += 4) sum += pixels[i]; return sum; };
const tool = id => {
  for (let page = 0; page < 3 && !document.querySelector(`#tools [data-tool="${id}"]`); page++) $('tool-page')?.click();
  const button = document.querySelector(`#tools [data-tool="${id}"]`);
  if (!button) throw Error(`找不到工具：${id}`);
  button.click();
};
const canvas = $('painting'); canvas.setPointerCapture = () => {};
let pointer = 300;
const send = (type, x, y) => {
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, pointerId: pointer, pointerType: 'mouse', button: 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: rect.x + x * rect.width, clientY: rect.y + y * rect.height,
  }));
};
const stroke = (x1 = .18, y1 = .28, x2 = .8, y2 = .72, points = 6) => {
  const started = performance.now();
  pointer++;
  send('pointerdown', x1, y1);
  for (let i = 1; i < points; i++) { const t = i / points; send('pointermove', x1 + (x2 - x1) * t, y1 + (y2 - y1) * t); }
  send('pointermove', x2, y2); send('pointerup', x2, y2);
  return performance.now() - started;
};
const cancelStroke = (x1 = .25, y1 = .26, x2 = .7, y2 = .7) => {
  pointer++; send('pointerdown', x1, y1); send('pointermove', x2, y2); send('pointercancel', x2, y2);
};
const resetDurations = [];
const resetCover = async () => {
  const started = performance.now();
  const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim().includes('重新盖住'));
  check(!!button, '刮刮画提供重新盖住入口'); button.click(); await idle();
  const duration = performance.now() - started; resetDurations.push(duration); return duration;
};
const projectForImport = async project => {
  const transfer = new DataTransfer();
  transfer.items.add(new File([JSON.stringify(project)], 'scratch.luoyex', { type: 'application/json' }));
  $('file-input').files = transfer.files; $('file-input').dispatchEvent(new Event('change')); await idle();
};

try {
  // Start from a clean board and create real coloured pixels below the cover.
  $('new-quick').click(); await idle(); tool('pen');
  $('size').value = 34; $('size').dispatchEvent(new Event('input', { bubbles: true }));
  stroke(.15, .22, .82, .22); stroke(.18, .35, .8, .58); await idle();
  const artwork = await snapshot();
  const artworkLayer = artwork.layers.find(layer => !layer.role);
  check(!!artworkLayer, '秘密画稿已创建');
  const artworkImage = artworkLayer.image;

  // Preparing the card must add one reusable opaque cover and leave the art below.
  tool('scratch'); await idle();
  let covered = await snapshot();
  let cover = layerByRole(covered, 'scratch');
  check(!!cover, '刮刮画创建覆盖层');
  check(covered.layers.indexOf(cover) === covered.layers.length - 1, '覆盖层位于最上方');
  check(covered.layers.some(layer => layer.id === artworkLayer.id && layer.image === artworkImage), '秘密画稿像素在盖住后保持不变');
  const coverImage = cover.image;
  const coverPixels = await imagePixels(coverImage);
  check(alphaSum(coverPixels) > 0, '覆盖层初始具有不透明像素');

  // Scratch only changes cover alpha; the artwork PNG must remain identical.
  const scratchStart = performance.now();
  // Keep this first gesture as one history item so undo/redo can be checked
  // against the exact untouched cover. The later stress section uses many
  // gestures for throughput measurements.
  const firstStrokeMs = stroke(.08, .18, .82, .72, 120);
  await idle();
  const scratchMs = performance.now() - scratchStart;
  const scratched = await snapshot();
  const scratchedCover = layerByRole(scratched, 'scratch');
  const scratchedArt = layerById(scratched, artworkLayer.id);
  check(scratchedArt?.image === artworkImage, '刮擦不修改秘密画稿');
  const scratchedPixels = await imagePixels(scratchedCover.image);
  const coverDelta = pixelDifference(coverPixels, scratchedPixels);
  check(coverDelta.different > 20 && coverDelta.alpha > 20, '刮擦实际清除覆盖层像素', coverDelta);
  check(scratched.layers.filter(layer => layer.role === 'scratch').length === 1, '刮擦不会复制覆盖层');

  // A cancelled gesture must not enter history, and undo/redo must be pixel exact.
  const beforeCancel = await snapshot(); cancelStroke(); await idle();
  check((await snapshot()).layers.find(layer => layer.role === 'scratch').image === beforeCancel.layers.find(layer => layer.role === 'scratch').image, '取消刮擦不新增像素变化');
  $('undo').click(); await idle();
  const undone = await snapshot();
  check(undone.layers.find(layer => layer.role === 'scratch').image === coverImage, '撤销恢复原始覆盖层');
  check(undone.layers.find(layer => layer.id === artworkLayer.id)?.image === artworkImage, '撤销不改变秘密画稿');
  $('redo').click(); await idle();
  const redone = await snapshot();
  check(redone.layers.find(layer => layer.role === 'scratch').image === scratchedCover.image, '重做恢复刮擦结果');

  // Reset is itself undoable and does not add a second cover.
  await resetCover();
  const reset = await snapshot();
  check(reset.layers.filter(layer => layer.role === 'scratch').length === 1, '重新盖住不会创建重复覆盖层');
  check(reset.layers.find(layer => layer.role === 'scratch').image === coverImage, '重新盖住恢复完整覆盖层');
  $('undo').click(); await idle();
  check((await snapshot()).layers.find(layer => layer.role === 'scratch').image === scratchedCover.image, '撤销重新盖住恢复刮擦状态');
  $('redo').click(); await idle();
  check((await snapshot()).layers.find(layer => layer.role === 'scratch').image === coverImage, '重做重新盖住恢复完整覆盖层');
  const historyBeforeNoopReset = window.LUOYEPerformance().historyBytes;
  for (let i = 0; i < 6; i++) await resetCover();
  check(window.LUOYEPerformance().historyBytes === historyBeforeNoopReset, '连续重新盖住完整表面不增加历史占用', { before: historyBeforeNoopReset, after: window.LUOYEPerformance().historyBytes });

  // Repeated selection reuses the same cover and keeps the layer count stable.
  const beforePrepare = await snapshot(); tool('scratch'); await idle(); const afterPrepare = await snapshot();
  check(afterPrepare.layers.filter(layer => layer.role === 'scratch').length === 1, '反复选择刮刮画不会新增覆盖层');
  check(afterPrepare.layers.length === beforePrepare.layers.length, '反复选择刮刮画保持图层数量');
  $('layer-menu').click(); await idle(); $('layer-down').click(); await idle();
  const reordered = await snapshot();
  check(layerByRole(reordered, 'scratch').id !== reordered.layers.at(-1).id, '测试覆盖层手动向下重排');
  $('layer-dialog').close(); tool('scratch'); await idle();
  const preparedAfterReorder = await snapshot();
  check(preparedAfterReorder.layers.at(-1).role === 'scratch', '重新选择刮刮画将覆盖层放回最上方');

  // Save/import round trip retains role, order and cover pixels.
  const saved = await snapshot(); await resetCover(); await projectForImport(saved);
  const restored = await snapshot();
  check(restored.layers.length === saved.layers.length, '保存恢复保持图层数量');
  check(restored.layers.map(layer => layer.role || '').join('|') === saved.layers.map(layer => layer.role || '').join('|'), '保存恢复保持刮刮画图层类型和顺序');
  check(layerByRole(restored, 'scratch')?.image === layerByRole(saved, 'scratch')?.image, '保存恢复保持覆盖层像素');

  // Start recording before a cover exists. This exercises prepare's layer
  // creation metadata, scratch, reset and scratch again in the replay path.
  const withoutCover = { ...restored, layers: restored.layers.filter(layer => layer.role !== 'scratch') };
  await projectForImport(withoutCover); tool('pen'); await idle();
  $('recordings').click(); await idle(); $('record-start').click(); await pause(80);
  tool('scratch'); await idle();
  stroke(.2, .3, .72, .6, 10); await idle();
  // Reset is also a visible drawing operation and must enter the recording;
  // follow it with a second scratch so replay checks a nontrivial final state.
  await resetCover(); stroke(.3, .72, .72, .28, 16); await idle();
  const recordedFinal = await snapshot();
  $('recordings').click(); await idle(); $('record-stop').click(); await idle();
  const count = Number($('record-position').max);
  check(count >= 4, '创建覆盖层、刮擦和重新盖住进入录像', { count });
  $('record-last').click(); await idle();
  const preview = document.querySelector('#record-preview canvas');
  check(!!preview && preview.toDataURL().length > 100, '刮刮画录像可以回放');
  const exportedBeforeReplay = (await window.LUOYEFlushBeforeClose()).png;
  const previewPixels = preview.getContext('2d').getImageData(0, 0, preview.width, preview.height).data;
  const exportedPixels = await imagePixelsAt(exportedBeforeReplay, preview.width, preview.height);
  const replayDelta = pixelDifference(previewPixels, exportedPixels);
  check(replayDelta.different === 0, '刮刮画录像与当前作品逐像素一致', replayDelta);
  check(layerByRole(recordedFinal, 'scratch')?.image === layerByRole(await snapshot(), 'scratch')?.image, '回放不修改当前覆盖层');
  $('record-close').click(); await idle();

  // Stress path: theme changes, paper grain and thick scratch strokes. Keep
  // an event-loop watchdog so a regression that blocks the native host is
  // visible in acceptance evidence instead of timing out silently.
  const theme = $('theme-open') || document.querySelector('[data-theme-open]');
  const themeNames = ['spring', 'mechanical', 'space', 'candy'];
  let themeChanges = 0;
  if (theme) {
    for (const name of themeNames) {
      theme.click(); await idle();
      const card = document.querySelector(`#theme-dialog [data-theme="${name}"]`);
      if (card) { card.click(); themeChanges++; await pause(80); }
      const close = $('theme-done') || $('theme-close'); if (close) close.click(); await idle();
    }
  }
  $('paper-grain').value = 'grain-1'; $('paper-grain').dispatchEvent(new Event('change', { bubbles: true })); await pause(80);
  $('size').value = 240; $('size').dispatchEvent(new Event('input', { bubbles: true }));
  // Exercise the paper-grain material once before switching to the cover. The
  // following thick scratches then run against the same warmed rendering path.
  tool('pen'); stroke(.12, .82, .88, .82, 24); await idle(); tool('scratch');
  let maxGap = 0, last = performance.now(); const heartbeat = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; }, 16);
  const stressStart = performance.now();
  const stressStrokeMs = [];
  for (let i = 0; i < 24; i++) { stressStrokeMs.push(stroke(.05 + (i % 8) * .12, .1 + (i % 3) * .3, .7 + (i % 4) * .06, .85 - (i % 3) * .2, 18)); if (i % 4 === 0) await pause(16); }
  await idle(); const stressMs = performance.now() - stressStart; clearInterval(heartbeat);
  const perf = window.LUOYEPerformance();
  const historyBytes = perf.historyBytes ?? perf.historyBytesTotal ?? null;
  check(maxGap < 750, '连续粗笔刮擦未阻塞界面', { maxGap });
  check(perf.layers >= 2 && perf.layers < 8, '性能压力测试未产生异常图层', perf);

  const result = { passed: true, checks, scratchMs, firstStrokeMs, stressMs, stressStrokeMs, resetMs: resetDurations.at(-1) || 0, resetDurationsMs: resetDurations, maxEventLoopGapMs: maxGap, themeChanges, historyBytes, metrics: perf, layerCount: perf.layers };
  setInterval(() => { if ($('close-dialog')?.open) document.querySelector('#close-dialog [value=discard]')?.click(); }, 100);
  return result;
} catch (error) {
  return { passed: false, checks, failure: error.message, stack: error.stack };
}
