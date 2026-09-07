import test from 'node:test';
import assert from 'node:assert/strict';
import { regionMask, combineMasks, applyEffect, blendMasked } from '../src/pixels.js';

test('RGB function channels have independent parameters and channel shifts use integer pixels',()=>{
 const pixels=new Uint8ClampedArray([10,20,30,255,100,110,120,255]);
 const result=applyEffect(pixels,2,1,'function',{modes:['sin','cos','none'],channels:[{amplitude:0,offset:8,frequency:1},{amplitude:0,offset:9,frequency:2},{amplitude:0,offset:0,frequency:3}]});
 assert.deepEqual([...result],[8,9,30,255,8,9,120,255]);
 assert.deepEqual([...applyEffect(pixels,2,1,'shift',{dx:[1,0,0],dy:[0,0,0]})],[10,20,30,255,10,110,120,255]);
});

test('magic selection respects connected colors and tolerance', () => {
  const pixels = new Uint8ClampedArray([255,255,255,255, 0,0,0,255, 255,255,255,255]);
  assert.deepEqual([...regionMask(pixels,3,1,0,0,10)], [255,0,0]);
  assert.deepEqual([...regionMask(pixels,3,1,0,0,255)], [255,255,255]);
});
test('selection union, subtract and intersect preserve their set meaning', () => {
  const a=new Uint8ClampedArray([255,255,0]), b=new Uint8ClampedArray([0,255,255]);
  assert.deepEqual([...combineMasks(a,b,'union')],[255,255,255]);
  assert.deepEqual([...combineMasks(a,b,'subtract')],[255,0,0]);
  assert.deepEqual([...combineMasks(a,b,'intersect')],[0,255,0]);
});
test('darkroom transformations preserve alpha and original input', () => {
  const source=new Uint8ClampedArray([10,30,50,120, 255,0,0,0]);
  assert.deepEqual([...applyEffect(source,2,1,'invert')],[245,225,205,120,0,255,255,0]);
  assert.deepEqual([...source],[10,30,50,120,255,0,0,0]);
  const gray=applyEffect(source,2,1,'grayscale'); assert.equal(gray[0],gray[1]); assert.equal(gray[1],gray[2]);
  const same=applyEffect(source,2,1,'brightness',{brightness:0,contrast:0});assert.deepEqual(same,source);
});
test('masked effects cannot change pixels outside a selection', () => {
  const original=new Uint8ClampedArray([50,60,70,255, 80,90,100,255]);
  const output=blendMasked(original,applyEffect(original,2,1,'invert'),new Uint8ClampedArray([255,0]));
  assert.deepEqual([...output],[205,195,185,255,80,90,100,255]);
});
test('noise with a recorded seed is reproducible; blur does not leak hidden RGB', () => {
  const source=new Uint8ClampedArray(36).fill(120);
  assert.deepEqual(applyEffect(source,3,3,'noise',{seed:7}),applyEffect(source,3,3,'noise',{seed:7}));
  const edge=new Uint8ClampedArray([255,0,0,0, 0,0,255,255]);
  const out=applyEffect(edge,2,1,'blur',{radius:1});assert.equal(out[0],0);assert.equal(out[2],255);
});
