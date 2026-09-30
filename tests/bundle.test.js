import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { bundle } from '../tools/bundle.mjs';
test('the entire desktop script parses before it can be packaged',async()=>{new Script(await bundle());});
test('the packaged desktop script contains the new drawing feature modules',async()=>{
  const source=await bundle();
  assert(source.includes("id:'rainbow'"));
  assert(source.includes("id:'duotone'"));
  assert(source.includes('function shapeEraserBounds'));
  assert(source.includes('function closedFloodFill'));
});
