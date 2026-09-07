let draftDatabase;
let draftPreparation;
async function openDraftDatabase() {
  if (draftDatabase) return draftDatabase;
  draftDatabase = await new Promise((resolve, reject) => {
    const request = indexedDB.open('jshw-studio', 2);
    request.onupgradeneeded = () => { for(const name of ['drafts','gallery']) if(!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); };
    request.onsuccess = () => {request.result.onversionchange=()=>{request.result.close();draftDatabase=undefined;};resolve(request.result);};
    request.onblocked=()=>reject(new Error('请先关闭旧版本创作室，再打开画夹。'));
    request.onerror = () => reject(request.error);
  });
  return draftDatabase;
}
export async function writeDraft(project) {
  await preserveDraft();
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite');
    const store=transaction.objectStore('drafts'), previous=store.get('current');previous.onsuccess=()=>{if(previous.result)store.put(previous.result,'previous');store.put({ id:crypto.randomUUID(), project, updatedAt: Date.now() }, 'current');};
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
export async function discardCurrentDraft(){
  const db=await openDraftDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts');
    store.delete('current');store.delete('recording');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('草稿清理失败'));
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

export async function galleryList(){
  const db=await openDraftDatabase();return new Promise((resolve,reject)=>{const items=[],request=db.transaction('gallery').objectStore('gallery').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve(items.sort((a,b)=>b.updatedAt-a.updatedAt));return;}const {project,...metadata}=cursor.value;items.push({...metadata,title:project.title});cursor.continue();};request.onerror=()=>reject(request.error);});
}
export async function galleryGet(id){const db=await openDraftDatabase();return new Promise((resolve,reject)=>{const r=db.transaction('gallery').objectStore('gallery').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function galleryTrash(id,deletedAt){const item=await galleryGet(id);if(!item)throw new Error('画夹作品不存在。');await galleryPut({...item,deletedAt});}
export async function galleryPut(item){const db=await openDraftDatabase();return new Promise((resolve,reject)=>{const t=db.transaction('gallery','readwrite');t.objectStore('gallery').put(item,item.id);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('画夹保存中断'));});}

export async function writeRecordingDraft(recording){const db=await openDraftDatabase();return new Promise((resolve,reject)=>{const t=db.transaction('drafts','readwrite');t.objectStore('drafts').put(recording,'recording');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('录像保存中断'));});}
export async function readRecordingDraft(){const db=await openDraftDatabase();return new Promise((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').get('recording');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}

// One transaction protects the previous session before this session starts writing.
export function preserveDraft(){
  if(draftPreparation)return draftPreparation;
  draftPreparation=prepareDraft().catch(error=>{draftPreparation=undefined;throw error;});
  return draftPreparation;
}
async function prepareDraft(){
  const db=await openDraftDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['drafts','gallery'],'readwrite'),drafts=tx.objectStore('drafts'),request=drafts.get('current');
    request.onsuccess=()=>{const old=request.result;if(!old?.project)return;
      const id='previous-session-'+(old.id||old.updatedAt),store=tx.objectStore('gallery'),existing=store.get(id);
      existing.onsuccess=()=>{if(!existing.result)store.put({id,folder:'自动保留',project:old.project,thumbnail:old.project.layers?.[0]?.image||'',updatedAt:old.updatedAt,deletedAt:null},id);drafts.delete('current');};
    };
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('旧草稿保留失败'));
  });
}
