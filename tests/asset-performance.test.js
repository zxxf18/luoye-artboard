import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PaintEngine } from '../src/engine.js';

test('static delivery enables gzip for startup resources', () => {
  const nginx = readFileSync(new URL('../deploy/nginx.conf', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../tools/server.mjs', import.meta.url), 'utf8');
  assert.match(nginx, /gzip\s+on\s*;/);
  assert.match(nginx, /gzip_types[\s\S]*application\/javascript/);
  assert.match(server, /gzipAsync/);
  assert.match(server, /Content-Encoding['\"]:'gzip'/);
});

test('catalog assets have a bounded decode cache and duplicate-load guard', () => {
  const source = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  assert.match(source, /IMAGE_CACHE_MAX_PIXELS/);
  assert.match(source, /imageLoads/);
  assert.match(source, /clearImageCache/);
});

test('active top-layer gestures reuse lower-layer composites', () => {
  const source = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
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
