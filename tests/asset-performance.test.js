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

test('layer picking reuses one readback surface instead of allocating per hit', () => {
  const source = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  assert.match(source, /this\.hitCanvas=makeCanvas\(1,1,true\)/);
  assert.match(source, /const sample=this\.hitCanvas,ctx=this\.hitContext/);
  assert.doesNotMatch(source, /const sample=makeCanvas\(1,1\),ctx=sample\.getContext/);
  assert.doesNotMatch(source, /for\(const layer of \[\.\.\.this\.layers\]\.reverse\(\)\)/);
});

test('animation wakeups are lazy and limited to visible animated layers', () => {
  const source = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  assert.match(source, /this\.animationTimer = null/);
  assert.match(source, /hasDynamicLayers\(\)/);
  assert.match(source, /layer\.visible && layer\.opacity > 0/);
  assert.match(source, /ensureAnimationTimer\(\)/);
});

test('inactive pointer hover does not enqueue a canvas render for every event', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /const previousPreview=engine\.stampPreview/);
  assert.match(source, /if\(previewChanged\)engine\.render\(\)/);
});

test('duplicate pointer samples do not repaint an in-progress gesture', () => {
  const layer = { x: 0, y: 0, width: 100, height: 100, scale: 1, rotation: 0, flipX: false, flipY: false };
  let segments = 0, renders = 0;
  const value = {
    gesture: { layer, options: { tool: 'pen' }, last: { x: 50, y: 50 } },
    segment() { segments++; }, render() { renders++; },
  };
  PaintEngine.prototype.update.call(value, { x: 0, y: 0 });
  assert.equal(segments, 0);
  assert.equal(renders, 0);
});
