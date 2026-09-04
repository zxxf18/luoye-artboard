import { PaintEngine, makeCanvas, loadImage } from './engine.js';
import { deliverFile, readDraft, writeDraft } from './storage.js';
import { icon } from './icons.js';

const $ = id => document.getElementById(id);
const catalog = window.JSHW_ASSETS || [];
const toolNames = { pen: '画笔', eraser: '橡皮', fill: '填色', move: '移动', line: '直线', rect: '矩形', ellipse: '椭圆', text: '文字', picker: '取色' };
const hints = { pen: '拿起画笔，把想象画下来', eraser: '轻轻擦掉当前图层上的笔迹', fill: '点击当前图层中想填色的区域', move: '拖动当前图层，让小伙伴找到好位置', line: '按住拖动，画一条直线', rect: '按住拖动，画一个矩形', ellipse: '按住拖动，画一个椭圆', text: '点击画面，放上想说的话', picker: '点击画面，取一个喜欢的颜色' };
let engine, tool = 'pen', color = '#285b49', zoom = 1, busy = false, ready = false, revision = 0;
let toastTimer, saveTimer, pointerId, textPoint;

function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4000); }
async function run(action) {
  if (busy) return;
  busy = true; document.body.setAttribute('aria-busy', 'true');
  try { return await action(); } catch (error) { toast(error.message || '操作没有完成，请重试。'); console.error(error); }
  finally { busy = false; document.body.removeAttribute('aria-busy'); }
}
function bind(id, action) { $(id).addEventListener('click', () => run(action)); }
function setTool(next) {
  tool = next; $('painting').dataset.tool = tool; $('tool-hint').textContent = hints[tool];
  for (const button of document.querySelectorAll('[data-tool]')) if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', button.dataset.tool === tool);
}
function setColor(next) { color = next; $('color').value = next; $('current-color').style.background = next; for (const button of document.querySelectorAll('.swatch')) button.setAttribute('aria-pressed', button.dataset.color === next); }
function layoutCanvas() {
  const viewport = $('viewport'), style = getComputedStyle(viewport);
  const availableWidth = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const availableHeight = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const fit = Math.min(availableWidth / engine.width, availableHeight / engine.height);
  $('sheet').style.width = `${Math.max(10, engine.width * fit * zoom)}px`;
  $('sheet').style.height = `${Math.max(10, engine.height * fit * zoom)}px`;
  $('sheet').style.aspectRatio = `${engine.width}/${engine.height}`;
  viewport.style.justifyContent = zoom > 1 ? 'flex-start' : 'center'; viewport.style.alignItems = zoom > 1 ? 'flex-start' : 'center';
  $('zoom-value').textContent = zoom === 1 ? '适合窗口' : `${Math.round(zoom * 100)}%`;
}
function renderLayers() {
  $('layer-list').replaceChildren(); $('layer-count').textContent = engine.layers.length;
  for (const layer of [...engine.layers].reverse()) {
    const row = document.createElement('div'); row.className = `layer-row ${layer.id === engine.activeId ? 'active' : ''}`;
    const thumb = makeCanvas(64, 42); thumb.className = 'layer-thumb';
    const fit = Math.min(64 / layer.width, 42 / layer.height), context = thumb.getContext('2d');
    context.drawImage(layer.canvas, (64 - layer.width * fit) / 2, (42 - layer.height * fit) / 2, layer.width * fit, layer.height * fit);
    const name = document.createElement('button'); name.className = 'layer-name'; name.textContent = layer.name; name.setAttribute('aria-pressed', layer.id === engine.activeId);
    name.onclick = () => { if (busy) return; engine.activeId = layer.id; renderLayers(); };
    const eye = document.createElement('button'); eye.className = 'eye-button'; eye.innerHTML = icon(layer.visible ? 'eye' : 'hidden'); eye.setAttribute('aria-label', `${layer.visible ? '隐藏' : '显示'}${layer.name}`);
    eye.onclick = () => run(() => engine.setProperty(layer, 'visible', !layer.visible));
    row.append(thumb, name, eye); $('layer-list').append(row);
  }
  $('undo').disabled = !engine.history.past.length; $('redo').disabled = !engine.history.future.length;
  $('delete-layer').disabled = engine.layers.length < 2;
}
function changed() {
  if (!engine) return;
  revision++; renderLayers(); layoutCanvas(); $('canvas-size').textContent = `${engine.width} × ${engine.height}`;
  if (!ready) return;
  $('save-state').textContent = '正在保留这份想象…'; clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const savingRevision = revision;
    try {
      const project = await engine.serialize($('title').value.trim() || '我的画');
      await writeDraft(project);
      if (savingRevision === revision) $('save-state').textContent = '草稿已保存在这台设备';
    } catch { $('save-state').textContent = '草稿未保存，请手动保存作品'; }
  }, 900);
}
function chooseCategory(category) {
  for (const button of $('categories').children) button.setAttribute('aria-pressed', button.dataset.category === category);
  $('asset-grid').replaceChildren();
  const items = catalog.filter(asset => asset.category === category);
  $('asset-count').textContent = `${items.length} 个灵感`;
  for (const asset of items) {
    const button = document.createElement('button'); button.className = 'asset'; button.title = asset.name; button.setAttribute('aria-label', `加入${asset.name}`);
    const img = document.createElement('img'); img.src = asset.thumbnail || asset.src; img.alt = ''; img.loading = 'lazy';
    const label = document.createElement('span'); label.textContent = asset.name;
    const plus = document.createElement('span'); plus.className = 'asset-add'; plus.textContent = '+';
    button.append(img, label, plus); button.onclick = () => run(async () => { engine.end(); await engine.addAsset(asset); setTool('move'); toast(`${asset.name} 来到画里了`); });
    $('asset-grid').append(button);
  }
}
function showDialog(id) { const dialog = $(id); dialog.returnValue = ''; dialog.showModal(); }

for (const element of document.querySelectorAll('[data-icon]')) element.insertAdjacentHTML('afterbegin', icon(element.dataset.icon));
for (const [name, label] of Object.entries(toolNames)) {
  const button = document.createElement('button'); button.className = 'tool-button'; button.dataset.tool = name;
  button.setAttribute('aria-label', label); button.title = label; button.innerHTML = `${icon(name)}<span>${label}</span>`;
  button.onclick = () => { if (!busy) { engine.end(); setTool(name); } }; $('tools').append(button);
}
const palette = ['#283b35','#285b49','#759667','#aeca96','#e0b24a','#ed9448','#d9715f','#cf6f83','#b398b7','#7694b9','#68a9ae','#ffffff'];
for (const swatch of palette) {
  const button = document.createElement('button'); button.className = 'swatch'; button.dataset.color = swatch;
  button.style.background = swatch; button.style.setProperty('--swatch', swatch); button.setAttribute('aria-label', `颜色 ${swatch}`);
  button.onclick = () => setColor(swatch); $('swatches').append(button);
}
for (const [category, name] of Object.entries({ sticker: '小伙伴', background: '背景', animation: '动画', frame: '相框', fairy: '仙女袋', paper: '纸样', texture: '纹理' })) {
  const button = document.createElement('button'); button.textContent = name; button.dataset.category = category;
  button.onclick = () => chooseCategory(category); $('categories').append(button);
}
engine = new PaintEngine($('painting'), changed); changed(); setTool('pen'); setColor(color); chooseCategory('sticker');
new ResizeObserver(layoutCanvas).observe($('viewport'));
$('color').oninput = event => setColor(event.target.value);
$('size').oninput = () => { $('size-value').textContent = $('size').value; };
$('opacity').oninput = () => { $('opacity-value').textContent = `${$('opacity').value}%`; };
$('title').onchange = changed;
bind('undo', () => engine.undo()); bind('redo', () => engine.redo());
bind('add-layer', () => engine.addLayer(`画笔图层 ${engine.layers.length + 1}`));
bind('delete-layer', () => engine.removeActive()); bind('layer-up', () => engine.reorder(1)); bind('layer-down', () => engine.reorder(-1));
bind('rotate', () => engine.setProperty(engine.active, 'rotation', (engine.active.rotation + 15) % 360));
bind('smaller', () => engine.setProperty(engine.active, 'scale', Math.max(.05, engine.active.scale / 1.15)));
bind('bigger', () => engine.setProperty(engine.active, 'scale', Math.min(40, engine.active.scale * 1.15)));
bind('zoom-out', () => { zoom = Math.max(.5, zoom / 1.25); layoutCanvas(); });
bind('zoom-in', () => { zoom = Math.min(4, zoom * 1.25); layoutCanvas(); });
bind('fit', () => { zoom = 1; layoutCanvas(); });
bind('new', () => { engine.end(); showDialog('new-dialog'); });
$('new-dialog').addEventListener('close', () => { if ($('new-dialog').returnValue === 'create') { const [w, h] = $('preset').value.split(',').map(Number); zoom = 1; engine.reset(w, h); $('title').value = '新的奇妙世界'; setTool('pen'); changed(); } });
bind('save', async () => { engine.end(); const title = $('title').value.trim() || '我的画'; const project = await engine.serialize(title); toast(await deliverFile(`${title}.jshwx`, 'application/json', JSON.stringify(project))); });
bind('export', async () => { engine.end(); toast(await deliverFile(`${$('title').value.trim() || '我的画'}.png`, 'image/png', engine.exportPNG())); });
bind('open', () => $('file-input').click()); bind('import-image', () => $('image-input').click());
$('file-input').onchange = event => run(async () => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (file.size > 128 * 1024 * 1024) throw new Error('工程超过当前支持的 128 MiB 上限。');
  const data = JSON.parse(await file.text()); engine.end(); $('title').value = await engine.restore(data); changed(); toast('作品打开了，接着画吧');
});
$('image-input').onchange = event => run(async () => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (file.size > 30 * 1024 * 1024 || !['image/png','image/jpeg','image/webp','image/bmp','image/x-ms-bmp'].includes(file.type)) throw new Error('请选择 30 MiB 以内的 PNG、JPG、WebP 或 BMP 图片。');
  const url = URL.createObjectURL(file);
  try { const image = await loadImage(url); if (image.width > 4096 || image.height > 4096 || image.width * image.height > 8_388_608) throw new Error('图片过大，请先缩小到 4096 边长／8 百万像素以内。'); await engine.addAsset({ name: file.name.slice(0, 100), src: url, category: 'sticker' }); setTool('move'); }
  finally { URL.revokeObjectURL(url); }
});
$('painting').addEventListener('pointerdown', event => {
  if (busy || pointerId !== undefined || event.button !== 0) return;
  event.preventDefault(); $('painting').focus({ preventScroll: true }); const point = engine.point(event);
  if (tool === 'picker') {
    const x = Math.max(0, Math.min(engine.width - 1, Math.floor(point.x))), y = Math.max(0, Math.min(engine.height - 1, Math.floor(point.y)));
    const pixel = engine.ctx.getImageData(x, y, 1, 1).data;
    setColor('#' + [...pixel.slice(0, 3)].map(n => n.toString(16).padStart(2, '0')).join('')); setTool('pen'); return;
  }
  if (tool === 'text') { textPoint = point; showDialog('text-dialog'); $('text-content').focus(); return; }
  try {
    engine.begin(point, { tool, color, size: Number($('size').value), opacity: Number($('opacity').value) / 100, brush: $('brush').value, tolerance: 20 });
    if (engine.gesture) { pointerId = event.pointerId; $('painting').setPointerCapture(pointerId); }
  } catch (error) { toast(error.message); }
});
$('painting').addEventListener('pointermove', event => { if (event.pointerId !== pointerId) return; const samples = event.getCoalescedEvents?.(); for (const sample of samples?.length ? samples : [event]) engine.update(engine.point(sample)); });
function finishPointer(event) { if (event.pointerId !== pointerId) return; engine.end(event.type === 'pointercancel'); pointerId = undefined; }
$('painting').addEventListener('pointerup', finishPointer); $('painting').addEventListener('pointercancel', finishPointer);
$('painting').addEventListener('lostpointercapture', event => { if (event.pointerId === pointerId) { engine.end(); pointerId = undefined; } });
$('text-dialog').addEventListener('close', () => {
  if ($('text-dialog').returnValue !== 'add' || !$('text-content').value.trim()) return;
  run(() => {
    const text = $('text-content').value.trim(), size = Math.max(12, Math.min(240, Number($('text-size').value) || 72));
    const probe = makeCanvas(1, 1).getContext('2d'); probe.font = `600 ${size}px sans-serif`;
    const width = Math.min(4096, Math.ceil(probe.measureText(text).width) + 24), height = Math.ceil(size * 1.6);
    const canvas = makeCanvas(width, height), ctx = canvas.getContext('2d'); ctx.font = probe.font; ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 12, height / 2, width - 24);
    engine.addLayer(text.slice(0, 24), canvas, true, { x: textPoint.x + width / 2, y: textPoint.y }); setTool('move');
  });
});
document.addEventListener('keydown', event => {
  if (busy || event.target.matches('input,select,textarea') || document.querySelector('dialog[open]')) return;
  if (event.key === 'Escape') { engine.end(true); pointerId = undefined; return; }
  if (event.metaKey || event.ctrlKey) {
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? engine.redo() : engine.undo(); }
    if (event.key.toLowerCase() === 'y') { event.preventDefault(); engine.redo(); }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); $('save').click(); }
    if (event.key.toLowerCase() === 'o') { event.preventDefault(); $('open').click(); }
  }
});
window.addEventListener('blur', () => { if (engine.gesture) { engine.end(); pointerId = undefined; } });
async function initialize() {
  try {
    const draft = await readDraft();
    if (draft?.project) {
      showDialog('recover-dialog');
      $('recover-dialog').addEventListener('close', () => run(async () => { if ($('recover-dialog').returnValue === 'recover') { $('title').value = await engine.restore(draft.project); changed(); } }), { once: true });
    }
  } catch { $('save-state').textContent = '可手动保存作品'; }
  ready = true;
  if (window.webkit?.messageHandlers?.ready) window.webkit.messageHandlers.ready.postMessage({ width: engine.width, height: engine.height, assets: catalog.length });
}
initialize();
