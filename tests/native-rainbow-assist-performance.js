// Worst-case drawing smoke: radial symmetry with the widest gradient brush.
// Run inside the bundled iOS WKWebView so the event-loop and Canvas budgets
// cover the same path used by a real iPhone/iPad build.
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const el = id => document.getElementById(id);
const checks = [];
const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const assert = (value, message) => { if (!value) throw new Error(message); };
const idle = async () => { for (let i = 0; i < 500 && document.body.hasAttribute('aria-busy'); i++) await pause(20); assert(!document.body.hasAttribute('aria-busy'), '界面操作没有恢复响应'); };
const click = async id => { assert(el(id), `找不到 ${id}`); el(id).click(); await idle(); };

await click('assist-open');
el('assist-enabled').checked = true;
el('assist-enabled').dispatchEvent(new Event('change', { bubbles: true }));
el('assist-mode').value = 'radial';
el('assist-mode').dispatchEvent(new Event('change', { bubbles: true }));
el('assist-axes').value = '16';
el('assist-axes').dispatchEvent(new Event('input', { bubbles: true }));
el('assist-dialog').close();
const brush = document.querySelector('[data-brush="rainbow"]');
assert(brush, '找不到彩虹笔');
brush.click();
const size = el('size');
size.value = size.max || '240';
size.dispatchEvent(new Event('input', { bubbles: true }));
const canvas = el('painting'), box = canvas.getBoundingClientRect(), originalCapture = canvas.setPointerCapture;
canvas.setPointerCapture = () => {};
const point = (x, y) => ({ clientX: box.x + box.width * x, clientY: box.y + box.height * y });
const send = (type, x, y, buttons = type === 'pointerup' ? 0 : 1) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 117, pointerType: 'mouse', button: 0, buttons, ...point(x, y) }));
let lastHeartbeat = performance.now(), maxGap = 0;
const heartbeat = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - lastHeartbeat); lastHeartbeat = now; }, 16);
const started = performance.now();
const beforeMetrics = window.LUOYEPerformance?.() || {};
let elapsed = 0, metrics = {};
try {
  send('pointerdown', .12, .18);
  for (let i = 1; i <= 360; i++) {
    const t = i / 360;
    send('pointermove', .12 + t * .76, .18 + Math.sin(t * Math.PI * 2) * .2 + t * .38);
  }
  send('pointerup', .88, .56);
  await idle();
  await pause(120);
  elapsed = performance.now() - started;
  metrics = window.LUOYEPerformance?.() || {};
} finally {
  clearInterval(heartbeat);
  canvas.setPointerCapture = originalCapture;
}
assert(elapsed < 5000, `最坏笔触耗时过长：${Math.round(elapsed)}ms`);
assert(maxGap < 250, `事件循环最长停顿过长：${Math.round(maxGap)}ms`);
assert((metrics.frames || 0) > (beforeMetrics.frames || 0), '最坏笔触没有提交新的画面帧');
assert(metrics.gradientStopCalculations > 0, '彩虹笔没有经过渐变缓存路径');
checks.push({ name: 'radial16-rainbow-max', passed: true, detail: { elapsed: Math.round(elapsed), maxGap: Math.round(maxGap), frames: Math.max(0, (metrics.frames || 0) - (beforeMetrics.frames || 0)), metrics } });
assert(!errors.length, errors.join('; '));

return { passed: checks.every(check => check.passed), checks, errors, viewport: { width: innerWidth, height: innerHeight } };
