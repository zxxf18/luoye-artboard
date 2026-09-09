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
e.reset(90,160);const coloring=await e.addAsset({id:'coloring-test',category:'background',coloring:true,name:'涂色底稿',src:frame.toDataURL()});
check(coloring.width===90&&coloring.height===160&&coloring.scale===1,'竖向画纸上的涂色页保留完整构图');
check(coloring.canvas.getContext('2d').getImageData(45,1,1,1).data[0]===255,'涂色页空余区域补白而非裁掉内容');
const catalog=await fetch('/assets/catalog.json').then(response=>response.json());
const realColoring=catalog.find(asset=>asset.category==='background'&&asset.coloring);
e.reset(320,180);await e.addAsset({...realColoring,src:'/'+realColoring.src});
const before=makeCanvas(320,180);e.paint(before.getContext('2d'));const pixels=before.getContext('2d').getImageData(0,0,320,180).data;
let seed=0;for(let y=50;y<150;y++)for(let x=70;x<250;x++){const i=(y*320+x)*4;if(pixels[i]>250&&pixels[i+1]>250&&pixels[i+2]>250)seed=y*320+x;}
e.begin({x:seed%320,y:Math.floor(seed/320)},{tool:'fill',fillMode:'region',color:'#ef9944',opacity:1,tolerance:15});e.end();
const after=makeCanvas(320,180);e.paint(after.getContext('2d'));const painted=after.getContext('2d').getImageData(0,0,320,180).data;let changed=0,blackPreserved=true,whiteRemaining=0;
for(let i=0;i<pixels.length;i+=4){if(painted[i]!==pixels[i])changed++;if(pixels[i]<20&&painted[i]>40)blackPreserved=false;if(painted[i]>250&&painted[i+1]>250&&painted[i+2]>250)whiteRemaining++;}
check(changed>20&&blackPreserved&&whiteRemaining>100,'新绘线稿可分区填色，黑色轮廓和其他白色区域保留');
clearInterval(e.animationTimer);
document.body.dataset.results=JSON.stringify(results);document.querySelector('#summary').textContent=`${results.filter(r=>r.ok).length}/${results.length} 通过`;document.querySelector('#results').replaceChildren(...results.map(r=>Object.assign(document.createElement('li'),{textContent:(r.ok?'通过 ':'失败 ')+r.name})));
