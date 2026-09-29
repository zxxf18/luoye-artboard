import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
