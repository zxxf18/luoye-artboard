const open=(name)=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,2);r.onupgradeneeded=()=>{for(const store of ['drafts','gallery'])if(!r.result.objectStoreNames.contains(store))r.result.createObjectStore(store);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
if(!localStorage.getItem('luoye-migration-test')){
 const project=(await window.LUOYEFlushBeforeClose()).project;project.format='previous-studio';project.title='旧版迁移验证';
 const db=await open('previous-studio');await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({project,updatedAt:1},'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 localStorage.setItem('luoye-migration-test','1');return {reloadForTest:true};
}
const db=await open('luoye-studio');const rows=await new Promise(resolve=>{const r=db.transaction('gallery').objectStore('gallery').getAll();r.onsuccess=()=>resolve(r.result);});db.close();
const migrated=rows.filter(r=>r.id.startsWith('imported:previous-studio:'));
if(migrated.length!==1||migrated[0].project.title!=='旧版迁移验证'||migrated[0].project.format!=='luoye-studio')throw Error('旧版草稿迁移失败或重复');
return {passed:true,migrated:1,format:migrated[0].project.format};
