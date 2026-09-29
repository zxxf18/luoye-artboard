import { brandIcon, playfulIcon } from './playful-icons.js';
import { themeScene } from './theme-scenes.js';

export const THEME_STORAGE_KEY = 'luoye-theme';
export const DEFAULT_THEME = 'autumn';

export const THEMES = Object.freeze([
  { id: 'spring', label: '春', caption: '柳风轻拂', icon: 'forest' },
  { id: 'summer', label: '夏', caption: '海边假日', icon: 'wave' },
  { id: 'autumn', label: '秋', caption: '暖色画室', icon: 'palette' },
  { id: 'winter', label: '冬', caption: '冰晶雪地', icon: 'snow' },
  { id: 'mechanical', label: '机械', caption: '金属传动', icon: 'gear' },
  { id: 'space', label: '宇宙', caption: '星球漫游', icon: 'star' },
  { id: 'ocean', label: '海洋', caption: '海底花园', icon: 'fish' },
  { id: 'candy', label: '糖果', caption: '甜甜画室', icon: 'palette' },
]);

const THEME_IDS = new Set(THEMES.map(theme => theme.id));

function normalizeTheme(value) {
  return THEME_IDS.has(value) ? value : DEFAULT_THEME;
}

export function readTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(value = DEFAULT_THEME, { persist = false } = {}) {
  const theme = normalizeTheme(value);
  document.body.dataset.themeChanging = 'true';
  document.body.dataset.theme = theme;
  const clearTransition = () => {
    if (document.body.dataset.theme === theme) delete document.body.dataset.themeChanging;
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(clearTransition));
  else setTimeout(clearTransition, 0);
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* storage is optional */ }
  }
  return theme;
}

export function applyStoredTheme() {
  return applyTheme(readTheme());
}

function themeIcon(theme) {
  return brandIcon(theme.id, { slot: 'theme' });
}

export function mountTheme() {
  applyStoredTheme();

  const dialog = document.createElement('dialog');
  dialog.id = 'theme-dialog';
  dialog.className = 'theme-dialog';
  dialog.innerHTML = `
    <div class="theme-dialog-heading">
      <div>
        <h2>换一套画室气氛</h2>
        <p class="theme-summary" id="theme-summary">选择喜欢的主题，画纸和素材保持不变。</p>
      </div>
      <button type="button" class="theme-close" aria-label="关闭主题选择">×</button>
    </div>
    <div class="theme-grid" role="group" aria-label="主题配色"></div>
    <div class="dialog-actions"><button type="button" class="primary" id="theme-done">返回画纸</button></div>`;
  document.body.append(dialog);

  const entry = document.createElement('button');
  entry.id = 'theme-open';
  entry.type = 'button';
  entry.className = 'header-command theme-entry';
  entry.setAttribute('aria-label', '主题');
  entry.innerHTML = `${playfulIcon('theme')}<span>主题</span>`;

  const header = document.querySelector('.header-actions');
  if (header) {
    const gallery = header.querySelector('#gallery');
    header.insertBefore(entry, gallery || header.firstElementChild || null);
  }

  const grid = dialog.querySelector('.theme-grid');
  const summary = dialog.querySelector('#theme-summary');
  let selected = applyStoredTheme();

  function renderBrandIcon(theme) {
    const brand = document.querySelector('.brand');
    if (!brand) return;
    const currentIcon = brand.querySelector('.brand-icon, .playful-icon:not(.theme-scene)');
    const icon = brandIcon(theme);
    if (currentIcon) currentIcon.outerHTML = icon;
    else brand.insertAdjacentHTML('afterbegin', icon);
    const currentScene = brand.querySelector('.theme-scene');
    const scene = themeScene(theme, { animated: true });
    if (currentScene) currentScene.outerHTML = scene;
    else brand.insertAdjacentHTML('beforeend', scene);
    brand.dataset.themeIcon = theme;
  }
  renderBrandIcon(selected);

  function sync() {
    const current = THEMES.find(theme => theme.id === selected) || THEMES[2];
    summary.textContent = `当前：${current.label} · ${current.caption}。画纸和素材保持不变。`;
    for (const card of grid.querySelectorAll('[data-theme]')) {
      card.setAttribute('aria-pressed', String(card.dataset.theme === selected));
    }
  }

  for (const theme of THEMES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.dataset.theme = theme.id;
    card.setAttribute('aria-label', `${theme.label}：${theme.caption}`);
    card.innerHTML = `<span class="theme-card-preview" aria-hidden="true">${themeIcon(theme)}</span><span class="theme-card-copy"><strong>${theme.label}</strong><small>${theme.caption}</small></span>`;
    card.addEventListener('click', () => {
      selected = applyTheme(theme.id, { persist: true });
      renderBrandIcon(selected);
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: selected } }));
      sync();
    });
    grid.append(card);
  }

  entry.addEventListener('click', () => { sync(); dialog.showModal(); });
  dialog.querySelector('.theme-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('#theme-done').addEventListener('click', () => dialog.close());
  sync();

  return {
    getTheme: () => selected,
    reset() {
      selected = applyTheme(DEFAULT_THEME);
      renderBrandIcon(selected);
      try { localStorage.removeItem(THEME_STORAGE_KEY); } catch { /* storage is optional */ }
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: selected } }));
      sync();
    },
  };
}
