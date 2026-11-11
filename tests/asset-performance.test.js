import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PaintEngine, clearImageCache, loadImage } from '../src/core/engine.js';

test('static delivery enables gzip for startup resources', () => {
  const nginx = readFileSync(new URL('../deploy/nginx.conf', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../tools/server.mjs', import.meta.url), 'utf8');
  assert.match(nginx, /gzip\s+on\s*;/);
  assert.match(nginx, /gzip_types[\s\S]*application\/javascript/);
  assert.match(server, /gzipAsync/);
  assert.match(server, /Content-Encoding['\"]:'gzip'/);
});

test('catalog assets have a bounded decode cache and duplicate-load guard', () => {
  const source = readFileSync(new URL('../src/core/engine.js', import.meta.url), 'utf8');
  assert.match(source, /IMAGE_CACHE_MAX_PIXELS/);
  assert.match(source, /imageLoads/);
  assert.match(source, /clearImageCache/);
});

test('concurrent asset requests decode once, including when retrying a failed image', async () => {
  const original = globalThis.Image;
  let attempts = 0;
  globalThis.Image = class {
    width = 16;
    height = 16;
    set src(_source) {
      const attempt = ++attempts;
      queueMicrotask(() => attempt === 1 ? this.onerror() : this.onload());
    }
  };
  try {
    const src = 'assets/concurrent-decode-test.png';
    const failed = await Promise.allSettled([loadImage(src), loadImage(src)]);
    assert.deepEqual(failed.map(request => request.status), ['rejected', 'rejected']);
    assert.equal(attempts, 1);
    const [first, second] = await Promise.all([loadImage(src), loadImage(src)]);
    assert.equal(attempts, 2);
    assert.equal(first, second);
    assert.equal(await loadImage(src), first);
    assert.equal(attempts, 2);
  } finally {
    clearImageCache();
    if (original === undefined) delete globalThis.Image;
    else globalThis.Image = original;
  }
});

test('active top-layer gestures reuse lower-layer composites', () => {
  const source = readFileSync(new URL('../src/core/engine.js', import.meta.url), 'utf8');
  assert.match(source, /gestureCompositeFor\(layer, hasPlayingDynamic = false, frameTime/);
  assert.match(source, /this\.layers\.at\(-1\)!==layer/);
  assert.match(source, /this\.drawLayers\(cachedCtx,layer,frameTime\)/);
  assert.match(source, /gestureCacheHits/);
  assert.match(source, /const frameTime=this\.playing\?performance\.now\(\)-this\.animationStart/);
});

test('gesture composite cache skips only the safe top-layer path', () => {
  const previousDocument = globalThis.document;
  const context = { setTransform() {}, clearRect() {}, drawImage() {}, globalAlpha: 1, globalCompositeOperation: 'source-over' };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  try {
    const bottom = {}, top = {}, calls = [];
    const engine = {
      width: 16, height: 16, layers: [bottom, top], gestureComposite: null,
      metrics: { gestureCacheBuilds: 0, gestureCacheHits: 0 },
      drawLayers(_ctx, skip) { calls.push(skip); },
    };
    const first = PaintEngine.prototype.gestureCompositeFor.call(engine, top, false, 1);
    const second = PaintEngine.prototype.gestureCompositeFor.call(engine, top, false, 2);
    assert.ok(first);
    assert.equal(second, first);
    assert.equal(engine.metrics.gestureCacheBuilds, 1);
    assert.equal(engine.metrics.gestureCacheHits, 1);
    assert.deepEqual(calls, [top]);
    assert.equal(PaintEngine.prototype.gestureCompositeFor.call(engine, bottom, false, 3), null);
    assert.equal(PaintEngine.prototype.gestureCompositeFor.call(engine, top, true, 3), null);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('sprite hit samples draw only nearby stamps in painter order', () => {
  const calls = [];
  const context = {
    globalAlpha: 1,
    drawImage(frame) { calls.push([frame, this.globalAlpha]); },
  };
  const first = { width: 20, height: 20 }, second = { width: 20, height: 20 };
  const layer = {
    scale: 1,
    spriteGroups: [{ frames: [first], frameDuration: 100 }, { frames: [second], frameDuration: 100 }],
    sprites: [
      { group: 0, x: 100, y: 20, size: 20, opacity: 1 },
      { group: 1, x: 18, y: 20, size: 20, opacity: .25 },
      { group: 0, x: 24, y: 20, size: 20, opacity: .5 },
      { group: 1, x: 20, y: 100, size: 20, opacity: 1 },
    ],
  };
  PaintEngine.prototype.drawLayer.call({}, context, layer, 0, true, { x: 20, y: 20 });
  assert.deepEqual(calls, [[second, .25], [first, .5]]);
  assert.equal(context.globalAlpha, 1);
});
