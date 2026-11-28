import { makeCanvas } from '../core/engine.js';
import { openDialog } from './dialog-focus.js';

// Persistence is a platform capability supplied by the app shell.
export function mountGallery({ engine, run, toast, getTitle, setTitle, storage }) {
  const button = document.createElement('button');
  button.id = 'gallery';
  button.type = 'button';
  button.textContent = '我的画夹';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'gallery-dialog');
  document.querySelector('.header-actions').prepend(button);

  const dialog = document.createElement('dialog');
  dialog.id = 'gallery-dialog';
  dialog.className = 'gallery-dialog';
  dialog.setAttribute('aria-labelledby', 'gallery-title');
  dialog.innerHTML = `
    <div class="gallery-heading">
      <h2 id="gallery-title">我的画夹</h2>
      <button type="button" id="gallery-close" aria-label="关闭">×</button>
    </div>
    <p class="gallery-note">作品保存在这台设备。重要作品还请保存为工程文件。</p>
    <form class="gallery-save-controls">
      <label for="gallery-folder">画夹名称
        <input id="gallery-folder" placeholder="我的作品" maxlength="60">
      </label>
      <button type="submit" id="gallery-save" class="primary">保存一份到画夹</button>
    </form>
    <section class="gallery-collection" aria-labelledby="gallery-items-heading">
      <div class="gallery-list-heading">
        <h3 id="gallery-items-heading">已保存的作品</h3>
        <label><input id="gallery-trash" type="checkbox" aria-controls="gallery-items gallery-empty">查看回收站</label>
      </div>
      <p id="gallery-empty" class="gallery-empty" role="status" hidden></p>
      <ul id="gallery-items" class="gallery-items" role="list" hidden></ul>
    </section>`;
  document.body.append(dialog);

  const { galleryList, galleryPut, galleryGet, galleryTrash, writeDraft } = storage;
  const folderInput = dialog.querySelector('#gallery-folder');
  const trashToggle = dialog.querySelector('#gallery-trash');
  const itemsList = dialog.querySelector('#gallery-items');
  const itemsHeading = dialog.querySelector('#gallery-items-heading');
  const empty = dialog.querySelector('#gallery-empty');

  function renderCard(item, trash) {
    const card = document.createElement('li');
    card.className = 'gallery-card';

    const image = document.createElement('img');
    image.src = item.thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    const name = document.createElement('strong');
    name.textContent = item.title;
    if (!['我的奇妙世界', '我的画'].includes(item.title)) name.dataset.i18nIgnore = '';

    const info = document.createElement('small');
    const folder = document.createElement('span');
    folder.textContent = item.folder;
    if (!['我的作品', '自动保留'].includes(item.folder)) folder.dataset.i18nIgnore = '';
    const date = document.createElement('time');
    const updated = new Date(item.updatedAt);
    if (Number.isFinite(updated.getTime())) {
      date.dateTime = updated.toISOString();
      date.textContent = updated.toLocaleDateString(document.documentElement.lang);
    }
    info.append(folder, date);

    const actions = document.createElement('div');
    actions.className = 'gallery-card-actions';
    const open = document.createElement('button');
    open.textContent = trash ? '恢复' : '打开';
    open.onclick = () => run(async () => {
      if (trash) {
        await galleryTrash(item.id, null);
        await refresh();
        return;
      }
      const saved = await galleryGet(item.id);
      if (!saved) throw new Error('作品不存在');
      await backup();
      await engine.restore(saved.project);
      setTitle(saved.project.title);
      dialog.close();
      toast('画夹作品已打开');
    });
    actions.append(open);
    if (!trash) {
      const remove = document.createElement('button');
      remove.textContent = '移到回收站';
      remove.onclick = () => run(async () => {
        await galleryTrash(item.id, Date.now());
        await refresh();
      });
      actions.append(remove);
    }

    const details = document.createElement('div');
    details.className = 'gallery-card-details';
    details.append(name, info, actions);
    card.append(image, details);
    return card;
  }

  async function refresh() {
    const items = await galleryList();
    const trash = trashToggle.checked;
    const visible = items.filter(item => Boolean(item.deletedAt) === trash);
    itemsHeading.textContent = trash ? '回收站' : '已保存的作品';
    itemsList.replaceChildren(...visible.map(item => renderCard(item, trash)));
    itemsList.hidden = !visible.length;
    empty.hidden = Boolean(visible.length);
    empty.textContent = visible.length ? '' : trash ? '回收站是空的。' : '还没有作品，先把当前画作保存到画夹吧。';
  }

  async function save(folder, project) {
    const preview = makeCanvas(240, Math.round(240 * engine.height / engine.width));
    const composite = makeCanvas(engine.width, engine.height);
    engine.paint(composite.getContext('2d'));
    preview.getContext('2d').drawImage(composite, 0, 0, preview.width, preview.height);
    await galleryPut({ id: crypto.randomUUID(), folder, project, thumbnail: preview.toDataURL(), updatedAt: Date.now(), deletedAt: null });
  }

  async function backup() {
    engine.end();
    const project = await engine.serialize(getTitle());
    await writeDraft(project);
    await save('自动保留', project);
  }

  button.onclick = () => run(async () => {
    await refresh();
    openDialog(dialog);
  });
  dialog.querySelector('#gallery-close').onclick = () => dialog.close();
  trashToggle.onchange = () => run(refresh);
  dialog.querySelector('form').onsubmit = event => {
    event.preventDefault();
    run(async () => {
      engine.end();
      const folder = folderInput.value.trim() || '我的作品';
      await save(folder, await engine.serialize(getTitle()));
      await refresh();
      toast('作品已保存在画夹');
    });
  };
  return { backup };
}
