import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFractal } from '../src/fractals.js';
test('Mandel and Julia obey escape iteration and keep output dimensions',async()=>{
 const a=await generateFractal({kind:'mandel',width:64,height:48,left:-2,right:1,top:-1.5,bottom:1.5});assert.equal(a.data.length,64*48*4);const center=(24*64+42)*4;assert.deepEqual([...a.data.slice(center,center+4)],[0,0,0,255]);const b=await generateFractal({kind:'julia',width:64,height:48});assert.notDeepEqual(a.data,b.data);
});
test('IFS repeats the same seeded pattern, density changes coverage, cancel is honored',async()=>{
 const options={kind:'ifs',width:64,height:96,seed:42,density:10};const a=await generateFractal(options),b=await generateFractal(options);assert.deepEqual(a.data,b.data);const c=await generateFractal({...options,density:100});assert.notDeepEqual(a.data,c.data);const signal=AbortSignal.abort();await assert.rejects(generateFractal({kind:'julia',width:64,height:64},{signal}),{name:'AbortError'});await assert.rejects(generateFractal({kind:'norton',width:64,height:64}));await assert.rejects(generateFractal({kind:'mandel',width:1e9,height:64}));
});
