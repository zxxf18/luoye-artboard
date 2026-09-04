import { galleryList, galleryPut, galleryGet, galleryTrash, writeDraft } from './storage.js';
import { makeCanvas } from './engine.js';

export function mountGallery({engine,run,toast,getTitle,setTitle}){
  const button=document.createElement('button');button.textContent='我的画夹';button.id='gallery';document.querySelector('.header-actions').prepend(button);
  const dialog=document.createElement('dialog');dialog.id='gallery-dialog';dialog.className='wide-dialog';dialog.innerHTML='<h2>我的画夹</h2><p>作品保存在这台设备。重要作品还请保存为工程文件。</p><div class="record-controls"><label>画夹名 <input id="gallery-folder" value="我的作品" maxlength="60" aria-label="画夹名称"></label><button id="gallery-save">保存一份到画夹</button><label><input id="gallery-trash" type="checkbox">查看回收站</label></div><div id="gallery-items" class="gallery-items"></div><div class="dialog-actions"><button id="gallery-close">关闭</button></div>';document.body.append(dialog);
  const el=id=>document.getElementById(id);
  async function refresh(){el('gallery-items').replaceChildren();const items=await galleryList(),trash=el('gallery-trash').checked;for(const item of items.filter(i=>Boolean(i.deletedAt)===trash)){
    const card=document.createElement('article');card.className='gallery-card';const image=document.createElement('img');image.src=item.thumbnail;image.alt='';const name=document.createElement('strong');name.textContent=item.title;const info=document.createElement('small');info.textContent=`${item.folder} · ${new Date(item.updatedAt).toLocaleDateString()}`;
    const open=document.createElement('button');open.textContent=trash?'恢复':'打开';open.onclick=()=>run(async()=>{if(trash){await galleryTrash(item.id,null);await refresh();return;}const saved=await galleryGet(item.id);if(!saved)throw new Error('作品不存在');await backup();await engine.restore(saved.project);setTitle(saved.project.title);dialog.close();toast('画夹作品已打开');});
    card.append(image,name,info,open);if(!trash){const remove=document.createElement('button');remove.textContent='移到回收站';remove.onclick=()=>run(async()=>{await galleryTrash(item.id,Date.now());await refresh();});card.append(remove);}el('gallery-items').append(card);
  }if(!el('gallery-items').children.length)el('gallery-items').textContent=trash?'回收站是空的。':'还没有作品，先把当前画作保存到画夹吧。';}
  async function save(folder){const project=await engine.serialize(getTitle()),preview=makeCanvas(240,Math.round(240*engine.height/engine.width));const composite=makeCanvas(engine.width,engine.height);engine.paint(composite.getContext('2d'));preview.getContext('2d').drawImage(composite,0,0,preview.width,preview.height);await galleryPut({id:crypto.randomUUID(),folder,project,thumbnail:preview.toDataURL(),updatedAt:Date.now(),deletedAt:null});}
  async function backup(){engine.end();await writeDraft(await engine.serialize(getTitle()));await save('自动保留');}
  button.onclick=()=>run(async()=>{await refresh();dialog.showModal();});el('gallery-close').onclick=()=>dialog.close();el('gallery-trash').onchange=()=>run(refresh);el('gallery-save').onclick=()=>run(async()=>{engine.end();await save(el('gallery-folder').value.trim()||'我的作品');await refresh();toast('作品已保存在画夹');});
  return {backup};
}
