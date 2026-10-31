// Connect a debug Android WebView through an adb-forwarded CDP endpoint, then
// verify the tablet shell, real input, native bridges and resizes without Playwright.
import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const execFile=promisify(execFileCallback),adb=process.env.LUOYE_ANDROID_ADB||'adb',endpoint=process.env.LUOYE_ANDROID_CDP||'http://127.0.0.1:9222';
const root=path.resolve(new URL('..',import.meta.url).pathname),output=path.join(root,'build/android-tablet-acceptance.json');
const results=[],runtimeErrors=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let originalSize,socket,sequence=0;const pending=new Map();
function assert(value,message){if(!value)throw Error(message);}
async function run(name,fn){try{const detail=await fn();results.push({name,passed:true,detail:detail??null});}catch(error){results.push({name,passed:false,error:error.message});}}
async function wmSize(...args){return execFile(adb,['shell','wm','size',...args],{timeout:20000});}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(`${method} 等待超时`));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const response=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);return response.result?.value;}
async function connect(){
 const targets=await fetch(endpoint+'/json/list').then(response=>response.json()),target=targets.filter(item=>item.type==='page'&&item.url.includes('tablet.html')).at(-1);assert(target,'找不到 Android 平板 WebView 页面');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);if(message.error)item.reject(Error(message.error.message));else item.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
 socket.addEventListener('close',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Android WebView 调试连接已断开'));}pending.clear();});
 await send('Runtime.enable');
 await send('Page.bringToFront').catch(()=>{});
}
async function reconnect(){socket?.close();let connected=false;for(let i=0;i<50&&!connected;i++){try{await connect();connected=true;}catch{await wait(100);}}assert(connected,'变窗后无法重新连接 Android WebView');}
async function canvasBox(){return evaluate(`(()=>{const frame=document.getElementById('tablet-frame'),app=frame.contentWindow,outer=frame.getBoundingClientRect(),rect=app.document.getElementById('painting').getBoundingClientRect(),scale=window.LUOYETabletMetrics().scale;return {x:outer.left+rect.left*scale,y:outer.top+rect.top*scale,width:rect.width*scale,height:rect.height*scale};})()`);}
async function mouse(type,x,y,extra={}){await send('Input.dispatchMouseEvent',{type,x,y,...extra});}
async function click(selector){const point=await evaluate(`(()=>{const frame=document.getElementById('tablet-frame'),app=frame.contentWindow,node=app.document.querySelector(${JSON.stringify(selector)});if(!node)return null;const outer=frame.getBoundingClientRect(),rect=node.getBoundingClientRect(),scale=window.LUOYETabletMetrics().scale;return {x:outer.left+(rect.left+rect.width/2)*scale,y:outer.top+(rect.top+rect.height/2)*scale};})()`);assert(point,`找不到可点击控件 ${selector}`);await mouse('mouseMoved',point.x,point.y);await mouse('mousePressed',point.x,point.y,{button:'left',buttons:1,clickCount:1});await mouse('mouseReleased',point.x,point.y,{button:'left',buttons:0,clickCount:1});}
try{
 originalSize=(await wmSize()).stdout.trim();await connect();
 let ready=false;for(let i=0;i<300&&!ready;i++){ready=await evaluate(`Boolean(document.getElementById('tablet-frame')?.contentWindow?.document.body?.dataset.appReady==='true')`).catch(()=>false);if(!ready)await wait(100);}assert(ready,'Android 平板内页未完成初始化');
 await evaluate(`document.getElementById('tablet-frame').contentWindow.document.querySelector('#recover-dialog[open] [value="cancel"]')?.click()`);
 await wait(300);
 await evaluate(`document.getElementById('tablet-frame').contentWindow.document.body.dataset.androidTabletProbe='preserved'`);
 await run('Android 平板横屏且无外壳留白',async()=>{
  const state=await evaluate(`(()=>{const frame=document.getElementById('tablet-frame'),app=frame.contentWindow,rect=frame.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],rect:rect.toJSON(),metrics:window.LUOYETabletMetrics(),logical:[app.innerWidth,app.innerHeight],compact:app.document.body.hasAttribute('data-mobile-panel')};})()`);
  assert(state.viewport[0]>=state.viewport[1],`不是横屏：${state.viewport}`);assert(state.logical[0]>=1600&&state.logical[1]>=1000,'内页进入小屏断点');assert(!state.compact,'进入抽屉布局');assert(Math.abs(state.rect.width-state.viewport[0])<=1&&Math.abs(state.rect.height-state.viewport[1])<=1,'外壳没有完整铺满');return state;
 });
 let after;
 await run('Android WebView 实际输入在缩放画布落笔',async()=>{
  const before=await evaluate(`document.getElementById('tablet-frame').contentWindow.document.getElementById('painting').toDataURL()`),box=await canvasBox(),start={x:box.x+box.width*.2,y:box.y+box.height*.25},end={x:box.x+box.width*.7,y:box.y+box.height*.6};
  await mouse('mouseMoved',start.x,start.y);await mouse('mousePressed',start.x,start.y,{button:'left',buttons:1,clickCount:1});for(let i=1;i<=24;i++)await mouse('mouseMoved',start.x+(end.x-start.x)*i/24,start.y+(end.y-start.y)*i/24,{button:'left',buttons:1});await mouse('mouseReleased',end.x,end.y,{button:'left',buttons:0,clickCount:1});await wait(200);
  after=await evaluate(`document.getElementById('tablet-frame').contentWindow.document.getElementById('painting').toDataURL()`);assert(after!==before,'实际输入没有改变画布像素');return box;
 });
 await run('Android 弹窗通过缩放后的实际点击打开',async()=>{
  await click('#theme-open');await wait(100);const open=await evaluate(`document.getElementById('tablet-frame').contentWindow.document.getElementById('theme-dialog').open`);assert(open,'主题弹窗没有通过实际点击打开');await click('#theme-done');
 });
 await run('Android 显示桥接从 srcdoc 子 frame 往返',async()=>{
  const detail=await evaluate(`(()=>{const app=document.getElementById('tablet-frame').contentWindow;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('显示桥接超时')),10000);app.addEventListener('native-display-result',event=>{clearTimeout(timer);resolve(event.detail);},{once:true});app.webkit.messageHandlers.display.postMessage({action:'fit'});});})()`);
  assert(detail.width>0&&detail.height>0,'显示桥接返回无效尺寸');return detail;
 });
 await run('Android 音乐桥接响应子 frame 状态请求',async()=>{
  const detail=await evaluate(`(()=>{const app=document.getElementById('tablet-frame').contentWindow;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('音乐桥接超时')),10000);app.addEventListener('native-music-result',function handler(event){if(event.detail?.id!=='android-tablet-music')return;clearTimeout(timer);app.removeEventListener('native-music-result',handler);if(event.detail.error)reject(Error(event.detail.error));else resolve(event.detail);});app.webkit.messageHandlers.music.postMessage({id:'android-tablet-music',action:'state'});});})()`);
  assert(detail.state,'音乐桥接没有返回状态');return detail;
 });
 await run('Android 关闭前代理返回内页 v3 工程',async()=>{
  const snapshot=await evaluate(`window.LUOYEFlushBeforeClose()`);assert(snapshot?.project?.format==='luoye-studio'&&snapshot.project.version===3,'关闭代理没有返回 v3 工程');return {layers:snapshot.project.layers.length};
 });
 const initialImage=await execFile(adb,['exec-out','screencap','-p'],{encoding:'buffer',maxBuffer:32*1024*1024,timeout:20000});await writeFile(path.join(root,'build/android-tablet-webview.png'),initialImage.stdout);
 for(const size of ['2000x1200','1600x1000'])await run(`窗口变为 ${size} 时铺满且状态连续`,async()=>{
  await wmSize(size);await wait(700);await reconnect();
  const state=await evaluate(`(()=>{const frame=document.getElementById('tablet-frame'),app=frame.contentWindow,rect=frame.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],rect:rect.toJSON(),logical:[app.innerWidth,app.innerHeight],probe:app.document.body.dataset.androidTabletProbe,pixels:app.document.getElementById('painting').toDataURL()};})()`);
  assert(Math.abs(state.rect.width-state.viewport[0])<=1&&Math.abs(state.rect.height-state.viewport[1])<=1,'变窗后没有铺满');assert(state.logical[0]>=1600&&state.logical[1]>=1000,'变窗后进入小屏');assert(state.probe==='preserved','变窗重载了内页');assert(state.pixels===after,'变窗改变画布像素');const {pixels,...detail}=state;return detail;
 });
 await run('Android 平板没有未处理运行错误',()=>assert(!runtimeErrors.length,runtimeErrors.join('; ')));
 await wmSize('reset');await wait(500);await reconnect();
 const image=await execFile(adb,['exec-out','screencap','-p'],{encoding:'buffer',maxBuffer:32*1024*1024,timeout:20000});await writeFile(path.join(root,'build/android-tablet-resized.png'),image.stdout);
}catch(error){results.push({name:'Android 平板验收执行',passed:false,error:error.message});}finally{if(originalSize)await wmSize('reset').catch(()=>{});socket?.close();await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify({originalSize,passed:results.length>0&&results.every(result=>result.passed),checks:results,runtimeErrors},null,2)+'\n');}
console.log(JSON.stringify({passed:results.length>0&&results.every(result=>result.passed),checks:results},null,2));
if(!results.length||results.some(result=>!result.passed))process.exitCode=1;
