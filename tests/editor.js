import { DrawingEngine } from '../src/drawing.js';
import { Recorder, validateRecording } from '../src/recording.js';
import { makeCanvas } from '../src/engine.js';
const editor = new DrawingEngine(document.querySelector('canvas'),()=>{});
const results=[];
const pixel=(canvas,x,y)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function check(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}const r=results.at(-1),li=document.createElement('li');li.textContent=`${r.ok?'PASS':'FAIL'} ${name}${r.error?': '+r.error:''}`;document.querySelector('ol').append(li);}
await check('选区限制笔迹、擦除和倒色，撤销保留像素',()=>{
 editor.reset(32,32);editor.selectShape('rect',{x:8,y:8},{x:24,y:24});
 editor.begin({x:0,y:16},{tool:'pen',color:'#ff0000',size:8,opacity:1,brush:'pencil'});editor.update({x:31,y:16});editor.end();
 assert(pixel(editor.active.canvas,2,16)[3]===0,'笔迹越过选区');assert(pixel(editor.active.canvas,16,16)[0]===255,'选区内无笔迹');
 editor.undo();assert(pixel(editor.active.canvas,16,16)[3]===0,'撤销失败');
 editor.fillAt({x:10,y:10},{color:'#00ff00',background:'#ffffff',opacity:1,fillMode:'all'});
 assert(pixel(editor.active.canvas,0,0)[3]===0,'倒色越界');assert(pixel(editor.active.canvas,16,16)[1]===255,'倒色失败');
});
await check('剪切复制仅包含当前层选区，粘贴透明图并可撤销',()=>{
 editor.copySelection(true);assert(pixel(editor.active.canvas,16,16)[3]===0,'剪切未清除');
 editor.paste();assert(editor.layers.length===2,'粘贴没有新层');assert(editor.active.width===16&&editor.active.height===16,'选区裁切错误');
 editor.undo();editor.undo();assert(pixel(editor.active.canvas,16,16)[1]===255,'剪切撤销失败');
});
await check('图层复制独立像素，翻转、清空可撤销',()=>{
 editor.reset(16,16);editor.active.canvas.getContext('2d').fillRect(0,0,4,4);const original=editor.active;
 editor.duplicateLayer();editor.flipLayer('x');assert(pixel(editor.active.canvas,15,0)[3]===255,'翻转失败');
 assert(pixel(original.canvas,15,0)[3]===0,'副本污染原层');editor.clearPixels();editor.undo();assert(pixel(editor.active.canvas,15,0)[3]===255,'清空撤销失败');
});
await check('合并到最底层保留中间层并支持撤销',()=>{
 editor.reset(16,16);const bottom=editor.active;bottom.canvas.getContext('2d').fillRect(0,0,3,3);
 const middle=editor.addLayer('中间层');editor.addLayer('顶层');editor.active.canvas.getContext('2d').fillRect(12,12,3,3);
 editor.mergeToBottom();assert(editor.layers.length===2&&editor.layers[1]===middle,'没有保留中间层');
 assert(pixel(editor.layers[0].canvas,13,13)[3]===255,'合并丢失顶层');editor.undo();assert(editor.layers.length===3&&editor.layers[0]===bottom,'合并撤销失败');
});
await check('暗房预览不改作品，应用遵守选区且可撤销',()=>{
 editor.reset(16,16);let ctx=editor.active.canvas.getContext('2d');ctx.fillStyle='#102030';ctx.fillRect(0,0,16,16);
 const original=editor.active.canvas.toDataURL();editor.selectShape('rect',{x:0,y:0},{x:8,y:16});
 editor.effectPreview('invert');assert(editor.active.canvas.toDataURL()===original,'预览破坏作品');
 editor.applyDarkroom('invert');assert(eq(pixel(editor.active.canvas,2,2),[239,223,207,255]),'效果错误');
 assert(eq(pixel(editor.active.canvas,12,2),[16,32,48,255]),'效果越界');editor.undo();assert(editor.active.canvas.toDataURL()===original,'撤销错误');
});
await check('魔力棒只选连通区域；区域渐变以拖动方向为轴',()=>{
 editor.reset(16,16);const ctx=editor.active.canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,16,16);ctx.fillStyle='#000000';ctx.fillRect(8,0,1,16);
 editor.magicSelect({x:1,y:1},0);assert(editor.selection[1]===255&&editor.selection[12]===0,'魔力棒穿过边界');
 editor.clearSelection();editor.fillAt({x:0,y:4},{color:'#ff0000',background:'#0000ff',opacity:1,tolerance:0,fillMode:'region-gradient'},{x:8,y:4});
 assert(pixel(editor.active.canvas,1,4)[0]>pixel(editor.active.canvas,6,4)[0],'渐变方向错误');assert(eq(pixel(editor.active.canvas,12,4),[255,255,255,255]),'区域倒色越界');
});
await check('带选区变换的图层保存重开，编辑像素一致',async()=>{
 editor.active.scale=.8;editor.active.rotation=15;const saved=await editor.serialize('完整编辑');const before=editor.active.canvas.toDataURL();
 await editor.restore(saved);assert(editor.active.canvas.toDataURL()===before&&editor.active.rotation===15,'工程往返失败');assert(editor.selection===null,'旧选区没有清理');
});
await check('九类笔具有不同笔迹，随机笔触可重现，直线笔和软橡皮可撤销',()=>{
 const images=new Set();for(const brush of ['pencil','spray','watercolor','brush','marker','crayon','chalk','tube','effect']){editor.reset(64,64);editor.begin({x:8,y:32},{tool:'pen',brush,size:16,ratio:.7,opacity:1,color:'#ff0000',seed:9});editor.update({x:56,y:32});editor.end();images.add(editor.active.canvas.toDataURL());}
 assert(images.size===9,'笔种输出没有差异');
 const draw=()=>{editor.reset(64,64);editor.begin({x:8,y:32},{tool:'pen',brush:'spray',size:16,opacity:1,color:'#ff0000',seed:123});editor.update({x:56,y:32});editor.end();return editor.active.canvas.toDataURL();};assert(draw()===draw(),'随机笔迹不可复现');
 editor.reset(64,64);editor.begin({x:8,y:8},{tool:'pen',brush:'pencil',size:8,opacity:1,color:'#ff0000',strokeMode:'line'});editor.update({x:48,y:48});assert(pixel(editor.active.canvas,32,32)[3]===0,'直线提前写入');editor.end();assert(pixel(editor.active.canvas,32,32)[0]===255,'直线未提交');editor.undo();assert(pixel(editor.active.canvas,32,32)[3]===0,'直线撤销失败');
 editor.active.canvas.getContext('2d').fillRect(0,0,64,64);editor.begin({x:32,y:32},{tool:'eraser',eraserMode:'soft',size:20,opacity:1,color:'#000000'});editor.end();assert(pixel(editor.active.canvas,32,32)[3]>0&&pixel(editor.active.canvas,32,32)[3]<255,'软橡皮没有柔化透明度');editor.undo();assert(pixel(editor.active.canvas,32,32)[3]===255,'软橡皮撤销失败');
 editor.begin({x:8,y:8},{tool:'eraser',eraserMode:'rect',size:8,opacity:1,color:'#000000'});editor.update({x:24,y:24});editor.end();assert(pixel(editor.active.canvas,16,16)[3]===0&&pixel(editor.active.canvas,32,32)[3]===255,'矩形清除范围错误');
});
await check('仿制源快照避免自我污染，连续印章按间距盖画且可撤销',()=>{
 editor.reset(64,32);const ctx=editor.active.canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,8,32);editor.setCloneSource({x:4,y:16});
 editor.begin({x:20,y:16},{tool:'clone',size:6,opacity:1,color:'#000000'});editor.update({x:56,y:16});editor.end();assert(pixel(editor.active.canvas,20,16)[0]===255,'仿制未取源');assert(pixel(editor.active.canvas,52,16)[3]===0,'仿制读到了本次修改');editor.undo();assert(pixel(editor.active.canvas,20,16)[3]===0,'仿制撤销失败');
 const stamp=makeCanvas(4,4);stamp.getContext('2d').fillRect(0,0,4,4);editor.setStampImages([stamp]);editor.begin({x:12,y:8},{tool:'stamp',size:4,opacity:1,stampSpacing:2});editor.update({x:52,y:8});editor.end();assert(pixel(editor.active.canvas,12,8)[3]===255&&pixel(editor.active.canvas,44,8)[3]===255,'连续盖章失败');assert(pixel(editor.active.canvas,16,8)[3]===0,'间距丢失');editor.undo();assert(pixel(editor.active.canvas,12,8)[3]===0,'盖章撤销失败');
});
await check('多边形与 Bezier 可以取消和确认；清空整层不受选区限制',()=>{
 editor.reset(32,32);const o={tool:'polygon',size:2,color:'#ff0000',opacity:1,filled:true};editor.addVertex({x:2,y:2},o);editor.addVertex({x:24,y:2},o);editor.addVertex({x:24,y:24},o);editor.finishPath(true);assert(pixel(editor.active.canvas,20,8)[3]===0,'取消留下像素');
 editor.addVertex({x:2,y:2},o);editor.addVertex({x:24,y:2},o);editor.addVertex({x:24,y:24},o);editor.finishPath();assert(pixel(editor.active.canvas,20,8)[3]===255,'多边形没有填充');
 editor.selectShape('rect',{x:0,y:0},{x:4,y:4});editor.clearLayer();assert(pixel(editor.active.canvas,20,8)[3]===0,'整层清空被选区限制');editor.undo();assert(pixel(editor.active.canvas,20,8)[3]===255,'整层清空撤销失败');
 editor.reset(32,32);const curve=[{x:4,y:24},{x:4,y:4},{x:28,y:4},{x:28,y:24}];for(const point of curve)editor.addVertex(point,{...o,tool:'bezier',filled:false});editor.finishPath();assert(pixel(editor.active.canvas,16,9)[3]>0,'Bezier 曲线未生成');editor.undo();assert(pixel(editor.active.canvas,16,9)[3]===0,'Bezier 撤销失败');
 for(const point of curve)editor.addVertex(point,{...o,tool:'select-bezier'});editor.finishPath();assert(editor.selection[16*32+16]===255&&editor.selection[0]===0,'Bezier 选区错误');
});
await check('五段命令录像重现笔迹、素材、暗房与图层变换，改色不污染原作',async()=>{
 editor.reset(64,64);const rec=new Recorder(editor);await rec.start(0,'录像测试');
 const o={tool:'pen',brush:'spray',color:'#ff0000',size:16,opacity:1,seed:7};editor.begin({x:8,y:12},o);editor.update({x:52,y:12});editor.end();
 const image=makeCanvas(8,8);image.getContext('2d').fillRect(0,0,8,8);editor.addLayer('素材',image);editor.setProperty(editor.active,'x',48);editor.applyDarkroom('invert');
 rec.stop();assert(rec.slots[0].events.length===4,'高层命令重复或漏记');const before=editor.exportPNG(),preview=makeCanvas(64,64);
 await rec.replay(0,4,preview);assert(preview.toDataURL()===before,'命令回放像素不一致');
 await rec.replay(0,4,preview,{color:'#0000ff'});assert(preview.toDataURL()!==before,'当前色播放未生效');assert(editor.exportPNG()===before,'回放污染原作');
 const file=JSON.parse(JSON.stringify(rec.export()));rec.import(file);await rec.replay(0,4,preview);assert(preview.toDataURL()===before,'录像文件往返失败');rec.truncate(0,1);assert(rec.slots[0].events.length===1,'截断无效');
 await rec.start(1,'第二段');editor.begin({x:4,y:4},{...o,brush:'pencil'});editor.end();rec.stop();assert(rec.slots[0].events.length===1&&rec.slots[1].events.length===1,'录像段相互覆盖');
});
await check('非法录像命令与无穷笔尖被拒绝，原作品保持不变',async()=>{
 const rec=new Recorder(new DrawingEngine(makeCanvas(16,16),()=>{}));clearInterval(rec.engine.animationTimer);rec.engine.reset(16,16);await rec.start(0,'安全验证');rec.stop();const raw=rec.export(),before=editor.exportPNG();
 raw.slots[0].events=[{method:'restore',activeId:'x',args:[],time:0}];let rejected=false;try{validateRecording(raw);}catch{rejected=true;}assert(rejected,'可调用任意方法');
 raw.slots[0].events=[{method:'stroke',activeId:'x',args:[[{x:0,y:0}],{tool:'pen',size:1e9}],time:0}];rejected=false;try{validateRecording(raw);}catch{rejected=true;}assert(rejected,'无界笔尖未拒绝');assert(editor.exportPNG()===before,'验证修改了原作');
});
await check('动态仙女袋整笔归层，保留实例动画、选区、撤销和录像引用',async()=>{
 const e=new DrawingEngine(makeCanvas(64,64),()=>{});e.reset(64,64);clearInterval(e.animationTimer);
 const first=makeCanvas(8,8),second=makeCanvas(8,8);first.getContext('2d').fillRect(2,2,4,4);second.getContext('2d').fillRect(0,0,2,2);e.setFairyGroups([{frames:[first,second],frameDuration:10000}], 'dynamic');
 const rec=new Recorder(e);await rec.start(0,'动态盖章');e.begin({x:10,y:16},{tool:'stamp',size:8,opacity:1,stampSpacing:2});e.update({x:30,y:16});e.end();assert(e.layers.length===2&&e.layers[1].sprites.length===2&&e.layers[1].spriteGroups[0].frames.length===2,'动态实例或帧丢失');assert(pixel(e.layers[1].canvas,0,0)[3]===0,'透明区丢失');e.setProperty(e.active,'x',44);rec.stop();
 const output=makeCanvas(64,64);const project=await rec.replay(0,2,output);assert(project.layers.length===2&&project.layers.at(-1).x===44&&project.layers[1].sprites.length===2&&project.layers[1].spriteGroups[0].frames.length===2,'回放图层引用失效');
 e.undo();e.undo();assert(e.layers.length===1,'整次盖章撤销失败');e.begin({x:10,y:16},{tool:'stamp',size:8,opacity:1});e.end(true);assert(e.layers.length===1,'取消留下动画实例');e.selectShape('rect',{x:0,y:0},{x:9,y:64});e.begin({x:10,y:16},{tool:'stamp',size:8,opacity:.5});e.end();assert(e.active.sprites[0].opacity===.5&&pixel(e.active.canvas,8,16)[3]===128&&pixel(e.active.canvas,10,16)[3]===0,'动画盖章未遵守透明度或选区');
});
clearInterval(editor.animationTimer);const count=results.filter(r=>r.ok).length;document.querySelector('#status').textContent=`${count}/${results.length} passed`;document.title=`${count}/${results.length} passed`;
