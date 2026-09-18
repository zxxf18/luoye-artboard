import { makeCanvas } from './engine.js';
import { deliverFile } from './storage.js';

const EFFECTS = {
  brightness:['明亮度／对比度',[['brightness','明亮度',-100,100,0],['contrast','对比度',-100,100,0]]],
  hsl:['色相／彩度／亮度',[['hue','色相',-180,180,0],['saturation','彩度',-100,100,0],['lightness','亮度',-100,100,0]]],
  balance:['色彩平衡',[['red','红',-255,255,0],['green','绿',-255,255,0],['blue','蓝',-255,255,0]]],
  opacity:['透明度',[['amount','不透明度',0,100,100]]], enhance:['色彩增强',[['red','红',10,300,100],['green','绿',10,300,100],['blue','蓝',10,300,100]]],
  shift:['色彩偏移',[['rx','红水平',-100,100,0],['ry','红垂直',-100,100,0],['gx','绿水平',-100,100,0],['gy','绿垂直',-100,100,0],['bx','蓝水平',-100,100,0],['by','蓝垂直',-100,100,0]]],
  grayscale:['灰阶',[]],threshold:['黑白',[['threshold','阈值',0,255,128]]],invert:['反向',[]],
  blur:['柔化',[['radius','半径',1,12,2]]],sharpen:['锐化',[]],emboss:['浮雕',[]],mosaic:['马赛克',[['radius','方块大小',2,80,10]]],posterize:['色阶分离',[['levels','色阶',2,16,4]]],sepia:['怀旧色',[]],solarize:['曝光反转',[]],
  edge:['综合寻边',[]],edgeX:['水平寻边',[]],edgeY:['垂直寻边',[]],
  dilateX:['水平膨胀',[]],dilateY:['垂直膨胀',[]],erodeX:['水平腐蚀',[]],erodeY:['垂直腐蚀',[]],openX:['水平开操作',[]],openY:['垂直开操作',[]],closeX:['水平闭操作',[]],closeY:['垂直闭操作',[]],
  gradient:['渐变映射',[['start','起始亮度',0,254,0],['end','结束亮度',1,255,255]]],replace:['前景色换成背景色',[['tolerance','颜色公差',0,255,20]]],
  noise:['噪音',[['amount','振幅',0,100,40],['frequency','密度',0,100,50],['seed','随机种子',1,9999,1]]],
  function:['色彩魔力',[]],feather:['羽化透明度',[['radius','半径',1,12,4]]],
};

export function mountStudio({engine,run,toast,setTool,getTool,getColor,changed}) {
  const el=id=>document.getElementById(id);
  const strip=document.createElement('div');strip.className='command-strip';strip.innerHTML=`
    <div class="workspace-tabs" aria-label="创作单元"><button id="mode-board" class="selected">画板</button><button id="darkroom">暗房</button><button id="mode-library">图库</button></div>
    <div class="edit-commands"><button id="copy" title="⌘/Ctrl+C">复制</button><button id="cut" title="⌘/Ctrl+X">剪切</button><button id="paste" title="⌘/Ctrl+V">粘贴</button><button id="selection-menu">选区操作</button><button id="layer-menu">图层操作</button></div>`;
  document.querySelector('.options-bar').after(strip);
  const detail=document.createElement('div');detail.className='detail-bar';detail.innerHTML=`
    <label data-option="pen">笔迹 <select id="stroke-mode" aria-label="画笔方式"><option value="free">自由涂鸦</option><option value="line">直线</option></select></label><label data-option="pen">宽窄 <input id="brush-ratio" type="number" aria-label="笔尖宽窄比" min="0.15" max="2" step="0.05" value="1"></label><label data-option="eraser">橡皮 <select id="eraser-mode" aria-label="橡皮种类"><option value="hard">硬橡皮</option><option value="soft">软橡皮</option><option value="rect">矩形清除</option></select></label><label data-option="stamp">间距 <input id="stamp-spacing" type="number" aria-label="印章间距" value="0.7" min="0.1" max="4" step="0.1"></label><button data-option="clone" id="clone-source">设置仿制源点</button><label>背景色 <input id="background-color" aria-label="背景颜色" type="color" value="#ffffff" hidden><button id="background-picker-open" type="button">选择背景颜色</button></label>
    <label data-option="fill">填色 <select id="fill-mode" aria-label="填色模式"><option value="region">区域填色</option><option value="all">完全填色</option><option value="gradient">前景／背景渐变</option><option value="region-gradient">区域渐变</option><option value="ellipse">圆形填色</option><option value="rect">矩形填色</option></select></label>
    <label data-option="fill"><input id="fill-gradient" type="checkbox">圆／矩形渐变</label>
    <label data-option="fill magic">公差 <input id="tolerance" type="number" min="0" max="255" value="20" aria-label="颜色公差"></label>
    <label data-option="select">圈选 <span class="selection-mode-buttons"><button type="button" id="selection-rect" title="矩形圈选">▣ 矩形</button><button type="button" id="selection-free" title="自由圈选">⌁ 自由</button></span><select id="selection-shape" aria-label="选区形状"><option value="rect">矩形</option><option value="ellipse">圆形</option><option value="triangle">三角形</option><option value="pentagon">五角形</option><option value="hexagon">六角形</option><option value="roundrect">圆矩形</option><option value="free">自由套索</option><option value="bezier">Bezier 选区</option></select></label>
    <label data-option="select">组合 <select id="selection-mode" aria-label="选区组合"><option value="replace">重新选择</option><option value="union">再加一块</option><option value="subtract">减掉一块</option><option value="intersect">只留重叠</option></select></label>
    <label data-option="line rect ellipse triangle pentagon hexagon roundrect star polygon bezier">几何 <select id="geometry" aria-label="几何形状"><option value="line">直线</option><option value="triangle">三角形</option><option value="rect">矩形</option><option value="pentagon">五角形</option><option value="hexagon">六角形</option><option value="roundrect">圆矩形</option><option value="ellipse">椭圆</option><option value="star">星形</option><option value="polygon">多边形</option><option value="bezier">Bezier 曲线</option></select></label>
    <label data-option="line rect ellipse triangle pentagon hexagon roundrect star polygon bezier"><input id="shape-filled" type="checkbox">实心</label><label data-option="line rect ellipse triangle pentagon hexagon roundrect star polygon bezier"><input id="shape-dashed" type="checkbox">虚线</label>
    <span id="option-help">选区可以约束画笔、填色与暗房效果。</span>`;
  strip.after(detail);
  const dialogs=document.createElement('div');dialogs.innerHTML=`
    <dialog id="selection-dialog"><h2>选区操作</h2><p>所有像素工具都只修改选区内的画面。取消选区后恢复整层编辑。</p><div class="dialog-grid"><button id="select-all">全选</button><button id="select-none">取消选区</button><button id="select-inverse">反选</button><button id="clear-selection-pixels">清除所选像素</button></div><div class="dialog-actions"><button data-close="selection-dialog">完成</button></div></dialog>
    <dialog id="layer-dialog"><h2>管理当前图层</h2><p id="current-layer-name"></p><div class="dialog-grid"><button id="use-stamp">用作印章</button><button id="duplicate-layer">复制图层</button><button id="clear-layer">清空图层</button><button id="merge-bottom">合并到最底层</button><button id="flip-x">水平翻转</button><button id="flip-y">垂直翻转</button><button id="rotate-90">旋转 90°</button><button id="export-layer">输出透明 PNG</button><button id="animation-toggle">播放／暂停动画</button><button id="freeze-animation">将动画定格</button></div><label>图层不透明度 <input id="layer-opacity" type="range" min="0" max="100" value="100"></label><div class="dialog-actions"><button data-close="layer-dialog">完成</button></div></dialog>
    <dialog id="darkroom-dialog" class="wide-dialog"><h2>暗房</h2><nav id="darkroom-categories" class="darkroom-categories" aria-label="暗房七个单元"></nav><p>先在小图上预览，确认后应用到当前图层。画布上有选区时，仅修改选区。</p><div class="effect-layout"><div><label for="effect-kind">处理方式</label><select id="effect-kind"></select><div id="effect-parameters"></div><div id="function-modes" hidden><label>红色函数 <select data-channel="0"><option value="sin">正弦</option><option value="cos">余弦</option><option value="none">不处理</option></select></label><label>绿色函数 <select data-channel="1"><option value="sin">正弦</option><option value="cos">余弦</option><option value="none">不处理</option></select></label><label>蓝色函数 <select data-channel="2"><option value="sin">正弦</option><option value="cos">余弦</option><option value="none">不处理</option></select></label></div></div><div class="effect-preview"><span>当前图层预览</span><div id="effect-preview"></div></div></div><div class="dialog-actions"><button data-close="darkroom-dialog">取消</button><button id="apply-effect" class="primary">应用效果</button></div></dialog>`;
  document.body.append(dialogs);
  const combinations=document.createElement('div');combinations.id='selection-combination';combinations.dataset.option='select';combinations.setAttribute('role','group');combinations.setAttribute('aria-label','圈选组合');combinations.innerHTML='<strong>组合</strong><div class="selection-choices"></div>';
  const mode=el('selection-mode');
  const syncCombination=()=>{for(const button of combinations.querySelectorAll('button'))button.setAttribute('aria-pressed',button.dataset.selectionMode===mode.value);};
  for(const option of mode.options){const button=document.createElement('button');button.type='button';button.dataset.selectionMode=option.value;button.textContent=option.textContent;button.onclick=()=>{mode.value=option.value;mode.dispatchEvent(new Event('change',{bubbles:true}));};combinations.querySelector('.selection-choices').append(button);}
  mode.addEventListener('change',syncCombination);syncCombination();
  const selectionActions=document.createElement('div');selectionActions.id='selection-actions';selectionActions.dataset.option='select';selectionActions.setAttribute('role','group');selectionActions.setAttribute('aria-label','圈选操作');
  for(const [id,name] of [['select-all','全选'],['select-none','取消'],['select-inverse','反选'],['copy','复制'],['cut','剪切']]){const button=document.createElement('button');button.type='button';button.id='inline-'+id;button.textContent=name;button.onclick=()=>el(id).click();selectionActions.append(button);}
  detail.append(combinations,selectionActions);
  el('background-picker-open').onclick=()=>el('background-palette').click();
  const show=id=>el(id).showModal();
  const action=(id,fn)=>el(id).onclick=()=>run(fn);
  for(const button of dialogs.querySelectorAll('[data-close]'))button.onclick=()=>el(button.dataset.close).close();
  action('copy',()=>{engine.copySelection();toast(engine.paperMode?'已复制圈选的画面':'已复制当前层中的画面');});action('cut',()=>{engine.copySelection(true);toast('已剪切，可以粘贴为新图层');});action('paste',()=>{const previous=getTool?.()||'pen';engine.paste();setTool(previous);});
  action('selection-menu',()=>show('selection-dialog'));
  for(const [id,fn] of [['select-all',()=>engine.selectAll()],['select-none',()=>engine.clearSelection()],['select-inverse',()=>engine.invertSelection()],['clear-selection-pixels',()=>engine.deleteSelection()]])action(id,()=>{fn();el('selection-dialog').close();});
  let clonePicking=false;action('clone-source',()=>{clonePicking=true;toast('请点击画布上的仿制源点');});
  action('use-stamp',()=>{engine.useLayerAsStamp();engine.addLayer('连续印章');setTool('stamp');el('size').value=100;el('size-value').textContent='100';el('layer-dialog').close();toast('拖动画布连续盖章；动画素材将依次使用各帧');});
  action('layer-menu',()=>{el('current-layer-name').textContent='正在调整：'+engine.active.name;el('layer-opacity').value=engine.active.opacity*100;show('layer-dialog');});
  action('duplicate-layer',()=>engine.duplicateLayer());action('clear-layer',()=>engine.clearLayer());action('merge-bottom',()=>engine.mergeToBottom());action('flip-x',()=>engine.flipLayer('x'));action('flip-y',()=>engine.flipLayer('y'));action('rotate-90',()=>engine.setProperty(engine.active,'rotation',(engine.active.rotation+90)%360));
  action('export-layer',async()=>{toast(await deliverFile(engine.active.name+'.png','image/png',engine.exportLayerPNG()));});
  action('animation-toggle',()=>engine.toggleAnimation());action('freeze-animation',()=>engine.freezeAnimation());el('layer-opacity').onchange=()=>run(()=>engine.setProperty(engine.active,'opacity',Number(el('layer-opacity').value)/100));
  const effectGroups={
    '色彩调节':['brightness','hsl','balance','opacity','enhance','shift'],
    '模式转换':['grayscale','threshold','invert'],
    '暗房特效':['blur','sharpen','emboss','mosaic','posterize','sepia','solarize','edge','edgeX','edgeY','dilateX','dilateY','erodeX','erodeY','openX','openY','closeX','closeY','feather'],
    '色彩渐变':['gradient'],'噪音':['noise'],'色彩互换':['replace'],'色彩魔力':['function']
  };
  function selectEffectGroup(label){el('effect-kind').replaceChildren();for(const value of effectGroups[label]){const option=document.createElement('option');option.value=value;option.textContent=EFFECTS[value][0];el('effect-kind').append(option);}for(const b of el('darkroom-categories').children)b.setAttribute('aria-pressed',b.textContent===label);parameters();}
  for(const label of Object.keys(effectGroups)){const button=document.createElement('button');button.textContent=label;button.onclick=()=>selectEffectGroup(label);el('darkroom-categories').append(button);}
  el('function-modes').innerHTML=['红','绿','蓝'].map((name,i)=>`<fieldset><legend>${name}通道</legend><label>函数 <select data-channel="${i}" aria-label="${name}色函数"><option value="sin">正弦</option><option value="cos">余弦</option><option value="none">不处理</option></select></label>${[['amplitude','振幅',0,255,127],['offset','偏移',0,255,128],['frequency','频率',1,12,1]].map(([key,label,min,max,value])=>`<label>${label}<input type="range" data-channel-param="${key}" data-index="${i}" min="${min}" max="${max}" value="${value}" aria-label="${name}通道${label}"><output>${value}</output></label>`).join('')}</fieldset>`).join('');
  function effectOptions(){const p={color:getColor(),background:el('background-color').value};for(const input of el('effect-parameters').querySelectorAll('input'))p[input.dataset.param]=Number(input.value);p.modes=[...el('function-modes').querySelectorAll('select')].map(e=>e.value);p.channels=[{},{},{}];for(const input of el('function-modes').querySelectorAll('input'))p.channels[Number(input.dataset.index)][input.dataset.channelParam]=Number(input.value);p.dx=[p.rx||0,p.gx||0,p.bx||0];p.dy=[p.ry||0,p.gy||0,p.by||0];return p;}
  function preview(){try{el('effect-preview').replaceChildren(engine.effectPreview(el('effect-kind').value,effectOptions()));}catch(e){el('effect-preview').textContent=e.message;}}
  function parameters(){el('effect-parameters').replaceChildren();for(const [key,label,min,max,value] of EFFECTS[el('effect-kind').value][1]){const row=document.createElement('label');row.textContent=label+' ';const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.value=value;input.dataset.param=key;input.setAttribute('aria-label',label);const output=document.createElement('output');output.textContent=value;input.oninput=()=>{output.textContent=input.value;preview();};row.append(input,output);el('effect-parameters').append(row);}el('function-modes').hidden=el('effect-kind').value!=='function';preview();}
  el('effect-kind').onchange=parameters;for(const select of el('function-modes').querySelectorAll('select'))select.onchange=preview;
  for(const input of el('function-modes').querySelectorAll('input'))input.oninput=()=>{input.nextElementSibling.textContent=input.value;preview();};
  selectEffectGroup('色彩调节');
  action('darkroom',()=>{engine.end();if(!engine.paperMode)engine.assertRaster();parameters();show('darkroom-dialog');});
  action('apply-effect',async()=>{await engine.applyDarkroom(el('effect-kind').value,effectOptions());el('darkroom-dialog').close();toast('暗房效果已应用，可以撤销');});
  el('geometry').onchange=()=>setTool(el('geometry').value);
  for(const [id,shape] of [['selection-rect','rect'],['selection-free','free']])el(id).onclick=()=>{el('selection-shape').value=shape;setTool('select');};
  action('mode-board',()=>setTool('pen'));action('mode-library',()=>{document.querySelector('.categories button').focus();toast('在右侧图库选择素材加入作品');});
  document.addEventListener('keydown',event=>{
    if(document.body.hasAttribute('aria-busy')||event.target.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;
    if(event.ctrlKey||event.metaKey){const keys={c:'copy',x:'cut',v:'paste',a:'select-all',d:'select-none',i:'select-inverse',n:'new'};const id=keys[event.key.toLowerCase()];if(id){event.preventDefault();el(id).click();}}
    else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();run(()=>engine.deleteSelection());}
  });
  function toolChanged(tool){for(const item of document.querySelectorAll('.detail-bar [data-option],.classic-parameters [data-option]'))item.hidden=!item.dataset.option.split(' ').includes(tool);el('shape-filled').closest('label').hidden=['line','bezier'].includes(tool)||!el('shape-filled').closest('label').dataset.option.split(' ').includes(tool);if([...el('geometry').options].some(o=>o.value===tool))el('geometry').value=tool;}
  toolChanged('pen');
  return {effectCount:Object.keys(EFFECTS).length,toolChanged,pickingClone:()=>clonePicking,clonePicked:()=>{clonePicking=false;},options:()=>({strokeMode:el('stroke-mode').value,ratio:Math.max(.15,Math.min(2,Number(el('brush-ratio').value)||1)),eraserMode:el('eraser-mode').value,stampSpacing:Math.max(.1,Math.min(4,Number(el('stamp-spacing').value)||.7)),background:el('background-color').value,tolerance:Math.max(0,Math.min(255,Number(el('tolerance').value))),selectionShape:el('selection-shape').value,selectionMode:getTool?.()==='magic'?'replace':el('selection-mode').value,fillMode:el('fill-mode').value,gradient:el('fill-gradient').checked,filled:el('shape-filled').checked,dashed:el('shape-dashed').checked})};
}
