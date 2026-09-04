import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decodeLegacyFly } from '../src/legacy.js';

test('all three installed FLY samples decode dimensions, bottom-up RGB and opaque alpha',async()=>{
 for(const id of ['000','001','002']){const bytes=await readFile(new URL(`../jshw/lan/chs/file/000$${id}.fly`,import.meta.url)),image=decodeLegacyFly(bytes);assert.equal(image.width,600);assert.equal(image.height,450);assert.deepEqual([...image.rgba.slice(0,4)],[bytes[70+449*1800+2],bytes[70+449*1800+1],bytes[70+449*1800],255]);}
});
test('truncated, unknown and oversized legacy files are refused',async()=>{
 const bytes=await readFile(new URL('../jshw/lan/chs/file/000$000.fly',import.meta.url));assert.throws(()=>decodeLegacyFly(bytes.subarray(0,500)));const altered=new Uint8Array(bytes);altered[0]=0;assert.throws(()=>decodeLegacyFly(altered));altered.set(bytes);altered[35]=255;assert.throws(()=>decodeLegacyFly(altered));
});
