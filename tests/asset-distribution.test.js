import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {renderRuntimeAssetCatalog,selectAssetCatalog} from '../tools/assets/asset-distribution.mjs';
import {runtimeAssetPaths,includeAsset} from '../tools/assets/runtime-assets.mjs';
const current=JSON.parse(await readFile(new URL('../public/assets/catalog.json',import.meta.url)));
const legacy=JSON.parse(await readFile(new URL('../resources/assets/legacy-catalog.json',import.meta.url)));
test('community retains all current entries and exposes the previous replacements separately',async()=>{
 const merged=selectAssetCatalog(current,legacy,'community');
 assert.equal(merged.length,current.length+111);assert.equal(new Set(merged.map(x=>x.id)).size,merged.length);
 for(const original of legacy){const saved=merged.find(x=>x.id===original.id+'-legacy');assert.ok(saved,original.id);assert.equal(saved.category,original.category);assert.equal(saved.collection,original.collection);assert.equal(saved.src,original.src);assert.equal(saved.legacyOf,original.id);}
 for(const p of runtimeAssetPaths(merged))await access(new URL('../public/'+p,import.meta.url));
});
test('community gives fairy variants distinct names and starts combinations with the archived candy car',()=>{
 const merged=selectAssetCatalog(current,legacy,'community');
 for(const mode of ['static','dynamic']){
  const entries=merged.filter(item=>item.category==='fairy'&&item.fairyMode===mode);
  assert.equal(new Set(entries.map(item=>item.name)).size,entries.length);
  assert.ok(entries.every(item=>!item.name.includes('旧版')));
 }
 assert.equal(merged.find(item=>item.category==='fairy'&&item.fairyMode==='static').id,'girl-1-9-legacy');
 for(const item of legacy.filter(item=>item.category!=='fairy')){
  assert.equal(merged.find(entry=>entry.legacyOf===item.id).name,item.name+'（旧版）');
 }
});
test('store excludes legacy entries, their bitmaps and the archive index',()=>{
 const selected=selectAssetCatalog(current,legacy,'store'),paths=runtimeAssetPaths(selected);
 assert.deepEqual(selected,current);
 for(const old of legacy){assert.equal(includeAsset(old.src,paths),false,old.id);assert.equal(includeAsset(old.thumbnail,paths),false,old.id);}
 assert.equal(includeAsset('assets/legacy-catalog.json',paths),false);
 assert.throws(()=>selectAssetCatalog(current,legacy,'unknown'));
});

test('startup catalog retains the gallery, placement and animation fields for both editions',()=>{
 for(const distribution of ['community','store']){
  const selected=selectAssetCatalog(current,legacy,distribution);
  const script=renderRuntimeAssetCatalog(selected);
  const serialized=runInNewContext(script+'JSON.stringify(window.LUOYE_ASSETS)',{window:{}});
  const runtime=JSON.parse(serialized);
  assert.deepEqual(runtime.map(asset=>asset.id),selected.map(asset=>asset.id));
  assert.deepEqual(runtimeAssetPaths(runtime),runtimeAssetPaths(selected));
  const fields=['name','category','collection','src','thumbnail','width','height','coloring','frames','frameDuration','fairyMode','fairyGroups','fairyBehavior','legacyOf'];
  for(const [index,asset] of runtime.entries()){
   for(const field of fields)assert.deepEqual(asset[field],selected[index][field],asset.id+' '+field);
   for(const provenance of ['sources','masterSource','artDirection','originalFairyGroups'])assert.ok(!Object.hasOwn(asset,provenance));
  }
  assert.ok(script.length<JSON.stringify(selected).length);
 }
});
