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
await check('辅助对称保持静态贴图位置、方向，并且不复制动态图案', async () => {
 const e = new DrawingEngine(makeCanvas(120,80)); e.reset(120,80); clearInterval(e.animationTimer);
 const stamp = makeCanvas(4,2), sc = stamp.getContext('2d');
 sc.fillStyle='#e34234'; sc.fillRect(0,0,2,2); sc.fillStyle='#3267c7'; sc.fillRect(2,0,2,2);
 e.setStampImages([stamp]);
 const assist={enabled:true,mode:'vertical',centerX:60,centerY:40,stamp:true};
 e.begin({x:20,y:30},{tool:'stamp',size:4,opacity:1,assist});e.end();
 const ctx=e.active.canvas.getContext('2d'),px=(x,y)=>ctx.getImageData(x,y,1,1).data;
 assert(px(19,30)[0]>180&&px(21,30)[2]>120,'原始贴图位置或颜色错误');
 assert(px(99,30)[2]>120&&px(101,30)[0]>180,'镜像贴图位置或方向错误');
 const dynamic = new DrawingEngine(makeCanvas(120,80)); dynamic.reset(120,80); clearInterval(dynamic.animationTimer);
 dynamic.setFairyGroups([{frames:[stamp],frameDuration:160}],'dynamic');
 dynamic.begin({x:20,y:30},{tool:'stamp',size:4,opacity:1,assist});dynamic.end();
 const spriteLayer=dynamic.layers.find(layer=>layer.sprites?.length);
 assert(spriteLayer?.sprites.length===1,'动态贴图不应被辅助功能复制');
 assert(spriteLayer.sprites[0].x===20&&spriteLayer.sprites[0].y===30,'动态图案位置改变');
 clearInterval(dynamic.animationTimer);
});
await check('辅助绘制的线条和图形同时覆盖原始侧与镜像侧', () => {
 const e = new DrawingEngine(makeCanvas(120,80)); e.reset(120,80); clearInterval(e.animationTimer);
 const assist={enabled:true,mode:'vertical',centerX:60,centerY:40,stamp:false};
 e.begin({x:20,y:20},{tool:'pen',brush:'pencil',brushVersion:2,size:8,opacity:1,color:'#e34234',seed:2,assist});e.update({x:30,y:20});e.end();
 const ctx=e.active.canvas.getContext('2d');assert(ctx.getImageData(25,20,1,1).data[3]>0,'原始笔触缺失');assert(ctx.getImageData(95,20,1,1).data[3]>0,'镜像笔触缺失');
 e.begin({x:20,y:50},{tool:'line',size:4,opacity:1,color:'#3267c7',assist});e.update({x:30,y:50});e.end();
 assert(ctx.getImageData(25,50,1,1).data[3]>0&&ctx.getImageData(95,50,1,1).data[3]>0,'镜像图形缺失');
});
await check('纹理笔触的采样位置随镜像笔触一起保留', () => {
 const e = new DrawingEngine(makeCanvas(120,80)); e.reset(120,80); clearInterval(e.animationTimer);
 const texture=makeCanvas(2,1),tc=texture.getContext('2d');tc.fillStyle='#e34234';tc.fillRect(0,0,1,1);tc.fillStyle='#3267c7';tc.fillRect(1,0,1,1);e.setPaintTexture(texture);
 const assist={enabled:true,mode:'vertical',centerX:60,centerY:40,stamp:false};
 e.begin({x:20,y:30},{tool:'pen',brush:'pencil',brushVersion:2,size:8,opacity:1,color:'#ffffff',fillSource:'texture',seed:7,assist});e.update({x:30,y:30});e.end();
 const ctx=e.active.canvas.getContext('2d'),source=ctx.getImageData(25,30,1,1).data,mirror=ctx.getImageData(95,30,1,1).data;
 assert(source[3]>0&&mirror[3]>0,'纹理笔触没有同时落在原始和镜像位置');
 assert((source[0]>source[2])!==(mirror[0]>mirror[2]),'镜像后的纹理采样方向没有保持贴图位置关系');
});
await check('辅助线只存在于编辑预览，不会进入导出图片', () => {
 const e=new DrawingEngine(makeCanvas(120,80));e.reset(120,80);clearInterval(e.animationTimer);
 e.assistConfig={enabled:true,mode:'vertical',centerX:60,centerY:40,showGuides:true,showGrid:false};
 const exported=makeCanvas(120,80),preview=makeCanvas(120,80);e.paint(exported.getContext('2d'),false);e.paint(preview.getContext('2d'),true);
 assert(exported.toDataURL()!==preview.toDataURL(),'编辑预览没有绘制辅助线');
 e.assistConfig.showGuides=false;const withoutGuides=makeCanvas(120,80);e.paint(withoutGuides.getContext('2d'),true);assert(withoutGuides.toDataURL()===exported.toDataURL(),'关闭辅助线仍污染导出画面');
});
document.querySelector('#status').textContent=document.title=`${results.filter(r=>r.ok).length}/${results.length} passed`;
