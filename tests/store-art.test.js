import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const plan=JSON.parse(await readFile(new URL('../tools/assets/manifests/store-refresh.json',import.meta.url)));
const catalog=JSON.parse(await readFile(new URL('../public/assets/catalog.json',import.meta.url)));
test('all replacement assets preserve IDs, categories and animation contracts', async()=>{
 for(const spec of plan){
  const item=catalog.find(x=>x.id===spec.id);assert.ok(item,spec.id);
  assert.equal(item.category,spec.category,spec.id);assert.equal(item.collection,spec.collection,spec.id);
  assert.ok(item.src.startsWith(`assets/${item.category}/store/`),spec.id);
  if(spec.groups){assert.equal(item.fairyGroups.length,spec.groups.length,spec.id);for(let g=0;g<spec.groups.length;g++){assert.equal(item.fairyGroups[g].frames.length,spec.groups[g].frames,spec.id);assert.equal(item.fairyGroups[g].frameDuration,spec.groups[g].frameDuration,spec.id);}}
  if(spec.frameCount)assert.equal(item.frames.length,spec.frameCount,spec.id);
  for(const p of [item.src,item.thumbnail,...(item.frames||[]),...(item.fairyGroups||[]).flatMap(g=>g.frames)])await access(new URL('../public/'+p,import.meta.url));
 }
});
