import {DrawingEngine} from '/src/drawing.js';
import {makeCanvas,loadImage} from '/src/engine.js';
import {Recorder,validateRecording} from '/src/recording.js';
import {MAX_LAYERS} from '/src/core.js';
const checks=[],assert=(v,m)=>{if(!v)throw Error(m);};
async function check(name,fn){const e=new DrawingEngine(makeCanvas(32,32));e.reset(32,32);try{await fn(e);checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.message});}finally{clearInterval(e.animationTimer);}}
const fill=e=>{const c=e.active.canvas.getContext('2d');c.fillStyle='#dd3300';c.fillRect(0,0,32,32);e.changed();};
const rgb=(e,x,y)=>{const c=makeCanvas(e.width,e.height);e.paint(c.getContext('2d'));return [...c.getContext('2d').getImageData(x,y,1,1).data];};
await check('镜像与旋转录像导出、导入、回放保持画面',async e=>{
 e.active.canvas.getContext('2d').fillRect(2,3,8,5);const r=new Recorder(e);await r.start(0,'镜像');e.setProperty(e.active,'flipX',true);e.setProperty(e.active,'flipY',true);e.setProperty(e.active,'rotation',90);r.stop();r.import(JSON.parse(JSON.stringify(r.export())));const c=makeCanvas(32,32);await r.replay(0,3,c);assert(c.toDataURL()===e.exportPNG(),'回放改变画面');
 const raw=r.export();raw.slots[0].events[0].args[2]=1;let rejected=false;try{validateRecording(raw);}catch{rejected=true;}assert(rejected,'镜像属性必须是布尔值');
});
await check('录像遵守当前 200 层容量而非旧 20 层限制',async e=>{
 const r=new Recorder(e);await r.start(0,'层容量');r.stop();const raw=r.export(),id=e.activeId,png=e.active.canvas.toDataURL();
 raw.slots[0].events=[{method:'addLayer',activeId:id,time:0,args:['层',{width:32,height:32,image:png},true,{insertAt:MAX_LAYERS-1,flipX:true}]}];validateRecording(raw);
 raw.slots[0].events[0].args[3].insertAt=MAX_LAYERS;let rejected=false;try{validateRecording(raw);}catch{rejected=true;}assert(rejected,'没有限制图层位置');
});
await check('镜像图层上的矩形橡皮擦除鼠标框住的位置',e=>{
 fill(e);e.setProperty(e.active,'flipX',true);e.setProperty(e.active,'flipY',true);e.paperMode=true;e.begin({x:1,y:2},{tool:'eraser',eraserMode:'rect',size:12,opacity:1});e.update({x:10,y:12});e.end();assert(rgb(e,5,6)[0]===255&&rgb(e,26,26)[0]===221,'擦除到了镜像另一侧');e.undo();assert(rgb(e,5,6)[0]===221,'撤销未恢复');
});
await check('镜像图层上的选区限制绘画和擦除',e=>{
 fill(e);e.setProperty(e.active,'flipX',true);e.setProperty(e.active,'flipY',true);e.selectShape('rect',{x:1,y:2},{x:10,y:12});e.clearPixels();assert(rgb(e,5,6)[0]===255&&rgb(e,26,26)[0]===221,'选区映射错误');
});
await check('合并镜像底层不重复镜像，撤销保留变换',e=>{
 e.active.canvas.getContext('2d').fillRect(1,2,5,7);e.setProperty(e.active,'flipX',true);e.addLayer('顶层');e.active.canvas.getContext('2d').fillRect(8,10,6,3);e.changed();const before=e.exportPNG();e.mergeToBottom();assert(e.exportPNG()===before,'合并发生重复镜像');e.undo();assert(e.layers[0].flipX===true&&e.exportPNG()===before,'撤销失去镜像');
});
await check('组合魔法袋从中途开始录制仍接着当前图案回放',async e=>{
 const frames=['red','green','blue'].map(color=>{const c=makeCanvas(4,4);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,4,4);return c;});e.setFairyGroups(frames.map(c=>({frames:[c],frameDuration:160})),'static');
 const options={tool:'stamp',size:4,opacity:1,stampSpacing:1};e.begin({x:5,y:5},options);e.end();const r=new Recorder(e);await r.start(0,'连续组合');e.begin({x:15,y:15},options);e.end();r.stop();const c=makeCanvas(32,32);await r.replay(0,1,c);assert(c.toDataURL()===e.exportPNG(),'录像从第一个组合重新开始');
 await r.start(1,'切换工具');e.resetStampProgress();e.begin({x:25,y:25},options);e.end();r.stop();await r.replay(1,r.slots[1].events.length,c);assert(c.toDataURL()===e.exportPNG(),'录像没有重现工具切换后的组合重置');
});
await check('镜像图层应用暗房后保持位置和方向',e=>{
 e.active.canvas.getContext('2d').fillRect(1,2,5,7);e.setProperty(e.active,'flipX',true);e.paperMode=true;const before=e.exportPNG();e.applyDarkroom('brightness',{brightness:0,contrast:0});assert(e.exportPNG()===before,'暗房重复应用了镜像');e.undo();assert(e.exportPNG()===before,'撤销改变镜像图层');
});
await check('镜像动态图案的暗房选区和滤镜命中可见位置',e=>{
 const frame=makeCanvas(4,4);frame.getContext('2d').fillStyle='#223344';frame.getContext('2d').fillRect(0,0,4,4);e.addLayer('动态印章',makeCanvas(32,32),true,{sprites:[{x:5,y:5,size:4,opacity:1,group:0}],spriteGroups:[{frames:[frame],frameDuration:160}],flipX:true});e.paperMode=true;e.selectShape('rect',{x:23,y:1},{x:31,y:9});e.applyDarkroom('invert');assert(rgb(e,27,5).slice(0,3).join()==='221,204,187','镜像后选区没有作用于动态图案');e.undo();e.clearSelection();e.applyBoardFilter('point-light',{x:27,y:5,radius:4,density:100});assert(rgb(e,27,5)[0]>200,'滤镜没有命中镜像后的位置');
});
await check('透明图层导出包含当前动画帧和擦除结果',async e=>{
 const red=makeCanvas(32,32),blue=makeCanvas(32,32);red.getContext('2d').fillStyle='red';red.getContext('2d').fillRect(0,0,32,32);blue.getContext('2d').fillStyle='blue';blue.getContext('2d').fillRect(0,0,32,32);e.addLayer('动画',red,true,{frames:[red,blue],frameDuration:160});e.playing=false;e.animationTime=170;e.paperMode=true;e.begin({x:1,y:2},{tool:'eraser',eraserMode:'rect',size:12,opacity:1});e.update({x:10,y:12});e.end();
 const c=makeCanvas(32,32);c.getContext('2d').drawImage(await loadImage(e.exportLayerPNG()),0,0);const pixel=(x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];assert(pixel(5,6)[3]===0,'导出恢复了擦除像素');assert(pixel(20,20)[2]===255,'导出不是当前动画帧');
});
document.getElementById('result').textContent=JSON.stringify({passed:checks.every(c=>c.passed),checks},null,2);
