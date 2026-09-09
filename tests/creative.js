import { makeCanvas } from '../src/engine.js';
import { DrawingEngine } from '../src/drawing.js';
import { Recorder } from '../src/recording.js';
import { renderStyledText } from '../src/text.js';
const results=[];
const assert=(v,m)=>{if(!v)throw new Error(m);};
async function check(name,fn){try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}const r=results.at(-1),li=document.createElement('li');li.textContent=`${r.ok?'PASS':'FAIL'} ${name}${r.error?': '+r.error:''}`;document.querySelector('ol').append(li);}
await check('文字十种样式产生不同输出，组合样式和多行不截断',()=>{
 const spec={text:'Hello\n落叶画板',size:48,font:'sans-serif',color:'#ff0000',background:'#0000ff',antialias:true};const base=renderStyledText(spec);const images=new Set([base.toDataURL()]);for(const key of ['bold','italic','underline','strike','shadow','outline','flipX','flipY','gradient'])images.add(renderStyledText({...spec,[key]:true}).toDataURL());assert(images.size===10,'样式没有生效');
 const hard=renderStyledText({...spec,antialias:false}),a=hard.getContext('2d').getImageData(0,0,hard.width,hard.height).data;assert(a.every((v,i)=>i%4!==3||v===0||v===255),'关闭反走样后仍有部分透明');assert(base.height>100,'多行被裁切');
 const texture=makeCanvas(2,2),ctx=texture.getContext('2d');ctx.fillStyle='#00ff00';ctx.fillRect(0,0,2,2);const patterned=renderStyledText(spec,texture);assert(patterned.toDataURL()!==base.toDataURL(),'纹理文字没有生效');let refused=false;try{renderStyledText({...spec,size:99999});}catch{refused=true;}assert(refused,'无界文字尺寸未拒绝');
});
await check('变形遵守选区，整笔撤销／取消和滤镜录像可重现',async()=>{
 const e=new DrawingEngine(makeCanvas(32,32),()=>{});e.reset(32,32);clearInterval(e.animationTimer);const ctx=e.active.canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(10,0,6,32);const original=e.active.canvas.toDataURL();e.selectShape('rect',{x:0,y:0},{x:32,y:16});const o={tool:'warp',warpKind:'push',radius:12,speed:100};e.begin({x:12,y:8},o);e.update({x:20,y:8});e.end();assert(e.active.canvas.toDataURL()!==original,'变形没有生效');assert(ctx.getImageData(12,24,1,1).data[0]===255,'变形破坏选区外像素');e.undo();assert(e.active.canvas.toDataURL()===original,'撤销失败');e.begin({x:12,y:8},o);e.update({x:22,y:8});e.end(true);assert(e.active.canvas.toDataURL()===original,'取消残留像素');
 const rec=new Recorder(e);await rec.start(0,'变形滤镜');e.begin({x:12,y:8},o);e.update({x:20,y:8});e.end();e.applyBoardFilter('twist',{radius:14,curvature:100});rec.stop();const output=makeCanvas(32,32);await rec.replay(0,2,output);assert(output.toDataURL()===e.exportPNG(),'变形／滤镜录像像素不一致');cancelAnimationFrame(e.renderFrame);
});
await check('图片填充和纸纹笔迹保留透明边缘、选区，并可录制回放',async()=>{
 const e=new DrawingEngine(makeCanvas(32,32),()=>{});e.reset(32,32);clearInterval(e.animationTimer);const t=makeCanvas(2,2),ctx=t.getContext('2d');ctx.fillStyle='#00ff00';ctx.fillRect(0,0,2,2);ctx.clearRect(0,0,1,1);e.setPaintTexture(t);
 e.selectShape('rect',{x:0,y:0},{x:16,y:32});e.fillAt({x:0,y:0},{fillMode:'all',fillSource:'texture',opacity:1,color:'#ff0000'});assert(e.active.canvas.getContext('2d').getImageData(3,3,1,1).data[1]===255,'纹理倒色颜色错误');assert(e.active.canvas.getContext('2d').getImageData(20,3,1,1).data[3]===0,'纹理越过选区');e.undo();e.clearSelection();
 const paper=makeCanvas(2,2);paper.getContext('2d').fillRect(0,0,2,2);e.setPaperTexture(paper);const rec=new Recorder(e);await rec.start(0,'纸纹笔迹');e.begin({x:4,y:16},{tool:'pen',brush:'pencil',size:12,opacity:1,color:'#ff0000',fillSource:'texture',paperGrain:1,seed:1});e.update({x:28,y:16});e.end();rec.stop();const px=e.active.canvas.getContext('2d').getImageData(15,15,1,1).data;assert(px[1]===255&&px[3]<255&&px[3]>0,'笔触没有使用纹理和纸纹');const c=makeCanvas(32,32);await rec.replay(0,1,c);assert(c.toDataURL()===e.exportPNG(),'纹理回放丢失资源');cancelAnimationFrame(e.renderFrame);
});
document.querySelector('#status').textContent=document.title=`${results.filter(r=>r.ok).length}/${results.length} passed`;
