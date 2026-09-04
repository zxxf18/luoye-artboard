let draftDatabase;
async function openDraftDatabase() {
  if (draftDatabase) return draftDatabase;
  draftDatabase = await new Promise((resolve, reject) => {
    const request = indexedDB.open('jshw-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return draftDatabase;
}
export async function writeDraft(project) {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite');
    transaction.objectStore('drafts').put({ project, updatedAt: Date.now() }, 'current');
    transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('草稿写入被中断'));
  });
}
export async function readDraft() {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('drafts').objectStore('drafts').get('current');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function deliverFile(name, mime, textOrDataURL) {
  if (window.webkit?.messageHandlers?.files) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const listener = (event) => {
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
