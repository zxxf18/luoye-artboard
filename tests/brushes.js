import { makeCanvas } from '../src/engine.js';
import { DrawingEngine } from '../src/drawing.js';
import { Recorder } from '../src/recording.js';
const entries=[['pencil','铅笔'],['spray','喷笔'],['watercolor','水彩'],['brush','刷子'],['marker','麦克笔'],['crayon','蜡笔'],['chalk','粉笔'],['tube','颜料管'],['effect','星光笔'],['rainbow','彩虹笔'],['duotone','双色渐变']];
const stats={},results=[];const assert=(v,m)=>{if(!v)throw new Error(m);};
const make=()=>{const e=new DrawingEngine(makeCanvas(280,120),()=>{});e.reset(280,120);clearInterval(e.animationTimer);return e;};
function draw(e,brush,version=2){const o={tool:'pen',brush,brushVersion:version,size:32,color:'#2877c9',opacity:1,seed:719};e.begin({x:25,y:65},o);for(let x=29;x<=250;x+=4)e.update({x,y:60+Math.sin((x-25)/225*Math.PI*2)*22});e.end();cancelAnimationFrame(e.renderFrame);}
for(const [key,name] of entries){const e=make();draw(e,key);const c=e.active.canvas;const data=c.getContext('2d').getImageData(0,0,280,120).data;let area=0,sum=0,peak=0,highlights=0;for(let i=0;i<data.length;i+=4){if(data[i+3]){area++;sum+=data[i+3];peak=Math.max(peak,data[i+3]);if(data[i]>140&&data[i+1]>140&&data[i+2]>180)highlights++;}}stats[key]={area,mean:sum/area,peak,highlights,png:c.toDataURL()};const f=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=name;f.append(caption,c);document.querySelector('#samples').append(f);}
async function check(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}const li=document.createElement('li'),r=results.at(-1);li.textContent=(r.ok?'PASS ':'FAIL ')+name+(r.error?' — '+r.error:'');document.querySelector('#results').append(li);}
await check('笔触有可量化差异：细铅笔、透明水彩、浓墨麦克笔、颜料高光',()=>{assert(stats.pencil.area<stats.marker.area*.7,'铅笔和麦克笔粗细缺少区别');assert(stats.watercolor.mean<stats.marker.mean*.7,'水彩没有明显透明感');assert(stats.tube.highlights>100,'颜料管缺少立体高光');assert(new Set(Object.values(stats).map(v=>v.png)).size===11,'有重复笔触');});
await check('新笔触可复现，整笔撤销／取消不留痕',()=>{for(const [key] of entries){const e=make();draw(e,key);assert(e.active.canvas.toDataURL()===stats[key].png,key+' 随机笔触无法复现');e.undo();const blank=e.active.canvas.toDataURL();e.begin({x:20,y:60},{tool:'pen',brush:key,brushVersion:2,size:32,color:'#2877c9',opacity:1,seed:719});e.update({x:240,y:60});e.end(true);assert(e.active.canvas.toDataURL()===blank,key+' 取消残留');cancelAnimationFrame(e.renderFrame);}});
await check('新旧笔刷录像分别保留原有输出',async()=>{for(const version of [1,2]){const e=make(),rec=new Recorder(e);await rec.start(0,'笔触版本');draw(e,'watercolor',version);rec.stop();if(version===1)delete rec.slots[0].events[0].args[1].brushVersion;const canvas=makeCanvas(280,120);await rec.replay(0,1,canvas);const expected=makeCanvas(e.width,e.height);e.paint(expected.getContext('2d'));const a=expected.getContext('2d').getImageData(0,0,e.width,e.height).data,b=canvas.getContext('2d').getImageData(0,0,e.width,e.height).data;let different=0,max=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])different++;max=Math.max(max,Math.abs(a[i]-b[i]));}assert(!different,'笔刷版本 '+version+' 回放改变 '+different+' 通道，最大差 '+max);}});
document.title=document.querySelector('#status').textContent=`${results.filter(r=>r.ok).length}/${results.length} passed`;

// —— 连续性专项：稀疏快速采样下，笔迹必须连接成线而不是离散的点 ——
await check('十一种画笔快速拖动不断线',()=>{
  for(const [key] of entries){
    const e=make();const o={tool:'pen',brush:key,brushVersion:2,size:36,color:'#2877c9',opacity:1,seed:991,ratio:1};
    e.begin({x:20,y:60},o);for(let x=56;x<=252;x+=36)e.update({x,y:60});e.end();cancelAnimationFrame(e.renderFrame);
    const data=e.active.canvas.getContext('2d').getImageData(0,0,280,120).data;
    const inked=x=>{for(let dy=-8;dy<=8;dy++){const i=((60+dy)*280+Math.round(x))*4;if(data[i+3]>8)return true;}return false;};
    for(let x=38;x<252;x+=36)assert(inked(x),key+' 快速拖动在采样点之间留下断点（x='+x+'）');
  }
});
await check('宽幅渐变笔在十六轴对称下快速拖动不断线',()=>{
  const e=make();const o={tool:'pen',brush:'rainbow',brushVersion:2,size:80,color:'#2877c9',opacity:1,seed:5,ratio:1,assist:{enabled:true,mode:'radial',axes:16}};
  e.begin({x:16,y:60},o);for(let x=46;x<=250;x+=30)e.update({x,y:60});e.end();cancelAnimationFrame(e.renderFrame);
  const data=e.active.canvas.getContext('2d').getImageData(0,0,280,120).data;
  for(let x=31;x<250;x+=30){let inked=false;for(let dy=-20;dy<=20;dy++){const i=((60+dy)*280+Math.round(x))*4;if(data[i+3]>8){inked=true;break;}}assert(inked,'彩虹笔对称辅助下中点断线（x='+x+'）');}
});
await check('纸面橡皮快速拖动整段擦净不留残墨',()=>{
  for(const mode of ['hard','soft']){
    const e=make();e.paperMode=true;const ctx=e.active.canvas.getContext('2d');ctx.fillStyle='#33479c';ctx.fillRect(0,0,280,120);
    e.begin({x:20,y:60},{tool:'eraser',eraserMode:mode,size:40,color:'#000000',opacity:1,ratio:1});
    for(let x=60;x<=258;x+=39)e.update({x,y:60});e.end();cancelAnimationFrame(e.renderFrame);
    const data=e.active.canvas.getContext('2d').getImageData(0,0,280,120).data;
    for(let x=40;x<258;x+=39)for(const dy of [-8,0,8]){const i=((60+dy)*280+Math.round(x))*4;assert(data[i+3]<200,mode+' 橡皮在采样点之间留下残墨（x='+x+'）');}
  }
});
await check('刮刮画粗笔快速拖动保持连续',()=>{
  const e=make();const ctx=e.active.canvas.getContext('2d');ctx.fillStyle='#c99559';ctx.fillRect(0,0,280,120);
  e.begin({x:20,y:60},{tool:'scratch',size:48,color:'#000000',opacity:1,ratio:1});
  for(let x=64;x<=254;x+=43)e.update({x,y:60});e.end();cancelAnimationFrame(e.renderFrame);
  const data=e.active.canvas.getContext('2d').getImageData(0,0,280,120).data;
  for(let x=42;x<254;x+=43)for(const dy of [-10,0,10]){const i=((60+dy)*280+Math.round(x))*4;assert(data[i+3]<40,'刮刮画快速拖动在采样点之间留下未刮开区域（x='+x+'）');}
});
