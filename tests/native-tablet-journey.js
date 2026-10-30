// Tablet-shell journey. The native runner executes in the outer shell while
// these checks drive the unchanged app inside its same-origin iframe.
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[],runtimeErrors=[];
const frame=document.getElementById('tablet-frame');
const app=frame?.contentWindow,doc=frame?.contentDocument;
window.addEventListener('error',event=>runtimeErrors.push(event.message));
app?.addEventListener('error',event=>runtimeErrors.push(event.message));
app?.addEventListener('unhandledrejection',event=>runtimeErrors.push(String(event.reason)));
function assert(value,message){if(!value)throw Error(message);}
function visible(node){return Boolean(node?.getClientRects().length);}
async function idle(){await pause(40);for(let i=0;i<500&&doc.body.hasAttribute('aria-busy');i++)await pause(20);assert(!doc.body.hasAttribute('aria-busy'),'界面操作没有恢复响应');await pause(30);}
async function check(name,fn){try{const detail=await fn();checks.push({name,passed:true,detail:detail??null});}catch(error){checks.push({name,passed:false,error:error.message});for(const dialog of doc?.querySelectorAll('dialog[open]')||[])dialog.close();await pause(60);}}
function nativeResult(name,id,post){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{app.removeEventListener(name,handler);reject(Error(`${name} 等待超时`));},12000);function handler(event){if(event.detail?.id!==id)return;clearTimeout(timer);app.removeEventListener(name,handler);if(event.detail.error)reject(Error(event.detail.error));else resolve(event.detail);}app.addEventListener(name,handler);try{post();}catch(error){clearTimeout(timer);app.removeEventListener(name,handler);reject(error);}});}
function stroke(x=.2,y=.25,endX=.65,endY=.55){const canvas=doc.getElementById('painting'),box=canvas.getBoundingClientRect(),capture=canvas.setPointerCapture;canvas.setPointerCapture=()=>{};try{for(const [type,px,py,buttons] of [['pointerdown',x,y,1],['pointermove',endX,endY,1],['pointerup',endX,endY,0]])canvas.dispatchEvent(new app.PointerEvent(type,{bubbles:true,pointerId:91,pointerType:'pen',button:0,buttons,clientX:box.x+box.width*px,clientY:box.y+box.height*py}));}finally{canvas.setPointerCapture=capture;}}
try{
for(let i=0;i<500&&(doc?.body?.dataset.appReady!=='true'||!window.LUOYETabletMetrics?.());i++)await pause(20);
assert(doc?.body?.dataset.appReady==='true','平板内页未完成初始化');
for(let i=0;i<100&&innerWidth<innerHeight;i++)await pause(20);
doc.querySelector('#recover-dialog[open] [value="cancel"]')?.click();await idle();
doc.body.dataset.tabletNativeProbe='preserved';

await check('iPad 横屏外壳完整铺满且内页保持桌面视口',()=>{
 const metrics=window.LUOYETabletMetrics(),box=frame.getBoundingClientRect();
 assert(innerWidth>=innerHeight,`不是横屏视口：${innerWidth}×${innerHeight}`);
 assert(metrics&&metrics.logicalWidth>=1600-0.001&&metrics.logicalHeight>=1000-0.001,'逻辑视口低于 1600×1000');
 for(const [actual,expected,label] of [[box.width,innerWidth,'宽'],[box.height,innerHeight,'高']])assert(Math.abs(actual-expected)<=1,`外壳没有铺满${label}：${actual}/${expected}`);
 assert(Math.abs(box.left)<=1&&Math.abs(box.top)<=1,'外壳边缘存在留白');
 assert(app.innerWidth>=1600&&app.innerHeight>=1000,'内页进入小屏断点');
 assert(!doc.body.hasAttribute('data-mobile-panel'),'iPad 进入了抽屉布局');
 const paper=doc.getElementById('viewport').getBoundingClientRect();assert(paper.width>=300&&paper.height>=180,'画纸空间过小');
 return {viewport:{width:innerWidth,height:innerHeight},metrics};
});

await check('iOS 平台标识和子 frame 桥接已进入内页',()=>{
 assert(app.LUOYE_PLATFORM==='ios','内页缺少 iOS 平台标识');
 for(const channel of ['files','music','display','assets'])assert(app.webkit?.messageHandlers?.[channel],`内页缺少 ${channel} 桥接`);
 return {platform:app.LUOYE_PLATFORM};
});

// The display protocol has no id, so exercise it separately from id-based calls.
await check('显示桥接从子 frame 往返且窗口变化不重载',async()=>{
 const originalDocument=frame.contentDocument,canvas=doc.getElementById('painting'),before=canvas.toDataURL();
 const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('native-display-result 等待超时')),10000);app.addEventListener('native-display-result',event=>{clearTimeout(timer);resolve(event.detail);},{once:true});});
 app.webkit.messageHandlers.display.postMessage({action:'fullscreen'});
 const detail=await result;await idle();
 assert(detail.width>0&&detail.height>0,'显示桥接没有返回有效尺寸');
 assert(frame.contentDocument===originalDocument,'全屏变化重载了内页');
 assert(doc.body.dataset.tabletNativeProbe==='preserved'&&canvas.toDataURL()===before,'全屏变化破坏内页状态');
 app.webkit.messageHandlers.display.postMessage({action:'fullscreen'});await idle();
 return detail;
});

await check('彩虹笔和双色渐变笔在缩放内页实际落笔',async()=>{
 const canvas=doc.getElementById('painting');
 for(const brush of ['rainbow','duotone']){
  const button=doc.querySelector(`[data-brush="${brush}"]`);assert(button&&visible(button),`${brush} 入口不可见`);button.click();await idle();
  const before=canvas.toDataURL();stroke();await idle();assert(canvas.dataset.brush===brush,`${brush} 没有成为当前画笔`);assert(canvas.toDataURL()!==before,`${brush} 没有画出笔迹`);
 }
});

await check('图库直接展开且贴图生成新图层',async()=>{
 doc.getElementById('mode-library').click();await idle();
 const category=doc.querySelector('[data-category="sticker"]');assert(category&&visible(category),'贴图分类不可见');category.click();await idle();
 const asset=doc.querySelector('#asset-grid .asset');assert(asset&&visible(asset),'贴图素材不可见');
 const before=Number(doc.getElementById('layer-count').textContent);asset.click();await idle();
 assert(Number(doc.getElementById('layer-count').textContent)>before,'贴图没有生成新图层');
 assert(!doc.body.hasAttribute('data-mobile-panel'),'图库切换触发抽屉');
 doc.getElementById('mode-board').click();await idle();
});

await check('素材桥接读取应用包内图片',async()=>{
 const image=doc.querySelector('#asset-grid img');assert(image,'没有可验证的素材图片');
 const path=decodeURIComponent(new URL(image.src).pathname).split('/site/')[1];assert(path,'素材不在应用 site 包内');
 const detail=await nativeResult('native-asset-result','tablet-asset',()=>app.webkit.messageHandlers.assets.postMessage({id:'tablet-asset',path}));
 assert(detail.data?.startsWith('data:image/'),'素材桥接没有返回图片数据');
 return {path};
});

await check('音乐桥接响应子 frame 状态请求',async()=>{
 const detail=await nativeResult('native-music-result','tablet-music',()=>app.webkit.messageHandlers.music.postMessage({id:'tablet-music',action:'state'}));
 assert(detail.state,'音乐桥接没有返回状态');return {state:detail.state};
});

await check('关闭前代理和文件桥接保存同一份 v3 工程',async()=>{
 assert(fileChecks===true,'请以 -LUOYE_SMOKE_FILES 1 运行文件验收');
 const snapshot=await window.LUOYEFlushBeforeClose();
 assert(snapshot?.project?.format==='luoye-studio'&&snapshot.project.version===3,'关闭代理没有返回 v3 工程');
 const content=JSON.stringify(snapshot.project);
 const detail=await nativeResult('native-file-result','tablet-file',()=>app.webkit.messageHandlers.files.postMessage({id:'tablet-file',name:'平板验收.luoyex',mime:'application/json',content}));
 assert(detail.saved===true,'文件桥接没有确认保存');return {bytes:content.length,layers:snapshot.project.layers.length};
});

await check('八个主题切换不改变画布像素',async()=>{
 const canvas=doc.getElementById('painting'),before=canvas.toDataURL();doc.getElementById('theme-open').click();await idle();
 const cards=[...doc.querySelectorAll('#theme-dialog [data-theme]')];assert(cards.length===8,'主题数量错误');
 for(const card of cards){card.click();await pause(30);assert(doc.body.dataset.theme===card.dataset.theme,'主题没有切换');}
 assert(canvas.toDataURL()===before,'主题切换改变画布像素');doc.getElementById('theme-done').click();await idle();
});

await check('平板验收没有未处理运行错误',()=>assert(!runtimeErrors.length,runtimeErrors.join('; ')));
}catch(error){checks.push({name:'平板旅程执行',passed:false,error:error.message,stack:error.stack});}
return {passed:checks.every(check=>check.passed),checks,viewport:{width:innerWidth,height:innerHeight},metrics:window.LUOYETabletMetrics(),runtimeErrors};
