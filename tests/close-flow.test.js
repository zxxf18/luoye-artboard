import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloseFlow} from '../src/close-flow.js';
test('close preserves work on cancel and save failure, and only discards explicitly',async()=>{
 let choice='cancel',dirty=true,saves=0,discards=0,asks=0;
 const close=createCloseFlow({hasChanges:()=>dirty,ask:async()=>{asks++;return choice;},save:async()=>{saves++;throw Error('disk full');},discard:async()=>{discards++;}});
 assert.deepEqual(await close(),{action:'cancel'});assert.equal(discards,0);
 choice='save';await assert.rejects(close(),/disk full/);assert.equal(discards,0);
 choice='discard';assert.deepEqual(await close(),{action:'exit'});assert.equal(discards,1);
 dirty=false;assert.deepEqual(await close(),{action:'exit'});assert.equal(asks,3);assert.equal(saves,1);
});
test('save returns the payload and repeated close requests share the same choice',async()=>{
 let choose,asks=0;const close=createCloseFlow({hasChanges:()=>true,ask:()=>{asks++;return new Promise(r=>choose=r);},save:async()=>({revision:7}),discard:async()=>{throw Error('unexpected');}});
 const first=close(),second=close();choose('save');
 assert.deepEqual(await first,{action:'save',payload:{revision:7}});assert.deepEqual(await second,await first);assert.equal(asks,1);
});
