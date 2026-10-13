const frame=document.querySelector('iframe'),results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function assert(value,message){if(!value)throw Error(message);}
function isVisible(el){return el.getClientRects().length>0;}
function inside(el,root){const a=el.getBoundingClientRect(),b=root.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;}
async function checkPalette(doc,label){
 const button=[...doc.querySelectorAll('#paint-color-open, #foreground-palette, #palette-open')].find(isVisible);
 assert(button,`${label}缺少可见的选颜色入口`);
 button.click();await pause(25);
 const palette=doc.querySelector('#palette-dialog');assert(palette?.open,`${label}颜色选择框没有打开`);assert(inside(palette,doc.body),`${label}颜色选择框超出窗口`);
 const presets=[...palette.querySelectorAll('.preset-color')],strip=palette.querySelector('.palette-presets');
 assert(presets.length>10,`${label}常用颜色缺失`);
 for(const preset of presets){
  preset.scrollIntoView({block:'nearest',inline:'nearest'});await pause(5);
  assert(inside(preset,strip),`${label}颜色预设无法通过滚动访问`);
  assert(preset.getBoundingClientRect().height<=56,`${label}颜色预设过高`);
 }
 strip.scrollLeft=0;
 const actions=palette.querySelector('.dialog-actions');actions.scrollIntoView({block:'nearest'});await pause(5);
 assert(inside(palette.querySelector('#palette-apply'),palette),`${label}确认颜色按钮被裁切`);
 palette.querySelector('#palette-cancel').click();await pause(15);
}
async function openPanel(doc,panel){
 const button=doc.querySelector(`.mobile-command[data-mobile-panel="${panel}"]`);
 if(button&&!button.matches('[aria-pressed="true"]')){button.click();await pause(60);}
}
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
  const cards=[...details.querySelectorAll('label')].filter(isVisible);
  for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++){
   const x=cards[a].getBoundingClientRect(),y=cards[b].getBoundingClientRect();
   assert(x.right<=y.left+1||y.right<=x.left+1||x.bottom<=y.top+1||y.bottom<=x.top+1,'参数卡片重叠 '+tool);
  }
 }
 if(narrow)await mobilePanel('focus');
 if(!doc.querySelector('.tool-button[data-tool="pen"]'))doc.querySelector('#tool-page').click();
 doc.querySelector('.tool-button[data-tool="pen"]').click();details.scrollTop=0;
}
async function checkAssist(doc,width,height){
 const trigger=doc.querySelector('.tool-button[data-tool="assist"]')||doc.querySelector('#assist-open');if(!trigger)return;
 trigger.click();await pause(40);const dialog=doc.querySelector('#assist-dialog'),form=dialog?.querySelector('.assist-form');
 assert(dialog?.open&&form,'辅助面板没有打开');
 const viewport=doc.defaultView,box=dialog.getBoundingClientRect(),margin=4;
 assert(box.left>=margin&&box.top>=margin&&box.right<=viewport.innerWidth-margin&&box.bottom<=viewport.innerHeight-margin,`辅助面板越出窗口 ${width}×${height}`);
 const checkLayout=()=>{const blocks=[...form.children].filter(isVisible);for(const block of blocks){const r=block.getBoundingClientRect();assert(r.left>=box.left-1&&r.right<=box.right+1,'辅助面板内容横向溢出');}for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){const a=blocks[i].getBoundingClientRect(),b=blocks[j].getBoundingClientRect();assert(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,`辅助面板内容重叠 ${width}×${height}`);}};
 checkLayout();
 const fields=[...form.querySelectorAll('input,select,button')].filter(isVisible);
 for(const field of fields){field.scrollIntoView({block:'nearest',inline:'nearest'});await pause(5);const r=field.getBoundingClientRect();assert(r.width>0&&r.height>0,'辅助控件没有可用尺寸');assert(r.left>=box.left-1&&r.right<=box.right+1,'辅助控件超出面板');}
 assert(form.scrollHeight>=form.clientHeight,'辅助面板滚动容器尺寸异常');
 // Short landscape windows keep the whole assist sheet in one view, including
 // the larger radial mode. The smallest portrait fixtures retain the normal
 // dialog fallback because 320×240 cannot fit every touch target at once.
 const compact=width>=500&&height<=400;
 if(compact)assert(form.scrollHeight>=form.clientHeight,'矮窗口辅助参数缺少可滚动空间');
 const enabled=doc.querySelector('#assist-enabled');if(!enabled.checked)enabled.click();await pause(20);assert(enabled.checked,'辅助开关无法操作');
 const mode=doc.querySelector('#assist-mode'),modeButton=doc.querySelector('#assist-mode-toggle');
 assert(mode&&!isVisible(mode),'辅助模式原生下拉框不应直接显示');
 assert(modeButton&&isVisible(modeButton)&&!modeButton.disabled,'辅助模式展开入口不可操作');
 const options=doc.querySelector('#assist-mode-options');assert(options&&!options.hidden,'辅助方式选项没有在参数区展开');
 const radial=options.querySelector('[data-assist-mode-option="radial"]');assert(radial,'径向模式选项缺失');radial.click();await pause(20);
 assert(mode.value==='radial','径向模式选择没有回写源控件');
 assert(dialog.dataset.assistMode==='radial','辅助模式没有切换到径向');assert(doc.querySelector('#assist-axes-value').textContent.includes('8'),'径向份数没有显示');
 for(const [id,value] of [['assist-center-x','36'],['assist-center-y','64']]){const input=doc.querySelector('#'+id);input.value=value;input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));}
 for(const id of ['assist-grid','assist-stamp']){const input=doc.querySelector('#'+id);if(!input.checked)input.click();}
 assert(doc.querySelector('#assist-center-x-value').textContent==='36%'&&doc.querySelector('#assist-center-y-value').textContent==='64%','辅助中心位置没有更新');assert(doc.querySelector('#assist-grid').checked&&doc.querySelector('#assist-stamp').checked,'辅助预览选项无法操作');checkLayout();
 if(compact)assert(form.scrollHeight>=form.clientHeight,'径向辅助参数缺少可滚动空间');
 form.querySelector('.assist-close')?.click();await pause(20);assert(!dialog.open,'辅助面板关闭失败');
}
for(const [width,height] of [[375,240],[540,320],[900,500],[900,650],[1280,500],[1280,720],[1920,1080],[2560,1440]]){
 frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform=`scale(${Math.min(1,1100/width)})`;
 await new Promise(resolve=>{frame.onload=resolve;frame.src=`/?layout-regression=${Date.now()}-${width}-${height}`;});const doc=frame.contentDocument;
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
   assert(!doc.querySelector('#all-brushes-open'),'仍有展开画笔盒入口');assert(cards.length>=11,'画笔盒缺少新增画笔');for(const card of cards){card.scrollIntoView({block:'nearest'});assert(inside(card,pens),'画笔无法滚动访问');}pens.scrollTop=0;
   const targets=[...doc.querySelectorAll('.header-actions button,.brush-card,.tool-button,.swatch,.left-actions button')].filter(isVisible),minTarget=(width<=640||height<=500)?30:43.5;assert(targets.every(b=>b.getBoundingClientRect().width>=minTarget&&b.getBoundingClientRect().height>=minTarget),'点击区域过小');
   if(width<=900||height<=720)await checkAssist(doc,width,height);
   assert(![...doc.querySelectorAll('select')].some(isVisible),'出现默认下拉框');
   doc.querySelector('.mobile-command[data-mobile-panel="focus"]')?.click();await pause(20);doc.querySelector('#mode-library').click();await pause(100);
   const brushPage=doc.querySelector('.brush-box'),subtoolPage=doc.querySelector('.subtool-box'),groupBox=doc.querySelector('#library-groups'),compactGallery=width<=860||height<=600;
   assert(brushPage.hidden||!isVisible(brushPage),'选择图库后左侧仍显示画笔页面');
   assert(subtoolPage.hidden||!isVisible(subtoolPage),'选择图库后左侧仍显示工具参数页面');
   if(groupBox?.children.length){
    const expectedParent=compactGallery?doc.querySelector('.library'):doc.querySelector('.classic-left');
    assert(groupBox.parentElement===expectedParent,'图库分类按钮没有归位到对应侧栏');
   }
   const fairyCategory=doc.querySelector('[data-category="fairy"]');
   if(fairyCategory){
    fairyCategory.click();await pause(50);
    const fairyModes=[...groupBox.querySelectorAll('[data-fairy-mode]')].filter(isVisible);
    assert(fairyModes.length===3,'魔法袋缺少单张、组合或会动图案入口');
    for(let i=0;i<fairyModes.length;i++){
     const card=fairyModes[i],rect=card.getBoundingClientRect();
     assert(inside(card,groupBox),'魔法袋入口超出左侧分类区域');
     assert(card.querySelector('span')?.textContent?.trim(),'魔法袋入口缺少可读文案');
     for(let j=i+1;j<fairyModes.length;j++){
      const other=fairyModes[j].getBoundingClientRect();
      assert(rect.right<=other.left+1||other.right<=rect.left+1||rect.bottom<=other.top+1||other.bottom<=rect.top+1,'魔法袋入口互相重叠');
     }
    }
    doc.querySelector('[data-category="background"]')?.click();await pause(30);
   }
   const tray=doc.querySelector('.right-panel').getBoundingClientRect(),paper=viewport.getBoundingClientRect();
   // On a short phone the drawer intentionally overlays the canvas so its
   // controls remain usable; on a tall window it should reserve a shelf below
   // the paper. In both cases the drawer itself must stay inside the viewport.
   if(height>=600)assert(tray.top>=paper.bottom-1,'素材遮挡画纸');
   else assert(tray.bottom<=doc.defaultView.innerHeight+1,'素材栏超出窗口');
   assert(paper.width>=200&&paper.height>=100,'素材栏挤掉画纸');
   assert(inside(doc.querySelector('.right-panel'),doc.body),'素材栏超出窗口');
   for(const asset of doc.querySelectorAll('#asset-grid .asset')){
    asset.scrollIntoView({block:'nearest',inline:'nearest'});await pause(5);
    assert(inside(asset,doc.querySelector('#asset-grid')),'素材卡片无法通过滚动完整查看');
    assert(inside(asset.querySelector('span'),asset),'素材名称超出卡片');
   }
   if(width>640&&height>500)assert(inside(doc.querySelector('#size'),parameters),'素材打开后大小滑杆被裁切');
   // The gallery owns its pager on wide layouts as well as mobile drawers;
   // validate it against the live parent instead of the old parameter strip.
   const pagerRoot=doc.querySelector('#library-pagination')?.parentElement||doc.querySelector('.right-panel');
   for(const b of doc.querySelectorAll('#library-pagination button')){
    b.scrollIntoView({block:'nearest',inline:'nearest'});await pause(5);assert(inside(b,pagerRoot),'素材翻页按钮无法滚动到可视区域');
   }
   doc.querySelector('#mode-board').click();await pause(25);
   assert(!brushPage.hidden,'关闭图库后画笔页面没有恢复');
   if(width<=640||height<=500)await openPanel(doc,'brushes');
   await checkPalette(doc,'画笔');
   if(width<=640||height<=500)await openPanel(doc,'options');
   const textTool=doc.querySelector('.tool-button[data-tool="text"]');
   if(textTool){textTool.click();await pause(25);if(width<=640||height<=500)await openPanel(doc,'brushes');await checkPalette(doc,'文字');}
   await checkTools(doc);
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
