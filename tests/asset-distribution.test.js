import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {selectAssetCatalog} from '../tools/assets/asset-distribution.mjs';
import {runtimeAssetPaths,includeAsset} from '../tools/assets/runtime-assets.mjs';
const current=JSON.parse(await readFile(new URL('../public/assets/catalog.json',import.meta.url)));
const legacy=JSON.parse(await readFile(new URL('../resources/assets/legacy-catalog.json',import.meta.url)));
test('community retains all current entries and exposes the previous replacements separately',async()=>{
 const merged=selectAssetCatalog(current,legacy,'community');
 assert.equal(merged.length,current.length+111);assert.equal(new Set(merged.map(x=>x.id)).size,merged.length);
 for(const original of legacy){const saved=merged.find(x=>x.id===original.id+'-legacy');assert.ok(saved,original.id);assert.equal(saved.category,original.category);assert.equal(saved.collection,original.collection);assert.equal(saved.src,original.src);assert.equal(saved.legacyOf,original.id);}
 for(const p of runtimeAssetPaths(merged))await access(new URL('../public/'+p,import.meta.url));
});
test('store excludes legacy entries, their bitmaps and the archive index',()=>{
 const selected=selectAssetCatalog(current,legacy,'store'),paths=runtimeAssetPaths(selected);
 assert.deepEqual(selected,current);
 for(const old of legacy){assert.equal(includeAsset(old.src,paths),false,old.id);assert.equal(includeAsset(old.thumbnail,paths),false,old.id);}
 assert.equal(includeAsset('assets/legacy-catalog.json',paths),false);
 assert.throws(()=>selectAssetCatalog(current,legacy,'unknown'));
});
