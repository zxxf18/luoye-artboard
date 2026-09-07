import { DrawingEngine } from '../src/drawing.js';
import { makeCanvas } from '../src/engine.js';
import { Recorder } from '../src/recording.js';
const results=[],$=id=>document.getElementById(id);
const check=(ok,name)=>{results.push({name,passed:!!ok});if(!ok)throw new Error(name);};
const solid=color=>{const c=makeCanvas(32,32);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,32,32);return c;};
const engine=new DrawingEngine(makeCanvas(160,100));engine.reset(160,100);
try{
 const red=solid('#ff0000'),blue=solid('#0000ff');
 const a={name:'红背景',id:'color1-a',category:'background',src:red.toDataURL()},b={name:'蓝背景',id:'color1-b',category:'background',src:blue.toDataURL()};
 await engine.addAsset(a);const previous=engine.layers[0];await engine.addAsset(b);
 const fullBackground=makeCanvas(160,100);engine.paint(fullBackground.getContext('2d'));check(fullBackground.getContext('2d').getImageData(1,1,1,1).data[2]===255&&fullBackground.getContext('2d').getImageData(1,1,1,1).data[0]===0,'4:3 背景铺满宽画纸，不留下白边');
 check(engine.layers.length===2&&engine.layers[0].sourceId===b.id,'背景替换而非堆在旧背景下');engine.undo();check(engine.layers[0]===previous,'替换背景可撤销');engine.redo();check(engine.layers[0].sourceId===b.id,'替换背景可重做');
 engine.activeId=engine.layers[0].id;engine.reorder(1);check(engine.layers[0].sourceId===b.id,'背景保持底部');
 const obj=await engine.addAsset({name:'小红图案',category:'sticker',src:red.toDataURL()});engine.ensureDrawingLayer();check(engine.active!==obj&&engine.active===engine.layers.at(-1),'选中小图后画笔在整张画纸最上面画');
 check(engine.pickLayer({x:80,y:50})===obj,'移动时穿过上面的透明画纸，点到实际小图');
 check(engine.pickLayer({x:1,y:1})===null,'移动不会选中并拖走背景');
 engine.setProperty(obj,'visible',false);check(engine.pickLayer({x:80,y:50})===null,'移动不会选中隐藏图层');engine.setProperty(obj,'visible',true);
 const selected=engine.pickLayer({x:80,y:50});engine.activeId=selected.id;engine.begin({x:80,y:50},{tool:'move'});engine.update({x:100,y:65});engine.end();check(obj.x===100&&obj.y===65,'移动只改变点中的图层');engine.undo();check(obj.x===80&&obj.y===50,'移动图层可以撤销');
 const groups=[{frames:[red,blue],frameDuration:100},{frames:[blue,red,blue],frameDuration:160}];engine.setFairyGroups(groups,'dynamic');
 const count=engine.layers.length;engine.begin({x:25,y:25},{tool:'stamp',size:20,opacity:1,stampSpacing:.4});
 for(let i=0;i<30;i++){engine.update({x:25+(i%8)*10,y:25+Math.floor(i/8)*10});engine.repeatStamp(true);}engine.end();
 check(engine.layers.length===count+1&&engine.active.sprites.length>30,'一次动态连续绘制超过30张仅占一个图层');
 const spriteLayer=engine.active,project=await engine.serialize('动态图案');const restored=new DrawingEngine(makeCanvas(160,100));await restored.restore(project);
 check(restored.active.sprites.length===spriteLayer.sprites.length&&restored.active.spriteGroups[1].frameDuration===160,'动态分组、位置和独立节奏保存重开');
 const c1=makeCanvas(160,100),c2=makeCanvas(160,100);engine.drawLayer(c1.getContext('2d'),spriteLayer,230);restored.drawLayer(c2.getContext('2d'),restored.active,230);
 check(c1.toDataURL()===c2.toDataURL(),'重开后的动态图逐像素一致');
 engine.undo();check(engine.layers.length===count,'整笔动态图撤销');engine.redo();check(engine.active.sprites.length===spriteLayer.sprites.length,'整笔动态图重做');
 engine.freezeAnimation();check(!engine.active.sprites,'动态图可定格再画');engine.undo();check(engine.active.sprites.length>30,'定格可撤销恢复动画');
 engine.begin({x:15,y:15},{tool:'stamp',size:20,opacity:1});engine.repeatStamp(true);engine.end(true);check(engine.layers.length===count+1,'取消连续动画不留下图层');
 const eraseEngine=new DrawingEngine(makeCanvas(160,100));
 const alphaAt=()=>eraseEngine.active.canvas.getContext('2d').getImageData(80,50,1,1).data[3];
 for(const mode of ['hard','soft','rect']){
   eraseEngine.reset(160,100);eraseEngine.active.canvas.getContext('2d').fillStyle='#e44f42';eraseEngine.active.canvas.getContext('2d').fillRect(0,0,160,100);
   const opts={tool:'eraser',eraserMode:mode,size:50,color:'#000000',opacity:1,ratio:1};
   eraseEngine.begin(mode==='rect'?{x:55,y:30}:{x:80,y:50},opts);if(mode==='rect')eraseEngine.update({x:105,y:70});eraseEngine.end();
   check(alphaAt()<255,mode+' 橡皮确实擦掉了当前层像素');
   check(eraseEngine.active.canvas.getContext('2d').globalCompositeOperation==='source-over',mode+' 擦除不遗留 destination-out 状态');
   await eraseEngine.addAsset(b);let composite=makeCanvas(160,100);eraseEngine.paint(composite.getContext('2d'));
   const hole=composite.getContext('2d').getImageData(80,50,1,1).data;check(hole[2]>0,mode+' 擦除位置能看到新背景，不留下白色遮挡');
   for(const brush of ['pencil','spray','watercolor','brush','marker','crayon','chalk','tube','effect']){
     eraseEngine.ensureDrawingLayer();const before=eraseEngine.active.canvas.toDataURL();
     eraseEngine.begin({x:75,y:50},{tool:'pen',brush,brushVersion:2,size:25,color:'#00a846',opacity:1,seed:23,ratio:1});eraseEngine.update({x:90,y:50});eraseEngine.end();
     check(eraseEngine.active.canvas.toDataURL()!==before,mode+' 擦除后 '+brush+' 能重新画');
   }
 }
 clearInterval(eraseEngine.animationTimer);
 const renderer=new DrawingEngine(makeCanvas(160,100));renderer.reset(160,100);const recorder=new Recorder(renderer,()=>{});await recorder.start(0,'回放测试');
 await renderer.addAsset(a);await renderer.addAsset(b);renderer.setFairyGroups(groups,'dynamic');renderer.begin({x:35,y:35},{tool:'stamp',size:20,opacity:1});renderer.repeatStamp(true);renderer.repeatStamp(true);renderer.end();recorder.stop();
 const recording=recorder.export();check(recording.slots[0].events.some(e=>e.method==='replaceBackground'),'录像记录完整背景替换操作');
 const playback=await recorder.replay(0,999,makeCanvas(160,100));
 check(playback.layers.filter(l=>l.role==='background').length===1&&playback.layers[0].sourceId===b.id,'录像重放背景替换一致');check(playback.layers.at(-1).sprites.length===3,'静止按住的连续盖章也能完整回放');
 for(const e of [restored,renderer])clearInterval(e.animationTimer);
}catch(error){results.push({name:error.message,passed:false,stack:error.stack});}
clearInterval(engine.animationTimer);$('summary').textContent=results.every(r=>r.passed)?`${results.length} 项全部通过`:'检查失败';$('results').textContent=JSON.stringify(results,null,2);document.body.dataset.results=JSON.stringify(results);
