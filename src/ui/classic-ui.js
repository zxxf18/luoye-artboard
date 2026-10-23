import { choiceArt } from './choice-art.js';
import { mountPalette } from './palette-ui.js';
import { buildScratchPanel, applyScratchShelf, releaseScratchShelf } from './classic-scratch.js';
import { mountMobileShelf } from './classic-mobile.js';
import { FRACTAL_PRESETS, FRACTAL_PRESET_ICONS, FRACTAL_MAX_DEPTH, fractalState, fractalPercentToSize, fractalSizeToPercent, renderFractalCanvas } from './fractal-studio.js';
import { brandIcon, playfulIcon } from './playful-icons.js';
import { BRUSHES, DEFAULT_BRUSH_SIZE, brushSegment, prepareGradientStops } from '../core/brushes.js';
import { makeCanvas } from '../core/engine.js';

export const CLASSIC_TOOLS=[['pen','画笔'],['eraser','橡皮'],['stamp','魔法袋'],['fill','油漆桶'],['picker','吸颜色'],['line','图形'],['text','文字'],['select','圈选'],['magic','魔力棒'],['move','移动'],['warp','变形'],['board-filter','滤镜'],['clone','仿制印章'],['fractal','分形'],['scratch','刮刮画'],['animation','小动画'],['pixel','像素画']];
export function brushPreview(id,color,width=140,height=42,size=28,secondary='#ffffff'){
  const canvas=makeCanvas(width*2,height*2),ctx=canvas.getContext('2d');ctx.scale(2,2);canvas.setAttribute('aria-hidden','true');
  const g={layer:{scale:1},options:{tool:'pen',brush:id,brushVersion:2,size,color,secondaryColor:secondary,opacity:1,seed:913}};
  let a={x:18,y:height/2};brushSegment(ctx,g,a,a);for(let x=22;x<width-14;x+=4){const b={x,y:height/2+Math.sin((x-18)/(width-32)*Math.PI*2)*height*.13};
    // 预览不走绘画引擎的 segment()，渐变停靠点必须按段刷新，
    // 否则彩虹笔示例会停在起笔点的单一颜色上。
    prepareGradientStops(g,a,b);brushSegment(ctx,g,a,b);a=b;}return canvas;
}

export function mountClassic({setTool,getColor,setColor,clearAnimations,features}){
  const el=id=>document.getElementById(id);document.body.classList.add('playroom');
  const workspace=document.querySelector('.workspace'),studio=document.querySelector('.studio');
  const left=document.createElement('aside');left.id='classic-left';left.className='classic-left';left.setAttribute('aria-label','画笔盒');workspace.prepend(left);const paletteApi=mountPalette({getColor,setColor});
  const heading=document.createElement('div');heading.className='canvas-topbar';const tabs=document.querySelector('.workspace-tabs');heading.append(tabs);const tip=document.createElement('span');tip.className='canvas-welcome';tip.textContent='每一笔，都是新发现';heading.append(tip);studio.prepend(heading);
  const parameter=document.createElement('section');parameter.className='classic-parameters';parameter.setAttribute('aria-label','当前工具参数');parameter.innerHTML='<div class="brush-inspector"><div id="active-brush-preview"></div><div><strong id="active-tool-name">铅笔</strong><span id="active-tool-description">细细的线，勾轮廓</span></div></div>';
  const options=document.querySelector('.options-bar');parameter.append(options);studio.append(parameter);
  const detailBar=document.querySelector('.detail-bar');
  const palette=document.querySelector('.palette');palette.className='quick-palette';parameter.before(palette);palette.querySelector('.palette-label').remove();palette.querySelector('.custom-color').hidden=true;
  const dock=document.createElement('section');dock.id='tool-dock';dock.className='tool-dock';dock.setAttribute('aria-label','底部工具区');parameter.before(dock);dock.append(palette,parameter);
  const rail=document.querySelector('.tool-rail');if(rail)rail.id='tool-rail';
  const primary=document.createElement('div');primary.className='primary-brush-options';primary.setAttribute('aria-label','工具玩法与参数');primary.tabIndex=0;parameter.append(primary);if(detailBar)primary.append(detailBar);
  // The illustrated cards in the sidebar own these choices. Keep their source
  // controls connected for existing events, without duplicating them below.
  el('brush').dataset.directChoice='true';el('brush').hidden=true;
  for(const id of ['eraser-mode','eraser-shape','fill-mode','selection-shape','selection-mode','geometry']){
    const control=el(id);control.dataset.directChoice='true';control.hidden=true;control.closest('label').classList.add('sidebar-choice-source');
  }
  el('background-color').closest('label').classList.add('sidebar-choice-source');
  const stroke=el('stroke-mode');stroke.dataset.directChoice='true';stroke.hidden=true;stroke.closest('label').classList.add('deprecated-stroke-control');stroke.closest('label').hidden=true;
  const modes=document.createElement('div');modes.id='stroke-buttons';modes.setAttribute('role','group');modes.setAttribute('aria-label','画笔方式');
  for(const option of stroke.options){const b=document.createElement('button');b.type='button';b.dataset.strokeMode=option.value;b.append(choiceArt(stroke,option),Object.assign(document.createElement('span'),{textContent:option.textContent}));b.onclick=()=>{stroke.value=option.value;stroke.dispatchEvent(new Event('change',{bubbles:true}));};modes.append(b);}
  const syncModes=()=>{for(const b of modes.children)b.setAttribute('aria-pressed',b.dataset.strokeMode===stroke.value);};stroke.addEventListener('change',syncModes);syncModes();options.append(el('brush-ratio').closest('label'));
  for(const control of [el('brush-options'),document.querySelector('.opacity-control'),el('brush-ratio').closest('label')])control.classList.add('parameter-slider');
  el('brush-ratio').type='range';el('brush-ratio').setAttribute('aria-label','笔尖宽窄');
  const ratioValue=document.createElement('output');ratioValue.id='ratio-value';el('brush-ratio').after(ratioValue);
  const showRatio=()=>{ratioValue.textContent=Number(el('brush-ratio').value).toFixed(2);};el('brush-ratio').addEventListener('input',showRatio);showRatio();parameter.append(primary);
  const brushOptions=el('brush-options'),brushOptionsParent=brushOptions.parentElement;
  const moreColor=document.createElement('button');moreColor.className='more-colors';moreColor.innerHTML=playfulIcon('palette')+'<span>更多颜色</span>';moreColor.onclick=()=>el('palette-open').click();palette.append(moreColor);
  const {panel:scratchPanel,sizeRow:scratchSizeRow}=buildScratchPanel({palette:paletteApi});
  scratchPanel.hidden=true;parameter.append(scratchPanel);
  // 分形参数栏：颜色直接用底部固定的“我的颜色”栏选择，这里只留
  // 一行——左边大小滑杆、右边分形次数加减。
  const fractalPanel=document.createElement('section');fractalPanel.className='fractal-params';fractalPanel.setAttribute('aria-label','分形参数');
  fractalPanel.innerHTML=`<div class="fractal-fields"><div class="fractal-field fractal-size-field"><span>大小</span><input id="fractal-size" type="range" min="0" max="100" step="1" value="${fractalSizeToPercent(fractalState.size)}" aria-label="分形大小百分比"><output id="fractal-size-value">${fractalSizeToPercent(fractalState.size)}%</output></div><div class="fractal-field fractal-depth-field"><span>分形次数</span><div class="fractal-stepper"><button type="button" id="fractal-depth-down" aria-label="减少分形次数">−</button><output id="fractal-depth-value">${fractalState.depth}</output><button type="button" id="fractal-depth-up" aria-label="增加分形次数">＋</button></div></div></div>`;
  fractalPanel.hidden=true;parameter.append(fractalPanel);
  document.addEventListener('palettechange',()=>{fractalState.color=document.getElementById('color').value;});
  fractalPanel.querySelector('#fractal-size').addEventListener('input',event=>{fractalState.size=fractalPercentToSize(event.target.value);fractalPanel.querySelector('#fractal-size-value').textContent=event.target.value+'%';});
  const syncFractalDepth=()=>{fractalPanel.querySelector('#fractal-depth-value').textContent=fractalState.depth;fractalPanel.querySelector('#fractal-depth-down').disabled=fractalState.depth<=1;fractalPanel.querySelector('#fractal-depth-up').disabled=fractalState.depth>=FRACTAL_MAX_DEPTH;};
  fractalPanel.querySelector('#fractal-depth-down').onclick=()=>{fractalState.depth=Math.max(1,fractalState.depth-1);syncFractalDepth();};
  fractalPanel.querySelector('#fractal-depth-up').onclick=()=>{fractalState.depth=Math.min(FRACTAL_MAX_DEPTH,fractalState.depth+1);syncFractalDepth();};
  syncFractalDepth();
  const status=document.querySelector('.canvas-footer');studio.append(status);const zoom=document.querySelector('.zoom-controls');heading.append(zoom);
  document.querySelector('.canvas-heading').hidden=true;
  const footer=document.createElement('div');footer.className='left-actions';
  const pens=document.createElement('div');pens.className='brush-box';pens.setAttribute('aria-label','十一种画笔');const title=document.createElement('h2');title.textContent='我的画笔盒';left.append(title,pens);const libraryGroups=document.createElement('div');libraryGroups.id='library-groups';libraryGroups.setAttribute('aria-label','素材分类');left.append(libraryGroups);
  let currentBrush=el('brush').value;const sizes={};
  function chooseBrush(value){el('painting').dataset.brush=value;document.dispatchEvent(new Event('brushchange'));if(el('painting').dataset.tool==='pen')sizes[currentBrush]=Number(el('size').value);openLibrary(false);currentBrush=value;el('brush').value=value;el('size').value=sizes[value]||DEFAULT_BRUSH_SIZE;el('size').dispatchEvent(new Event('input',{bubbles:true}));setTool('pen');sync();document.dispatchEvent(new Event('controlschange'));}
  for(const brush of BRUSHES){const b=document.createElement('button');b.type='button';b.className='brush-card';b.dataset.brush=brush.id;b.style.setProperty('--brush-color',brush.color);b.setAttribute('aria-label',brush.name);b.title=brush.name+'：'+brush.hint;b.innerHTML=playfulIcon(brush.id)+`<span>${brush.name}</span><span class="brush-sample"></span>`;b.onclick=()=>{if(!document.body.hasAttribute('aria-busy'))chooseBrush(brush.id);};pens.append(b);const option=[...el('brush').options].find(o=>o.value===brush.id);option.textContent=brush.name;}
  pens.tabIndex=0;
  el('size').value=DEFAULT_BRUSH_SIZE;el('size-value').textContent=DEFAULT_BRUSH_SIZE;
  const subtools=document.createElement('div');subtools.className='subtool-box';left.append(subtools,modes,footer);
  // Single source of truth for the classic shelf; the core tool registry
  // contract test asserts this list stays registered and described.
  const tools=CLASSIC_TOOLS.map(entry=>[...entry]);
  const featureTools={animation:features?.animation,pixel:features?.pixel};
  const geometries=['line','triangle','rect','pentagon','hexagon','roundrect','ellipse','star','polygon','bezier'];
  const groupTool=()=>geometries.includes(el('painting').dataset.tool)?'line':el('painting').dataset.tool;
  const bar=el('tools');bar.replaceChildren();let page=0;
  // 刮刮画／小动画／像素画／分形是独立功能，永远从新一页开始排；
  // 绘画工具每页至多 7 个（13 个绘画工具 → 第一页 7 个、第二页 6 个）。
  const featureIds=new Set(['scratch','animation','pixel']);
  const firstFeature=tools.findIndex(([id])=>featureIds.has(id));
  const drawingPages=firstFeature<0?Math.ceil(tools.length/7):Math.ceil(firstFeature/7);
  const pageOf=index=>index<firstFeature?Math.floor(index/7):drawingPages+Math.floor((index-firstFeature)/7);
  const pageCount=()=>Math.max(drawingPages,pageOf(tools.length-1)+1);
  // 左右双箭头翻页：两个方向都循环，中间是页码指示。
  const flipRow=document.createElement('div');flipRow.id='tool-pager';flipRow.className='tool-pager';
  const flipPrev=document.createElement('button');flipPrev.id='tool-page-prev';flipPrev.className='tool-page-arrow';flipPrev.setAttribute('aria-label','上一页工具');flipPrev.innerHTML='◀';
  const flipLabel=document.createElement('span');flipLabel.id='tool-page-label';flipLabel.className='tool-page-label';
  const flipNext=document.createElement('button');flipNext.id='tool-page';flipNext.className='tool-page-arrow';flipNext.setAttribute('aria-label','下一页工具');flipNext.innerHTML='▶';
  flipPrev.onclick=()=>{page=(page-1+pageCount())%pageCount();renderTools();sync();};
  flipNext.onclick=()=>{page=(page+1)%pageCount();renderTools();sync();};
  flipRow.append(flipPrev,flipLabel,flipNext);
  function renderTools(){
    // In a compact WebView all tools belong to the same drawer. Keeping the
    // pages there made the sheet tall while hiding half of the actions.
    // Desktop/native windows keep the rail at seven tools per page; newer
    // additions (刮刮画、小动画、像素画) live together on the third page.
    // Buttons from other pages stay in the DOM but hidden, so keyboard and
    // test journeys can still reach every tool without guessing the page.
    const compact=matchMedia('(max-width: 860px), (max-height: 600px)').matches;
    bar.replaceChildren();
    // 桌面模式：可见按钮装进固定 7 格高度的列里，列在栏内垂直居中、
    // 按钮从列顶部排起；不满一页时不会整体居中，也不会过度拉伸。
    const column=document.createElement('div');column.className='tool-column';
    for(const [index,[id,name]] of tools.entries()){
      const b=document.createElement('button');b.className='tool-button';b.dataset.tool=id;b.setAttribute('aria-label',name);b.innerHTML=playfulIcon(id==='pen'?'pencil':id==='animation'?'butterfly':id)+`<span>${name}</span>`;
      b.hidden=!compact&&pageOf(index)!==page;
      b.onclick=()=>{if(document.body.hasAttribute('aria-busy'))return;
        // Programmatic or assistive activation can target a button from
        // another page; reveal its page first so the rail follows the action.
        if(b.hidden){page=pageOf(index);renderTools();}
        const feature=featureTools[id];if(feature){feature();return;}setTool(id);if(id!=='stamp')openLibrary(false);if(id==='stamp'){document.dispatchEvent(new Event('openfairy'));openLibrary(true);}if(isNarrow())setMobilePanel(id==='stamp'?'library':'brushes');};
      (compact?bar:column).append(b);
    }
    if(!compact)bar.append(column);
    bar.classList.toggle('tools-centered',!compact);
    flipRow.hidden=compact;
    flipRow.setAttribute('aria-hidden',String(compact));
    flipLabel.textContent=`${page+1} / ${pageCount()}`;
    flipPrev.title=page===0?`循环到第 ${pageCount()} 页`:'上一页工具';
    flipNext.title=page===pageCount()-1?'回到第 1 页':'下一页工具';
    bar.after(flipRow);
  }
  renderTools();
  let lastColor='',lastSecondary='',showEraserShapes=false;
  // 示例笔迹不跟选色走：亮主题固定黑色、暗主题（机械/宇宙）固定白色；
  // 彩虹笔自带七彩旅程不受影响，渐变笔用固定深浅两色画出渐变。
  const darkSample=()=>['mechanical','space'].includes(document.body.dataset.theme);
  const sampleColor=()=>darkSample()?'#ffffff':'#141414';
  const sampleSecondary=(id,base)=>id==='duotone'?(darkSample()?'#39404e':'#ffffff'):base;
  function sync(){const tool=el('painting').dataset.tool,brush=BRUSHES.find(b=>b.id===el('brush').value);document.body.dataset.classicTool=tool;title.textContent=document.body.classList.contains('library-open')&&libraryGroups.children.length?'找一找图案':tool==='pen'?'我的画笔盒':tool==='scratch'?'我的刮刮画':(tools.find(t=>t[0]===groupTool())?.[1]||'工具')+'怎么玩';pens.hidden=tool!=='pen';subtools.replaceChildren();
    for(const b of pens.children)b.setAttribute('aria-pressed',b.dataset.brush===brush.id);el('painting').dataset.brush=brush.id;for(const b of bar.children)b.setAttribute('aria-pressed',b.dataset.tool===groupTool());
    const secondary=el('background-color').value;if(getColor()!==lastColor||secondary!==lastSecondary){lastColor=getColor();lastSecondary=secondary;for(const b of pens.children)b.querySelector('.brush-sample').replaceChildren(brushPreview(b.dataset.brush,sampleColor(),140,34,DEFAULT_BRUSH_SIZE,sampleSecondary(b.dataset.brush,secondary)));}
    const name=tool==='pen'?brush.name:tools.find(t=>t[0]===groupTool())?.[1]||'画画';el('active-tool-name').textContent=name;el('active-tool-description').textContent=tool==='pen'?brush.hint:'选好玩法，再到画纸上试一试';el('active-brush-preview').replaceChildren(tool==='pen'?brushPreview(brush.id,sampleColor(),140,50,Math.min(36,Number(el('size').value)),sampleSecondary(brush.id,secondary)):Object.assign(document.createElement('span'),{innerHTML:playfulIcon(groupTool())}));
    primary.hidden=false;modes.hidden=tool!=='pen';
    el('brush-options').hidden=!['pen','eraser','stamp','clone','scratch',...geometries].includes(tool)||(tool==='eraser'&&el('eraser-mode').value==='rect');document.querySelector('.opacity-control').hidden=['select','magic','move','warp','board-filter','picker','fractal','scratch'].includes(tool)||(tool==='eraser'&&el('eraser-mode').value==='rect');
    options.hidden=![...options.querySelectorAll('.parameter-slider')].some(item=>!item.hidden);
    document.querySelector('label[for="size"]').textContent=tool==='stamp'?'图案大小':tool==='scratch'?'粗细':'笔尖粗细';
    const map={eraser:showEraserShapes&&el('eraser-mode').value==='shape'?'eraser-shape':'eraser-mode',fill:'fill-mode',select:'selection-shape',warp:'warp-kind','board-filter':'board-filter-kind'};const config=geometries.includes(tool)?'geometry':map[tool],select=config&&el(config);
    if(select){if(config==='eraser-shape'){const back=document.createElement('button');back.type='button';back.className='subtool-card eraser-mode-back';back.textContent='← 其他橡皮';back.onclick=()=>{showEraserShapes=false;sync();};subtools.append(back);}for(const option of select.options){const b=document.createElement('button');b.type='button';b.className='subtool-card';const label=document.createElement('span');label.textContent=option.textContent;b.append(choiceArt(select,option),label);b.setAttribute('aria-pressed',select.value===option.value);b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));sync();};subtools.append(b);}}
    else if(tool!=='pen'&&tool!=='scratch'&&tool!=='fractal'){const p=document.createElement('p');p.className='tool-coach';p.textContent=tool==='stamp'?'选好图案，调一调大小\n按住鼠标，连续画':el('tool-hint').textContent;subtools.append(p);if(tool==='stamp'){const edit=document.createElement('button');edit.className='subtool-card';edit.innerHTML=playfulIcon('move')+'<span>调整画里的图案</span>';edit.onclick=()=>{setTool('move');openLibrary(false);};subtools.append(edit);const modes=document.createElement('div');modes.className='fairy-modes';edit.before(modes);for(const [mode,label] of [['single','单张图案'],['static','组合图案'],['dynamic','会动图案']]){const b=document.createElement('button');b.className='subtool-card';b.innerHTML=playfulIcon(mode==='dynamic'?'effect':'stamp')+'<span>'+label+'</span>';b.setAttribute('aria-pressed',(document.body.dataset.fairyMode||'single')===mode);b.onclick=()=>{document.body.dataset.fairyMode=mode;document.dispatchEvent(new Event('fairymodechange'));openLibrary(true);sync();};modes.append(b);}}if(tool==='text'){const b=document.createElement('button');b.className='primary';b.innerHTML=playfulIcon('text')+'<span>写几个字</span>';b.onclick=()=>{[...document.querySelectorAll('.detail-bar button')].find(n=>n.dataset.option==='text')?.click();};subtools.append(b);}}
    // Keep the shared "我的颜色" shelf visible for scratch painting.  The
    // scratch-specific controls live below it as three equal parameter cards;
    // hiding the shared palette made this tool look and behave differently
    // from every other drawing tool.
    scratchPanel.hidden=tool!=='scratch';fractalPanel.hidden=tool!=='fractal';palette.hidden=false;moreColor.hidden=false;
    if(tool==='fractal'){
      const heading=document.createElement('p');heading.className='tool-coach fractal-coach';heading.textContent='选图案，调颜色，点到画纸上';subtools.append(heading);
      // 滤镜同款竖排图标列表：卡通 SVG 图标 + 名称，列表长了像画笔盒一样滚动。
      const list=document.createElement('div');list.className='fractal-presets';list.setAttribute('role','group');list.setAttribute('aria-label','分形图案');
      for(const preset of FRACTAL_PRESETS){
        const card=document.createElement('button');card.type='button';card.className='subtool-card fractal-preset-card';card.dataset.fractalPreset=preset.id;card.title=preset.hint;card.setAttribute('aria-pressed',String(fractalState.preset===preset.id));
        const art=document.createElement('span');art.className='fractal-preset-icon';art.setAttribute('aria-hidden','true');art.innerHTML=`<svg viewBox="0 0 64 64" fill="none" stroke="#8d654c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${FRACTAL_PRESET_ICONS[preset.id]||''}</svg>`;
        card.append(art,Object.assign(document.createElement('span'),{textContent:preset.name}));
        card.onclick=()=>{fractalState.preset=preset.id;for(const item of list.children)item.setAttribute('aria-pressed',String(item===card));};
        list.append(card);
      }
      subtools.append(list);
    }
    if(tool==='scratch'){
      applyScratchShelf({parameter,brushOptions,options,primary,panel:scratchPanel,sizeRow:scratchSizeRow});
    } else {
      releaseScratchShelf({parameter,brushOptions,panel:scratchPanel,brushOptionsParent,dock});
    }
    if(tool==='eraser'){const clear=document.createElement('button');clear.id='clear-animations';clear.className='subtool-card';clear.innerHTML=playfulIcon('eraser')+'<span>清除所有动图</span>';clear.title='保留背景和画笔；可以撤销';clear.onclick=clearAnimations;subtools.append(clear);}
    if(tool==='scratch'){const reset=document.createElement('button');reset.className='subtool-card scratch-reset-card';reset.innerHTML=playfulIcon('scratch')+'<span>重新覆盖</span>';reset.title='恢复覆盖层，可以再次刮开';reset.onclick=()=>document.dispatchEvent(new Event('scratch-reset'));subtools.append(reset);
      // 关闭刮刮画的开关：整个卡（覆盖层＋底色）一次性移除并可用撤销找回，
      // 原画作与背景从未被破坏，去掉后立即恢复完整画面。
      const remove=document.createElement('button');remove.className='subtool-card scratch-remove-card';remove.innerHTML=playfulIcon('new-paper')+'<span>去掉刮刮画</span>';remove.title='移除覆盖层和底色，完整恢复画面；可以撤销';remove.onclick=()=>document.dispatchEvent(new Event('scratch-remove'));subtools.append(remove);}
  }
  document.addEventListener('toolchange',()=>{const i=tools.findIndex(t=>t[0]===groupTool());const compact=matchMedia('(max-width: 860px), (max-height: 600px)').matches;if(compact){if(page!==0){page=0;renderTools();}}else if(i>=0&&pageOf(i)!==page){page=pageOf(i);renderTools();}sync();});document.addEventListener('palettechange',sync);document.addEventListener('themechange',()=>{lastColor='';sync();});document.addEventListener('input',e=>{if(e.target===el('background-color'))sync();});document.addEventListener('change',e=>{if(e.target===el('brush'))chooseBrush(e.target.value);else if(['geometry','eraser-mode','eraser-shape','fill-mode','selection-shape','warp-kind','board-filter-kind'].includes(e.target.id)){if(e.target===el('eraser-mode'))showEraserShapes=e.target.value==='shape';sync();}});el('size').addEventListener('input',sync);
  function openLibrary(open){document.body.classList.toggle('library-open',open);el('mode-library').setAttribute('aria-pressed',open);el('mode-board').setAttribute('aria-pressed',!open);}
  new MutationObserver(()=>{const open=document.body.classList.contains('library-open');el('mode-library').setAttribute('aria-pressed',open);el('mode-board').setAttribute('aria-pressed',!open);if(open&&libraryGroups.children.length)title.textContent=document.body.dataset.librarySurface==='fairy'?'我的魔法袋':'找一找图案';else if(!open)sync();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  el('mode-library').onclick=()=>{const opening=!document.body.classList.contains('library-open')||document.body.dataset.librarySurface==='fairy';if(opening)document.dispatchEvent(new Event('opengallery'));openLibrary(opening);};el('mode-board').addEventListener('click',()=>openLibrary(false));
  for(const [id,icon,label] of [['mode-board','paper','画板'],['darkroom','board-filter','暗房'],['mode-library','forest','图库']])el(id).innerHTML=playfulIcon(icon)+'<span>'+label+'</span>';
  const library=document.querySelector('.right-panel');dock.prepend(library);document.querySelector('.panel-heading h2').textContent='灵感百宝箱';
  const layer=el('layer-menu');layer.innerHTML=playfulIcon('layers')+'<span>我的图层</span>';footer.append(layer);const newPaper=el('new');newPaper.innerHTML=playfulIcon('new-paper')+'<span>新画纸</span>';footer.append(newPaper);
  const more=document.createElement('dialog');more.id='more-dialog';more.className='wide-dialog';more.innerHTML='<h2>设置</h2><div class="more-actions"></div><div class="dialog-actions"><button id="more-done">返回画纸</button></div>';document.body.append(more);const actions=more.querySelector('.more-actions');
  // Every entry in the settings drawer uses the same icon/text contract. The
  // original controls stay in place by id so their behaviour and keyboard
  // shortcuts continue to work after moving them into this grid.
  const settingItems=[['copy','copy','复制'],['cut','cut','剪切'],['paste','paste','粘贴'],['selection-menu','select','选区操作'],['recordings','play','绘画录像'],['import-image','image','放入自己的图片']];
  const paperSize=document.createElement('button');paperSize.id='paper-size-open';paperSize.type='button';
  const settingButton=(button,icon,label)=>{button.type='button';button.className='more-action';button.innerHTML=playfulIcon(icon)+`<span>${label}</span>`;button.setAttribute('aria-label',label);actions.append(button);};
  settingButton(paperSize,'paper','画纸尺寸');
  for(const [id,icon,label] of settingItems){const button=el(id);if(button)settingButton(button,icon,label);}
  const aboutButton=document.createElement('button');aboutButton.id='about-open';aboutButton.type='button';settingButton(aboutButton,'palette','关于');actions.append(aboutButton);
  actions.addEventListener('click',()=>more.close(),true);el('more-done').onclick=()=>more.close();const about=document.createElement('dialog');about.id='about-dialog';about.className='about-dialog';about.innerHTML=`<div class="about-mark" aria-hidden="true">${brandIcon(document.body.dataset.theme||'autumn',{slot:'about'})}</div><h2>落叶画板</h2><p class="about-version">版本 <strong id="about-version">开发版</strong></p><p class="about-links"><a href="https://github.com/zxxf18/luoye-artboard" target="_blank" rel="noopener noreferrer">项目地址</a><span class="about-links-sep" aria-hidden="true">·</span><a href="https://index.yebuluo.com.cn/donate/" target="_blank" rel="noopener noreferrer">支持作者</a></p><p class="about-credit">Powered by ZX</p><p class="about-credit">For WenHe</p><div class="dialog-actions"><button id="about-close" class="primary" autofocus>返回画纸</button></div>`;document.body.append(about);about.querySelector('#about-version').textContent=window.LUOYE_VERSION||'开发版';aboutButton.onclick=()=>about.showModal();about.querySelector('#about-close').onclick=()=>about.close();document.addEventListener('themechange',event=>{const icon=about.querySelector('.about-mark');const current=icon?.querySelector('.about-theme-icon');if(icon&&current)current.outerHTML=brandIcon(event.detail?.theme||document.body.dataset.theme||'autumn',{slot:'about'});});
  const titleDialog=document.createElement('dialog');titleDialog.id='title-dialog';titleDialog.innerHTML='<h2>给画起个名字</h2><div class="dialog-actions"><button id="title-done" class="primary">就叫这个</button></div>';titleDialog.querySelector('h2').after(document.querySelector('.document-name'));document.body.append(titleDialog);const rename=document.createElement('button');rename.id='rename-open';rename.onclick=()=>titleDialog.showModal();settingButton(rename,'pencil','给画起名字');actions.append(aboutButton);
  const header=document.querySelector('.header-actions');header.prepend(el('new-quick'),el('undo'),el('redo'));for(const [id,icon,name] of [['undo','undo','撤销'],['redo','redo','重做'],['new-quick','new-paper','新画纸'],['reset-settings','reset-settings','重置'],['open','folder','打开'],['save','save','保存'],['export','download','导出'],['gallery','folder','画夹']]){el(id).innerHTML=playfulIcon(icon)+`<span>${name}</span>`;el(id).className='header-command';}
  const moreButton=document.createElement('button');moreButton.id='more-open';moreButton.className='header-command';moreButton.innerHTML=playfulIcon('more')+'<span>设置</span>';moreButton.onclick=()=>more.showModal();header.append(moreButton);
  // On short or narrow windows the canvas is the primary surface. Keep the
  // full tool groups available as drawers instead of shrinking the paper into
  // a thumbnail. The same controls remain in their original DOM containers,
  // so existing keyboard focus and event wiring continue to work.
  const {setMobilePanel,syncMobileLayout,isNarrow}=mountMobileShelf({left,subtools,parameter,dock,onNarrowChanged:()=>{page=0;renderTools();}});
  document.querySelector('.brand').innerHTML=brandIcon(document.body.dataset.theme||'autumn')+'<span><strong>落叶画板</strong><small>我的暖暖画室</small></span>';
  const layerDialog=el('layer-dialog');layerDialog.querySelector('h2').textContent='我的图层';
  const help=document.createElement('p');help.className='layer-guide';help.textContent='每张小卡片都是画里的一部分。先点卡片，再移动或调整它。上面的会挡住下面的，背景一直在最下面。';
  layerDialog.querySelector('h2').after(help,document.querySelector('.layers-panel'));
  const advanced=document.createElement('details');advanced.className='layer-advanced';advanced.innerHTML='<summary>翻转、清空与更多操作</summary>';advanced.append(layerDialog.querySelector('.dialog-grid'),el('layer-opacity').closest('label'));layerDialog.querySelector('.dialog-actions').before(advanced);
  const layerActions=document.querySelector('.layer-actions');
  for(const [id,label,picture] of [['layer-up','往前一层','layers'],['layer-down','往后一层','layers'],['duplicate-layer','复制一份','copy'],['delete-layer','移走它','eraser']]){const b=el(id);b.innerHTML=playfulIcon(picture)+'<span>'+label+'</span>';b.setAttribute('aria-label',label);layerActions.append(b);}
  advanced.querySelector('.dialog-grid').prepend(el('rotate'));for(const [id,label,picture] of [['mirror-x','水平镜像','mirror-x'],['mirror-y','垂直镜像','mirror-y'],['smaller','变小','move'],['bigger','变大','move']]){el(id).innerHTML=playfulIcon(picture)+'<span>'+label+'</span>';layerActions.append(el(id));}
  const moveSelected=document.createElement('button');moveSelected.id='move-selected-layer';moveSelected.innerHTML=playfulIcon('move')+'<span>移动</span>';moveSelected.onclick=()=>{setTool('move');layerDialog.close();};layerActions.prepend(moveSelected);
  el('add-layer').innerHTML=playfulIcon('paper')+'<span>加一张透明画纸</span>';el('add-layer').setAttribute('aria-label','加一张透明画纸');
  layerDialog.querySelector('[data-close]').textContent='选好了，返回画纸';
  sync();return {groups:tools,sync};
}
