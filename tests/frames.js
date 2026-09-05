import { DrawingEngine } from '/src/drawing.js';
import { makeCanvas } from '/src/engine.js';
const results=[];
const check=(ok,name)=>{results.push({ok:!!ok,name});};
const e=new DrawingEngine(makeCanvas(160,90));e.reset(160,90);e.paperMode=true;
const frame=makeCanvas(120,90),fc=frame.getContext('2d');fc.fillStyle='#e84040';fc.fillRect(0,0,120,90);fc.clearRect(8,8,104,74);
for(const [w,h] of [[160,90],[90,160],[120,120]]){
 e.reset(w,h);const l=await e.addAsset({id:'test-frame',category:'frame',name:'相框',src:frame.toDataURL()});
 check(l.width*l.scale===w&&l.height*l.scale===h,`${w}×${h} 相框四边贴合画纸`);
 const out=makeCanvas(w,h);e.paint(out.getContext('2d'));const rgb=(x,y)=>out.getContext('2d').getImageData(x,y,1,1).data;
 check(rgb(1,h/2)[0]>200&&rgb(1,h/2)[1]<100&&rgb(w-2,h/2)[1]<100,`${w}×${h} 左右相框完整`);
 check(rgb(w/2,h/2)[0]===255&&rgb(w/2,h/2)[1]===255,`${w}×${h} 相框中央透明`);
 e.undo();check(!e.layers.includes(l),`${w}×${h} 相框可撤销`);e.redo();check(e.layers.includes(l),`${w}×${h} 相框可重做`);
}
e.reset(160,90);const sprite=makeCanvas(20,20);sprite.getContext('2d').fillRect(0,0,20,20);e.setFairyGroups([{frames:[sprite,sprite],frameDuration:100}], 'dynamic');e.stampPreview={point:{x:80,y:45},size:30};
const preview=makeCanvas(160,90),ctx=preview.getContext('2d');let boxes=0;const original=ctx.strokeRect.bind(ctx);ctx.strokeRect=(...args)=>{boxes++;original(...args);};
e.paint(ctx,true);check(boxes===0,'动态仙女袋悬停没有虚线框');
e.begin({x:80,y:45},{tool:'stamp',size:30,opacity:1});e.update({x:110,y:45});boxes=0;e.paint(ctx,true);check(boxes===0,'动态仙女袋拖动没有虚线框');e.end();
check(e.layers.some(l=>l.sprites?.length>1),'移除预览框仍连续绘制动态图案');
clearInterval(e.animationTimer);
document.body.dataset.results=JSON.stringify(results);document.querySelector('#summary').textContent=`${results.filter(r=>r.ok).length}/${results.length} 通过`;document.querySelector('#results').replaceChildren(...results.map(r=>Object.assign(document.createElement('li'),{textContent:(r.ok?'通过 ':'失败 ')+r.name})));
