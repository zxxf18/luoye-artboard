import { makeCanvas, loadImage } from './engine.js';
import { DrawingEngine } from './drawing.js';
import { decodeLegacyFly } from './legacy.js';
import { mountGallery } from './gallery-ui.js';
import { mountRecorder } from './recorder-ui.js';
import { mountStudio } from './studio-ui.js';
import { deliverFile, preserveDraft, writeDraft, discardCurrentDraft } from './storage.js';
import { createCloseFlow } from './close-flow.js';
import { playfulIcon } from './playful-icons.js';
import { icon } from './icons.js';
import { mountClassic } from './classic-ui.js';
import { mountText } from './text-ui.js';
import { mountCreative } from './creative-ui.js';
import { mountMusic } from './music-ui.js';
import { mountDisplay } from './display-ui.js';
import { mountPlayfulControls } from './playful-controls.js';
import { mountMaterials } from './materials-ui.js';

const $ = id => document.getElementById(id);
const catalog = window.LUOYE_ASSETS || [];
const toolNames = { pen: '画笔', eraser: '橡皮', fill: '油漆桶', move: '移动', line: '直线', rect: '矩形', ellipse: '椭圆', text: '文字', picker: '取色', select:'选区', magic:'魔力棒', stamp:'印章', clone:'仿制',warp:'变形','board-filter':'滤镜',fractal:'分形' };
const hints = { pen: '拿起画笔，把想象画下来', eraser: '轻轻擦掉画纸上已有的笔迹', fill: '点击画纸里想填色的区域', move: '拖动当前图层，让小伙伴找到好位置', line: '按住拖动，画一条直线', rect: '按住拖动，画一个矩形', ellipse: '按住拖动，画一个椭圆', text: '点击画面，放上想说的话', picker: '点击画面，取一个喜欢的颜色' };
const sessionId=crypto.randomUUID();
let closeSnapshot=null;
let savedRevision=0, savedTitle='', draftInFlight=Promise.resolve();
let engine, tool = 'pen', color = '#000000', zoom = 1, busy = false, ready = false, revision = 0;
let saveTimer, pointerId, studio, stampTimer, stampSize = 160, hoverPoint;
const fairyCache = new Map();

function toast(message) { const status=$('tool-hint');status.textContent=message;status.title=message;status.setAttribute('role','status'); }
async function run(action) {
  if (busy) return;
  busy = true; document.body.setAttribute('aria-busy', 'true');
  try { return await action(); } catch (error) { toast(error.message || '操作没有完成，请重试。'); if(error.name!=='AbortError')console.error(error); }
  finally { busy = false; document.body.removeAttribute('aria-busy'); }
}
function bind(id, action) { $(id).addEventListener('click', () => run(action)); }
function setTool(next) {
  clearInterval(stampTimer); pointerId = undefined;
  if(tool === 'stamp') stampSize = Number($('size').value);
  if(next === 'stamp' && tool !== 'stamp') { $('size').value = stampSize; $('size-value').textContent = stampSize; }
  engine?.end(); if(engine) { engine.stampPreview = null; engine.render(); }
  if(engine?.path&&next!==tool)engine.finishPath(true);
  tool = next; $('painting').dataset.tool = tool; $('tool-hint').textContent = hints[tool]||'按住拖动，绘制选定的几何形状';
  for (const button of document.querySelectorAll('[data-tool]')) if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', button.dataset.tool === tool);
  if (tool === 'select') $('tool-hint').textContent = '拖动圈选区域；画笔、填色和暗房只修改选中部分';
  if (tool === 'magic') $('tool-hint').textContent = '点击颜色相连的区域，再调整公差与选区组合';
  if(tool==='stamp') $('tool-hint').textContent='先选图案、调大小，再移到画纸上按住鼠标画';
  if(tool==='clone') $('tool-hint').textContent='Ctrl 点选仿制源，再拖动复制；也可用工具选项设置源点';
  if(['polygon','bezier'].includes(tool)) $('tool-hint').textContent='点击添加顶点／控制点，Enter 或双击完成，Esc 取消';
  if(tool==='warp')$('tool-hint').textContent='推拉：拖动变形；缩放：点击或拖动。负速度用于反向变形';
  if(tool==='board-filter')$('tool-hint').textContent='点击画纸设置效果中心，或在底部预览后确定';
  if(tool==='fractal')$('tool-hint').textContent='点击画纸或底部按钮，选择分形样式与尺寸';
  studio?.toolChanged(tool);
  document.dispatchEvent(new Event('toolchange'));
}
function setColor(next) { color = next; $('color').value = next; for (const button of document.querySelectorAll('.swatch')) button.setAttribute('aria-pressed', button.dataset.color === next); document.dispatchEvent(new Event('palettechange')); }
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
  if($('current-layer-name'))$('current-layer-name').textContent='正在调整：'+engine.active.name;
  if($('layer-opacity'))$('layer-opacity').value=engine.active.opacity*100;
  $('layer-list').replaceChildren(); $('layer-count').textContent = engine.layers.length;
  for (const layer of [...engine.layers].reverse()) {
    const row = document.createElement('div'); row.className = `layer-row ${layer.id === engine.activeId ? 'active' : ''}`;
    const thumb = makeCanvas(64, 42); thumb.className = 'layer-thumb';
    const fit = Math.min(64 / layer.width, 42 / layer.height), context = thumb.getContext('2d');
    context.drawImage(layer.canvas, (64 - layer.width * fit) / 2, (42 - layer.height * fit) / 2, layer.width * fit, layer.height * fit);
    for(const mask of [layer.eraseMask,layer.spriteClip])if(mask){context.globalCompositeOperation='destination-in';context.drawImage(mask,(64-layer.width*fit)/2,(42-layer.height*fit)/2,layer.width*fit,layer.height*fit);}
    const name = document.createElement('button'); name.className = 'layer-name'; name.innerHTML = ''; const caption = document.createElement('span'); caption.textContent = (layer.role === 'background' ? '画纸背景 · ' : '') + layer.name; name.append(thumb,caption); name.setAttribute('aria-pressed', layer.id === engine.activeId);
    name.onclick = () => { if (busy) return; engine.activeId = layer.id; renderLayers(); document.dispatchEvent(new Event('controlschange')); };
    const eye = document.createElement('button'); eye.className = 'eye-button'; eye.innerHTML = icon(layer.visible ? 'eye' : 'hidden'); eye.setAttribute('aria-label', `${layer.visible ? '藏起来：' : '显示：'}${layer.name}`);
    eye.onclick = () => run(() => engine.setProperty(layer, 'visible', !layer.visible));
    eye.append(document.createTextNode(layer.visible ? '藏起来' : '显示')); row.append(name, eye); $('layer-list').append(row);
  }
  document.dispatchEvent(new Event('objectchange'));
  $('smaller').disabled=$('bigger').disabled=engine.active.role==='background';
  $('undo').disabled = !engine.history.past.length; $('redo').disabled = !engine.history.future.length;
  $('delete-layer').disabled = engine.layers.length < 2;
  $('layer-up').disabled = engine.active === engine.layers.at(-1) || engine.active.role === 'background';
  $('layer-down').disabled = engine.layers.indexOf(engine.active) === 0 || engine.active.role === 'background' || engine.layers[engine.layers.indexOf(engine.active)-1]?.role === 'background';
  if($('move-selected-layer')) $('move-selected-layer').disabled = engine.active.role === 'background';
}
function changed() {
  if (!engine) return;
  revision++; renderLayers(); layoutCanvas(); $('canvas-size').textContent = `${engine.width} × ${engine.height}`;
  if (!ready) return;
  $('save-state').textContent = '正在保留这份想象…'; clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {draftInFlight=(async () => {
    const savingRevision = revision;
    try {
      const project = await engine.serialize($('title').value.trim() || '我的画');
      if(savingRevision!==revision)return;
      await writeDraft(project);
      if (savingRevision === revision) $('save-state').textContent = '草稿已临时保留 · 退出时可选择保存';
    } catch { $('save-state').textContent = '草稿未保存，请手动保存作品'; }
  })();}, 900);
}
let libraryCategory='sticker',libraryCollection='',libraryPage=0,selectedAssetId='';
let galleryLocation={category:'sticker',collection:'',page:0};
function libraryPageSize(){const width=document.querySelector('.studio')?.clientWidth||600;return Math.max(3,Math.floor((width-24)/Math.max(110,Math.min(184,innerWidth*.075))));}
const collectionNames={'bg-space':'太空','bg-countryside':'田园','bg-underwater':'海底','bg-city':'城市','bg-farm':'农场','bg-forest':'森林','bg-rivers':'河湖','bg-ocean':'海洋','bg-animals':'动物','bg-weather':'天气',frame:'相框',paper:'纸样',texture:'纹理',role0:'动物',role1:'海洋动物',role2:'飞鸟',role3:'植物',role4:'人物',role5:'物品',role6:'工具',anim0:'陆地动物',anim1:'海洋动物',anim2:'飞鸟',anim3:'人物',anim4:'物品与天气'};
function chooseCategory(category,collection='',page=0) {
  libraryCategory=category;libraryCollection=collection;libraryPage=page;
  if(category!=='fairy')galleryLocation={category,collection,page};
  document.body.dataset.librarySurface=category==='fairy'?'fairy':'gallery';
  for (const button of $('categories').children) button.setAttribute('aria-pressed', button.dataset.category === category);
  $('asset-grid').replaceChildren();
  const all = catalog.filter(asset => (category==='coloring'?asset.coloring:asset.category === category&&!asset.coloring) && (category !== 'fairy' || asset.fairyMode === (document.body.dataset.fairyMode || 'single')));
  const items=all.filter(asset=>!collection||asset.collection===collection);
  const groupBox=$('library-groups');if(groupBox){groupBox.replaceChildren();const collections=[...new Set(all.map(a=>a.collection))];if(category!=='fairy'&&collections.length>1){for(const key of ['',...collections]){const b=document.createElement('button');b.className='subtool-card';const sample=all.find(a=>!key||a.collection===key),img=document.createElement('img');img.src=sample.thumbnail;img.alt='';b.append(img,Object.assign(document.createElement('span'),{textContent:key?(collectionNames[key] || key):'全部图案'}));b.setAttribute('aria-pressed',key===collection);b.onclick=()=>chooseCategory(category,key);groupBox.append(b);}}}
  if(groupBox&&category==='fairy'){
    for(const [mode,label,picture] of [['single','单张图案','stamp'],['static','组合图案','friend'],['dynamic','会动图案','butterfly']]){
      const button=document.createElement('button');button.className='subtool-card';button.dataset.fairyMode=mode;
      button.innerHTML=playfulIcon(picture)+'<span>'+label+'</span>';button.setAttribute('aria-pressed',mode===(document.body.dataset.fairyMode||'single'));
      button.onclick=()=>{document.body.dataset.fairyMode=mode;setTool('stamp');chooseCategory('fairy');};groupBox.append(button);
    }
  }
  const heading=document.querySelector('.classic-left>h2');if(heading&&document.body.classList.contains('library-open'))heading.textContent=category==='fairy'?'我的魔法袋':'找一找图案';
  const pageSize=libraryPageSize(),pages=Math.max(1,Math.ceil(items.length/pageSize));libraryPage=Math.min(page,pages-1);$('asset-grid').style.setProperty('--shelf-columns',pageSize);
  let pager=$('library-pagination');if(!pager){pager=document.createElement('div');pager.id='library-pagination';document.querySelector('.classic-parameters')?.append(pager);}
  pager.replaceChildren();for(const [delta,label,iconName] of [[-1,'上一页','undo'],[1,'下一页','redo']]){const b=document.createElement('button');b.setAttribute('aria-label',label);b.innerHTML=playfulIcon(iconName)+'<span>'+label+'</span>';b.disabled=delta<0?libraryPage===0:libraryPage===pages-1;b.onclick=()=>chooseCategory(category,collection,libraryPage+delta);pager.append(b);if(delta===-1){const count=document.createElement('span');count.textContent=`${libraryPage+1} / ${pages} · ${items.length} 个`;pager.append(count);}}

  $('asset-count').textContent = `${items.length} 个灵感`;
  let instruction=$('library-instruction');if(!instruction){instruction=document.createElement('div');instruction.id='library-instruction';document.querySelector('.classic-parameters')?.append(instruction);}
  instruction.innerHTML=playfulIcon(category==='coloring'?'fill':category==='fairy'?'stamp':'forest')+'<span>'+(category==='coloring'?'拿起油漆桶，给小故事涂上颜色':category==='fairy'?'选好图案，按住鼠标连续画':'选一个喜欢的图案，放进你的画里')+'</span>';
  for (const asset of items.slice(libraryPage*pageSize,libraryPage*pageSize+pageSize)) {
    const button = document.createElement('button'); button.className = 'asset'; button.title = asset.name; button.setAttribute('aria-label', `加入${asset.name}`);
    const img = document.createElement('img'); img.src = asset.thumbnail || asset.src; img.alt = ''; img.loading = 'lazy';
    const label = document.createElement('span'); label.textContent = asset.name;
    const plus = document.createElement('span'); plus.className = 'asset-add'; plus.textContent = '+';
    button.dataset.assetId=asset.id;button.setAttribute('aria-pressed',selectedAssetId===asset.id);
    button.append(img, label, plus); button.onclick = () => run(async () => {
      engine.end();
      if(asset.fairyGroups){
        let groups=fairyCache.get(asset.id);
        if(!groups){groups=await Promise.all(asset.fairyGroups.map(async group=>({...group,frames:await Promise.all(group.frames.map(loadImage))})));fairyCache.set(asset.id,groups);while(fairyCache.size>2)fairyCache.delete(fairyCache.keys().next().value);}
        engine.setFairyGroups(groups,asset.fairyMode,asset.fairyBehavior);engine.stampName=asset.name;
        setTool('stamp');
        toast(asset.name+'：调好大小，再到画纸上按住鼠标画');
      } else {
        await engine.addAsset(asset); setTool(['background','paper','texture','frame'].includes(asset.category)?'pen':'move');
        toast(`${asset.name} ${['background','paper','texture'].includes(asset.category)?'已换好，画里的小伙伴都还在':'来到画里了'}`);
      }
      selectedAssetId=asset.id;for(const item of $('asset-grid').children)item.setAttribute('aria-pressed',item.dataset.assetId===asset.id);
    });
    $('asset-grid').append(button);
  }
}
let shelfResize;window.addEventListener('resize',()=>{clearTimeout(shelfResize);shelfResize=setTimeout(()=>chooseCategory(libraryCategory,libraryCollection,libraryPage),100);});
document.addEventListener('uisizechange',()=>{clearTimeout(shelfResize);shelfResize=setTimeout(()=>chooseCategory(libraryCategory,libraryCollection,libraryPage),100);});
document.addEventListener('fairymodechange',()=>chooseCategory('fairy'));
document.addEventListener('opengallery',()=>chooseCategory(galleryLocation.category,galleryLocation.collection,galleryLocation.page));
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
for (const [category, name] of Object.entries({ sticker: '小伙伴', background: '彩色背景', coloring:'涂色本', animation: '动画', frame: '相框', fairy: '魔法袋', paper: '纸样', texture: '纹理' })) {
  const button = document.createElement('button'); button.innerHTML=playfulIcon(({sticker:'friend',background:'forest',coloring:'pen',animation:'butterfly',frame:'select',fairy:'magic',paper:'paper',texture:'palette'})[category])+'<span>'+name+'</span>'; button.dataset.category = category;
  button.onclick = () => chooseCategory(category); $('categories').append(button);
}
engine = new DrawingEngine($('painting'), changed); engine.paperMode = true;engine.asyncEffects=true;engine.notice=toast; changed(); setTool('pen'); setColor(color); chooseCategory('sticker');
studio = mountStudio({ engine, run, toast, setTool, getTool:()=>tool, getColor:()=>color, changed });
const recorder=mountRecorder({engine,run,toast,getColor:()=>color,getTitle:()=>$('title').value.trim()||'我的画'});
const gallery=mountGallery({engine,run,toast,getTitle:()=>$('title').value.trim()||'我的画',setTitle:title=>{$('title').value=title;changed();savedRevision=revision;savedTitle=title;}});
mountClassic({setTool,getColor:()=>color,setColor,clearAnimations:()=>run(()=>engine.clearAnimated())});chooseCategory(libraryCategory);
const selectionReset=document.createElement('button');selectionReset.id='selection-reset';selectionReset.hidden=true;selectionReset.innerHTML=playfulIcon('select')+'<span>只在圈内画<br>点这里取消圈选</span>';selectionReset.onclick=()=>{engine.clearSelection();toast('圈选已取消，整张画纸都可以画了');};document.querySelector('.left-actions').prepend(selectionReset);
engine.onSelectionChange=()=>{selectionReset.hidden=!engine.selection;};

const styledText=mountText({engine,run,toast,getColor:()=>color,setTool});
const creative=mountCreative({engine,run,toast,getColor:()=>color,setTool});
mountMusic({run,toast});
const materials=mountMaterials({engine,run,toast});
mountDisplay();
mountPlayfulControls();
let canvasLayoutFrame;new ResizeObserver(()=>{cancelAnimationFrame(canvasLayoutFrame);canvasLayoutFrame=requestAnimationFrame(layoutCanvas);}).observe($('viewport'));
$('color').oninput = event => setColor(event.target.value);
$('size').oninput = () => { $('size-value').textContent = $('size').value; };
$('opacity').oninput = () => { $('opacity-value').textContent = `${$('opacity').value}%`; };
$('title').onchange = changed;
bind('undo', () => engine.undo()); bind('redo', () => engine.redo());
bind('add-layer', () => engine.addLayer(`画笔图层 ${engine.layers.length + 1}`));
bind('delete-layer', () => engine.removeActive()); bind('layer-up', () => engine.reorder(1)); bind('layer-down', () => engine.reorder(-1));
bind('rotate', () => engine.setProperty(engine.active, 'rotation', (engine.active.rotation + 15) % 360));
bind('smaller', () => engine.resizeActiveObject(1/1.15));
bind('bigger', () => engine.resizeActiveObject(1.15));
bind('zoom-out', () => { zoom = Math.max(.5, zoom / 1.25); layoutCanvas(); });
bind('zoom-in', () => { zoom = Math.min(4, zoom * 1.25); layoutCanvas(); });
bind('fit', () => { zoom = 1; layoutCanvas(); });
bind('new', () => { engine.end(); showDialog('new-dialog'); });
$('new-dialog').addEventListener('close', () => run(async () => { if ($('new-dialog').returnValue === 'create') { await gallery.backup();const [w, h] = $('preset').value.split(',').map(Number); zoom = 1; engine.reset(w, h); $('title').value = '新的奇妙世界'; setTool('pen'); changed(); } }));
bind('save', async () => { engine.end(); const title = $('title').value.trim() || '我的画',savingRevision=revision; const project = await engine.serialize(title); const result=await deliverFile(`${title}.luoyex`, 'application/json', JSON.stringify(project));if(result==='文件已保存'){savedRevision=savingRevision;savedTitle=title;}toast(result); });
bind('export',()=>showDialog('export-dialog'));
$('export-dialog').addEventListener('close',()=>run(async()=>{if($('export-dialog').returnValue!=='export')return;engine.end();const format=$('export-format').value,c=makeCanvas(engine.width,engine.height);engine.paint(c.getContext('2d'));toast(await deliverFile(($('title').value.trim()||'我的画')+(format==='png'?'.png':'.jpg'),'image/'+format,c.toDataURL('image/'+format,.92)));}));
bind('open', () => $('file-input').click()); bind('import-image', () => $('image-input').click());
$('file-input').onchange = event => run(async () => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (file.size > 128 * 1024 * 1024) throw new Error('工程超过当前支持的 128 MiB 上限。');
  if(/\.fly$/i.test(file.name)){const image=decodeLegacyFly(await file.arrayBuffer());await gallery.backup();engine.reset(image.width,image.height);engine.active.canvas.getContext('2d').putImageData(new ImageData(image.rgba,image.width,image.height),0,0);$('title').value=file.name.replace(/\.fly$/i,'');changed();toast('已作为单张图片导入；旧图层与记录不在此兼容范围内');return;}
  const data = JSON.parse(await file.text());await gallery.backup();engine.end(); $('title').value = await engine.restore(data); changed();savedRevision=revision;savedTitle=$('title').value.trim()||'我的画'; toast('作品打开了，接着画吧');
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
  if(['polygon','bezier'].includes(tool)||(tool==='select'&&studio.options().selectionShape==='bezier')){try{if(tool!=='select'&&!engine.path)engine.ensureDrawingLayer();engine.addVertex(point,{tool:tool==='select'?'select-bezier':tool,color,size:Number($('size').value),opacity:Number($('opacity').value)/100,...studio.options(),...materials.options()});}catch(e){toast(e.message);}return;}
  if (tool === 'picker') {
    const x = Math.max(0, Math.min(engine.width - 1, Math.floor(point.x))), y = Math.max(0, Math.min(engine.height - 1, Math.floor(point.y)));
    const composite=makeCanvas(engine.width,engine.height);engine.paint(composite.getContext('2d'));const pixel = composite.getContext('2d').getImageData(x, y, 1, 1).data;
    const picked='#'+[...pixel.slice(0,3)].map(n=>n.toString(16).padStart(2,'0')).join('');if(event.ctrlKey){$('background-color').value=picked;$('background-color').dispatchEvent(new Event('input'));}else setColor(picked);setTool('pen');return;
  }
  if (tool === 'text') { styledText.open(point); return; }
  if(tool==='fractal'){creative.open();return;}
  if(tool==='board-filter'){const o=creative.options();run(()=>engine.applyBoardFilter(o.filterKind,{...o,x:point.x,y:point.y}));return;}
  try {
    if(tool==='move'){
      const hit=engine.pickLayer(point);
      if(!hit){toast('请点住画里的小伙伴或笔迹来移动，背景会留在最下面');return;}
      engine.activeId=hit.id;renderLayers();
    }
    if ((tool === 'pen') || (tool === 'stamp' && engine.fairyMode !== 'dynamic') || ['line','triangle','rect','pentagon','hexagon','roundrect','ellipse','star'].includes(tool)) engine.ensureDrawingLayer(tool==='stamp'?'魔法袋笔迹':'我的画笔');
    engine.begin(point, { tool, color, size: Number($('size').value), opacity: Number($('opacity').value) / 100, brushVersion:2, brush: $('brush').value, ...studio.options(),...creative.options(),...materials.options() });
    if (engine.gesture) { pointerId = event.pointerId; $('painting').setPointerCapture(pointerId); if(tool==='stamp') stampTimer=setInterval(()=>engine.repeatStamp(),160); }
  } catch (error) { toast(error.message); }
});
$('painting').addEventListener('dblclick',()=>run(()=>engine.finishPath()));
function previewStamp(point) {
  hoverPoint=point;engine.stampPreview=tool==='stamp'&&engine.stampImages?.length&&point?{point,size:Number($('size').value)}:null;engine.render();
}
$('size').addEventListener('input',()=>previewStamp(hoverPoint));
$('painting').addEventListener('pointermove', event => {
  const point=engine.point(event);previewStamp(point);
  if (event.pointerId !== pointerId) return;
  const samples=event.getCoalescedEvents?.();
  for(const sample of samples?.length?samples:[event])engine.update(engine.point(sample));
});
$('painting').addEventListener('pointerleave',()=>previewStamp(null));
function finishPointer(event) { if(event.pointerId!==pointerId)return;clearInterval(stampTimer);engine.end(event.type==='pointercancel');pointerId=undefined; }
$('painting').addEventListener('pointerup',finishPointer);$('painting').addEventListener('pointercancel',finishPointer);$('painting').addEventListener('lostpointercapture',finishPointer);
window.addEventListener('blur',()=>{clearInterval(stampTimer);engine.end();pointerId=undefined;previewStamp(null);});
document.addEventListener('keydown', event => {
  if (busy || event.target.matches('input,select,textarea') || document.querySelector('dialog[open]')) return;
  if(event.key==='Enter'&&engine.path){event.preventDefault();run(()=>engine.finishPath());return;}
  if (event.key === 'Escape') { clearInterval(stampTimer); previewStamp(null); engine.finishPath(true);engine.end(true); pointerId = undefined; return; }
  if (event.metaKey || event.ctrlKey) {
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? engine.redo() : engine.undo(); }
    if (event.key.toLowerCase() === 'y') { event.preventDefault(); engine.redo(); }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); $('save').click(); }
    if (event.key.toLowerCase() === 'o') { event.preventDefault(); $('open').click(); }
  }
});
window.LUOYEFlushBeforeClose=async()=>{
  if(busy)throw new Error('请先完成当前操作');
  busy=true;
  try{
  engine.end();engine.finishPath(true);clearTimeout(saveTimer);
  if(!closeSnapshot||closeSnapshot.revision!==revision){
    const png=engine.exportPNG(),snapshotRevision=revision;
    const project=await engine.serialize($('title').value.trim()||'我的画');
    closeSnapshot={sessionId,revision:snapshotRevision,project,png};
  }
  await writeDraft(closeSnapshot.project);await recorder.flush();
  return closeSnapshot;
  }finally{busy=false;}
};
const closeDialog=document.createElement('dialog');closeDialog.id='close-dialog';
window.LUOYEPerformance=()=>({...engine.metrics,layers:engine.layers.length,sprites:engine.layers.reduce((n,l)=>n+(l.sprites?.length||0),0),decodedPixels:engine.scenePixels()});
closeDialog.innerHTML='<form method="dialog"><h2>把这幅画留下来吗？</h2><p>这幅画还有没保存的修改。保存后会放在「图片／落叶画板作品」。</p><div class="dialog-actions"><button value="save">'+playfulIcon('save')+'保存并退出</button><button value="discard">'+playfulIcon('eraser')+'不保存退出</button><button value="cancel" autofocus>'+playfulIcon('pencil')+'继续画画</button></div></form>';
document.body.append(closeDialog);
window.LUOYERequestClose=createCloseFlow({
 hasChanges:()=>revision!==savedRevision||($('title').value.trim()||'我的画')!==savedTitle,
 ask:()=>new Promise(resolve=>{closeDialog.returnValue='cancel';closeDialog.addEventListener('close',()=>resolve(closeDialog.returnValue),{once:true});closeDialog.showModal();}),
 save:()=>window.LUOYEFlushBeforeClose(),
 discard:async()=>{clearTimeout(saveTimer);await draftInFlight.catch(()=>{});await recorder.flush();await discardCurrentDraft();savedRevision=revision;savedTitle=$('title').value.trim()||'我的画';}
});
window.addEventListener('blur', () => { if (engine.gesture) { engine.end(); pointerId = undefined; } });
async function initialize() {
  try {
    await preserveDraft();
  } catch { $('save-state').textContent = '可手动保存作品'; }
  ready = true;
  savedRevision=revision;savedTitle=$('title').value.trim()||'我的画';
  if (window.webkit?.messageHandlers?.ready) window.webkit.messageHandlers.ready.postMessage({ width: engine.width, height: engine.height, assets: catalog.length, brushes:$('brush').options.length, effects:studio.effectCount, tools:Object.keys(toolNames), version:window.LUOYE_VERSION||'开发版',classicUnits:14,toolPages:2,textStyles:10,musicTracks:20,darkroomGroups:7,proceduralFractals:3,nortonThumbnailPresets:20,fairyFrames:catalog.reduce((n,asset)=>n+(asset.fairyGroups?.reduce((sum,group)=>sum+group.frames.length,0)||0),0) });
}
initialize();

const effectProgress=document.createElement('div');effectProgress.id='effect-progress';effectProgress.hidden=true;effectProgress.innerHTML='<span role="status">正在给画面变魔法…</span><button id="cancel-effect">取消这次效果</button>';document.querySelector('.canvas-topbar').append(effectProgress);
engine.onEffectProgress=active=>{effectProgress.hidden=!active;document.body.classList.toggle('processing-effect',active);};
$('cancel-effect').onclick=()=>{engine.effectCancelled=true;};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&engine.effectRunning){event.preventDefault();event.stopImmediatePropagation();engine.effectCancelled=true;}},true);

const objectControls=document.createElement('div');objectControls.id='object-controls';objectControls.hidden=true;objectControls.innerHTML='<div><strong id="object-caption"></strong><span>拖动它换位置，点按钮调大小</span></div><button id="object-smaller" aria-label="缩小画里的小伙伴">'+playfulIcon('shrink')+'<span>变小</span></button><button id="object-bigger" aria-label="放大画里的小伙伴">'+playfulIcon('grow')+'<span>变大</span></button>';
document.querySelector('.classic-parameters').append(objectControls);$('object-smaller').onclick=()=>$('smaller').click();$('object-bigger').onclick=()=>$('bigger').click();
function objectState(){const layer=engine.active;objectControls.hidden=tool!=='move'||!layer||layer.role==='background';if(layer)$('object-caption').textContent=layer.sprites?'调整这串动态图案':layer.name;}
document.addEventListener('toolchange',objectState);document.addEventListener('objectchange',objectState);objectState();
