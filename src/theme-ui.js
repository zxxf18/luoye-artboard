import { playfulIcon } from './playful-icons.js';

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
  document.body.dataset.theme = theme;
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* storage is optional */ }
  }
  return theme;
}

export function applyStoredTheme() {
  return applyTheme(readTheme());
}

function themeIcon(theme) {
  return playfulIcon(theme.icon);
}

export function mountTheme() {
  applyStoredTheme();

  const decoration = document.createElement('div');
  decoration.className = 'theme-decoration';
  decoration.setAttribute('aria-hidden', 'true');
  decoration.innerHTML = '<span class="theme-decoration-a"></span><span class="theme-decoration-b"></span><span class="theme-decoration-c"></span>';
  document.body.append(decoration);

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
  entry.className = 'theme-entry';
  entry.setAttribute('aria-label', '换肤');
  entry.innerHTML = `${playfulIcon('palette')}<span>换肤</span>`;

  const actions = document.querySelector('#more-dialog .more-actions');
  if (actions) actions.append(entry);
  else document.querySelector('.header-actions')?.append(entry);

  const grid = dialog.querySelector('.theme-grid');
  const summary = dialog.querySelector('#theme-summary');
  let selected = applyStoredTheme();

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
    card.innerHTML = `<span class="theme-card-preview" aria-hidden="true"><i></i><b></b></span><span class="theme-card-copy"><strong>${theme.label}</strong><small>${theme.caption}</small></span>${themeIcon(theme)}`;
    card.addEventListener('click', () => {
      selected = applyTheme(theme.id, { persist: true });
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
      try { localStorage.removeItem(THEME_STORAGE_KEY); } catch { /* storage is optional */ }
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: selected } }));
      sync();
    },
  };
}
