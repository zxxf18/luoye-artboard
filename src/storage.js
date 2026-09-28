import { validateProject } from './core.js';
import { validateRecording } from './recording.js';
import { DRAFT_STORAGE_VERSION, createDraftRecord, galleryMetadata, previousSessionId, shouldSkipDraftWrite, storageErrorMessage } from './storage-format.js';

const DATABASE_NAME = 'luoye-studio';
const DATABASE_VERSION = 3;
let draftDatabase;
let draftPreparation;
let draftWriteChain = Promise.resolve();
let latestRequestedRevision = -Infinity;

function failStorage(error, operation) {
  if (error instanceof Error && error.message.startsWith(`${operation}失败：`)) return error;
  const wrapped = new Error(storageErrorMessage(error, operation));
  wrapped.name = error?.name || 'StorageError';
  wrapped.cause = error;
  return wrapped;
}

function finishTransaction(transaction, resolve, reject, operation, value) {
  transaction.oncomplete = () => resolve(typeof value === 'function' ? value() : value);
  transaction.onerror = () => reject(failStorage(transaction.error, operation));
  transaction.onabort = () => reject(failStorage(transaction.error || new Error('事务中断'), operation));
}

async function openDraftDatabase() {
  if (draftDatabase) return draftDatabase;
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const transaction = request.transaction;
      for (const name of ['drafts', 'gallery']) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      }
      const meta = request.result.objectStoreNames.contains('galleryMeta')
        ? transaction.objectStore('galleryMeta')
        : request.result.createObjectStore('galleryMeta');
      const gallery = transaction.objectStore('gallery');
      if (request.oldVersion < DATABASE_VERSION) {
        const cursor = gallery.openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          meta.put(galleryMetadata(current.value), current.key);
          current.continue();
        };
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); draftDatabase = undefined; };
      resolve(request.result);
    };
    request.onblocked = () => reject(new Error('请先关闭旧版本创作室，再打开画夹。'));
    request.onerror = () => reject(request.error);
  });
  try {
    await migrateCompatibleLibraries(database);
    draftDatabase = database;
    return database;
  } catch (error) {
    database.close();
    throw failStorage(error, '本机作品迁移');
  }
}

async function migrateCompatibleLibraries(target) {
  if (typeof indexedDB.databases !== 'function') return;
  for (const info of await indexedDB.databases()) {
    if (!info.name || info.name === target.name || !info.name.endsWith('-studio')) continue;
    const marker = `luoye-imported:${info.name}`;
    if (localStorage.getItem(marker)) continue;
    const source = await new Promise((resolve, reject) => {
      const request = indexedDB.open(info.name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      if (!['gallery', 'drafts'].every(store => source.objectStoreNames.contains(store))) continue;
      const records = [];
      let recording;
      for (const name of ['gallery', 'drafts']) await new Promise((resolve, reject) => {
        const transaction = source.transaction(name);
        const cursor = transaction.objectStore(name).openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          try {
            const item = current.value;
            if (item?.project) {
              const project = validateProject(item.project);
              records.push({ ...item, storageVersion: DRAFT_STORAGE_VERSION, recordKind: 'gallery', project, id: `imported:${info.name}:${name}:${current.key}`, folder: '旧版作品', deletedAt: item.deletedAt ?? null });
            }
            if (name === 'drafts' && current.key === 'recording') recording = validateRecording(item);
            current.continue();
          } catch (error) {
            transaction.abort();
            reject(error);
          }
        };
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('旧作品读取失败'));
      });
      await new Promise((resolve, reject) => {
        const transaction = target.transaction(['gallery', 'galleryMeta'], 'readwrite');
        const store = transaction.objectStore('gallery');
        const meta = transaction.objectStore('galleryMeta');
        for (const item of records) { store.put(item, item.id); meta.put(galleryMetadata(item), item.id); }
        finishTransaction(transaction, resolve, reject, '旧作品迁移');
      });
      if (recording) await new Promise((resolve, reject) => {
        const transaction = target.transaction('drafts', 'readwrite');
        const store = transaction.objectStore('drafts');
        const request = store.get('recording');
        request.onsuccess = () => { if (!request.result) store.put(recording, 'recording'); };
        finishTransaction(transaction, resolve, reject, '录像迁移');
      });
      localStorage.setItem(marker, '1');
    } finally {
      source.close();
    }
  }
}

async function writeDraftNow(project, revision) {
  await preserveDraft();
  if (Number.isFinite(revision) && revision < latestRequestedRevision) return { skipped: true, revision };
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite');
    const store = transaction.objectStore('drafts');
    let result;
    const current = store.get('current');
    current.onsuccess = () => {
      if (shouldSkipDraftWrite(current.result, revision)) { result = { skipped: true, revision }; return; }
      if (current.result) store.put({ ...current.result, recordKind: 'draft-previous' }, 'previous');
      result = createDraftRecord(project, { revision });
      result.recordKind = 'draft-current';
      store.put(result, 'current');
    };
    finishTransaction(transaction, resolve, reject, '草稿保存', () => result);
  });
}

export function writeDraft(project, { revision = null } = {}) {
  if (Number.isFinite(revision)) latestRequestedRevision = Math.max(latestRequestedRevision, revision);
  const task = draftWriteChain.catch(() => {}).then(() => writeDraftNow(project, revision));
  draftWriteChain = task.catch(() => {});
  return task;
}

export async function readDraft() {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('drafts').objectStore('drafts').get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(failStorage(request.error, '草稿读取'));
  });
}

export async function discardCurrentDraft() {
  await draftWriteChain.catch(() => {});
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite');
    const store = transaction.objectStore('drafts');
    store.delete('current');
    store.delete('recording');
    finishTransaction(transaction, resolve, reject, '草稿清理');
  });
}

export async function deliverFile(name, mime, textOrDataURL) {
  if (window.webkit?.messageHandlers?.files) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const listener = event => {
        if (event.detail.id !== id) return;
        window.removeEventListener('native-file-result', listener);
        if (event.detail.error) reject(new Error(event.detail.error)); else resolve(event.detail.saved ? '文件已保存' : '已取消保存');
      };
      window.addEventListener('native-file-result', listener);
      window.webkit.messageHandlers.files.postMessage({ id, name, mime, content: textOrDataURL });
    });
  }
  const url = textOrDataURL.startsWith('data:') ? textOrDataURL : URL.createObjectURL(new Blob([textOrDataURL], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 10000);
  return '已生成下载文件';
}

export async function galleryList() {
  const database = await openDraftDatabase();
  const storeName = database.objectStoreNames.contains('galleryMeta') ? 'galleryMeta' : 'gallery';
  return new Promise((resolve, reject) => {
    const items = [];
    const request = database.transaction(storeName).objectStore(storeName).openCursor();
    request.onsuccess = () => {
      const current = request.result;
      if (!current) { resolve(items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))); return; }
      items.push(storeName === 'galleryMeta' ? current.value : galleryMetadata(current.value));
      current.continue();
    };
    request.onerror = () => reject(failStorage(request.error, '画夹读取'));
  });
}

export async function galleryGet(id) {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('gallery').objectStore('gallery').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(failStorage(request.error, '作品读取'));
  });
}

export async function galleryTrash(id, deletedAt) {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    let missing = false;
    const transaction = database.transaction(['gallery', 'galleryMeta'], 'readwrite');
    const store = transaction.objectStore('gallery');
    const meta = transaction.objectStore('galleryMeta');
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) { missing = true; transaction.abort(); return; }
      const item = { ...request.result, deletedAt };
      store.put(item, id);
      meta.put(galleryMetadata(item), id);
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(missing ? new Error('画夹作品不存在。') : failStorage(transaction.error, '画夹更新'));
    transaction.onabort = () => reject(missing ? new Error('画夹作品不存在。') : failStorage(transaction.error || new Error('画夹更新中断'), '画夹更新'));
  });
}

export async function galleryPut(item) {
  const database = await openDraftDatabase();
  const value = { ...item, storageVersion: DRAFT_STORAGE_VERSION, recordKind: 'gallery' };
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['gallery', 'galleryMeta'], 'readwrite');
    transaction.objectStore('gallery').put(value, value.id);
    transaction.objectStore('galleryMeta').put(galleryMetadata(value), value.id);
    finishTransaction(transaction, resolve, reject, '画夹保存');
  });
}

export async function writeRecordingDraft(recording) {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite');
    transaction.objectStore('drafts').put(recording, 'recording');
    finishTransaction(transaction, resolve, reject, '录像保存');
  });
}

export async function readRecordingDraft() {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('drafts').objectStore('drafts').get('recording');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(failStorage(request.error, '录像读取'));
  });
}

export function preserveDraft() {
  if (draftPreparation) return draftPreparation;
  draftPreparation = prepareDraft().catch(error => { draftPreparation = undefined; throw error; });
  return draftPreparation;
}

async function prepareDraft() {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['drafts', 'gallery', 'galleryMeta'], 'readwrite');
    const drafts = transaction.objectStore('drafts');
    const gallery = transaction.objectStore('gallery');
    const meta = transaction.objectStore('galleryMeta');
    const request = drafts.get('current');
    request.onsuccess = () => {
      const old = request.result;
      if (!old?.project) return;
      const id = previousSessionId(old);
      const existing = gallery.get(id);
      existing.onsuccess = () => {
        if (!existing.result) {
          const item = { id, folder: '自动保留', project: old.project, thumbnail: '', updatedAt: old.updatedAt || Date.now(), deletedAt: null, storageVersion: DRAFT_STORAGE_VERSION, recordKind: 'gallery' };
          gallery.put(item, id);
          meta.put(galleryMetadata(item), id);
        }
        drafts.delete('current');
      };
    };
    finishTransaction(transaction, resolve, reject, '旧草稿保留');
  });
}
