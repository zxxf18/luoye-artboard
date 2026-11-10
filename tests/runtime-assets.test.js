import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeAssetPaths,includeAsset} from '../tools/runtime-assets.mjs';
test('packaging keeps runtime frames but excludes old brand images and source masters',()=>{
 const paths=runtimeAssetPaths([{src:'assets/new.webp',thumbnail:'assets/thumb.webp',frames:['assets/a.webp'],fairyGroups:[{frames:['assets/b.webp']}],masterSource:'assets/masters/old.webp'}]);
 for(const p of ['assets/new.webp','assets/thumb.webp','assets/a.webp','assets/b.webp','assets/catalog.js','branding/logo.png'])assert.equal(includeAsset(p,paths),true);
 for(const p of ['assets/masters/old.webp','assets/old-tesla.webp'])assert.equal(includeAsset(p,paths),false);
});
