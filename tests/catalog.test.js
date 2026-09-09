import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
const root=new URL('../public/',import.meta.url),assets=JSON.parse(readFileSync(new URL('assets/catalog.json',root)));
test('catalog has concise meaningful collections and no retired backgrounds',()=>{
 assert.equal(assets.length,1444);assert.equal(new Set(assets.map(a=>a.id)).size,assets.length);
 assert.equal(assets.filter(a=>a.category==='background').length,420);assert.equal(assets.filter(a=>a.category==='background'&&!a.id.startsWith('bg170-')).length,0);
 assert.equal(assets.find(a=>a.id==='illustrated-caterpillar').collection,'role0');assert.equal(assets.find(a=>a.id==='illustrated-caterpillar-stamp').collection,'girl');
 assert(!assets.some(a=>a.collection==='illustrated'||a.collection==='redrawn'||a.collection==='file'));
});
test('sixty coloring pages are divided across ten meaningful themes',()=>{
 const coloring=assets.filter(a=>a.coloring);assert.equal(coloring.length,60);assert.equal(new Set(coloring.map(a=>a.theme)).size,10);
 for(const a of coloring){assert.equal(a.category,'background');assert(a.name.length<=12);assert.equal(a.quality,'original-background-v170');}
});
test('every catalogue bitmap and animation frame ships locally',()=>{
 const paths=new Set();for(const a of assets){for(const p of [a.src,a.thumbnail,...a.frames||[],...(a.fairyGroups||[]).flatMap(g=>g.frames)])paths.add(p);}
 for(const path of paths){assert.match(path,/^assets\/[\w/-]+\.(png|webp)$/);const file=new URL(path,root);assert(existsSync(file),path);const fd=openSync(file,'r'),b=Buffer.alloc(24);try{assert.equal(readSync(fd,b,0,24,0),24);}finally{closeSync(fd);}if(path.endsWith('.png'))assert.equal(b.subarray(1,4).toString(),'PNG',path);else{assert.equal(b.subarray(0,4).toString(),'RIFF',path);assert.equal(b.subarray(8,12).toString(),'WEBP',path);}}
});
test('new backgrounds cover every theme and style',()=>{
 const b=assets.filter(a=>a.id.startsWith('bg170-')&&!a.coloring);assert.equal(b.length,360);
 for(const theme of ['space','countryside','underwater','city','farm','forest','rivers','ocean','animals','weather'])for(const style of ['comic','oil','watercolor','pencil','realistic','papercut'])assert.equal(b.filter(a=>a.theme===theme&&a.style===style).length,6);
});
test('card stamp opts into random order and rotation',()=>{const a=assets.find(a=>a.id==='girl-1-10');assert.deepEqual(a.fairyBehavior,{randomOrder:true,rotation:20});});
