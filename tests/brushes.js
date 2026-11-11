import { makeCanvas } from '../src/core/engine.js';
import { BRUSHES, DEFAULT_BRUSH_SIZE } from '../src/core/brushes.js';
import { DrawingEngine } from '../src/core/drawing.js';
import { Recorder } from '../src/ui/recording.js';
const entries=[['pencil','铅笔'],['spray','喷笔'],['watercolor','水彩'],['brush','刷子'],['marker','麦克笔'],['crayon','蜡笔'],['chalk','粉笔'],['tube','颜料管'],['effect','星光笔'],['rainbow','彩虹笔'],['duotone','双色渐变']];
const stats={},results=[];const assert=(v,m)=>{if(!v)throw new Error(m);};
const make=()=>{const e=new DrawingEngine(makeCanvas(280,120),()=>{});e.reset(280,120);clearInterval(e.animationTimer);return e;};
function draw(e,brush){const o={tool:'pen',brush,size:32,color:'#2877c9',opacity:1,seed:719};e.begin({x:25,y:65},o);for(let x=29;x<=250;x+=4)e.update({x,y:60+Math.sin((x-25)/225*Math.PI*2)*22});e.end();cancelAnimationFrame(e.renderFrame);}
for(const [key,name] of entries){const e=make();draw(e,key);const c=e.active.canvas;const data=c.getContext('2d').getImageData(0,0,280,120).data;let area=0,sum=0,peak=0,highlights=0;for(let i=0;i<data.length;i+=4){if(data[i+3]){area++;sum+=data[i+3];peak=Math.max(peak,data[i+3]);if(data[i]>140&&data[i+1]>140&&data[i+2]>180)highlights++;}}stats[key]={area,mean:sum/area,peak,highlights,png:c.toDataURL()};const f=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=name;f.append(caption,c);document.querySelector('#samples').append(f);}
async function check(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}const li=document.createElement('li'),r=results.at(-1);li.textContent=(r.ok?'PASS ':'FAIL ')+name+(r.error?' — '+r.error:'');document.querySelector('#results').append(li);}
await check('笔触有可量化差异：细铅笔、透明水彩、浓墨麦克笔、颜料高光',()=>{assert(stats.pencil.area<stats.marker.area*.7,'铅笔和麦克笔粗细缺少区别');assert(stats.watercolor.mean<stats.marker.mean*.7,'水彩没有明显透明感');assert(stats.tube.highlights>100,'颜料管缺少立体高光');assert(new Set(Object.values(stats).map(v=>v.png)).size===11,'有重复笔触');});
await check('新笔触可复现，整笔撤销／取消不留痕',()=>{for(const [key] of entries){const e=make();draw(e,key);assert(e.active.canvas.toDataURL()===stats[key].png,key+' 随机笔触无法复现');e.undo();const blank=e.active.canvas.toDataURL();e.begin({x:20,y:60},{tool:'pen',brush:key,brushVersion:2,size:32,color:'#2877c9',opacity:1,seed:719});e.update({x:240,y:60});e.end(true);assert(e.active.canvas.toDataURL()===blank,key+' 取消残留');cancelAnimationFrame(e.renderFrame);}});
await check('录像重放与原笔触逐通道一致',async()=>{const e=make(),rec=new Recorder(e);await rec.start(0,'笔触回放');draw(e,'watercolor');rec.stop();const canvas=makeCanvas(280,120);await rec.replay(0,1,canvas);const expected=makeCanvas(e.width,e.height);e.paint(expected.getContext('2d'));const a=expected.getContext('2d').getImageData(0,0,e.width,e.height).data,b=canvas.getContext('2d').getImageData(0,0,e.width,e.height).data;let different=0,max=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])different++;max=Math.max(max,Math.abs(a[i]-b[i]));}assert(!different,'回放改变 '+different+' 通道，最大差 '+max);});

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
    const composited=makeCanvas(280,120).getContext('2d');e.drawLayer(composited,e.active);
    const data=composited.getImageData(0,0,280,120).data;
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

await check('十一种画笔的最细、默认、中等和最粗笔尖都能绘制并撤销、重做', () => {
  const e = make();
  e.reset(400, 320);
  e.render = () => {};
  const canvas = e.active.canvas, ctx = canvas.getContext('2d'), blank = canvas.toDataURL();
  const points = Array.from({ length: 14 }, (_, index) => ({
    x: 72 + 12 * index,
    y: 112 + Math.sin(index * .37) * 40,
  }));
  for (const brush of BRUSHES) for (const size of [2, DEFAULT_BRUSH_SIZE, 150, 300]) for (const axes of [1, 16]) {
    const name = `${brush.id}/${size}/${axes}`;
    e.begin(points[0], { tool: 'pen', brush: brush.id, size, color: brush.color, secondaryColor: '#9448b0',
      opacity: .8, ratio: 1, seed: 719, assist: { enabled: axes > 1, mode: 'radial', axes } });
    for (const point of points.slice(1)) e.update(point);
    e.end();
    assert(ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0),
      `${name} 没有留下笔迹`);
    const drawing = canvas.toDataURL();
    e.undo();
    assert(canvas.toDataURL() === blank, `${name} 撤销有残留`);
    e.redo();
    assert(canvas.toDataURL() === drawing, `${name} 重做改变笔迹`);
    e.undo();
  }
  cancelAnimationFrame(e.renderFrame);
  clearTimeout(e.renderDeadline);
});

await check('多轴水彩只生成一个笔尖渐变，窄宽比、透明度和对称中心仍生效', () => {
  const e = make();
  const prototype = CanvasRenderingContext2D.prototype, createGradient = prototype.createRadialGradient;
  let gradients = 0;
  prototype.createRadialGradient = function (...args) {
    gradients++;
    return createGradient.apply(this, args);
  };
  try {
    for (const ratio of [.15, 1, 2]) {
      const canvas = e.active.canvas;
      const ctx = canvas.getContext('2d');
      gradients = 0;
      e.begin({ x: 83, y: 60 }, { tool: 'pen', brush: 'watercolor', size: 16, color: '#2877c9',
        opacity: .65, ratio, assist: { enabled: true, mode: 'radial', axes: 16 } });
      e.update({ x: 56, y: 60 });
      e.update({ x: 32, y: 60 });
      e.end();
      assert(gradients === 1, `宽窄比 ${ratio} 创建了 ${gradients} 个渐变`);
      const alpha = x => ctx.getImageData(x, 60, 1, 1).data[3];
      assert(alpha(64) > 0 && alpha(215) > 0 && alpha(64) < 200 && alpha(140) === 0, `宽窄比 ${ratio} 的水彩透明度或轴心错误`);
      e.undo();
    }
  } finally {
    prototype.createRadialGradient = createGradient;
    cancelAnimationFrame(e.renderFrame);
    clearTimeout(e.renderDeadline);
  }
});

await check('对称轴重叠后，粒子笔的独立随机状态仍可复现', () => {
  const e = make();
  const canvas = e.active.canvas, blank = canvas.toDataURL();
  const points = [
    { x: 140, y: 60 }, { x: 140, y: 45 }, { x: 140, y: 25 },
    { x: 151, y: 28 }, { x: 165, y: 33 }, { x: 182, y: 40 }, { x: 210, y: 50 },
  ];
  function stroke(brush, cancel = false) {
    e.begin(points[0], { tool: 'pen', brush, size: 16, color: '#2877c9', opacity: .7, ratio: 1, seed: 126,
      assist: { enabled: true, mode: 'four' } });
    for (const point of points.slice(1)) e.update(point);
    e.end(cancel);
  }
  for (const brush of ['spray', 'crayon', 'chalk']) {
    stroke(brush);
    const drawing = canvas.toDataURL();
    assert(drawing !== blank, `${brush} 没有留下笔迹`);
    e.undo();
    stroke(brush, true);
    assert(canvas.toDataURL() === blank, `${brush} 取消有残留`);
    stroke(brush);
    assert(canvas.toDataURL() === drawing, `${brush} 对称轴重叠后笔迹不可复现`);
    e.undo();
  }
  cancelAnimationFrame(e.renderFrame);
  clearTimeout(e.renderDeadline);
});

document.title=document.querySelector('#status').textContent=`${results.filter(r=>r.ok).length}/${results.length} passed`;
