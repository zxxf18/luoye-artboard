import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
const root=new URL('../public/',import.meta.url),assets=JSON.parse(readFileSync(new URL('assets/catalog.json',root)));
test('entire installed legacy library is published with unique IDs and honest quality metadata',()=>{
 const original=assets.filter(a=>a.sources?.length);
 assert.equal(new Set(assets.map(a=>a.id)).size,assets.length);
 assert.deepEqual(Object.fromEntries(['animation','background','fairy','frame','paper','sticker','texture'].map(k=>[k,original.filter(a=>a.category===k).length])),{animation:45,background:99,fairy:154,frame:41,paper:21,sticker:675,texture:82});
 assert(original.filter(a=>a.category==='fairy').every(a=>!/^单张仙女袋|^静态仙女袋|^动态仙女袋/.test(a.name)));
});
test('coloring pages are separated and all thirty installed themes have actual redrawn files',()=>{
 const coloring=assets.filter(a=>a.coloring);
 assert.equal(coloring.length,46);
 for(let i=0;i<30;i++){
   const item=assets.find(a=>a.id===`color0-${i}`);
   assert(item.coloring);assert.equal(item.quality,'preschool-natural-v16');assert.equal(item.referenceId,item.id);
   assert(item.originalSrc.startsWith('assets/original/'));assert(item.width>item.originalDimensions[0]);
 }
 assert.equal(assets.filter(a=>a.category==='frame'&&a.quality==='preschool-natural-v16').length,45);
});
test('every catalogue bitmap and original animation frame ships locally and has valid dimensions',()=>{
 const paths=new Set();for(const a of assets){for(const p of [a.src,a.thumbnail,...a.frames||[],...(a.fairyGroups||[]).flatMap(g=>g.frames)])paths.add(p);}
 for(const path of paths){assert.match(path,/^assets\/[\w/-]+\.(png|webp)$/);const file=new URL(path,root);assert(existsSync(file),path);const fd=openSync(file,'r'),b=Buffer.alloc(24);try{assert.equal(readSync(fd,b,0,24,0),24);}finally{closeSync(fd);}if(path.endsWith('.png')){assert.equal(b.subarray(1,4).toString(),'PNG',path);assert(b.readUInt32BE(16)>0&&b.readUInt32BE(20)>0,path);}else{assert.equal(b.subarray(0,4).toString(),'RIFF',path);assert.equal(b.subarray(8,12).toString(),'WEBP',path);}}
});
test('all 154 fairy packs use preschool artwork while retaining modes and combination counts',()=>{
 const fairy=assets.filter(a=>a.id.startsWith('girl-'));
 assert.equal(fairy.length,154);
 assert.deepEqual(Object.fromEntries(['single','static','dynamic'].map(mode=>[mode,fairy.filter(a=>a.fairyMode===mode).length])),{single:100,static:32,dynamic:22});
 assert.equal(fairy.reduce((n,a)=>n+a.fairyGroups.length,0),470);
 for(const a of fairy){
   assert.equal(a.quality,'preschool-natural-v16',a.id);assert(a.thumbnail.startsWith(a.fairyMode==='dynamic'?'assets/motion-v162/':'assets/library-v16/'));
   assert.equal(a.fairyGroups.length,a.originalFairyGroups.length,a.id);
   for(const [i,g] of a.fairyGroups.entries()){
     assert.equal(g.frameDuration,a.originalFairyGroups[i].frameDuration,a.id);
     assert.equal(g.frames.length,a.fairyMode==='dynamic'?8:1,a.id);
     assert.equal(new Set(g.frames).size,g.frames.length,'Do not inflate animation counts using repeated frame paths');
     assert(g.frames.every(p=>p.startsWith(a.fairyMode==='dynamic'?'assets/motion-v162/sprites/':'assets/library-v16/sprites/')),a.id);
     assert(g.width>0&&g.height>0&&Math.max(g.width,g.height)<=(a.fairyMode==='dynamic'?480:1024),a.id);
   }
 }
});

test('v1.6 publishes the complete preschool-natural library without changing legacy behavior',()=>{
 assert.equal(assets.length,1502);
 assert(assets.every(a=>a.quality===(a.id.startsWith('bg170-')?'original-background-v170':'preschool-natural-v16')),new Set(assets.filter(a=>a.quality!=='preschool-natural-v16').map(a=>a.quality)));
 for(const a of assets){
   assert(/^assets\/(library-v16|motion-v162|backgrounds-v162|backgrounds-v170)\//.test(a.src),a.id);
   assert(/^assets\/(library-v16|motion-v162|backgrounds-v162|backgrounds-v170)\//.test(a.thumbnail),a.id);
 }
 const transparent=assets.filter(a=>['sticker','animation','fairy','frame'].includes(a.category));
 assert(transparent.every(a=>a.alphaRequired===true));
 const backgrounds=assets.filter(a=>a.category==='background');
 assert(backgrounds.every(a=>a.width>=1600&&Math.abs(a.width/a.height-16/9)<0.02));
 for(const a of assets.filter(a=>a.category==='animation')){
   assert(a.frames.length>=8,a.id);
   assert.equal(new Set(a.frames).size,a.frames.length,a.id);
   assert(a.frames.every(p=>p.startsWith('assets/library-v16/')||p.startsWith('assets/motion-v162/')),a.id);
 }
});


test('360 new backgrounds cover every theme and style with independent scene descriptions',()=>{
 const plan=JSON.parse(readFileSync(new URL('../design/versions/v1.7.0/background-production-plan.json',import.meta.url)));
 const backgrounds=assets.filter(a=>a.id.startsWith('bg170-')&&!a.coloring);
 assert.equal(backgrounds.length,360);assert.equal(new Set(plan.map(p=>p.scene)).size,360);
 for(const theme of ['space','countryside','underwater','city','farm','forest','rivers','ocean','animals','weather'])for(const style of ['comic','oil','watercolor','pencil','realistic','papercut'])assert.equal(backgrounds.filter(a=>a.theme===theme&&a.style===style).length,6,theme+' '+style);
 const boat=assets.find(a=>a.id==='legacy-sailboat-variant');assert.equal(boat.name,'帆船');assert.equal(boat.collection,'role6');
});
