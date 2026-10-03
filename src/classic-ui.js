import { choiceArt } from './choice-art.js';
import { mountPalette } from './palette-ui.js';
import { brandIcon, playfulIcon } from './playful-icons.js';
import { BRUSHES, DEFAULT_BRUSH_SIZE, brushSegment } from './brushes.js';
import { makeCanvas } from './engine.js';

export function brushPreview(id,color,width=140,height=42,size=28,secondary='#ffffff'){
  const canvas=makeCanvas(width*2,height*2,false),ctx=canvas.getContext('2d');ctx.scale(2,2);canvas.setAttribute('aria-hidden','true');
  const g={layer:{scale:1},options:{tool:'pen',brush:id,brushVersion:2,size,color,secondaryColor:secondary,opacity:1,seed:913}};
  let a={x:18,y:height/2};brushSegment(ctx,g,a,a);for(let x=22;x<width-14;x+=4){const b={x,y:height/2+Math.sin((x-18)/(width-32)*Math.PI*2)*height*.13};brushSegment(ctx,g,a,b);a=b;}return canvas;
}

export function mountClassic({setTool,getColor,setColor,clearAnimations}){
  const el=id=>document.getElementById(id);document.body.classList.add('playroom');
  const workspace=document.querySelector('.workspace'),studio=document.querySelector('.studio');
  const left=document.createElement('aside');left.id='classic-left';left.className='classic-left';left.setAttribute('aria-label','画笔盒');workspace.prepend(left);
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
  const moreColor=document.createElement('button');moreColor.className='more-colors';moreColor.innerHTML=playfulIcon('palette')+'<span>更多颜色</span>';moreColor.onclick=()=>el('palette-open').click();palette.append(moreColor);
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
  // Scratch-card colors stay in the tool drawer instead of the global palette.
  // The engine owns the actual layer mutation; this view only emits a small,
  // serializable style object so a mobile color picker cannot touch the paper.
  const scratchChoices={
    base:[
      {id:'white',label:'白色',style:{baseMode:'solid',baseColor:'#fffdf8',baseSecondaryColor:''},color:'#fffdf8'},
      {id:'cream',label:'奶油',style:{baseMode:'solid',baseColor:'#f9e7be',baseSecondaryColor:''},color:'#f9e7be'},
      {id:'sky',label:'天空',style:{baseMode:'solid',baseColor:'#cfe9f5',baseSecondaryColor:''},color:'#cfe9f5'},
      {id:'rainbow',label:'彩虹',style:{baseMode:'rainbow',baseColor:'',baseSecondaryColor:''},color:'linear-gradient(135deg,#f47e7e 0%,#f3c96a 25%,#8bcf9b 50%,#8abde8 75%,#b89ad9 100%)'},
    ],
    cover:[
      {id:'ginkgo',label:'银杏金',style:{color:'#c99559',secondaryColor:'#f0d49f'},color:'linear-gradient(135deg,#c99559,#f0d49f)'},
      {id:'mint',label:'薄荷青',style:{color:'#74a99e',secondaryColor:'#b7ded7'},color:'linear-gradient(135deg,#74a99e,#b7ded7)'},
      {id:'space',label:'星空紫',style:{color:'#55557a',secondaryColor:'#a29ac4'},color:'linear-gradient(135deg,#55557a,#a29ac4)'},
    ],
  };
  let scratchSelection={base:'white',cover:'ginkgo'};
  let scratchStyleSnapshot={};
  const buildScratchStyles=()=>{
    const panel=document.createElement('section');panel.className='scratch-style-panel';panel.setAttribute('aria-label','刮刮画颜色');
    const heading=document.createElement('div');heading.className='scratch-style-heading';heading.textContent='颜色';panel.append(heading);
    const makeGroup=(kind,title)=>{
      const group=document.createElement('div');group.className='scratch-style-group';group.dataset.styleKind=kind;
      const label=document.createElement('span');label.className='scratch-style-label';label.textContent=title;group.append(label);
      const row=document.createElement('div');row.className='scratch-style-choices';row.setAttribute('role','group');row.setAttribute('aria-label',title);group.append(row);
      const choices=scratchChoices[kind];
      for(const choice of choices){
        const button=document.createElement('button');button.type='button';button.className='scratch-style-chip';button.dataset.scratchStyle=choice.id;button.title=choice.label;button.setAttribute('aria-label',choice.label);button.setAttribute('aria-pressed',String(scratchSelection[kind]===choice.id));button.style.setProperty('--scratch-chip',choice.color);button.onclick=()=>{
          scratchSelection[kind]=choice.id;
          for(const sibling of row.children)sibling.setAttribute('aria-pressed',String(sibling===button));
          document.dispatchEvent(new CustomEvent('scratch-style-change',{detail:{...choice.style,kind,preset:choice.id}}));
        };row.append(button);
      }
      const custom=document.createElement('label');custom.className='scratch-style-custom';custom.title=kind==='base'?'自选底色':'自选覆盖层颜色';custom.setAttribute('aria-label',custom.title);
      const input=document.createElement('input');input.type='color';input.value=kind==='base'?(scratchStyleSnapshot.baseColor||'#fffdf8'):(scratchStyleSnapshot.color||'#c99559');input.dataset.scratchCustom=kind;input.tabIndex=-1;
      const button=document.createElement('span');button.className='scratch-style-custom-button';button.textContent='＋';button.setAttribute('aria-pressed',String(scratchSelection[kind]==='custom'));custom.append(input,button);
      const commit=()=>{
        scratchSelection[kind]='custom';button.style.setProperty('--scratch-chip',input.value);button.textContent='';button.setAttribute('data-has-color','true');
        for(const sibling of row.children)sibling.setAttribute('aria-pressed','false');
        button.setAttribute('aria-pressed','true');
        const style=kind==='base'?{baseMode:'solid',baseColor:input.value,baseSecondaryColor:''}:{color:input.value,secondaryColor:''};
        document.dispatchEvent(new CustomEvent('scratch-style-change',{detail:{...style,kind,preset:'custom'}}));
      };
      input.addEventListener('input',()=>{button.style.setProperty('--scratch-chip',input.value);button.setAttribute('data-has-color','true');});
      input.addEventListener('change',commit);
      custom.addEventListener('click',event=>{if(event.target!==input){event.preventDefault();input.click();}});
      row.append(custom);
      return group;
    };
    panel.append(makeGroup('base','底色'),makeGroup('cover','覆盖层'));
    return panel;
  };
  // Loading a project or changing a preset in the engine can send the current
  // persisted style back to the drawer. Keep the selected ring truthful when
  // the child leaves and re-enters the scratch tool.
  document.addEventListener('scratch-style-updated',event=>{
    const style=event.detail||{};
    scratchStyleSnapshot={...scratchStyleSnapshot,...style};
    if(style.baseMode==='rainbow')scratchSelection.base='rainbow';
    else if(typeof style.baseColor==='string')scratchSelection.base=scratchChoices.base.find(choice=>choice.style.baseColor===style.baseColor)?.id||'custom';
    if(typeof style.color==='string')scratchSelection.cover=scratchChoices.cover.find(choice=>choice.style.color===style.color&&choice.style.secondaryColor===(style.secondaryColor||''))?.id||'custom';
    if(el('painting')?.dataset.tool==='scratch')sync();
  });
  // Keep the rail ordered by the child's drawing flow. The first page contains
  // the tools used to make a picture; the second page contains selection,
  // adjustment and generative tools. Defining the groups explicitly avoids
  // silently moving a new tool between pages when the list grows.
  const toolPages=[
    [['pen','画笔'],['eraser','橡皮'],['line','图形'],['fill','油漆桶'],['text','文字'],['stamp','魔法袋'],['scratch','刮刮画'],['picker','吸颜色']],
    [['select','圈选'],['move','移动'],['clone','仿制印章'],['warp','变形'],['magic','魔力棒'],['board-filter','滤镜'],['fractal','分形']],
  ];
  const tools=toolPages.flat();
  const toolPageCount=toolPages.length;
  const toolPageFor=id=>toolPages.findIndex(group=>group.some(tool=>tool[0]===id));
  const geometries=['line','triangle','rect','pentagon','hexagon','roundrect','ellipse','star','polygon','bezier'];
  const groupTool=()=>geometries.includes(el('painting').dataset.tool)?'line':el('painting').dataset.tool;
  const bar=el('tools');bar.replaceChildren();let page=0;
  const flip=document.createElement('button');flip.id='tool-page';flip.className='tool-page';flip.setAttribute('aria-label','工具翻页');flip.onclick=()=>{page=(page+1)%toolPageCount;renderTools();sync();};
  function renderTools(){
    // In a compact WebView all tools belong to the same drawer. Keeping the
    // second page there made the sheet tall while hiding half of the actions.
    // Desktop/native windows retain the original two-page rail.
    const compact=matchMedia('(max-width: 860px), (max-height: 600px)').matches;
    const visible=compact?tools:toolPages[page]||toolPages[0];
    bar.replaceChildren();
    for(const [id,name] of visible){const b=document.createElement('button');b.className='tool-button';b.dataset.tool=id;b.setAttribute('aria-label',name);b.innerHTML=playfulIcon(id==='pen'?'pencil':id)+`<span>${name}</span>`;b.onclick=()=>{if(document.body.hasAttribute('aria-busy'))return;setTool(id);if(id!=='stamp')openLibrary(false);if(id==='stamp'){document.querySelector('[data-category="fairy"]').click();openLibrary(true);}if(narrowWindow)setMobilePanel(id==='stamp'?'library':'brushes');};bar.append(b);}
    flip.hidden=compact;
    flip.setAttribute('aria-hidden',String(compact));
    const nextLabel=page===0?'更多工具 →':'常用工具 →';
    flip.innerHTML=`<span>${nextLabel}</span><small>${page+1} / ${toolPageCount}</small>`;
    bar.after(flip);
  }
  renderTools();
  let lastColor='',lastSecondary='',showEraserShapes=false;
  function sync(){const tool=el('painting').dataset.tool,brush=BRUSHES.find(b=>b.id===el('brush').value);title.textContent=document.body.classList.contains('library-open')&&libraryGroups.children.length?'找一找图案':tool==='pen'?'我的画笔盒':(tools.find(t=>t[0]===groupTool())?.[1]||'工具')+'怎么玩';pens.hidden=tool!=='pen';subtools.replaceChildren();
    for(const b of pens.children)b.setAttribute('aria-pressed',b.dataset.brush===brush.id);el('painting').dataset.brush=brush.id;for(const b of bar.children)b.setAttribute('aria-pressed',b.dataset.tool===groupTool());
    const secondary=el('background-color').value;if(getColor()!==lastColor||secondary!==lastSecondary){lastColor=getColor();lastSecondary=secondary;for(const b of pens.children)b.querySelector('.brush-sample').replaceChildren(brushPreview(b.dataset.brush,lastColor,140,34,DEFAULT_BRUSH_SIZE,secondary));}
    const name=tool==='pen'?brush.name:tools.find(t=>t[0]===groupTool())?.[1]||'画画';el('active-tool-name').textContent=name;el('active-tool-description').textContent=tool==='pen'?brush.hint:'选好玩法，再到画纸上试一试';el('active-brush-preview').replaceChildren(tool==='pen'?brushPreview(brush.id,getColor(),140,50,Math.min(36,Number(el('size').value)),secondary):Object.assign(document.createElement('span'),{innerHTML:playfulIcon(groupTool())}));
    primary.hidden=false;modes.hidden=tool!=='pen';
    // Scratch uses the same size control as a brush. Keeping this visible is
    // important on compact drawers: children can choose a small tip for
    // details or a wider tip for quickly revealing the covered artwork.
    el('brush-options').hidden=!['pen','eraser','stamp','clone',...geometries,'scratch'].includes(tool)||(tool==='eraser'&&el('eraser-mode').value==='rect');document.querySelector('.opacity-control').hidden=['select','magic','move','warp','board-filter','picker','fractal'].includes(tool)||(tool==='eraser'&&el('eraser-mode').value==='rect');
    options.hidden=![...options.querySelectorAll('.parameter-slider')].some(item=>!item.hidden);
    document.querySelector('label[for="size"]').textContent=tool==='stamp'?'图案大小':'笔尖粗细';
    const map={eraser:showEraserShapes&&el('eraser-mode').value==='shape'?'eraser-shape':'eraser-mode',fill:'fill-mode',select:'selection-shape',warp:'warp-kind','board-filter':'board-filter-kind'};const config=geometries.includes(tool)?'geometry':map[tool],select=config&&el(config);
    if(select){if(config==='eraser-shape'){const back=document.createElement('button');back.type='button';back.className='subtool-card eraser-mode-back';back.textContent='← 其他橡皮';back.onclick=()=>{showEraserShapes=false;sync();};subtools.append(back);}for(const option of select.options){const b=document.createElement('button');b.type='button';b.className='subtool-card';const label=document.createElement('span');label.textContent=option.textContent;b.append(choiceArt(select,option),label);b.setAttribute('aria-pressed',select.value===option.value);b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));sync();};subtools.append(b);}}
    else if(tool!=='pen'&&tool!=='scratch'){const p=document.createElement('p');p.className='tool-coach';p.textContent=tool==='stamp'?'选好图案，调一调大小\n按住鼠标，连续画':el('tool-hint').textContent;subtools.append(p);if(tool==='stamp'){const edit=document.createElement('button');edit.className='subtool-card';edit.innerHTML=playfulIcon('move')+'<span>调整画里的图案</span>';edit.onclick=()=>{setTool('move');openLibrary(false);};subtools.append(edit);const modes=document.createElement('div');modes.className='fairy-modes';edit.before(modes);for(const [mode,label] of [['single','单张图案'],['static','组合图案'],['dynamic','会动图案']]){const b=document.createElement('button');b.className='subtool-card';b.innerHTML=playfulIcon(mode==='dynamic'?'effect':'stamp')+'<span>'+label+'</span>';b.setAttribute('aria-pressed',(document.body.dataset.fairyMode||'single')===mode);b.onclick=()=>{document.body.dataset.fairyMode=mode;document.dispatchEvent(new Event('fairymodechange'));openLibrary(true);sync();};modes.append(b);}}if(tool==='text'||tool==='fractal'){const b=document.createElement('button');b.className='primary';b.innerHTML=playfulIcon(tool)+'<span>'+(tool==='text'?'写几个字':'生成分形')+'</span>';b.onclick=()=>{if(tool==='fractal')el('fractal-open').click();else [...document.querySelectorAll('.detail-bar button')].find(n=>n.dataset.option==='text')?.click();};subtools.append(b);}}
    if(tool==='scratch'){
      subtools.append(buildScratchStyles());
      const reset=document.createElement('button');reset.className='subtool-card';reset.innerHTML=playfulIcon('scratch')+'<span>重新盖住</span>';reset.title='把刮开的表面恢复，可以继续刮';reset.onclick=()=>document.dispatchEvent(new Event('scratch-reset'));subtools.append(reset);
    }
    if(tool==='eraser'){const clear=document.createElement('button');clear.id='clear-animations';clear.className='subtool-card';clear.innerHTML=playfulIcon('eraser')+'<span>清除所有动图</span>';clear.title='保留背景和画笔；可以撤销';clear.onclick=clearAnimations;subtools.append(clear);}
  }
  document.addEventListener('toolchange',()=>{const pageFor=toolPageFor(groupTool());const compact=matchMedia('(max-width: 860px), (max-height: 600px)').matches;if(compact){if(page!==0){page=0;renderTools();}}else if(pageFor>=0&&pageFor!==page){page=pageFor;renderTools();}sync();});document.addEventListener('palettechange',sync);document.addEventListener('input',e=>{if(e.target===el('background-color'))sync();});document.addEventListener('change',e=>{if(e.target===el('brush'))chooseBrush(e.target.value);else if(['geometry','eraser-mode','eraser-shape','fill-mode','selection-shape','warp-kind','board-filter-kind'].includes(e.target.id)){if(e.target===el('eraser-mode'))showEraserShapes=e.target.value==='shape';sync();}});el('size').addEventListener('input',()=>{if(el('painting').dataset.tool==='pen')sync();});
  function openLibrary(open){
    // The wide layout keeps the gallery in the existing bottom shelf. Record
    // the shelf's closed height before revealing the gallery so loading its
    // intrinsic content cannot push the canvas upward or resize the paper.
    const wideShelf=matchMedia('(min-width: 861px) and (min-height: 601px)').matches;
    if(open&&wideShelf&&dock){
      const height=Math.round(dock.getBoundingClientRect().height);
      if(height>0)dock.style.setProperty('--library-reserved-height',`${height}px`);
    }else if(!open&&dock)dock.style.removeProperty('--library-reserved-height');
    document.body.classList.toggle('library-open',open);el('mode-library').setAttribute('aria-pressed',open);el('mode-board').setAttribute('aria-pressed',!open);
  }
  new MutationObserver(()=>{const open=document.body.classList.contains('library-open');el('mode-library').setAttribute('aria-pressed',open);el('mode-board').setAttribute('aria-pressed',!open);if(open&&libraryGroups.children.length)title.textContent=document.body.dataset.librarySurface==='fairy'?'我的魔法袋':'找一找图案';else if(!open)sync();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  el('mode-library').onclick=()=>{const opening=!document.body.classList.contains('library-open')||document.body.dataset.librarySurface==='fairy';if(opening)document.dispatchEvent(new Event('opengallery'));openLibrary(opening);};el('mode-board').addEventListener('click',()=>openLibrary(false));
  for(const [id,icon,label] of [['mode-board','paper','画板'],['darkroom','board-filter','暗房'],['mode-library','forest','图库']])el(id).innerHTML=playfulIcon(icon)+'<span>'+label+'</span>';
  const library=document.querySelector('.right-panel');dock.prepend(library);document.querySelector('.panel-heading h2').textContent='灵感百宝箱';
  const layer=el('layer-menu');layer.innerHTML=playfulIcon('layers')+'<span>我的图层</span>';footer.append(layer);const newPaper=el('new');newPaper.innerHTML=playfulIcon('new-paper')+'<span>新画纸</span>';footer.append(newPaper);
  const more=document.createElement('dialog');more.id='more-dialog';more.className='wide-dialog';more.innerHTML='<h2>设置</h2><div class="more-actions"></div><div class="dialog-actions"><button id="more-done">返回画纸</button></div>';document.body.append(more);const actions=more.querySelector('.more-actions');const paperSize=document.createElement('button');paperSize.id='paper-size-open';paperSize.type='button';paperSize.innerHTML=playfulIcon('paper')+'<span>画纸尺寸</span>';actions.append(paperSize);for(const id of ['copy','cut','paste','selection-menu','recordings','import-image'])actions.append(el(id));const aboutButton=document.createElement('button');aboutButton.id='about-open';aboutButton.type='button';aboutButton.innerHTML=playfulIcon('palette')+'<span>关于</span>';actions.append(aboutButton);actions.addEventListener('click',()=>more.close(),true);el('more-done').onclick=()=>more.close();const about=document.createElement('dialog');about.id='about-dialog';about.className='about-dialog';about.innerHTML=`<div class="about-mark" aria-hidden="true">${brandIcon(document.body.dataset.theme||'autumn',{slot:'about'})}</div><h2>落叶画板</h2><p class="about-version">版本 <strong id="about-version">开发版</strong></p><p class="about-links"><a href="https://github.com/zxxf18/luoye-artboard" target="_blank" rel="noopener noreferrer">项目地址</a><span class="about-links-sep" aria-hidden="true">·</span><a href="https://index.yebuluo.com.cn/donate/" target="_blank" rel="noopener noreferrer">支持作者</a></p><p class="about-credit">Powered by ZX</p><p class="about-credit">For WenHe</p><div class="dialog-actions"><button id="about-close" class="primary" autofocus>返回画纸</button></div>`;document.body.append(about);about.querySelector('#about-version').textContent=window.LUOYE_VERSION||'开发版';aboutButton.onclick=()=>about.showModal();about.querySelector('#about-close').onclick=()=>about.close();document.addEventListener('themechange',event=>{const icon=about.querySelector('.about-mark');const current=icon?.querySelector('.about-theme-icon');if(icon&&current)current.outerHTML=brandIcon(event.detail?.theme||document.body.dataset.theme||'autumn',{slot:'about'});});
  const titleDialog=document.createElement('dialog');titleDialog.id='title-dialog';titleDialog.innerHTML='<h2>给画起个名字</h2><div class="dialog-actions"><button id="title-done" class="primary">就叫这个</button></div>';titleDialog.querySelector('h2').after(document.querySelector('.document-name'));document.body.append(titleDialog);const rename=document.createElement('button');rename.textContent='给画起名字';rename.onclick=()=>titleDialog.showModal();actions.append(rename);actions.append(aboutButton);el('title-done').onclick=()=>titleDialog.close();
  const header=document.querySelector('.header-actions');header.prepend(el('new-quick'),el('undo'),el('redo'));for(const [id,icon,name] of [['undo','undo','撤销'],['redo','redo','重做'],['new-quick','new-paper','新画纸'],['reset-settings','reset-settings','重置'],['open','folder','打开'],['save','save','保存'],['export','download','导出'],['gallery','folder','画夹']]){el(id).innerHTML=playfulIcon(icon)+`<span>${name}</span>`;el(id).className='header-command';}
  const moreButton=document.createElement('button');moreButton.id='more-open';moreButton.className='header-command';moreButton.innerHTML=playfulIcon('more')+'<span>设置</span>';moreButton.onclick=()=>more.showModal();header.append(moreButton);
  // The header is a finite-width control strip. On compact windows, keep the
  // actions used during a drawing session in the strip and move infrequent
  // actions into the existing 设置 sheet. This avoids a second horizontal
  // scroll target while preserving the same button nodes and event handlers.
  const foldedToolbarIds = ['reset-settings','open','export','gallery','music-open','animation-open','pixel-art-open','collage-open','shape-snap-open'];
  const toolbarPrimaryIds = ['new-quick','undo','redo','save','theme-open','more-open'];
  const toolbarOrder = new Map();
  let toolbarSyncFrame = 0;
  const reorderIfNeeded = (container, ids) => {
    const current = [...container.children].map(child => child.id).filter(id => ids.includes(id));
    const wanted = ids.filter(id => container.querySelector(`#${id}`)?.parentElement === container);
    if (current.length === wanted.length && current.every((id, index) => id === wanted[index])) return;
    for (const id of wanted) {
      const button = el(id);
      if (button?.parentElement === container) container.append(button);
    }
  };
  const scheduleToolbarSync = () => {
    cancelAnimationFrame(toolbarSyncFrame);
    toolbarSyncFrame = requestAnimationFrame(syncToolbar);
  };
  function syncToolbar() {
    toolbarSyncFrame = 0;
    const actions = document.querySelector('.more-actions');
    if (!actions || !header) return;
    const compact = matchMedia('(max-width: 1080px), (max-height: 600px)').matches;
    const hasOverflow = header.scrollWidth > header.clientWidth + 2;
    const folded = compact || hasOverflow;
    header.dataset.folded = String(folded);
    const candidates = foldedToolbarIds.map(id => el(id)).filter(Boolean);
    // Dynamic feature entries mount after this classic shell. Keep their
    // original order in the header until they are ready, then fold them as a
    // group; a missing entry is simply ignored.
    for (const button of candidates) {
      if (!toolbarOrder.has(button.id)) toolbarOrder.set(button.id, toolbarOrder.size);
      if (folded) {
        if (button.parentElement !== actions) actions.append(button);
        button.dataset.toolbarFolded = 'true';
      } else {
        button.removeAttribute('data-toolbar-folded');
        if (button.parentElement !== header) header.append(button);
      }
    }
    // Restore a stable, child-friendly order after dynamic modules insert
    // their buttons. About remains the final action in 设置 by design.
    if (!folded) {
      const order = ['new-quick','undo','redo','save','theme-open','open','export','gallery','reset-settings','animation-open','pixel-art-open','collage-open','shape-snap-open','music-open','more-open'];
      reorderIfNeeded(header, order);
    } else {
      const order = ['reset-settings','open','export','gallery','music-open','animation-open','pixel-art-open','collage-open','shape-snap-open'];
      reorderIfNeeded(actions, order);
    }
    // The about entry is deliberately the final action in 设置. Dynamic
    // feature buttons are appended after the classic actions, so pin the
    // about button back to the end on every synchronization pass.
    const about = el('about-open');
    if (about?.parentElement === actions) actions.append(about);
    for (const id of toolbarPrimaryIds) {
      const button = el(id);
      if (button?.parentElement === header) button.dataset.toolbarPrimary = 'true';
    }
  }
  const toolbarObserver = new MutationObserver(scheduleToolbarSync);
  toolbarObserver.observe(header, { childList: true });
  toolbarObserver.observe(more.querySelector('.more-actions'), { childList: true });
  const toolbarResize = new ResizeObserver(scheduleToolbarSync);
  toolbarResize.observe(header);
  window.addEventListener('resize', scheduleToolbarSync, { passive: true });
  scheduleToolbarSync();
  // On short or narrow windows the canvas is the primary surface. Keep the
  // full tool groups available as drawers instead of shrinking the paper into
  // a thumbnail. The same controls remain in their original DOM containers,
  // so existing keyboard focus and event wiring continue to work.
  const mobileScrim=document.createElement('div');mobileScrim.className='mobile-scrim';mobileScrim.setAttribute('aria-hidden','true');document.body.append(mobileScrim);
  const mobileCommands=document.createElement('div');mobileCommands.className='mobile-commands';mobileCommands.setAttribute('aria-label','小屏工具栏');
  const mobileItems=[['brushes','画笔','classic-left'],['tools','工具','tool-rail'],['options','参数','tool-dock'],['library','素材','tool-dock']];
  const mobileButtons=new Map();
  for(const [panel,label,target] of mobileItems){const button=document.createElement('button');button.type='button';button.className='mobile-command';button.dataset.mobilePanel=panel;button.textContent=label;button.setAttribute('aria-controls',target);button.setAttribute('aria-expanded','false');button.onclick=()=>setMobilePanel(panel);mobileCommands.append(button);mobileButtons.set(panel,button);}
  const focusButton=document.createElement('button');focusButton.type='button';focusButton.className='mobile-command mobile-focus-command';focusButton.textContent='画布';focusButton.setAttribute('aria-controls','viewport');focusButton.setAttribute('aria-expanded','true');focusButton.onclick=()=>setMobilePanel('focus');mobileCommands.append(focusButton);mobileButtons.set('focus',focusButton);
  document.querySelector('.canvas-topbar').append(mobileCommands);
  let narrowWindow=false;
  function syncMobileShelfControls(panel){
    const library=document.querySelector('.library');
    const pager=document.querySelector('#library-pagination');
    const instruction=document.querySelector('#library-instruction');
    const fairyGroups=document.querySelector('#library-groups');
    if(fairyGroups){
      if(panel==='library'&&fairyGroups.parentElement!==library){
        library?.prepend(fairyGroups);
      }else if(panel!=='library'&&fairyGroups.parentElement!==left){
        left.insertBefore(fairyGroups,subtools);
      }
    }
    if(panel==='library'){
      if(pager&&library&&pager.parentElement!==library)library.append(pager);
      if(instruction&&library&&instruction.parentElement!==library)library.append(instruction);
    }else{
      if(pager&&pager.parentElement!==parameter)parameter.append(pager);
      if(instruction&&instruction.parentElement!==parameter)parameter.append(instruction);
    }
  }
  function setMobilePanel(panel,manual=true){
    if(!narrowWindow&&panel!=='focus')return;
    if(panel!=='focus'&&document.body.dataset.mobilePanel===panel)panel='focus';
    if(panel==='library'&&!document.body.classList.contains('library-open'))el('mode-library').click();
    if(panel!=='library'&&document.body.classList.contains('library-open'))el('mode-board').click();
    document.body.dataset.mobilePanel=panel;
    document.body.dataset.mobileFocus=String(panel==='focus');
    if(manual)document.body.dataset.mobileUser='true';
    for(const [name,button] of mobileButtons){const active=name===panel;button.setAttribute('aria-expanded',String(active));button.setAttribute('aria-pressed',String(active));}
    const toolRail=document.querySelector('.tool-rail');
    for(const [name,node] of [['brushes',left],['tools',toolRail],['dock',dock]]){const open=node===dock?(panel==='options'||panel==='library'):panel===name;node?.setAttribute('aria-hidden',String(!open));}
    syncMobileShelfControls(panel);
  }
  function syncMobileLayout(){
    const next=matchMedia('(max-width: 860px), (max-height: 600px)').matches;
    const changed=next!==narrowWindow;
    if(next&&!narrowWindow){document.body.removeAttribute('data-mobile-user');setMobilePanel('focus',false);}
    if(!next&&narrowWindow){document.body.removeAttribute('data-mobile-panel');document.body.removeAttribute('data-mobile-focus');document.body.removeAttribute('data-mobile-user');for(const node of [left,document.querySelector('.tool-rail'),dock])node?.removeAttribute('aria-hidden');syncMobileShelfControls('focus');}
    narrowWindow=next;
    if(changed){page=0;renderTools();}
    if(next&&document.body.dataset.mobilePanel!=='focus'&&document.body.dataset.mobilePanel!=='brushes'&&document.body.dataset.mobilePanel!=='tools'&&document.body.dataset.mobilePanel!=='options'&&document.body.dataset.mobilePanel!=='library')setMobilePanel('focus',false);
  }
  mobileScrim.onclick=()=>setMobilePanel('focus');
  window.addEventListener('resize',syncMobileLayout);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&narrowWindow&&document.body.dataset.mobilePanel!=='focus')setMobilePanel('focus');});
  syncMobileLayout();
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
  mountPalette({getColor,setColor});sync();return {groups:tools,sync};
}
