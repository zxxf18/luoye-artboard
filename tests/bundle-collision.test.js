import test from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from '../tools/bundle.mjs';

// The bundler concatenates every module into one top-level scope and strips
// import/export lines. Two modules that declare the same top-level name would
// silently shadow each other in the shipped app while the ES-module test
// pages stay green — exactly how the two `shapePath` helpers once broke every
// geometry tool in the bundled build. Keep this check on the real output.
test('打包产物中不允许出现同名顶层声明', async () => {
  const code = await bundle();
  const declared = new Map();
  const pattern = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:export\s+)?(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
  let match;
  while ((match = pattern.exec(code))) {
    const name = match[1] || match[2];
    if (!declared.has(name)) declared.set(name, []);
    declared.get(name).push(match.index);
  }
  const duplicates = [...declared.entries()].filter(([, offsets]) => offsets.length > 1);
  assert.deepEqual(duplicates.map(([name]) => name), [], '以下顶层名称在多个模块中重复声明，会在拼接后的应用里互相遮蔽');
});
