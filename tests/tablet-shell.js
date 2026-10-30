const shell=document.querySelector('#shell'),direct=document.querySelector('#direct'),results=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(value,message){if(!value)throw Error(message);}
function near(actual,expected,message,tolerance=1){assert(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} / ${expected}`);}
async function ready(doc){for(let i=0;i<400&&doc.body?.dataset.appReady!=='true';i++)await pause(25);assert(doc.body?.dataset.appReady==='true','应用未完成初始化');doc.querySelector('#recover-dialog[open] [value="cancel"]')?.click();await pause(100);}
function size(frame,width,height){frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform=`scale(${Math.min(1,1100/width)})`;}
function stroke(win,doc,x=.2,y=.25,endX=.65,endY=.55){
 const canvas=doc.getElementById('painting'),box=canvas.getBoundingClientRect(),capture=canvas.setPointerCapture;canvas.setPointerCapture=()=>{};
 try{for(const [type,px,py,buttons] of [['pointerdown',x,y,1],['pointermove',endX,endY,1],['pointerup',endX,endY,0]])canvas.dispatchEvent(new win.PointerEvent(type,{bubbles:true,pointerId:91,pointerType:'pen',button:0,buttons,clientX:box.x+box.width*px,clientY:box.y+box.height*py}));}finally{canvas.setPointerCapture=capture;}
}
try{
 await ready(direct.contentDocument);
 size(shell,1600,1000);await new Promise(resolve=>{shell.onload=resolve;shell.src='/tablet.html';});
 const shellWindow=shell.contentWindow,frame=shell.contentDocument.getElementById('tablet-frame');
 await ready(frame.contentDocument);
 const app=frame.contentWindow,doc=frame.contentDocument;
 results.push({name:'平板外壳加载完整画板',passed:true});

 const selectors=['.app-header','.workspace','.classic-left','.studio','.tool-rail','#viewport','.tool-dock','.right-panel'];
 for(const selector of selectors){
  const expected=direct.contentDocument.querySelector(selector).getBoundingClientRect(),actual=doc.querySelector(selector).getBoundingClientRect();
  for(const key of ['x','y','width','height'])near(actual[key],expected[key],`scale=1 布局等价 ${selector} ${key}`);
 }
 results.push({name:'scale=1 与桌面直接页面布局等价',passed:true});

 let forwarded;
 app.addEventListener('native-display-result',event=>{forwarded=event.detail;},{once:true});
 shellWindow.dispatchEvent(new shellWindow.CustomEvent('native-display-result',{detail:{width:1180,height:820}}));
 assert(forwarded?.width===1180&&forwarded?.height===820,'原生结果没有转发到内页');
 results.push({name:'原生结果事件转发到内页',passed:true});

 stroke(app,doc);await pause(150);
 const canvas=doc.getElementById('painting'),pixels=canvas.toDataURL(),undo=doc.getElementById('undo');
 assert(!undo.disabled,'测试笔触没有进入撤销历史');
 doc.body.dataset.tabletProbe='preserved';
 const originalDocument=doc,originalWindow=app;

 for(const [width,height] of [[1600,1000],[1180,820],[1024,768],[1366,1024],[1280,800],[1280,720],[900,600],[800,600],[1180,820]]){
  size(shell,width,height);await pause(180);
  const metrics=shellWindow.LUOYETabletMetrics(),box=frame.getBoundingClientRect();
  assert(metrics,'缺少外壳尺寸数据');
  near(metrics.width,width,'外壳测量宽度',.01);near(metrics.height,height,'外壳测量高度',.01);
  near(box.width,width,'缩放后铺满宽度',.05);near(box.height,height,'缩放后铺满高度',.05);
  near(box.left,0,'外壳左侧无留白',.05);near(box.top,0,'外壳顶部无留白',.05);
  assert(app.innerWidth>=1600&&app.innerHeight>=1000,`内页进入小屏视口 ${app.innerWidth}x${app.innerHeight}`);
  near(app.innerWidth,metrics.logicalWidth,'内页逻辑宽度',1);near(app.innerHeight,metrics.logicalHeight,'内页逻辑高度',1);
  assert(metrics.logicalWidth>=1600&&metrics.logicalHeight>=1000,'逻辑视口低于最小契约');
  assert(frame.contentDocument===originalDocument&&frame.contentWindow===originalWindow,'窗口变化重载了内页');
  assert(doc.body.dataset.tabletProbe==='preserved','窗口变化丢失了文档状态');
  assert(!doc.body.hasAttribute('data-mobile-panel'),'平板进入了抽屉布局');
  assert(canvas.toDataURL()===pixels,`窗口变化改变画布像素 ${width}×${height}`);
  assert(!undo.disabled,'窗口变化清空撤销历史');
  results.push({name:`${width}×${height} 铺满且状态连续`,passed:true});
 }

 doc.getElementById('display-open').click();await pause(80);
 const dialog=doc.getElementById('display-dialog');assert(dialog.open,'显示弹窗没有打开');
 const dialogBox=dialog.getBoundingClientRect();assert(dialogBox.left>=0&&dialogBox.top>=0&&dialogBox.right<=app.innerWidth+1&&dialogBox.bottom<=app.innerHeight+1,'弹窗被逻辑视口裁切');
 dialog.close();
 results.push({name:'缩放后的内页弹窗完整可达',passed:true});

 const snapshot=await shellWindow.LUOYEFlushBeforeClose();
 assert(snapshot?.project?.format==='luoye-studio'&&snapshot.project.version===3,'关闭前草稿代理没有返回内页工程');
 results.push({name:'关闭前草稿代理连接内页工程',passed:true});

 const before=canvas.toDataURL();stroke(app,doc,.3,.35,.7,.6);await pause(120);assert(canvas.toDataURL()!==before,'缩放后画布没有响应指针');
 results.push({name:'缩放后画布指针路径可用',passed:true});
}catch(error){results.push({name:'平板弹性视口验收',passed:false,error:error.message});}
document.querySelector('#results').replaceChildren(...results.map(result=>{const item=document.createElement('li');item.textContent=(result.passed?'通过 ':'失败 ')+result.name+(result.error?' — '+result.error:'');return item;}));
const passed=results.filter(result=>result.passed).length;document.querySelector('#summary').textContent=`${passed}/${results.length} 通过`;document.body.dataset.results=JSON.stringify(results);
