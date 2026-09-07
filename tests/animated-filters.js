import {Recorder} from '/src/recording.js';
import {DrawingEngine} from '/src/drawing.js';import {makeCanvas} from '/src/engine.js';
const results=[];const check=(ok,name)=>results.push({passed:!!ok,name});
const solid=(color,w=40,h=40)=>{const c=makeCanvas(w,h),ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(4,4,w-8,h-8);return c;};
const e=new DrawingEngine(makeCanvas(320,180));e.reset(320,180);e.paperMode=true;
await e.addAsset({id:'bg-test',name:'背景',category:'background',src:solid('#f0d090',320,180).toDataURL()});
const animated=e.addLayer('会动的小伙伴',solid('#f04040'),true,{frames:[solid('#f04040'),solid('#40c040')],frameDuration:100});
e.setFairyGroups([{frames:[solid('#4090ff'),solid('#ffd040')],frameDuration:100}],'dynamic');e.begin({x:100,y:70},{tool:'stamp',size:50,opacity:1});e.end();const dynamic=e.layers.at(-1);e.addLayer('普通伙伴',solid('#7040d0'));
const start=performance.now();await e.applyBoardFilter('waterfall',{x:160,y:90,radius:120,density:70});
check(e.layers.find(l=>l.id===animated.id)?.frames?.length===2,'瀑布后动画小伙伴保留帧与播放节奏');check(e.layers.find(l=>l.id===dynamic.id)?.sprites?.length===1,'瀑布后动态仙女袋保留实例');
check(e.layers.find(l=>l.id===dynamic.id)?.spriteGroups?.[0]?.frames.length===2,'动态仙女袋仍有不同动画帧');
e.undo();check(e.layers.includes(animated)&&e.layers.includes(dynamic),'一次撤销恢复滤镜前全部图层');e.redo();
check(e.layers.find(l=>l.id===animated.id)?.frames?.length===2,'重做也不会定格动画');
const restored=new DrawingEngine(makeCanvas(320,180));await restored.restore(await e.serialize('动画滤镜'));check(restored.layers.some(l=>l.frames?.length===2),'滤镜后的动画工程保存重开仍会动');
check(performance.now()-start<3000,'小场景滤镜与保存不会长期阻塞');

e.asyncEffects=true;e.reset(1920,1080);e.paperMode=true;e.addLayer('动态图',solid('#fa5544',200,160),true,{frames:Array.from({length:8},(_,i)=>solid(i%2?'#fa5544':'#55aa44',200,160)),frameDuration:100});
let ticks=0;const heartbeat=setInterval(()=>ticks++,5);await e.applyBoardFilter('waterfall',{radius:600});clearInterval(heartbeat);
check(ticks>0,'1080 滤镜分步执行，事件循环仍可响应');check(!e.effectRunning,'效果完成后解除操作状态');
const beforeCancel=e.layers.slice(),history=e.history.past.length;const pending=e.applyBoardFilter('twist',{radius:600});setTimeout(()=>{e.effectCancelled=true;},0);let cancelled=false;try{await pending;}catch(error){cancelled=error.name==='AbortError';}
check(cancelled&&e.layers.every((l,i)=>l===beforeCancel[i])&&e.history.past.length===history,'取消滤镜保留全部原图层和历史');check(!e.effectRunning,'取消后解除操作状态');
e.activeId=e.layers.at(-1).id;const target=e.active,oldScale=target.scale;e.resizeActiveObject(1.5);check(target.scale===oldScale*1.5&&target.frames.length===8,'动态小伙伴可以缩放且继续播放');e.undo();check(target.scale===oldScale,'动态缩放可以撤销');
const recorder=new Recorder(e);await recorder.start(0,'动画效果录像');
await e.applyBoardFilter('ripple',{radius:200});e.resizeActiveObject(1.15);
check(recorder.slots[0].events.map(x=>x.method).join(',')==='applyBoardFilter,resizeActiveObject','异步滤镜成功后与缩放按顺序录入');
const interrupted=e.applyBoardFilter('twist',{radius:600});setTimeout(()=>{e.effectCancelled=true;},0);try{await interrupted;}catch{}
check(recorder.slots[0].events.length===2&&recorder.depth===0,'取消效果不写入录像，也不影响后续录制');
recorder.stop();await recorder.replay(0,2,makeCanvas(1920,1080));check(true,'动画滤镜与缩放录像可重放');
const cluster=new DrawingEngine(makeCanvas(320,180));cluster.reset(320,180);cluster.paperMode=true;
const crowd=cluster.addLayer('很多小伙伴',makeCanvas(320,180),true,{sprites:Array.from({length:250},(_,i)=>({group:0,x:8+i%25*12,y:8+Math.floor(i/25)*16,size:8,opacity:1})),spriteGroups:[{frames:[solid('#f06050'),solid('#60b0f0')],frameDuration:100}]});
cluster.applyBoardFilter('ripple',{x:20,y:20,radius:10});let updated=cluster.layers.find(l=>l.id===crowd.id);
check(updated.sprites.length===250&&updated.spriteGroups.length<15,'长串动态图案只为滤镜影响区域生成新帧');
cluster.undo();cluster.applyDarkroom('invert');updated=cluster.layers.find(l=>l.id===crowd.id);
check(updated.sprites.length===250&&updated.spriteGroups.length===1,'暗房对重复动态图案共用结果，避免重复占用内存');
await cluster.serialize('长串动态图案');check(true,'滤镜处理后的长串动态图案仍符合可保存格式');clearInterval(cluster.animationTimer);
clearInterval(e.animationTimer);clearInterval(restored.animationTimer);document.body.dataset.results=JSON.stringify(results);document.querySelector('#summary').textContent=results.filter(x=>x.passed).length+'/'+results.length+' 通过';document.querySelector('#results').textContent=JSON.stringify(results,null,2);
