import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLegacyFly } from '../src/legacy.js';

function fixture(width,height){
 const stride=Math.ceil(width*3/4)*4,bytes=new Uint8Array(76+stride*height),v=new DataView(bytes.buffer);
 bytes.set([0x26,4,0,0,0,0,1,0,0,0,1,0,0,0,0,0]);
 v.setInt32(16,width,true);v.setInt32(20,height,true);v.setUint16(24,65534,true);v.setUint32(26,40+stride*height,true);v.setUint32(30,40,true);v.setInt32(34,width,true);v.setInt32(38,height,true);v.setUint16(42,1,true);v.setUint16(44,24,true);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)bytes.set([x+7,y+11,31],70+(height-1-y)*stride+x*3);
 bytes.set([255,255,0,0,0,0],bytes.length-6);return bytes;
}
test('independent FLY fixtures decode bottom-up rows, BGR and padded strides',()=>{
 for(const [width,height] of [[1,2],[3,4],[4,3]]){
  const image=decodeLegacyFly(fixture(width,height));assert.equal(image.width,width);assert.equal(image.height,height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)assert.deepEqual([...image.rgba.slice((y*width+x)*4,(y*width+x+1)*4)],[31,y+11,x+7,255]);
 }
});
test('truncated, unknown and oversized legacy files are refused',()=>{
 const bytes=fixture(3,4);assert.throws(()=>decodeLegacyFly(bytes.subarray(0,80)));const altered=new Uint8Array(bytes);altered[0]=0;assert.throws(()=>decodeLegacyFly(altered));altered.set(bytes);altered[35]=255;assert.throws(()=>decodeLegacyFly(altered));
});
