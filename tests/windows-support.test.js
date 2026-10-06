import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Windows display bridge reports the applied client size', async () => {
  const source = await readFile(new URL('../native/windows/Program.cs', import.meta.url), 'utf8');
  assert.match(source, /case "display": await SetDisplay\(/);
  assert.match(source, /async Task SetDisplay\(string\? action\)/);
  assert.equal((source.match(/native-display-result/g) || []).length, 2);
  assert.match(source, /width=web\.ClientSize\.Width,height=web\.ClientSize\.Height/);
});
