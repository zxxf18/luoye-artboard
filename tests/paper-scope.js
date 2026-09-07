import { Recorder } from '/src/recording.js';
import { DrawingEngine } from '/src/drawing.js';
import { makeCanvas } from '/src/engine.js';
const checks=[];const check=(ok,name)=>{checks.push({ok:!!ok,name});if(!ok)throw Error(name);};
const square=(color,w=20,h=20)=>{const c=makeCanvas(w,h);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,w,h);return c;};
const pixel=(e,x,y)=>{const c=makeCanvas(e.width,e.height);e.paint(c.getContext('2d'));return [...c.getContext('2d').getImageData(x,y,1,1).data];};
const pen={tool:'pen',brushVersion:2,brush:'tube',size:12,ratio:1,opacity:1,color:'#00aa44',seed:13};
let e;
try{
 e=new DrawingEngine(makeCanvas(160,100));e.reset(160,100);e.paperMode=true;
 for(const kind of ['素材','分形','文字','粘贴']){
  e.addLayer(kind,square('#ed3322'));e.begin({x:12,y:12},pen);e.update({x:35,y:12});e.end();check(pixel(e,25,12)[1]>90&&pixel(e,25,12)[0]<100,kind+' 后可在素材之外绘画');
 }
 e.reset(160,100);e.active.canvas.getContext('2d').drawImage(square('#ee3322',160,100),0,0);
 const lower=e.active;e.addLayer('小伙伴',square('#2233ee'));const obj=e.active;
 e.begin({x:10,y:10},{tool:'eraser',eraserMode:'hard',size:20,opacity:1});e.update({x:80,y:50});e.end();
 check(pixel(e,10,10).slice(0,3).every(v=>v===255),'小伙伴选中时可擦除远处下层笔迹');
 check(pixel(e,80,50).slice(0,3).every(v=>v===255),'重叠的前后两层一起擦干净');
 check(e.layers.includes(lower)&&e.layers.includes(obj),'擦除保留独立图层');e.undo();check(pixel(e,80,50)[2]>200&&pixel(e,10,10)[0]>200,'一键撤销恢复所有层');e.redo();
 await e.addAsset({id:'background-blue',name:'蓝背景',category:'background',src:square('#3388ee').toDataURL()});check(pixel(e,80,50)[2]>200&&pixel(e,80,50)[0]<100,'擦除位置显示更换后的背景');
 e.begin({x:75,y:50},pen);e.update({x:95,y:50});e.end();check(pixel(e,80,50)[1]>100&&pixel(e,80,50)[2]<180,'擦除区域可以重新画');
 const project=await e.serialize('橡皮与图层');const r=new DrawingEngine(makeCanvas(160,100));await r.restore(project);check(pixel(r,10,10).join()===pixel(e,10,10).join(),'擦除后保存重开一致');clearInterval(r.animationTimer);
 e.reset(160,100);e.addLayer('中间的小方块',square('#000000'));e.begin({x:10,y:10},{tool:'fill',fillMode:'region',color:'#ff8800',opacity:1,tolerance:1});e.end();check(pixel(e,10,10)[1]===136,'油漆桶可填素材外的区域');check(pixel(e,80,50)[0]===0,'油漆桶依据可见画面边界');
 e.reset(160,100);const selected=square('#222222');e.addLayer('选中的小块',selected);e.setCloneSource({x:80,y:50});e.begin({x:20,y:20},{tool:'clone',size:12,opacity:1});e.end();check(pixel(e,20,20)[0]<80,'仿制可以从素材复制到全图另一处');
 e.reset(160,100);const old=e.active;old.canvas.getContext('2d').drawImage(square('#dd3344',30,30),5,5);e.addLayer('很远的素材',square('#1133bb'));const previous=old.canvas.toDataURL();
 e.begin({x:15,y:15},{tool:'warp',warpKind:'push',radius:24,strength:1,speed:1});e.update({x:35,y:15});e.end();check(old.canvas.toDataURL()!==previous,'选中素材后，变形能影响远处另一层');e.undo();check(old.canvas.toDataURL()===previous,'跨层变形一键撤销');
 e.applyDarkroom('invert');check(pixel(e,15,15)[0]<100,'暗房修改可见画面的其他图层');e.undo();
 const animation=e.addLayer('动画',square('#3344dd'),true,{frames:[square('#3344dd'),square('#4455ee')],frameDuration:160});
 e.begin({x:80,y:50},{tool:'eraser',eraserMode:'hard',size:25,opacity:1});e.end();check(animation.frames.length===2&&pixel(e,80,50)[0]===255,'擦动画不需要定格，擦除对每帧有效');e.undo();check(!animation.eraseMask,'动画擦除撤销');
 for(const mode of ['hard','soft','rect']){
  e.reset(160,100);e.active.canvas.getContext('2d').drawImage(square('#dd2233',160,100),0,0);e.addLayer('叠放小块',square('#2233dd'));
  const opts={tool:'eraser',eraserMode:mode,size:45,opacity:1};const first=mode==='rect'?{x:5,y:5}:{x:20,y:20};e.begin(first,opts);e.update(mode==='rect'?{x:100,y:70}:{x:80,y:50});e.end();check(pixel(e,20,20)[1]>0,mode+' 全图橡皮在素材外生效');
  e.begin({x:15,y:20},pen);e.update({x:40,y:20});e.end();check(pixel(e,25,20)[1]>100,mode+' 全图橡皮之后能继续涂画');
 }
 e.reset(160,100);const rec=new Recorder(e);await rec.start(0,'整张画纸录像');e.addLayer('录像小块',square('#223344'));e.begin({x:10,y:10},{tool:'fill',fillMode:'region',color:'#dd5500',opacity:1});e.begin({x:8,y:8},{tool:'eraser',eraserMode:'hard',size:15,opacity:1});e.end();e.begin({x:10,y:10},pen);e.update({x:30,y:10});e.end();rec.stop();const output=makeCanvas(160,100);await rec.replay(0,rec.slots[0].events.length,output);check(output.toDataURL()===e.exportPNG(),'跨层填色、橡皮、再画的录像逐像素回放一致');
 e.setCloneSource({x:10,y:10});await rec.start(1,'仿制源录制');e.begin({x:20,y:80},{tool:'clone',size:15,opacity:1});e.end();rec.stop();await rec.replay(1,rec.slots[1].events.length,output);check(output.toDataURL()===e.exportPNG(),'整图仿制源在录像起点可恢复');
 e.reset(160,100);for(const brush of ['pencil','spray','watercolor','brush','marker','crayon','chalk','tube','effect']){
  e.begin({x:20,y:30},{...pen,brush,strokeMode:'line',size:28});e.update({x:130,y:65});const preview=makeCanvas(160,100);e.paint(preview.getContext('2d'),true);const before=e.active.canvas.toDataURL();e.paint(makeCanvas(160,100).getContext('2d'),true);check(e.active.canvas.toDataURL()===before,brush+' 直线预览不改变作品');e.end();const actual=makeCanvas(160,100);e.paint(actual.getContext('2d'));check(preview.toDataURL()===actual.toDataURL(),brush+' 预览与实际笔迹逐像素一致');e.reset(160,100);
 }
}catch(error){checks.push({ok:false,name:error.message});}finally{if(e)clearInterval(e.animationTimer);document.getElementById('result').textContent=JSON.stringify({passed:checks.every(c=>c.ok),checks},null,2);}
