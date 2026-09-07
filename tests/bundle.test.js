import test from 'node:test';
import { Script } from 'node:vm';
import { bundle } from '../tools/bundle.mjs';
test('the entire desktop script parses before it can be packaged',async()=>{new Script(await bundle());});
