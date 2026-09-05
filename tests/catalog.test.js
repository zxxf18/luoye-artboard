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
 assert.equal(coloring.length,36);
 for(let i=0;i<30;i++){
   const item=assets.find(a=>a.id===`color0-${i}`);
   assert(item.coloring);assert.equal(item.quality,'ai-redrawn-native');assert.equal(item.referenceId,item.id);
   assert(item.originalSrc.startsWith('assets/original/'));assert(item.width>item.originalDimensions[0]);
 }
 assert.equal(assets.filter(a=>a.category==='frame'&&a.quality==='ai-redrawn-native').length,4);
});
test('every catalogue bitmap and original animation frame ships locally and has valid dimensions',()=>{
 const paths=new Set();for(const a of assets){for(const p of [a.src,a.thumbnail,...a.frames||[],...(a.fairyGroups||[]).flatMap(g=>g.frames)])paths.add(p);}
 for(const path of paths){assert.match(path,/^assets\/[\w/-]+\.png$/);const file=new URL(path,root);assert(existsSync(file),path);const fd=openSync(file,'r'),b=Buffer.alloc(24);try{assert.equal(readSync(fd,b,0,24,0),24);}finally{closeSync(fd);}assert.equal(b.subarray(1,4).toString(),'PNG',path);assert(b.readUInt32BE(16)>0&&b.readUInt32BE(20)>0,path);}
});
