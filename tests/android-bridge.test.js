import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = await readFile(new URL('../public/android-bridge.js', import.meta.url), 'utf8');

test('Android bridge exposes the desktop-compatible channels and JSON payloads', () => {
  const messages = [];
  const context = { AndroidBridge: { post: (channel, payload) => messages.push({ channel, payload }) } };
  vm.runInNewContext(source, context);
  context.webkit.messageHandlers.files.postMessage({ id: 'x', name: '画.luoyex' });
  assert.deepEqual(messages, [{ channel: 'files', payload: '{"id":"x","name":"画.luoyex"}' }]);
  assert.deepEqual(Object.keys(context.webkit.messageHandlers).sort(), ['display', 'files', 'music', 'ready']);
});

test('Android bridge does not replace an existing desktop or browser webkit object', () => {
  const existing = { messageHandlers: { ready: { postMessage() {} } } };
  const context = { AndroidBridge: { post() {} }, webkit: existing };
  vm.runInNewContext(source, context);
  assert.equal(context.webkit, existing);
});
