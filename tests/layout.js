const frame=document.querySelector('iframe'),results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function assert(value,message){if(!value)throw Error(message);}
function isVisible(el){return el.getClientRects().length>0;}
function inside(el,root){const a=el.getBoundingClientRect(),b=root.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;}
async function checkTools(doc){
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
  assert(!isVisible(doc.querySelector('#brush-ratio')),'宽窄滑杆出现在非画笔工具 '+tool);
  const expected=[...ids];
  if(tool==='board-filter'){
   const select=doc.querySelector('#board-filter-kind');select.value='waterfall';select.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
   expected.push('filter-density','filter-spread','filter-height','filter-direction-choose');
  }
  for(const id of expected){
   const el=doc.getElementById(id);assert(el&&isVisible(el),'缺少已展开的参数 '+id);
   if(details.contains(el)){el.scrollIntoView({block:'nearest',inline:'nearest'});await pause(10);}
   assert(inside(el,parameters),'参数不可滚动到可视区域 '+id);
   const card=el.closest('label');if(card&&details.contains(card)){const css=frame.contentWindow.getComputedStyle(card);assert(parseFloat(css.paddingLeft)>=4&&parseFloat(css.paddingTop)>=4,'参数卡片文案贴边 '+id);}
  }
  const cards=[...details.querySelectorAll('label')].filter(isVisible);
  for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++){
   const x=cards[a].getBoundingClientRect(),y=cards[b].getBoundingClientRect();
   assert(x.right<=y.left+1||y.right<=x.left+1||x.bottom<=y.top+1||y.bottom<=x.top+1,'参数卡片重叠 '+tool);
  }
 }
 if(!doc.querySelector('.tool-button[data-tool="pen"]'))doc.querySelector('#tool-page').click();
 doc.querySelector('.tool-button[data-tool="pen"]').click();details.scrollTop=0;
}
for(const [width,height] of [[900,650],[1280,720],[1920,1080],[2560,1440]]){
 frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform=`scale(${Math.min(1,1100/width)})`;
 await new Promise(resolve=>{frame.onload=resolve;frame.src='/';});const doc=frame.contentDocument;
 for(let i=0;i<200&&doc.body.dataset.appReady!=='true';i++)await pause(30);
 if(doc.body.dataset.appReady!=='true'){results.push({name:`${width}×${height} 完整启动`,passed:false,error:'应用未完成初始化，无法进入界面验收'});continue;}
 await pause(200);doc.querySelector('#recover-dialog[open] [value="cancel"]')?.click();
 let previousScale=0;
 for(const size of ['auto','large','largest']){
  const name=`${width}×${height} · ${size}`;try{
   doc.querySelector('#display-open').click();doc.querySelector(`[data-ui-size="${size}"]`).click();doc.querySelector('#display-close').click();await pause(150);
   assert(doc.body.dataset.appReady==='true','应用未完成初始化');
   assert(doc.querySelector('#paint-texture-file')?.isConnected,'纹理文件控件未挂载');
   assert(doc.querySelector('#paint-source-choose'),'卡通选择控件未初始化');
   assert(!doc.querySelector('#tool-settings-open'),'仍存在更多玩法折叠入口');
   const scale=Number(doc.body.style.getPropertyValue('--u'));assert(scale>previousScale,'大按钮没有变大');previousScale=scale;
   const viewport=doc.querySelector('#viewport'),r=viewport.getBoundingClientRect();assert(r.width>=200&&r.height>=100,'画纸被挤压');
   const headerRect=doc.querySelector('.app-header').getBoundingClientRect(),dock=doc.querySelector('.tool-dock').getBoundingClientRect();
   assert(headerRect.height<=72,'顶部操作区过高');
   assert(dock.height<=Math.min(190,Math.max(164,height*.17))+1,'底部状态选择区过高');
   for(const id of ['display-open','new','tool-page','stroke-buttons'])assert(inside(doc.getElementById(id),doc.body),'控件超出窗口 '+id);
   const header=[...doc.querySelectorAll('.brand,.header-actions button')];for(let i=1;i<header.length;i++)assert(header[i-1].getBoundingClientRect().right<=header[i].getBoundingClientRect().left+1,'顶部按钮互相覆盖');
   const parameters=doc.querySelector('.classic-parameters');assert(parameters.scrollWidth<=parameters.clientWidth+2,'画笔参数溢出');
   for(const id of ['size','opacity','brush-ratio','paint-color-open','paper-grain-choose','paper-grain-strength'])assert(inside(doc.getElementById(id),parameters),'首屏参数被裁切 '+id);
   for(const card of doc.querySelectorAll('.parameter-slider')){const css=frame.contentWindow.getComputedStyle(card);assert(parseFloat(css.paddingLeft)>=4&&parseFloat(css.paddingTop)>=4,'文案留边不足');}
   const sliders=[...doc.querySelectorAll('.parameter-slider')].filter(isVisible);for(let i=1;i<sliders.length;i++)assert(sliders[i-1].getBoundingClientRect().right+5<=sliders[i].getBoundingClientRect().left,'滑杆卡片互相覆盖');
   const pens=doc.querySelector('.brush-box'),cards=[...pens.children],clipped=cards.some(c=>!inside(c,pens));
   assert(!doc.querySelector('#all-brushes-open'),'仍有展开画笔盒入口');assert(cards.length===9,'原笔盒不足九支画笔');for(const card of cards){card.scrollIntoView({block:'nearest'});assert(inside(card,pens),'画笔无法滚动访问');}pens.scrollTop=0;
   const targets=[...doc.querySelectorAll('.header-actions button,.brush-card,.tool-button,.swatch,.left-actions button')].filter(isVisible);assert(targets.every(b=>b.getBoundingClientRect().width>=43.5&&b.getBoundingClientRect().height>=43.5),'点击区域小于44');
   assert(![...doc.querySelectorAll('select')].some(isVisible),'出现默认下拉框');
   doc.querySelector('#mode-library').click();await pause(100);
   const tray=doc.querySelector('.right-panel').getBoundingClientRect(),paper=viewport.getBoundingClientRect();
   assert(tray.top>=paper.bottom-1,'素材遮挡画纸');assert(paper.height>=100,'素材栏挤掉画纸');assert(Math.abs(paper.height-r.height)<1&&Math.abs(paper.width-r.width)<1,'素材打开后画板尺寸变化');
   assert(inside(doc.querySelector('.right-panel'),doc.body),'素材栏超出窗口');
   for(const asset of doc.querySelectorAll('#asset-grid .asset'))assert(inside(asset,doc.querySelector('#asset-grid')),'素材分页中存在被裁切的卡片');
   assert(inside(doc.querySelector('#size'),parameters),'素材打开后大小滑杆被裁切');
   for(const b of doc.querySelectorAll('#library-pagination button'))assert(inside(b,parameters),'素材翻页按钮被裁切');
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
 assert(dock.getBoundingClientRect().height<large,'实时缩小时底部区域没有变小');
 assert(doc.querySelectorAll('#asset-grid .asset').length<largeCount,'素材每页数量没有随宽度变化');
 assert(doc.querySelector(`[data-asset-id="${selected}"]`).getAttribute('aria-pressed')==='true','窗口缩放丢失已选素材标记');
 assert(doc.querySelector('#painting').width===1920,'窗口缩放改变了作品分辨率');
 results.push({name:'实时缩放保持作品、选中状态并重排素材',passed:true});
}catch(error){results.push({name:'实时缩放保持作品、选中状态并重排素材',passed:false,error:error.message});}
document.querySelector('#results').replaceChildren(...results.map(result=>{const li=document.createElement('li');li.textContent=(result.passed?'通过 ':'失败 ')+result.name+(result.error?' — '+result.error:'');return li;}));
const passed=results.filter(r=>r.passed).length;document.querySelector('#summary').textContent=`${passed}/${results.length} 通过`;document.body.dataset.results=JSON.stringify(results);
