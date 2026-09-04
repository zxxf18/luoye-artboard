import { makeCanvas, loadImage } from './engine.js';
import { DrawingEngine } from './drawing.js';
import { decodeLegacyFly } from './legacy.js';
import { mountGallery } from './gallery-ui.js';
import { mountRecorder } from './recorder-ui.js';
import { mountStudio } from './studio-ui.js';
import { deliverFile, readDraft, writeDraft } from './storage.js';
import { icon } from './icons.js';
import { mountClassic } from './classic-ui.js';
import { mountText } from './text-ui.js';
import { mountCreative } from './creative-ui.js';
import { mountMusic } from './music-ui.js';
import { mountMaterials } from './materials-ui.js';

const $ = id => document.getElementById(id);
const catalog = window.JSHW_ASSETS || [];
const toolNames = { pen: '画笔', eraser: '橡皮', fill: '填色', move: '移动', line: '直线', rect: '矩形', ellipse: '椭圆', text: '文字', picker: '取色', select:'选区', magic:'魔力棒', stamp:'印章', clone:'仿制',warp:'变形','board-filter':'滤镜',fractal:'分形' };
const hints = { pen: '拿起画笔，把想象画下来', eraser: '轻轻擦掉当前图层上的笔迹', fill: '点击当前图层中想填色的区域', move: '拖动当前图层，让小伙伴找到好位置', line: '按住拖动，画一条直线', rect: '按住拖动，画一个矩形', ellipse: '按住拖动，画一个椭圆', text: '点击画面，放上想说的话', picker: '点击画面，取一个喜欢的颜色' };
let engine, tool = 'pen', color = '#000000', zoom = 1, busy = false, ready = false, revision = 0;
let toastTimer, saveTimer, pointerId, studio;

function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4000); }
async function run(action) {
  if (busy) return;
  busy = true; document.body.setAttribute('aria-busy', 'true');
  try { return await action(); } catch (error) { toast(error.message || '操作没有完成，请重试。'); console.error(error); }
  finally { busy = false; document.body.removeAttribute('aria-busy'); }
}
function bind(id, action) { $(id).addEventListener('click', () => run(action)); }
function setTool(next) {
  engine?.end();
  if(engine?.path&&next!==tool)engine.finishPath(true);
  tool = next; $('painting').dataset.tool = tool; $('tool-hint').textContent = hints[tool]||'按住拖动，绘制选定的几何形状';
  for (const button of document.querySelectorAll('[data-tool]')) if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', button.dataset.tool === tool);
  if (tool === 'select') $('tool-hint').textContent = '拖动圈选区域；画笔、倒色和暗房只修改选中部分';
  if (tool === 'magic') $('tool-hint').textContent = '点击颜色相连的区域，再调整公差与选区组合';
  if(tool==='stamp') $('tool-hint').textContent='连续盖章：在图库选择仙女袋，或将当前图层用作印章';
  if(tool==='clone') $('tool-hint').textContent='Ctrl 点选仿制源，再拖动复制；也可用工具选项设置源点';
  if(['polygon','bezier'].includes(tool)) $('tool-hint').textContent='点击添加顶点／控制点，Enter 或双击完成，Esc 取消';
  if(tool==='warp')$('tool-hint').textContent='推拉：拖动变形；缩放：点击或拖动。负速度用于反向变形';
  if(tool==='board-filter')$('tool-hint').textContent='点击画纸设置效果中心，或在底部预览后确定';
  if(tool==='fractal')$('tool-hint').textContent='点击画纸或底部按钮，选择分形样式与尺寸';
  studio?.toolChanged(tool);
  document.dispatchEvent(new Event('toolchange'));
}
function setColor(next) { color = next; $('color').value = next; $('current-color').style.background = next; for (const button of document.querySelectorAll('.swatch')) button.setAttribute('aria-pressed', button.dataset.color === next); document.dispatchEvent(new Event('palettechange')); }
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
    button.append(img, label, plus); button.onclick = () => run(async () => { engine.end();if(asset.fairyGroups){const groups=await Promise.all(asset.fairyGroups.map(async group=>({...group,frames:await Promise.all(group.frames.map(loadImage))})));engine.setFairyGroups(groups,asset.fairyMode);if(asset.fairyMode!=='dynamic'&&engine.active.frames?.length)engine.addLayer('仙女袋笔迹');$('size').value=240;$('size-value').textContent='240';setTool('stamp');document.body.classList.remove('library-open');toast(asset.name+' 已选中，在画布上拖动盖章');return;} await engine.addAsset(asset); setTool('move');document.body.classList.remove('library-open'); toast(`${asset.name} 来到画里了`); });
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
engine = new DrawingEngine($('painting'), changed);engine.notice=toast; changed(); setTool('pen'); setColor(color); chooseCategory('sticker');
studio = mountStudio({ engine, run, toast, setTool, getTool:()=>tool, getColor:()=>color, changed });
const recorder=mountRecorder({engine,run,toast,getColor:()=>color,getTitle:()=>$('title').value.trim()||'我的画'});
const gallery=mountGallery({engine,run,toast,getTitle:()=>$('title').value.trim()||'我的画',setTitle:title=>{$('title').value=title;changed();}});
mountClassic({setTool,getColor:()=>color,setColor});
const styledText=mountText({engine,run,toast,getColor:()=>color,setTool});
const creative=mountCreative({engine,run,toast,getColor:()=>color,setTool});
mountMusic({run,toast});
const materials=mountMaterials({engine,run,toast});
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
$('new-dialog').addEventListener('close', () => run(async () => { if ($('new-dialog').returnValue === 'create') { await gallery.backup();const [w, h] = $('preset').value.split(',').map(Number); zoom = 1; engine.reset(w, h); $('title').value = '新的奇妙世界'; setTool('pen'); changed(); } }));
bind('save', async () => { engine.end(); const title = $('title').value.trim() || '我的画'; const project = await engine.serialize(title); toast(await deliverFile(`${title}.jshwx`, 'application/json', JSON.stringify(project))); });
bind('export',()=>showDialog('export-dialog'));
$('export-dialog').addEventListener('close',()=>run(async()=>{if($('export-dialog').returnValue!=='export')return;engine.end();const format=$('export-format').value,c=makeCanvas(engine.width,engine.height);engine.paint(c.getContext('2d'));toast(await deliverFile(($('title').value.trim()||'我的画')+(format==='png'?'.png':'.jpg'),'image/'+format,c.toDataURL('image/'+format,.92)));}));
bind('open', () => $('file-input').click()); bind('import-image', () => $('image-input').click());
$('file-input').onchange = event => run(async () => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (file.size > 128 * 1024 * 1024) throw new Error('工程超过当前支持的 128 MiB 上限。');
  if(/\.fly$/i.test(file.name)){const image=decodeLegacyFly(await file.arrayBuffer());await gallery.backup();engine.reset(image.width,image.height);engine.active.canvas.getContext('2d').putImageData(new ImageData(image.rgba,image.width,image.height),0,0);$('title').value=file.name.replace(/\.fly$/i,'');changed();toast('已作为单张图片导入；旧图层与记录不在此兼容范围内');return;}
  const data = JSON.parse(await file.text());await gallery.backup();engine.end(); $('title').value = await engine.restore(data); changed(); toast('作品打开了，接着画吧');
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
  if(tool==='clone'&&(event.ctrlKey||studio.pickingClone())){engine.setCloneSource(point);studio.clonePicked();toast('仿制源点已设定');return;}
  if(['polygon','bezier'].includes(tool)||(tool==='select'&&studio.options().selectionShape==='bezier')){try{engine.addVertex(point,{tool:tool==='select'?'select-bezier':tool,color,size:Number($('size').value),opacity:Number($('opacity').value)/100,...studio.options(),...materials.options()});}catch(e){toast(e.message);}return;}
  if (tool === 'picker') {
    const x = Math.max(0, Math.min(engine.width - 1, Math.floor(point.x))), y = Math.max(0, Math.min(engine.height - 1, Math.floor(point.y)));
    const composite=makeCanvas(engine.width,engine.height);engine.paint(composite.getContext('2d'));const pixel = composite.getContext('2d').getImageData(x, y, 1, 1).data;
    const picked='#'+[...pixel.slice(0,3)].map(n=>n.toString(16).padStart(2,'0')).join('');if(event.ctrlKey){$('background-color').value=picked;$('background-color').dispatchEvent(new Event('input'));}else setColor(picked);setTool('pen');return;
  }
  if (tool === 'text') { styledText.open(point); return; }
  if(tool==='fractal'){creative.open();return;}
  try {
    engine.begin(point, { tool, color, size: Number($('size').value), opacity: Number($('opacity').value) / 100, brushVersion:2, brush: $('brush').value, ...studio.options(),...creative.options(),...materials.options() });
    if (engine.gesture) { pointerId = event.pointerId; $('painting').setPointerCapture(pointerId); }
  } catch (error) { toast(error.message); }
});
$('painting').addEventListener('dblclick',()=>run(()=>engine.finishPath()));
$('painting').addEventListener('pointermove', event => { if (event.pointerId !== pointerId) return; const samples = event.getCoalescedEvents?.(); for (const sample of samples?.length ? samples : [event]) engine.update(engine.point(sample)); });
function finishPointer(event) { if (event.pointerId !== pointerId) return; engine.end(event.type === 'pointercancel'); pointerId = undefined; }
$('painting').addEventListener('pointerup', finishPointer); $('painting').addEventListener('pointercancel', finishPointer);
$('painting').addEventListener('lostpointercapture', event => { if (event.pointerId === pointerId) { engine.end(); pointerId = undefined; } });
document.addEventListener('keydown', event => {
  if (busy || event.target.matches('input,select,textarea') || document.querySelector('dialog[open]')) return;
  if(event.key==='Enter'&&engine.path){event.preventDefault();run(()=>engine.finishPath());return;}
  if (event.key === 'Escape') { engine.finishPath(true);engine.end(true); pointerId = undefined; return; }
  if (event.metaKey || event.ctrlKey) {
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? engine.redo() : engine.undo(); }
    if (event.key.toLowerCase() === 'y') { event.preventDefault(); engine.redo(); }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); $('save').click(); }
    if (event.key.toLowerCase() === 'o') { event.preventDefault(); $('open').click(); }
  }
});
window.JSHWFlushBeforeClose=async()=>{if(busy)throw new Error('请先完成当前操作');engine.end();engine.finishPath(true);clearTimeout(saveTimer);await writeDraft(await engine.serialize($('title').value.trim()||'我的画'));await recorder.flush();return true;};
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
  if (window.webkit?.messageHandlers?.ready) window.webkit.messageHandlers.ready.postMessage({ width: engine.width, height: engine.height, assets: catalog.length, brushes:$('brush').options.length, effects:studio.effectCount, tools:Object.keys(toolNames), version:'0.3.0',classicUnits:14,toolPages:2,textStyles:10,musicTracks:20,darkroomGroups:7,proceduralFractals:3,nortonThumbnailPresets:20,fairyFrames:catalog.reduce((n,asset)=>n+(asset.fairyGroups?.reduce((sum,group)=>sum+group.frames.length,0)||0),0) });
}
initialize();
