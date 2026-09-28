import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAFT_STORAGE_VERSION,
  createDraftRecord,
  shouldSkipDraftWrite,
  classifyStorageError,
  previousSessionId,
  galleryMetadata,
} from '../src/storage-format.js';

const project = { title: '测试作品', width: 320, height: 240, layers: [] };

test('draft records carry a version and revision for idempotent recovery', () => {
  const record = createDraftRecord(project, { id: 'draft-1', revision: 12, updatedAt: 100 });
  assert.deepEqual(record, {
    storageVersion: DRAFT_STORAGE_VERSION,
    id: 'draft-1',
    revision: 12,
    project,
    updatedAt: 100,
  });
});

test('autosave skips an already committed revision but writes a changed revision', () => {
  const current = createDraftRecord(project, { id: 'draft-1', revision: 12, updatedAt: 100 });
  assert.equal(shouldSkipDraftWrite(current, 12), true);
  assert.equal(shouldSkipDraftWrite(current, 13), false);
  assert.equal(shouldSkipDraftWrite(null, 12), false);
  assert.equal(shouldSkipDraftWrite(current), false);
});

test('storage errors expose actionable user-facing categories', () => {
  const quota = new DOMException('full', 'QuotaExceededError');
  assert.equal(classifyStorageError(quota), 'quota');
  assert.equal(classifyStorageError(new DOMException('blocked', 'InvalidStateError')), 'unavailable');
  assert.equal(classifyStorageError(new Error('other')), 'unknown');
});

test('previous session ids remain stable for the same draft record', () => {
  assert.equal(previousSessionId({ id: 'draft-1', updatedAt: 100 }), 'previous-session-draft-1');
  assert.equal(previousSessionId({ updatedAt: 100 }), 'previous-session-100');
});

test('gallery metadata never carries the full project payload', () => {
  const metadata = galleryMetadata({ id: 'g1', folder: '作品', project, thumbnail: 'data:image/png;base64,small', updatedAt: 100 });
  assert.equal(metadata.project, undefined);
  assert.equal(metadata.title, project.title);
  assert.equal(metadata.storageVersion, DRAFT_STORAGE_VERSION);
});
