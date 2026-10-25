import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestFrameQueue } from '../src/core/input-sampling.js';

test('变形帧队列在一帧内只提交最新位置，并能在收笔时立即刷新', () => {
  const callbacks = [], applied = [];
  const queue = createLatestFrameQueue(value => applied.push(value), {
    requestFrame: callback => { callbacks.push(callback); return callbacks.length; },
    cancelFrame: () => {},
  });
  queue.enqueue({ x: 1 }); queue.enqueue({ x: 2 }); queue.enqueue({ x: 3 });
  assert.equal(callbacks.length, 1);
  callbacks[0]();
  assert.deepEqual(applied, [{ x: 3 }]);
  queue.enqueue({ x: 4 }); queue.enqueue({ x: 5 }); queue.flush();
  assert.deepEqual(applied, [{ x: 3 }, { x: 5 }]);
});

test('取消变形时会丢弃尚未提交的帧', () => {
  const callbacks = [], applied = [];
  const queue = createLatestFrameQueue(value => applied.push(value), {
    requestFrame: callback => { callbacks.push(callback); return callbacks.length; },
    cancelFrame: () => {},
  });
  queue.enqueue({ x: 1 }); queue.cancel(); callbacks[0]?.();
  assert.deepEqual(applied, []);
});
