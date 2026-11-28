import { openStudioDatabase } from '../src/platform/storage.js';

const fixtures = [
  { id: 'drawing', project: { title: '旧作品', layers: [] }, updatedAt: 20, deletedAt: null },
  { id: 'trashed', project: { title: '回收站作品', layers: [] }, updatedAt: 10, deletedAt: 30 },
];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function checkExistingGallery(version) {
  const name = `test-gallery-index-${crypto.randomUUID()}`;
  let database;
  try {
    const create = indexedDB.open(name, version);
    create.onupgradeneeded = () => {
      const { result } = create;
      result.createObjectStore('drafts');
      const gallery = result.createObjectStore('gallery');
      for (const item of fixtures) gallery.put(item, item.id);
      if (version === 3) {
        result.createObjectStore('galleryMeta').put({ id: 'drawing', title: '旧作品' }, 'drawing');
      }
    };
    database = await requestResult(create);
    database.close();

    for (let open = 0; open < 2; open++) {
      database = await openStudioDatabase(name);
      const transaction = database.transaction(['gallery', 'galleryMeta']);
      const [metadata, drawings] = await Promise.all([
        requestResult(transaction.objectStore('galleryMeta').getAll()),
        requestResult(transaction.objectStore('gallery').getAll()),
      ]);
      if (database.version !== 3 || metadata.length !== fixtures.length) throw new Error('画夹索引不完整');
      for (const item of fixtures) {
        const row = metadata.find(entry => entry.id === item.id);
        const original = drawings.find(entry => entry.id === item.id);
        if (!row || row.title !== item.project.title || row.deletedAt !== item.deletedAt || 'project' in row) {
          throw new Error(`作品 ${item.id} 的画夹索引错误`);
        }
        if (JSON.stringify(original) !== JSON.stringify(item)) throw new Error('原有作品被改写');
      }
      database.close();
    }
  } finally {
    database?.close();
    await requestResult(indexedDB.deleteDatabase(name));
  }
}

const checks = [];
for (const [version, name] of [[2, '从 v2 升级时找回画夹作品'], [3, '修复已有 v3 画夹索引并可重复打开']]) {
  try {
    await checkExistingGallery(version);
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
  }
}
document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
