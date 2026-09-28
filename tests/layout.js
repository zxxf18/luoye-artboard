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
 const trigger=doc.querySelector('#assist-open');if(!trigger)return;
 trigger.click();await pause(40);const dialog=doc.querySelector('#assist-dialog'),form=dialog?.querySelector('.assist-form');
 assert(dialog?.open&&form,'辅助面板没有打开');
 const viewport=doc.defaultView,box=dialog.getBoundingClientRect(),margin=4;
 assert(box.left>=margin&&box.top>=margin&&box.right<=viewport.innerWidth-margin&&box.bottom<=viewport.innerHeight-margin,`辅助面板越出窗口 ${width}×${height}`);
 const blocks=[...form.children].filter(isVisible);
 for(const block of blocks){const r=block.getBoundingClientRect();assert(r.left>=box.left-1&&r.right<=box.right+1,'辅助面板内容横向溢出');}
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){
  const a=blocks[i].getBoundingClientRect(),b=blocks[j].getBoundingClientRect();
  assert(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,`辅助面板内容重叠 ${width}×${height}`);
 }
 const fields=[...form.querySelectorAll('input,select,button')].filter(isVisible);
 for(const field of fields){const r=field.getBoundingClientRect();assert(r.width>0&&r.height>0,'辅助控件没有可用尺寸');assert(r.left>=box.left-1&&r.right<=box.right+1,'辅助控件超出面板');}
 assert(form.scrollHeight>=form.clientHeight,'辅助面板滚动容器尺寸异常');
 form.querySelector('.assist-close')?.click();await pause(20);assert(!dialog.open,'辅助面板关闭失败');
}
for(const [width,height] of [[375,240],[540,320],[900,650],[1280,720],[1920,1080],[2560,1440]]){
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
   assert(!doc.querySelector('#all-brushes-open'),'仍有展开画笔盒入口');assert(cards.length===9,'原笔盒不足九支画笔');for(const card of cards){card.scrollIntoView({block:'nearest'});assert(inside(card,pens),'画笔无法滚动访问');}pens.scrollTop=0;
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
   if(width>640&&height>500)assert(inside(doc.querySelector('#size'),parameters),'素材打开后大小滑杆被裁切');
   const pagerRoot=width>640&&height>500?parameters:doc.querySelector('.right-panel');
   for(const b of doc.querySelectorAll('#library-pagination button'))assert(inside(b,pagerRoot),'素材翻页按钮被裁切');
   doc.querySelector('#mode-board').click();await pause(25);
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
