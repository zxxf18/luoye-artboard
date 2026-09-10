import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import { DrawingEngine } from '../src/drawing.js';
import { EditorEngine } from '../src/editor.js';
import { PaintEngine } from '../src/engine.js';
import { beginPaperErase, updatePaperErase, endPaperErase } from '../src/paper-tools.js';
import { History } from '../src/core.js';

// Drawing algorithms use the same layer/gesture/history code as the app. Only
// the raster device is replaced here; native tests check actual pixels/layout.
const context=()=>({save(){},restore(){},drawImage(){},clearRect(){},setLineDash(){},fillRect(){},translate(){},scale(){},rotate(){},globalAlpha:1});
function canvas(width,height){const ctx=context();return {width,height,getContext:()=>ctx};}
function engine(){const e=Object.create(DrawingEngine.prototype);Object.assign(e,{width:1920,height:1080,layers:[],activeId:'',history:new History(),playing:false,animationTime:0,changed(){},render(){},drawLayer(){},notices:[]});e.notice=m=>e.notices.push(m);return e;}
function groups(n=4){return Array.from({length:n},()=>({frameDuration:160,frames:Array.from({length:8},()=>canvas(480,480))}));}
function draw(e,source,count=4,size=160){e.fairyGroups=source;e.fairyMode='dynamic';e.begin({x:200,y:200},{tool:'stamp',size,opacity:1});for(let i=1;i<count;i++)e.dynamicDab({x:200+i*2,y:200});e.end();}

const previousDocument=globalThis.document,previousPath=globalThis.Path2D;
before(()=>{globalThis.document={createElement:()=>canvas(1,1)};globalThis.Path2D=class {moveTo(){}lineTo(){}rect(){}bezierCurveTo(){}};});
after(()=>{globalThis.document=previousDocument;globalThis.Path2D=previousPath;});

test('open lines and curves always stroke even after a filled shape',()=>{
 const calls=[],ctx={...context(),stroke(){calls.push(['stroke',this.strokeStyle]);},fill(){calls.push(['fill',this.fillStyle]);}};
 for(const tool of ['rect','line','bezier'])EditorEngine.prototype.drawShape.call({},ctx,{options:{tool,color:'#ff0000',size:8,opacity:1,filled:true},layer:{scale:1},start:{x:1,y:1},end:{x:20,y:20}});
 assert.deepEqual(calls,[['fill','#ff0000'],['stroke','#ff0000'],['stroke','#ff0000']]);
});

test('a gesture snapshots its color before subsequent tool settings change',()=>{
 const e=engine();e.layers=[{id:'paper',...canvas(1920,1080),canvas:canvas(1920,1080),visible:true,x:960,y:540,scale:1,rotation:0}];e.activeId='paper';
 const options={tool:'rect',color:'#ff0000',size:8,opacity:1};PaintEngine.prototype.begin.call(e,{x:20,y:20},options);options.color='#0000ff';
 assert.equal(e.gesture.options.color,'#ff0000');
});

test('forty different animated bags fit without forty full-paper layers',()=>{
 const e=engine();for(let n=0;n<40;n++)draw(e,groups());
 assert.deepEqual(e.notices,[]);assert.equal(e.layers.length,1);assert.equal(e.layers[0].sprites.length,160);
 assert.equal(e.layers[0].spriteGroups.length,160);
 assert.ok(e.scenePixels()<36_000_000);assert.ok(e.layers[0].spriteGroups.every(g=>g.frames.every(f=>f.width===160)));
});

test('mixed bag undo redo and cancellation restore sprites and frame groups together',()=>{
 const e=engine(),a=groups(1),b=groups(1);draw(e,a,2);draw(e,b,3);
 const layer=e.layers[0],after=layer.spriteGroups;
 assert.equal(layer.sprites.length,5);assert.equal(layer.sprites[2].group,1);
 e.history.undo();assert.equal(layer.sprites.length,2);assert.equal(layer.spriteGroups.length,1);
 e.history.redo();assert.equal(layer.sprites.length,5);assert.equal(layer.spriteGroups,after);
 e.fairyGroups=groups(1);e.begin({x:200,y:200},{tool:'stamp',size:160,opacity:1});e.end(true);
 assert.equal(layer.sprites.length,5);assert.equal(layer.spriteGroups,after);
});

test('a moved bag is not reused and painter order is preserved',()=>{
 const e=engine();draw(e,groups(1),1);e.layers[0].x+=10;draw(e,groups(1),1);
 assert.equal(e.layers.length,2);assert.equal(e.layers[0].sprites.length,1);
});

test('large stamps retain original frame resolution',()=>{
 const e=engine(),g=groups(1);draw(e,g,1,600);assert.equal(e.layers[0].spriteGroups[0],g[0]);
});

test('group and memory boundaries fail without an empty unexportable layer',()=>{
 const e=engine();for(let n=0;n<201;n++)draw(e,groups(1),1,128);
 assert.equal(e.layers.length,2);assert.equal(e.layers[0].spriteGroups.length,200);assert.equal(e.layers[1].sprites.length,1);
 const full=engine();full.layers=[{id:'full',width:6000,height:7000,role:'background',canvas:canvas(6000,7000),spriteGroups:groups(30)}];full.activeId='full';
 draw(full,groups(1),1);assert.equal(full.layers.length,1);assert.equal(full.activeId,'full');assert.equal(full.notices.length,1);
});

test('repeated same-size stamps reuse immutable frame resources',()=>{
 const e=engine(),g=groups(1);draw(e,g,1);const pixels=e.scenePixels();draw(e,g,30);
 assert.equal(e.scenePixels(),pixels);assert.equal(e.layers[0].spriteGroups.length,1);
});

test('reopening old full-resolution bags preserves positions and shared resources',async t=>{
 const e=engine(),original=groups(1),sprites=[{group:0,x:23,y:45,size:160,opacity:.7}];
 const layers=[{width:1920,height:1080,scale:1,sprites:structuredClone(sprites),spriteGroups:original},{width:1920,height:1080,scale:1,sprites:structuredClone(sprites),spriteGroups:original.map(g=>({...g}))}];
 t.mock.method(EditorEngine.prototype,'restore',async function(){this.layers=layers;return '旧工程';});
 assert.equal(await e.restore({}),'旧工程');assert.deepEqual(e.layers[0].sprites,sprites);
 assert.equal(e.layers[0].spriteGroups[0].frames[0].width,160);
 assert.equal(e.layers[0].spriteGroups[0].frames[0],e.layers[1].spriteGroups[0].frames[0]);
 assert.equal(original[0].frames[0].width,480);assert.equal(e.layers[0].spriteGroups[0].frameDuration,160);
});

test('reopening enlarged stamps retains enough resolution for their displayed size',async t=>{
 const e=engine(),original=groups(1);
 t.mock.method(EditorEngine.prototype,'restore',async function(){this.layers=[{scale:3,sprites:[{group:0,size:160}],spriteGroups:original}];return '放大';});
 await e.restore({});assert.equal(e.layers[0].spriteGroups[0],original[0]);
});

test('ordinary strokes reuse the editable working layer instead of allocating per stroke',()=>{
 const e=engine();e.addLayer('工作层');const original=e.active;
 for(let i=0;i<50;i++)e.ensureDrawingLayer();
 assert.equal(e.layers.length,1);assert.equal(e.active,original);
 // An inserted object is kept intact. A new working layer goes above it, and
 // later strokes reuse that layer without changing the visual stacking order.
 const object=e.addLayer('角色',canvas(100,100),true,{sourceId:'character'});
 const drawing=e.ensureDrawingLayer();e.ensureDrawingLayer();
 assert.equal(e.layers.length,3);assert.equal(e.layers[1],object);assert.equal(e.layers[2],drawing);
 assert.equal(object.canvas.width,100);
});

test('drawing above transformed or masked content preserves that content',()=>{
 for(const props of [{rotation:20},{eraseMask:{}},{opacity:0},{visible:false}]){
  const e=engine();const old=e.addLayer('已有内容',canvas(1920,1080),true,props);
  const next=e.ensureDrawingLayer();assert.notEqual(next,old);assert.equal(e.layers[0],old);
  e.ensureDrawingLayer();assert.equal(e.layers.length,2);
 }
});


test('paper eraser includes the visible gallery background with reversible per-layer masks',()=>{
 const e=engine(),background=e.addLayer('背景',canvas(1920,1080),false,{role:'background',insertAt:0});
 const drawing=e.addLayer('绘画',canvas(1920,1080),false);
 const hidden=e.addLayer('隐藏背景',canvas(1920,1080),false,{role:'background',visible:false});
 e.captureTiles=(layer,bounds,tiles)=>tiles.set('touched',{});e.maskTiles=()=>{};
 beginPaperErase(e,{x:30,y:30},{tool:'eraser',eraserMode:'rect',size:20,opacity:1});
 assert.deepEqual(e.gesture.targets.map(t=>t.layer),[background,drawing]);
 updatePaperErase(e,{x:100,y:100});endPaperErase(e,false);
 const mask=background.eraseMask;assert.ok(mask);assert.ok(drawing.eraseMask);assert.equal(hidden.eraseMask,undefined);
 e.history.undo();assert.equal(background.eraseMask,undefined);assert.equal(drawing.eraseMask,undefined);
 e.history.redo();assert.equal(background.eraseMask,mask);
 beginPaperErase(e,{x:30,y:30},{tool:'eraser',eraserMode:'rect',size:20,opacity:1});endPaperErase(e,true);
 assert.equal(background.eraseMask,mask);
 const replacement=e.replaceBackground('新背景',canvas(1920,1080),{role:'background',insertAt:0});
 assert.equal(replacement.eraseMask,undefined);e.history.undo();assert.ok(e.layers.includes(background));assert.equal(background.eraseMask,mask);
});

test('scene capacity reserves space to erase a background, including when replacing it',()=>{
 const e=engine();assert.throws(()=>e.assertSceneCapacity([{width:10000,height:5000,role:'background'}]),/橡皮/);
 assert.doesNotThrow(()=>e.assertSceneCapacity([{width:10000,height:4000,role:'background'}]));
 const original=e.addLayer('旧背景',canvas(1920,1080),false,{role:'background'});
 assert.throws(()=>e.replaceBackground('超大背景',canvas(10000,5000),{role:'background',insertAt:0}),/橡皮/);
 assert.deepEqual(e.layers,[original]);assert.equal(e.active,original);
});
