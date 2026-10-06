import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, openSync, readSync, closeSync, statSync } from 'node:fs';
const root=new URL('../public/',import.meta.url),assets=JSON.parse(readFileSync(new URL('assets/catalog.json',root)));
test('catalog has concise meaningful collections and no retired backgrounds',()=>{
 assert.equal(assets.length,1694);assert.equal(new Set(assets.map(a=>a.id)).size,assets.length);
 assert.equal(assets.filter(a=>a.category==='background').length,513);assert.equal(assets.filter(a=>a.category==='background'&&!a.id.startsWith('bg170-')).length,93);
 assert.equal(assets.find(a=>a.id==='illustrated-caterpillar').collection,'role0');assert.equal(assets.find(a=>a.id==='illustrated-caterpillar-stamp').collection,'girl');
 assert.equal(assets.filter(a=>a.collection==='vehicles').length,12);
 assert(assets.filter(a=>a.collection==='vehicles').every(a=>a.category==='sticker'&&a.alphaRequired===true));
 const everyday=assets.filter(a=>a.quality==='original-imagegen-v180');
 assert.equal(everyday.length,24);
 assert.deepEqual([...new Set(everyday.map(a=>a.collection))].sort(),['everyday-oil','everyday-pencil','everyday-sticker','everyday-watercolor']);
 for(const collection of ['everyday-watercolor','everyday-oil','everyday-pencil','everyday-sticker']){
  const group=everyday.filter(a=>a.collection===collection);
  assert.equal(group.length,6);
  assert(group.every(a=>a.category==='sticker'&&a.alphaRequired===true&&a.src.endsWith('.webp')&&a.thumbnail.endsWith('.webp')));
 }
 const everyday181=assets.filter(a=>a.quality==='original-imagegen-v181');
 assert.equal(everyday181.length,48);
 assert.deepEqual([...new Set(everyday181.map(a=>a.collection))].sort(),['everyday-oil','everyday-pencil','everyday-sticker','everyday-watercolor']);
 for(const collection of ['everyday-watercolor','everyday-oil','everyday-pencil','everyday-sticker']){
  const group=everyday181.filter(a=>a.collection===collection);
  assert.equal(group.length,12);
  assert(group.every(a=>a.category==='sticker'&&a.alphaRequired===true&&a.src.endsWith('.webp')&&a.thumbnail.endsWith('.webp')&&a.width>0&&a.height>0&&a.width<=1024&&a.height<=1024));
 }
 const subjects=[...new Set(everyday181.map(a=>a.kind))];
 assert.equal(subjects.length,12);
 for(const subject of subjects) assert.deepEqual(new Set(everyday181.filter(a=>a.kind===subject).map(a=>a.style)),new Set(['watercolor','oil','pencil','sticker']));
 assert(assets.filter(a=>a.quality==='original-imagegen-v180').every(a=>a.width===1024&&a.height===1024));
 const everyday182=assets.filter(a=>a.quality==='original-imagegen-v182');
 assert.equal(everyday182.length,40);
 assert.equal(new Set(everyday182.map(a=>a.kind)).size,40);
 for(const style of ['watercolor','oil','pencil','sticker']){
  const group=everyday182.filter(a=>a.style===style);
  assert.equal(group.length,10);
  assert(group.every(a=>a.collection==='everyday-'+style&&a.category==='sticker'&&a.alphaRequired===true));
 }
 for(const subject of new Set(everyday182.map(a=>a.kind))) assert.equal(everyday182.filter(a=>a.kind===subject).length,1);
 const groups={};for(const item of everyday182) groups[item.contentGroup]=(groups[item.contentGroup]||0)+1;
 assert.deepEqual(groups,{'食物':8,'乐器':4,'玩具':4,'日用品':8,'建筑':4,'自然':8,'动物':4});
 for(const item of [...everyday,...everyday181,...everyday182]){
  for(const ref of [item.src,item.thumbnail]) assert(statSync(new URL(ref,root)).size<900*1024,`${item.id} exceeds runtime asset budget`);
  const bitmap=readFileSync(new URL(item.src,root));
  assert.equal(bitmap.subarray(12,16).toString(),'VP8X',item.id+' must use extended WebP with alpha');
  assert(bitmap[20]&0x10,item.id+' must retain alpha');
  assert.equal(bitmap.readUIntLE(24,3)+1,item.width,item.id+' runtime width');
  assert.equal(bitmap.readUIntLE(27,3)+1,item.height,item.id+' runtime height');
  assert(item.width<=1024&&item.height<=1024,item.id+' runtime dimension budget');
  const thumb=readFileSync(new URL(item.thumbnail,root));
  assert.equal(thumb.subarray(12,16).toString(),'VP8X',item.id+' thumbnail WebP');
  assert(thumb[20]&0x10,item.id+' thumbnail alpha');
  assert(thumb.readUIntLE(24,3)+1<=240&&thumb.readUIntLE(27,3)+1<=240,item.id+' thumbnail dimension budget');
 }
 assert(!assets.some(a=>a.collection==='illustrated'||a.collection==='redrawn'||a.collection==='file'));
});
test('sixty coloring pages are divided across ten meaningful themes',()=>{
 const coloring=assets.filter(a=>a.coloring);assert.equal(coloring.length,60);assert.equal(new Set(coloring.map(a=>a.theme)).size,10);
 for(const a of coloring){assert.equal(a.category,'background');assert(a.name.length<=12);assert.equal(a.quality,'original-background-v170');}
});
test('every catalogue bitmap and animation frame ships locally',()=>{
 const paths=new Set();for(const a of assets){for(const p of [a.src,a.thumbnail,...a.frames||[],...(a.fairyGroups||[]).flatMap(g=>g.frames)])paths.add(p);}
 for(const path of paths){assert.match(path,/^assets\/[\w/-]+\.(png|webp|svg)$/);const file=new URL(path,root);assert(existsSync(file),path);const fd=openSync(file,'r'),b=Buffer.alloc(24);try{assert.equal(readSync(fd,b,0,24,0),24);}finally{closeSync(fd);}if(path.endsWith('.png'))assert.equal(b.subarray(1,4).toString(),'PNG',path);else if(path.endsWith('.svg'))assert.match(b.toString(),/^<svg /,path);else{assert.equal(b.subarray(0,4).toString(),'RIFF',path);assert.equal(b.subarray(8,12).toString(),'WEBP',path);}}
});
test('new backgrounds cover every theme and style',()=>{
 const b=assets.filter(a=>a.id.startsWith('bg170-')&&!a.coloring);assert.equal(b.length,360);
 for(const theme of ['space','countryside','underwater','city','farm','forest','rivers','ocean','animals','weather'])for(const style of ['comic','oil','watercolor','pencil','realistic','papercut'])assert.equal(b.filter(a=>a.theme===theme&&a.style===style).length,6);
});
test('card stamp opts into random order and rotation',()=>{const a=assets.find(a=>a.id==='girl-1-10');assert.deepEqual(a.fairyBehavior,{randomOrder:true,rotation:20});});
