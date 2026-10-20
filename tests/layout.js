const frame=document.querySelector('iframe'),results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function assert(value,message){if(!value)throw Error(message);}
function isVisible(el){return el.getClientRects().length>0;}
function inside(el,root){const a=el.getBoundingClientRect(),b=root.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;}
async function checkTools(doc){
 const narrow=doc.defaultView.innerWidth<=640||doc.defaultView.innerHeight<=500;
 const mobilePanel=async panel=>{const button=doc.querySelector(`.mobile-command[data-mobile-panel="${panel}"]`);if(button&&!button.matches('[aria-pressed="true"]')){button.click();await pause(60);}};
 if(narrow)await mobilePanel('tools');
 const parameters=doc.querySelector('.classic-parameters'),details=doc.querySelector('.primary-brush-options');
 for(const [tool,ids] of [
  ['eraser',['size','opacity']],['fill',['fill-gradient','tolerance','paint-color-open']],
  ['line',['size','shape-dashed','paint-color-open']],['text',[]],
  ['select',['selection-combination','inline-select-all']],['magic',['tolerance']],
  ['warp',['warp-speed','creative-radius']],['board-filter',['creative-radius','filter-preview-button']],
  ['clone',['size','clone-source']],
 ]){
  if(!doc.querySelector(`.tool-button[data-tool="${tool}"]`))doc.querySelector('#tool-page').click();
  doc.querySelector(`.tool-button[data-tool="${tool}"]`).click();await pause(25);
  if(narrow)await mobilePanel('options');
  assert(!isVisible(doc.querySelector('#brush-ratio')),'宽窄滑杆出现在非画笔工具 '+tool);
  const expected=[...ids];
  if(tool==='board-filter'){
   const select=doc.querySelector('#board-filter-kind');select.value='waterfall';select.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
   expected.push('filter-density','filter-spread','filter-height','filter-direction-choose');
  }
  for(const id of expected){
   const el=doc.getElementById(id);assert(el&&isVisible(el),'缺少已展开的参数 '+id);
   if(details.contains(el)){el.scrollIntoView({block:'nearest',inline:'nearest'});await pause(10);}
   if(narrow)assert(el.closest('.classic-parameters')===parameters,'小窗口参数未归入滚动面板 '+id);
   else assert(inside(el,parameters),'参数不可滚动到可视区域 '+id);
   const card=el.closest('label');if(card&&details.contains(card)){const css=frame.contentWindow.getComputedStyle(card);assert(parseFloat(css.paddingLeft)>=4&&parseFloat(css.paddingTop)>=4,'参数卡片文案贴边 '+id);}
  }
  if(tool==='text'){
   const opacity=doc.querySelector('#opacity'),control=opacity?.closest('.opacity-control'),label=control?.querySelector('label');
   assert(opacity&&control&&label&&isVisible(control),'文字工具不透明度控件缺失');
   const opacityFont=parseFloat(frame.contentWindow.getComputedStyle(control).fontSize), opacityLabelFont=parseFloat(frame.contentWindow.getComputedStyle(label).fontSize);
   assert(opacityFont>=16&&opacityLabelFont>=16,'文字工具不透明度文案过小');
   assert(Math.abs(opacityFont-opacityLabelFont)<=.1,'文字工具不透明度标签与控件字号不一致');
  }
  if(tool==='fill'){
   for(const id of ['fill-gradient','tolerance']){
    const control=doc.querySelector('#'+id),label=control?.closest('label');
    assert(control&&label&&isVisible(label),'油漆桶参数控件缺失 '+id);
    const labelFont=parseFloat(frame.contentWindow.getComputedStyle(label).fontSize), inputFont=parseFloat(frame.contentWindow.getComputedStyle(control).fontSize);
    assert(labelFont>=16&&inputFont>=16,'油漆桶参数文案过小 '+id);
    assert(Math.abs(labelFont-inputFont)<=.1,'油漆桶参数标签与输入字号不一致 '+id);
    if(id==='tolerance')assert(inputFont>=16,'油漆桶公差数值过小');
   }
   const opacity=doc.querySelector('#opacity'),opacityControl=opacity?.closest('.opacity-control'),opacityLabel=opacityControl?.querySelector('label');
   assert(opacity&&opacityControl&&opacityLabel,'油漆桶不透明度控件缺失');
   if(!narrow){
    assert(isVisible(opacityControl),'桌面油漆桶不透明度控件未显示');
    const opacityFont=parseFloat(frame.contentWindow.getComputedStyle(opacityControl).fontSize),opacityLabelFont=parseFloat(frame.contentWindow.getComputedStyle(opacityLabel).fontSize);
    assert(opacityFont>=16&&opacityLabelFont>=16,'油漆桶不透明度文案过小');
    assert(Math.abs(opacityFont-opacityLabelFont)<=.1,'油漆桶不透明度标签与控件字号不一致');
   }
  }
  if(tool==='magic'){
   const tolerance=doc.querySelector('#tolerance'),label=tolerance?.closest('label');
   assert(tolerance&&label,'魔力棒公差控件缺失');
   const labelBox=label.getBoundingClientRect(),parameterBox=parameters.getBoundingClientRect();
   assert(labelBox.left<=parameterBox.left+14,'魔力棒公差没有靠左');
   assert(parseFloat(frame.contentWindow.getComputedStyle(label).fontSize)>=16,'魔力棒公差文案过小');
   assert(parseFloat(frame.contentWindow.getComputedStyle(tolerance).fontSize)>=16&&tolerance.getBoundingClientRect().width>=100,'魔力棒公差输入框过小');
   if(!narrow){
    const parameterStyle=frame.contentWindow.getComputedStyle(parameters),labelStyle=frame.contentWindow.getComputedStyle(label);
    const rows=parameterStyle.gridTemplateRows.trim().split(/\s+/).filter(Boolean);
    assert(rows.length>=2,'魔力棒参数区没有保留两行高度');
    assert(/1\s*\/\s*(?:span\s*)?2/.test(labelStyle.gridRow),'魔力棒公差没有跨越参数区两行');
    assert(labelBox.height>=parameterBox.height*.72,'魔力棒公差没有占满两行参数区');
   }
  }
  if(tool==='line'){
   const filled=doc.querySelector('#shape-filled')?.closest('label');
   const dashed=doc.querySelector('#shape-dashed')?.closest('label');
   assert(filled&&dashed,'图形实心/虚线控件缺失');
   assert(parseFloat(frame.contentWindow.getComputedStyle(filled).fontSize)>=16,'图形实心文案过小');
   const compactFont=parseFloat(frame.contentWindow.getComputedStyle(dashed.parentElement).fontSize);
   assert(Math.abs(parseFloat(frame.contentWindow.getComputedStyle(dashed).fontSize)-compactFont)<=.1,'图形虚线没有保持原来的紧凑字号');
  }
  if(tool==='clone'){
   const cloneSource=doc.querySelector('#clone-source'),size=doc.querySelector('#size'),opacity=doc.querySelector('#opacity');
   assert(cloneSource&&size&&opacity,'仿制印章参数控件缺失');
   const sourceBox=cloneSource.getBoundingClientRect(),sizeBox=size.getBoundingClientRect(),opacityBox=opacity.getBoundingClientRect();
   // Compact option sheets intentionally stack controls vertically, so the
   // desktop two-row placement is asserted only where the grid is active.
   if(!narrow)assert(Math.abs(sizeBox.top-opacityBox.top)<=1&&sourceBox.top>sizeBox.bottom-1,'仿制印章设置源点没有独占第二排');
   assert(parseFloat(frame.contentWindow.getComputedStyle(cloneSource).fontSize)>=16,'仿制印章设置源点文案过小');
   assert(parseFloat(frame.contentWindow.getComputedStyle(size.closest('label')||size).fontSize)>=16&&parseFloat(frame.contentWindow.getComputedStyle(opacity.closest('label')||opacity).fontSize)>=16,'仿制印章参数文案过小');
  }
  const cards=[...details.querySelectorAll('label')].filter(isVisible);
  for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++){
   const x=cards[a].getBoundingClientRect(),y=cards[b].getBoundingClientRect();
   assert(x.right<=y.left+1||y.right<=x.left+1||x.bottom<=y.top+1||y.bottom<=x.top+1,'参数卡片重叠 '+tool);
  }
 }
 if(narrow)await mobilePanel('tools');
 // The rail keeps every tool in the DOM and hides other pages, so flip until
 // the target page is actually shown instead of relying on absence.
 for(let i=0;i<3&&!doc.querySelector('.tool-button[data-tool="stamp"]')?.getClientRects().length;i++)doc.querySelector('#tool-page').click();
 const stampButton=doc.querySelector('.tool-button[data-tool="stamp"]');
 assert(stampButton&&isVisible(stampButton),'魔法袋工具不可见');
 stampButton.click();await pause(25);
 if(narrow)await mobilePanel('library');
 const fairyCategories=doc.querySelector('#categories'),fairyModes=doc.querySelectorAll('#library-groups [data-fairy-mode]');
 assert(fairyCategories&&!isVisible(fairyCategories),'魔法袋素材面板仍显示重复的图库分类栏');
 assert(fairyModes.length===3&&[...fairyModes].every(isVisible),'魔法袋左侧三种素材模式不可见');
 const stampParameters=doc.querySelector('.classic-parameters');
 const stampPanel=doc.querySelector('.right-panel'),stampAssets=doc.querySelector('#asset-grid'),stampPager=doc.querySelector('#library-pagination');
 let stampDockHeight=0;
 if(!narrow){
  stampDockHeight=doc.querySelector('.tool-dock')?.getBoundingClientRect().height||0;
  assert(stampDockHeight>=164&&stampDockHeight<=190,`魔法袋素材区与参数区总高度异常: ${stampDockHeight}`);
  const stampHeight=stampParameters?.getBoundingClientRect().height||0;
  assert(stampHeight>=46&&stampHeight<=64,`魔法袋参数区高度未压缩到独立控件行: ${stampHeight}`);
  const stampSize=doc.querySelector('#brush-options');
  assert(stampSize&&isVisible(stampSize)&&inside(stampSize,stampParameters),'魔法袋图案大小控件未位于标准参数区');
  assert(stampAssets.getBoundingClientRect().height>=88,'魔法袋素材卡片高度被错误压缩');
  const firstStampAsset=stampAssets.querySelector('.asset');
  assert(firstStampAsset&&firstStampAsset.getBoundingClientRect().bottom<=stampAssets.getBoundingClientRect().bottom-3,'魔法袋素材内框与外框底边过近');
  assert(stampSize.getBoundingClientRect().height<=52,'魔法袋素材大小拖拉条控件过高');
  assert(stampPager.getBoundingClientRect().height<=52,'魔法袋翻页控件过高');
  assert(stampPanel&&stampAssets&&stampPager&&stampAssets.getBoundingClientRect().bottom<=stampPanel.getBoundingClientRect().bottom+1,'魔法袋素材卡片溢出素材区');
  assert(stampAssets.getBoundingClientRect().bottom<=stampParameters.getBoundingClientRect().top+1,'魔法袋素材卡片与参数区重叠');
  assert(inside(stampPager,stampParameters),'魔法袋翻页控件未位于参数区');
 }
 // Switching from the fairy shelf to 图库 must clear the fairy-only size
 // control while keeping the gallery inside the normal dock height.
 const libraryTab=doc.querySelector('#mode-library');libraryTab.click();await pause(40);
 doc.querySelector('#categories [data-category="background"]')?.click();await pause(40);
 const galleryDock=doc.querySelector('.tool-dock'),galleryPanel=doc.querySelector('.right-panel'),galleryCategories=doc.querySelector('#categories'),galleryAssets=doc.querySelector('#asset-grid'),galleryPager=doc.querySelector('#library-pagination'),galleryBrush=doc.querySelector('#brush-options');
 assert(galleryBrush&&!isVisible(galleryBrush),'图库仍显示魔法袋图案大小控件');
 if(!narrow){
  const galleryDockHeight=galleryDock.getBoundingClientRect().height,galleryParameters=doc.querySelector('.classic-parameters');
  assert(galleryDockHeight>=164&&galleryDockHeight<=190,`图库工具区总高度异常: ${galleryDockHeight}`);
  assert(galleryCategories&&galleryCategories.getBoundingClientRect().height<=28,'图库分类行过高');
  assert(galleryAssets&&galleryPanel&&galleryAssets.getBoundingClientRect().bottom<=galleryPanel.getBoundingClientRect().bottom+1,'图库素材行溢出素材区');
  assert(galleryAssets.getBoundingClientRect().bottom<=galleryParameters.getBoundingClientRect().top+1,'图库素材行与参数区重叠');
  assert(galleryPager&&inside(galleryPager,galleryParameters)&&galleryPager.getBoundingClientRect().height<=30,'图库翻页行过高或未位于参数区');
 }
 if(!doc.querySelector('.tool-button[data-tool="pen"]'))doc.querySelector('#tool-page').click();
 const penButton=doc.querySelector('.tool-button[data-tool="pen"]');penButton.click();await pause(25);if(narrow)await mobilePanel('options');
 const dock=doc.querySelector('.tool-dock'),penDockHeight=dock.getBoundingClientRect().height;
 if(!narrow)assert(Math.abs(penDockHeight-stampDockHeight)<=1,`魔法袋工具区总高度未与普通工具一致: ${stampDockHeight} / ${penDockHeight}`);
 if(narrow)await mobilePanel('tools');
 for(let i=0;i<3&&!doc.querySelector('.tool-button[data-tool="scratch"]')?.getClientRects().length;i++)doc.querySelector('#tool-page').click();
 const scratchButton=doc.querySelector('.tool-button[data-tool="scratch"]');assert(scratchButton&&isVisible(scratchButton),'刮刮画工具不可见');scratchButton.click();await pause(25);if(narrow)await mobilePanel('options');
 assert(Math.abs(dock.getBoundingClientRect().height-penDockHeight)<=1,'刮刮画参数栏高度没有与其他工具统一');
 const scratchPanel=doc.querySelector('.scratch-style-panel'),chips=[...doc.querySelectorAll('.scratch-style-chip,.scratch-style-custom')],palette=doc.querySelector('.quick-palette');
 assert(scratchPanel&&isVisible(scratchPanel)&&inside(scratchPanel,dock),'刮刮画颜色面板越出工具区');
 if(palette&&isVisible(palette)){const a=scratchPanel.getBoundingClientRect(),b=palette.getBoundingClientRect();assert(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,'刮刮画颜色面板覆盖普通颜色栏');}
 assert(chips.length>=9,'刮刮画候选颜色不足');
 for(const chip of chips){const box=chip.getBoundingClientRect(),css=frame.contentWindow.getComputedStyle(chip),group=chip.closest('.scratch-style-group');assert(Math.abs(box.width-box.height)<=1&&css.borderRadius==='50%','刮刮画候选颜色不是圆形');assert(group&&inside(chip,group),'刮刮画候选颜色被卡片边缘裁切');}
 const groups=[...scratchPanel.querySelectorAll('.scratch-style-group')].map(node=>node.getBoundingClientRect()),colorGrid=scratchPanel.querySelector('.scratch-color-grid')?.getBoundingClientRect(),sizeControl=scratchPanel.querySelector('.scratch-size-row #brush-options')?.getBoundingClientRect(),panelRect=scratchPanel.getBoundingClientRect();
 assert(groups.length===2&&colorGrid&&sizeControl,'刮刮画缺少两种颜色或粗细控件');
 // The two colors occupy the left two thirds as a vertical stack. They must
 // have the same width and share a column, while the size card occupies the
 // right third and spans both rows.
 assert(Math.abs(groups[0].left-groups[1].left)<=1&&Math.abs(groups[0].width-groups[1].width)<=1,'刮刮画覆盖色与刮笔色没有同宽左侧两行排列');
 assert(groups[0].top<groups[1].top-1&&groups[0].bottom<=groups[1].top+1,'刮刮画两种颜色没有上下两行排列');
 assert(Math.abs(sizeControl.top-groups[0].top)<=1&&Math.abs(sizeControl.bottom-groups[1].bottom)<=2,'刮笔粗细没有跨越两行并与颜色区等高');
 assert(sizeControl.left>groups[0].right-1,'刮笔粗细没有位于颜色区右侧');
 for(const group of scratchPanel.querySelectorAll('.scratch-style-group')){
  const groupBox=group.getBoundingClientRect(),choices=group.querySelector('.scratch-style-choices'),choicesBox=choices?.getBoundingClientRect(),choiceStyle=choices&&frame.contentWindow.getComputedStyle(choices);
  assert(choices&&choicesBox&&choiceStyle&&choiceStyle.overflowX!=='hidden'&&choiceStyle.overflowY!=='hidden','刮刮画候选颜色容器会裁切圆形边缘');
  for(const chip of group.querySelectorAll('.scratch-style-chip,.scratch-style-custom')){
   const box=chip.getBoundingClientRect();
   assert(box.left>=groupBox.left-1&&box.right<=groupBox.right+1&&box.top>=groupBox.top-1&&box.bottom<=groupBox.bottom+1,'刮刮画候选圆形超出颜色卡片而被遮挡');
   assert(box.left>=choicesBox.left-1&&box.right<=choicesBox.right+1&&box.top>=choicesBox.top-1&&box.bottom<=choicesBox.bottom+1,'刮刮画候选圆形没有完整位于候选区');
  }
 }
 // Measure the visible left color column from either card. The wrapper is a
 // real grid so the check remains valid in native WebViews as well.
 const colorWidth=Math.max(groups[0].width,groups[1].width),colorRatio=colorWidth/panelRect.width,sizeRatio=sizeControl.width/panelRect.width;
 assert(colorRatio>=.58&&colorRatio<=.74&&sizeRatio>=.24&&sizeRatio<=.42,'刮刮画颜色区与粗细区没有保持约 2:1 宽度比例');
 const custom=doc.querySelector('.scratch-style-custom'),beforeColor=doc.querySelector('#color').value,beforeBackground=doc.querySelector('#background-color').value;assert(custom,'刮刮画缺少共享调色入口');custom.click();await pause(20);assert(doc.querySelector('#palette-dialog')?.open,'刮刮画没有打开共享调色板');doc.querySelector('#palette-dialog .preset-color[aria-label="苹果红"]')?.click();doc.querySelector('#palette-apply')?.click();await pause(20);assert(doc.querySelector('#color').value===beforeColor&&doc.querySelector('#background-color').value===beforeBackground,'刮刮画选色污染了画笔颜色');assert(custom.getAttribute('aria-pressed')==='true','刮刮画自选颜色没有保持选中');
 if(!doc.querySelector('.tool-button[data-tool="pen"]'))doc.querySelector('#tool-page').click();
 doc.querySelector('.tool-button[data-tool="pen"]').click();details.scrollTop=0;if(narrow)await mobilePanel('focus');
}
// 各工具的参数区要保持同一节奏：高度一致、控件不重叠、同功能控件字号一致。
async function checkParameterConsistency(doc){
 const win=frame.contentWindow,parameters=doc.querySelector('.classic-parameters');
 const railPage=()=>Number((doc.getElementById('tool-page').textContent.match(/(\d+)\s*\/\s*(\d+)/)||[0,1])[1]);
 const gotoPage=n=>{for(let i=0;i<3&&railPage()!==n;i++)doc.getElementById('tool-page').click();};
 const pickTool=async id=>{const index=[...doc.querySelectorAll('#tools .tool-button')].findIndex(b=>b.dataset.tool===id);gotoPage(Math.floor(index/7)+1);doc.querySelector(`#tools .tool-button[data-tool="${id}"]:not([hidden])`).click();await pause(30);};
 const heights=[],sizeFonts=new Set(),opacityFonts=new Set();
 for(const tool of ['pen','eraser','fill','picker','line','text','select','magic','move','warp','board-filter','clone','fractal','scratch']){
  await pickTool(tool);
  const height=parameters.getBoundingClientRect().height;
  if(tool!=='stamp')heights.push({tool,height});
  // 参数区里所有可见控件两两不能重叠（父子关系的元素除外）。
  const controls=[...parameters.querySelectorAll('label,button,input,select,output')].filter(isVisible);
  for(let a=0;a<controls.length;a++)for(let b=a+1;b<controls.length;b++){
   if(controls[a].contains(controls[b])||controls[b].contains(controls[a]))continue;
   const x=controls[a].getBoundingClientRect(),y=controls[b].getBoundingClientRect();
   assert(Math.min(x.right,y.right)-Math.max(x.left,y.left)<=2||Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)<=2,tool+' 参数控件重叠：'+(controls[a].id||controls[a].getAttribute('for')||a)+' × '+(controls[b].id||controls[b].getAttribute('for')||b));
  }
  const sizeLabel=doc.querySelector('label[for="size"]'),opacityLabel=doc.querySelector('.opacity-control');
  if(isVisible(sizeLabel))sizeFonts.add(win.getComputedStyle(sizeLabel).fontSize);
  if(isVisible(opacityLabel))opacityFonts.add(win.getComputedStyle(opacityLabel).fontSize);
 }
 const spread=Math.max(...heights.map(h=>h.height))-Math.min(...heights.map(h=>h.height));
 assert(spread<=2,'参数区高度不一致：'+JSON.stringify(heights.map(h=>h.tool+'='+Math.round(h.height))));
 assert(sizeFonts.size<=1,'笔尖粗细文案在不同工具下字号不一致：'+[...sizeFonts].join(' / '));
 assert(opacityFonts.size<=1,'不透明度文案在不同工具下字号不一致：'+[...opacityFonts].join(' / '));
 for(const font of [...sizeFonts,...opacityFonts])assert(parseFloat(font)>=14,'共享参数文案过小：'+font);
}
// 工具与图库反复穿插时，左侧列表与底部参数栏的状态机不能被任何工具破坏，
// 尤其是第三页的新功能（刮刮画／小动画／像素画）与图库和旧工具的穿插。
async function checkToolGalleryInterleave(doc){
 const leftCards=()=>[...doc.getElementById('library-groups').children].filter(isVisible);
 const click=id=>doc.getElementById(id).click();
 // 图库 → 彩色背景：左侧出现子分类列表，参数栏保留翻页与提示。
 click('mode-library');await pause(120);
 doc.querySelector('[data-category="background"]').click();await pause(120);
 assert(leftCards().length>3,'背景分类没有在左侧列出子分类');
 const parameters=doc.querySelector('.classic-parameters');
 // 桌面端设计上只显示翻页条；提示条可见时才要求它位于参数栏内。
 assert(inside(doc.getElementById('library-pagination'),parameters),'图库状态下 library-pagination 不在参数栏');
 const instruction=doc.getElementById('library-instruction');
 assert(!isVisible(instruction)||inside(instruction,parameters),'图库状态下 library-instruction 可见却不在参数栏');
 // 回画板：左侧列表清空、标题回到画笔盒。
 click('mode-board');await pause(80);
 assert(leftCards().length===0,'回画板后左侧仍残留素材分类');
 assert(doc.querySelector('.classic-left > h2').textContent==='我的画笔盒','回画板后左栏标题错误');
 // 魔法袋：自动切到魔法袋面板，左侧是三个模式卡，图库分类栏隐藏。
 const railPage=()=>Number((doc.getElementById('tool-page').textContent.match(/(\d+)\s*\/\s*(\d+)/)||[0,1])[1]);
 const gotoPage=n=>{for(let i=0;i<3&&railPage()!==n;i++)doc.getElementById('tool-page').click();};
 gotoPage(1);doc.querySelector('#tools .tool-button[data-tool="stamp"]:not([hidden])').click();await pause(150);
 assert(doc.querySelectorAll('#library-groups [data-fairy-mode]').length===3&&leftCards().length===3,'魔法袋左侧没有三个模式卡');
 assert(!isVisible(doc.getElementById('categories')),'魔法袋仍显示图库分类栏');
 // 魔法袋 → 图库：恢复上次的背景分类与左侧列表。
 click('mode-library');await pause(120);
 assert(leftCards().length>3&&isVisible(doc.getElementById('categories')),'从魔法袋回图库没有恢复分类');
 assert(doc.querySelector('.classic-left > h2').textContent==='找一找图案','图库标题错误');
 // 图库开着切刮刮画：非魔法袋工具收起图库，刮刮画参数面板照常出现。
 gotoPage(3);doc.querySelector('#tools .tool-button[data-tool="scratch"]:not([hidden])').click();await pause(150);
 assert(!doc.body.classList.contains('library-open'),'切刮刮画后图库没有收起');
 assert(isVisible(doc.querySelector('.scratch-style-panel')),'刮刮画参数面板没有出现');
 // 图库开着打开小动画／像素画弹窗：关闭后状态栏不残留、模式按钮不自相矛盾。
 for(const feature of ['animation','pixel']){
  click('mode-library');await pause(100);
  gotoPage(3);doc.querySelector(`#tools .tool-button[data-tool="${feature}"]:not([hidden])`).click();await pause(150);
  const dialog=doc.getElementById(feature==='animation'?'animation-editor-dialog':'pixel-art-dialog');
  assert(dialog?.open,feature+' 弹窗没有打开');
  dialog.close();await pause(80);
  assert(doc.getElementById('mode-library').getAttribute('aria-pressed')===String(doc.body.classList.contains('library-open')),feature+' 关闭后模式按钮与图库状态矛盾');
 }
 // 收尾回到画笔：参数区恢复常规节奏。
 gotoPage(1);doc.querySelector('#tools .tool-button[data-tool="pen"]:not([hidden])').click();await pause(120);
 assert(!doc.body.classList.contains('library-open'),'回画笔后图库没有收起');
 assert(isVisible(doc.getElementById('brush-options')),'回画笔后粗细滑杆缺失');
 assert(!doc.getElementById('tool-hint').textContent.includes('Failed'),'工具提示出现报错文案');
}
async function checkAssist(doc,width,height){ const trigger=doc.querySelector('#assist-open');if(!trigger)return;
 trigger.click();await pause(40);const dialog=doc.querySelector('#assist-dialog'),form=dialog?.querySelector('.assist-form');
 assert(dialog?.open&&form,'辅助面板没有打开');
 const viewport=doc.defaultView,box=dialog.getBoundingClientRect(),margin=4;
 assert(box.left>=margin&&box.top>=margin&&box.right<=viewport.innerWidth-margin&&box.bottom<=viewport.innerHeight-margin,`辅助面板越出窗口 ${width}×${height}`);
 const checkLayout=()=>{const blocks=[...form.children].filter(isVisible);for(const block of blocks){const r=block.getBoundingClientRect();assert(r.left>=box.left-1&&r.right<=box.right+1,'辅助面板内容横向溢出');}for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){const a=blocks[i].getBoundingClientRect(),b=blocks[j].getBoundingClientRect();assert(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,`辅助面板内容重叠 ${width}×${height}`);}};
 checkLayout();
 const fields=[...form.querySelectorAll('input,select,button')].filter(isVisible);
 for(const field of fields){const r=field.getBoundingClientRect();assert(r.width>0&&r.height>0,'辅助控件没有可用尺寸');assert(r.left>=box.left-1&&r.right<=box.right+1,'辅助控件超出面板');}
 assert(form.scrollHeight>=form.clientHeight,'辅助面板滚动容器尺寸异常');
 // Short landscape windows keep the whole assist sheet in one view, including
 // the larger radial mode. The smallest portrait fixtures retain the normal
 // dialog fallback because 320×240 cannot fit every touch target at once.
 const compact=width>=500&&height<=400;
 if(compact)assert(form.scrollHeight<=form.clientHeight+1&&dialog.scrollHeight<=dialog.clientHeight+1,`矮窗口辅助面板仍需滚动 ${width}×${height}`);
 const enabled=doc.querySelector('#assist-enabled');if(!enabled.checked)enabled.click();await pause(20);assert(enabled.checked,'辅助开关无法操作');
 const vertical=doc.querySelector('.assist-mode-button[data-assist-mode="vertical"]'),radial=doc.querySelector('.assist-mode-button[data-assist-mode="radial"]'),axes=doc.querySelector('#assist-axes'),axesRow=doc.querySelector('.assist-axes-row');
 assert(vertical&&radial&&!vertical.disabled&&!radial.disabled&&axesRow&&isVisible(axesRow),'辅助模式按钮或轴数行不可操作');vertical.click();await pause(10);assert(axes&&axes.disabled,'非多轴模式下轴数没有禁用');assert(vertical.getAttribute('aria-pressed')==='true','默认对称方式没有选中');radial.click();await pause(20);
 assert(dialog.dataset.assistMode==='radial'&&radial.getAttribute('aria-pressed')==='true','辅助模式没有切换到多轴');assert(!axes.disabled,'多轴模式下轴数仍被禁用');assert(doc.querySelector('#assist-axes-value').textContent.includes('8'),'多轴份数没有显示');
 for(const [id,value] of [['assist-center-x','36'],['assist-center-y','64']]){const input=doc.querySelector('#'+id);input.value=value;input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));}
 for(const id of ['assist-grid','assist-stamp']){const input=doc.querySelector('#'+id);if(!input.checked)input.click();}
 assert(doc.querySelector('#assist-center-x-value').textContent==='36%'&&doc.querySelector('#assist-center-y-value').textContent==='64%','辅助中心位置没有更新');assert(doc.querySelector('#assist-grid').checked&&doc.querySelector('#assist-stamp').checked,'辅助预览选项无法操作');checkLayout();
 if(compact)assert(form.scrollHeight<=form.clientHeight+1&&dialog.scrollHeight<=dialog.clientHeight+1,`径向辅助面板仍需滚动 ${width}×${height}`);
 form.querySelector('.assist-close')?.click();await pause(20);assert(!dialog.open,'辅助面板关闭失败');
}
for(const [width,height] of [[375,240],[540,320],[900,650],[1024,720],[1280,720],[1920,1080],[2560,1440]]){
 frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform=`scale(${Math.min(1,1100/width)})`;
 await new Promise(resolve=>{frame.onload=resolve;frame.src='/';});const doc=frame.contentDocument;
 for(let i=0;i<200&&doc.body.dataset.appReady!=='true';i++)await pause(30);
 if(doc.body.dataset.appReady!=='true'){results.push({name:`${width}×${height} 完整启动`,passed:false,error:'应用未完成初始化，无法进入界面验收'});continue;}
 await pause(200);doc.querySelector('#recover-dialog[open] [value="cancel"]')?.click();
 let previousScale=0;
 for(const size of ['auto','large','largest']){
  const name=`${width}×${height} · ${size}`;try{
   doc.querySelector('#display-open').click();doc.querySelector(`[data-ui-size="${size}"]`).click();doc.querySelector('#display-close').click();await pause(150);
   doc.querySelector('.mobile-command[data-mobile-panel="focus"]')?.click();await pause(20);
   assert(doc.body.dataset.appReady==='true','应用未完成初始化');
   assert(doc.querySelector('#paint-texture-file')?.isConnected,'纹理文件控件未挂载');
   assert(doc.querySelector('#paint-source-choose'),'卡通选择控件未初始化');
   assert(!doc.querySelector('#tool-settings-open'),'仍存在更多玩法折叠入口');
   const scale=Number(doc.body.style.getPropertyValue('--u'));assert(scale>previousScale,'大按钮没有变大');previousScale=scale;
   const viewport=doc.querySelector('#viewport'),r=viewport.getBoundingClientRect();assert(r.width>=200&&r.height>=100,'画纸被挤压');
   const headerRect=doc.querySelector('.app-header').getBoundingClientRect(),dock=doc.querySelector('.tool-dock').getBoundingClientRect();
   assert(headerRect.height<=72,'顶部操作区过高');
   assert(dock.height<=(height>=500?Math.min(190,Math.max(164,height*.17)):Math.max(180,height*.7))+1,'底部状态选择区过高');
   for(const id of ['display-open','new','tool-page','stroke-buttons']){
    const element=doc.getElementById(id);if(!element||!isVisible(element))continue;
    if(inside(element,doc.body))continue;
    // The compact header deliberately scrolls horizontally on phones. Make
    // sure an off-screen control is reachable through that strip.
    const scroller=element.closest('.header-actions');
    if(scroller&&scroller.scrollWidth>scroller.clientWidth){const before=scroller.scrollLeft;scroller.scrollLeft=scroller.scrollWidth;assert(inside(element,scroller),'控件无法通过工具栏滚动访问 '+id);scroller.scrollLeft=before;}
    else if(id==='new'&&element.closest('.classic-left')&&(width<=640||height<=500)){
     doc.querySelector('.mobile-command[data-mobile-panel="brushes"]')?.click();await pause(20);assert(inside(element,doc.querySelector('.classic-left')),'新画纸无法通过画笔抽屉访问');doc.querySelector('.mobile-command[data-mobile-panel="focus"]')?.click();
    } else assert(false,'控件超出窗口 '+id);
   }
   const header=[...doc.querySelectorAll('.brand,.header-actions button')];for(let i=1;i<header.length;i++)assert(header[i-1].getBoundingClientRect().right<=header[i].getBoundingClientRect().left+1,'顶部按钮互相覆盖');
   if(width<=640||height<=500){doc.querySelector('.mobile-command[data-mobile-panel="options"]')?.click();await pause(80);}
   const parameters=doc.querySelector('.classic-parameters');assert(parameters.scrollWidth<=parameters.clientWidth+2,'画笔参数溢出');
   for(const id of ['size','opacity','brush-ratio','paint-color-open','paper-grain-choose','paper-grain-strength']){
    const field=doc.getElementById(id);assert(field,`参数控件不存在 ${id}`);
    if(width>640&&height>500)assert(inside(field,parameters),'首屏参数被裁切 '+id);
    else {assert(field.closest('.classic-parameters')===parameters,'小窗口参数未归入滚动面板 '+id);assert(parameters.scrollHeight>=parameters.clientHeight,'小窗口参数缺少滚动空间 '+id);}
   }
   for(const card of doc.querySelectorAll('.parameter-slider')){const css=frame.contentWindow.getComputedStyle(card);assert(parseFloat(css.paddingLeft)>=4&&parseFloat(css.paddingTop)>=4,'文案留边不足');}
   const sliders=[...doc.querySelectorAll('.parameter-slider')].filter(isVisible);for(let i=1;i<sliders.length;i++){const previous=sliders[i-1].getBoundingClientRect(),current=sliders[i].getBoundingClientRect();if(width<=640||height<=500)assert(previous.bottom<=current.top+1||previous.right<=current.left+1,'滑杆卡片互相覆盖');else assert(previous.right+5<=current.left,'滑杆卡片互相覆盖');}
   const pens=doc.querySelector('.brush-box'),cards=[...pens.children],clipped=cards.some(c=>!inside(c,pens));
   assert(!doc.querySelector('#all-brushes-open'),'仍有展开画笔盒入口');assert(cards.length>=9,'原笔盒不足九支画笔');for(const card of cards){card.scrollIntoView({block:'nearest'});assert(inside(card,pens),'画笔无法滚动访问');}pens.scrollTop=0;
   const targets=[...doc.querySelectorAll('.header-actions button,.brush-card,.tool-button,.swatch,.left-actions button')].filter(isVisible),minTarget=(width<=640||height<=500)?30:43.5;assert(targets.every(b=>b.getBoundingClientRect().width>=minTarget&&b.getBoundingClientRect().height>=minTarget),'点击区域过小');
   if(width<=900||height<=720)await checkAssist(doc,width,height);
   assert(![...doc.querySelectorAll('select')].some(isVisible),'出现默认下拉框');
   doc.querySelector('.mobile-command[data-mobile-panel="focus"]')?.click();await pause(20);doc.querySelector('#mode-library').click();await pause(100);
   const tray=doc.querySelector('.right-panel').getBoundingClientRect(),paper=viewport.getBoundingClientRect();
   // On a short phone the drawer intentionally overlays the canvas so its
   // controls remain usable; on a tall window it should reserve a shelf below
   // the paper. In both cases the drawer itself must stay inside the viewport.
   if(height>=500)assert(tray.top>=paper.bottom-1,'素材遮挡画纸');
   else assert(tray.bottom<=doc.defaultView.innerHeight+1,'素材栏超出窗口');
   assert(paper.width>=200&&paper.height>=100,'素材栏挤掉画纸');
   assert(inside(doc.querySelector('.right-panel'),doc.body),'素材栏超出窗口');
   for(const asset of doc.querySelectorAll('#asset-grid .asset'))assert(inside(asset,doc.querySelector('#asset-grid')),'素材分页中存在被裁切的卡片');
   if(width>640&&height>500){
    if(doc.body.dataset.librarySurface==='fairy')assert(inside(doc.querySelector('#size'),parameters),'魔法袋素材打开后大小滑杆被裁切');
    else assert(!isVisible(doc.querySelector('#brush-options')),'普通图库错误显示魔法袋大小滑杆');
   }
   const pagerRoot=width>640&&height>500?parameters:doc.querySelector('.right-panel');
   for(const b of doc.querySelectorAll('#library-pagination button'))assert(inside(b,pagerRoot),'素材翻页按钮被裁切');
   doc.querySelector('#mode-board').click();await pause(25);
   await checkTools(doc);
   if(width>860&&height>600){await checkParameterConsistency(doc);await checkToolGalleryInterleave(doc);}
   results.push({name,passed:true,canvas:{width:Math.round(r.width),height:Math.round(r.height)},expandedBrushBox:clipped});
  }catch(error){results.push({name,passed:false,error:error.message});for(const dialog of doc.querySelectorAll('dialog[open]'))dialog.close();doc.querySelector('#mode-board').click();}
 }
 doc.querySelector('#display-open').click();doc.querySelector('[data-ui-size="auto"]').click();doc.querySelector('#display-close').click();
}
try{
 const doc=frame.contentDocument;doc.querySelector('#mode-library').click();await pause(150);
 const dock=doc.querySelector('.tool-dock'),large=dock.getBoundingClientRect().height,largeCount=doc.querySelectorAll('#asset-grid .asset').length;
 const first=doc.querySelector('#asset-grid .asset');first.click();await pause(250);const selected=first.dataset.assetId;
 frame.style.width='1280px';frame.style.height='720px';await pause(400);
 assert(dock.getBoundingClientRect().height>0,'实时缩放后底部区域不可见');
 assert(doc.querySelectorAll('#asset-grid .asset').length<largeCount,'素材每页数量没有随宽度变化');
 assert(doc.querySelector(`[data-asset-id="${selected}"]`).getAttribute('aria-pressed')==='true','窗口缩放丢失已选素材标记');
 assert(doc.querySelector('#painting').width===1920,'窗口缩放改变了作品分辨率');
 results.push({name:'实时缩放保持作品、选中状态并重排素材',passed:true});
}catch(error){results.push({name:'实时缩放保持作品、选中状态并重排素材',passed:false,error:error.message});}
document.querySelector('#results').replaceChildren(...results.map(result=>{const li=document.createElement('li');li.textContent=(result.passed?'通过 ':'失败 ')+result.name+(result.error?' — '+result.error:'');return li;}));
const passed=results.filter(r=>r.passed).length;document.querySelector('#summary').textContent=`${passed}/${results.length} 通过`;document.body.dataset.results=JSON.stringify(results);
