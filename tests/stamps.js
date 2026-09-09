import {makeCanvas} from '../src/engine.js';
import {DrawingEngine} from '../src/drawing.js';
import {Recorder,validateRecording} from '../src/recording.js';
const results=[],assert=(v,m)=>{if(!v)throw Error(m);};
async function check(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}const r=results.at(-1),li=document.createElement('li');li.textContent=`${r.ok?'PASS':'FAIL'} ${name}: ${r.error||''}`;document.querySelector('ol').append(li);}
const engine=()=>{const e=new DrawingEngine(makeCanvas(128,128));e.reset(128,128);clearInterval(e.animationTimer);return e;};
const groups=['#dd0000','#008800','#0000dd'].map(color=>{const c=makeCanvas(12,18);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,12,18);return {width:12,height:18,frames:[c],frameDuration:160};});
await check('随机花色与角度使用录制种子，导出导入后精确回放',async()=>{
 const e=engine(),r=new Recorder(e);e.setFairyGroups(groups,'static',{randomOrder:true,rotation:20});
 await r.start(0,'随机扑克牌');e.begin({x:20,y:25},{tool:'stamp',size:24,opacity:1,seed:42});e.update({x:100,y:100});e.end();
 e.setFairyGroups(groups,'static',{randomOrder:true,rotation:12});e.begin({x:30,y:90},{tool:'stamp',size:28,opacity:.8,seed:172});e.end();r.stop();
 r.slots=validateRecording(JSON.parse(JSON.stringify({format:'luoye-recording',version:1,slots:r.slots}))).slots;
 const output=makeCanvas(128,128);await r.replay(0,Infinity,output);assert(output.toDataURL()===e.exportPNG(),'随机回放像素不同');
 e.setStampImages(groups.map(g=>g.frames[0]));assert(!e.fairyBehavior,'普通印章残留随机行为');
});
await check('旋转印章不越过选区，撤销、重做和取消保留像素',()=>{
 const e=engine();e.setFairyGroups(groups,'static',{randomOrder:true,rotation:45});e.selectShape('rect',{x:0,y:0},{x:64,y:128});
 const before=e.exportPNG(),paint=()=>{e.begin({x:50,y:20},{tool:'stamp',size:40,opacity:1,seed:4});e.update({x:80,y:100});};
 paint();e.end();const after=e.exportPNG(),pixels=e.active.canvas.getContext('2d').getImageData(64,0,64,128).data;
 assert(pixels.every((v,i)=>i%4!==3||v===0),'印章越过选区');assert(after!==before,'印章未落笔');e.undo();assert(e.exportPNG()===before,'撤销失败');e.redo();assert(e.exportPNG()===after,'重做失败');paint();e.end(true);assert(e.exportPNG()===after,'取消留下痕迹');
});
await check('删除选区录像保留整张画纸上的可编辑内容语义',async()=>{
 const e=engine();e.paperMode=true;e.active.canvas.getContext('2d').fillRect(5,5,80,80);e.addLayer('空图层');e.selectShape('rect',{x:0,y:0},{x:50,y:50});const r=new Recorder(e);await r.start(0,'圈选删除');e.deleteSelection();r.stop();const output=makeCanvas(128,128);await r.replay(0,Infinity,output);assert(output.toDataURL()===e.exportPNG(),'删除回放不同');
});
document.querySelector('#status').textContent=document.title=`${results.filter(r=>r.ok).length}/${results.length} passed`;
