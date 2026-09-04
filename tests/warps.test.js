import test from 'node:test';
import assert from 'node:assert/strict';
import { warpPixels } from '../src/warps.js';
const fixture=()=>{const a=new Uint8ClampedArray(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;a.set([x*8,y*8,80,255],i);}return a;};
test('push and zoom keep pixels outside radius and leave input untouched',()=>{
 const a=fixture(),before=a.slice();for(const kind of ['push','zoom']){const b=warpPixels(a,32,32,{kind,x:16,y:16,radius:10,dx:5,dy:0,speed:60});assert.notDeepEqual(b,a);assert.deepEqual(b.slice(0,32*4),a.slice(0,32*4));}assert.deepEqual(a,before);assert.deepEqual(warpPixels(a,32,32,{kind:'push',x:16,y:16,radius:10,dx:5,speed:0}),a);
});
test('five board filters have distinct bounded outputs and bilinear sampling preserves alpha',()=>{
 const a=fixture(),seen=new Set();for(const kind of ['ripple','twist','waterfall','point-light','direction-light'])seen.add(Buffer.from(warpPixels(a,32,32,{kind,x:16,y:16,radius:14,density:70,curvature:120,height:50,spread:30,angle:45})).toString('base64'));assert.equal(seen.size,5);
 const transparent=new Uint8ClampedArray(8*8*4);for(let i=0;i<transparent.length;i+=4)transparent[i]=255;transparent.set([0,0,255,255],(4*8+4)*4);const b=warpPixels(transparent,8,8,{kind:'push',x:4,y:4,radius:3,dx:.5,dy:0,speed:100});for(let i=0;i<b.length;i+=4)if(b[i+3])assert.equal(b[i],0,'hidden RGB leaked');
 assert.throws(()=>warpPixels(a,32,32,{kind:'unknown'}));
});
