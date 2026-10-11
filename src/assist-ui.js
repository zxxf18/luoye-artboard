export function mountAssist({ engine, toast }) {
  const button = document.createElement('button');
  button.id = 'assist-open';
  button.className = 'assist-open';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'assist-dialog');
  button.innerHTML = '<span class="assist-open-mark" aria-hidden="true">✦</span><span>辅助</span>';

  const dialog = document.createElement('dialog');
  dialog.id = 'assist-dialog';
  dialog.className = 'assist-dialog';
  dialog.innerHTML = `<form method="dialog" class="assist-form">
    <header class="assist-header"><div class="assist-title"><strong>辅助绘画</strong><span>对称画笔、图形和印章</span></div><div class="assist-header-actions"><label class="assist-switch"><input id="assist-enabled" type="checkbox"><span class="assist-switch-track"></span><span class="assist-switch-copy"><b>启用</b><small>新笔触生效</small></span></label><button class="assist-close" value="cancel" aria-label="关闭辅助设置">×</button></div></header>
    <div class="assist-status" id="assist-status" role="status"></div>
    <div class="assist-layout">
      <section class="assist-card assist-core"><div class="assist-card-heading"><strong>对称设置</strong><small>选择复制方向和中心</small></div><div class="assist-section assist-mode-row"><label for="assist-mode-trigger">对称方式</label><select id="assist-mode" class="assist-mode-source" data-direct-choice="true" aria-hidden="true" tabindex="-1" hidden><option value="vertical">左右对称</option><option value="horizontal">上下对称</option><option value="four">四向对称</option><option value="radial">环形对称</option></select><button id="assist-mode-trigger" class="assist-mode-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="assist-mode-menu"><span class="assist-mode-trigger-value">左右对称</span><span class="assist-mode-trigger-arrow" aria-hidden="true">▾</span></button><div id="assist-mode-menu" class="assist-mode-menu" role="listbox" aria-label="对称方式" hidden><button type="button" role="option" data-assist-mode-option="vertical" aria-selected="true">左右对称</button><button type="button" role="option" data-assist-mode-option="horizontal" aria-selected="false">上下对称</button><button type="button" role="option" data-assist-mode-option="four" aria-selected="false">四向对称</button><button type="button" role="option" data-assist-mode-option="radial" aria-selected="false">环形对称</button></div></div><div class="assist-section assist-axes-row"><label for="assist-axes">环形份数 <output id="assist-axes-value">8</output></label><input id="assist-axes" type="range" min="2" max="16" step="1" value="8"></div><div class="assist-center-grid"><div class="assist-section"><label for="assist-center-x">中心横向 <output id="assist-center-x-value">50%</output></label><input id="assist-center-x" type="range" min="0" max="100" step="1" value="50"></div><div class="assist-section"><label for="assist-center-y">中心纵向 <output id="assist-center-y-value">50%</output></label><input id="assist-center-y" type="range" min="0" max="100" step="1" value="50"></div></div></section>
      <section class="assist-card assist-options"><div class="assist-card-heading"><strong>预览与素材</strong><small>只影响编辑过程</small></div><div class="assist-checks"><label class="assist-check"><input id="assist-guides" type="checkbox" checked><span>显示对称辅助线</span></label><label class="assist-check"><input id="assist-grid" type="checkbox"><span>显示淡色网格</span></label><label class="assist-check"><input id="assist-stamp" type="checkbox"><span>静态素材同步</span></label></div><p class="assist-note">辅助线不会保存或导出；动态魔法袋仍保持单点行为。</p></section>
    </div>
  </form>`;
  document.body.append(dialog);
  document.querySelector('.canvas-topbar')?.append(button);

  const state = { enabled: false, mode: 'vertical', axes: 8, centerX: 50, centerY: 50, showGuides: true, showGrid: false, stamp: false };
  const el = id => dialog.querySelector('#' + id);
  const modeSelect = el('assist-mode');
  const modeTrigger = el('assist-mode-trigger');
  const modeMenu = el('assist-mode-menu');
  const modeOptions = [...modeMenu.querySelectorAll('[data-assist-mode-option]')];
  const modeLabel = value => modeOptions.find(option => option.dataset.assistModeOption === value)?.textContent.trim() || '左右对称';
  let modeMenuOpen = false;
  const positionModeMenu = () => {
    if (!modeMenuOpen) return;
    const rect = modeTrigger.getBoundingClientRect();
    const menuHeight = Math.min(modeMenu.scrollHeight || 0, 190) || 190;
    const gap = 4;
    const below = window.innerHeight - rect.bottom;
    const top = below >= menuHeight + gap || rect.top < menuHeight + gap ? rect.bottom + gap : Math.max(gap, rect.top - menuHeight - gap);
    modeMenu.style.left = `${Math.max(gap, Math.min(rect.left, window.innerWidth - rect.width - gap))}px`;
    modeMenu.style.top = `${Math.max(gap, Math.min(top, window.innerHeight - menuHeight - gap))}px`;
    modeMenu.style.width = `${rect.width}px`;
  };
  const closeModeMenu = ({ focus = false } = {}) => {
    modeMenuOpen = false;
    modeMenu.hidden = true;
    modeTrigger.setAttribute('aria-expanded', 'false');
    modeOptions.forEach(option => { option.tabIndex = -1; });
    if (focus) modeTrigger.focus({ preventScroll: true });
  };
  const openModeMenu = () => {
    if (modeTrigger.disabled) return;
    modeMenuOpen = true;
    modeMenu.hidden = false;
    modeMenu.style.position = 'fixed';
    positionModeMenu();
    modeTrigger.setAttribute('aria-expanded', 'true');
    modeOptions.forEach(option => { option.tabIndex = option.dataset.assistModeOption === modeSelect.value ? 0 : -1; });
    modeOptions.find(option => option.dataset.assistModeOption === modeSelect.value)?.focus({ preventScroll: true });
  };
  const syncModePicker = () => {
    const label = modeLabel(modeSelect.value);
    modeTrigger.querySelector('.assist-mode-trigger-value').textContent = label;
    modeTrigger.setAttribute('aria-label', `对称方式：${label}`);
    modeOptions.forEach(option => {
      const selected = option.dataset.assistModeOption === modeSelect.value;
      option.setAttribute('aria-selected', String(selected));
      option.classList.toggle('is-selected', selected);
    });
  };
  const currentConfig = () => ({ enabled: state.enabled, mode: state.mode, axes: state.axes, centerX: engine.width * state.centerX / 100, centerY: engine.height * state.centerY / 100, showGuides: state.showGuides, showGrid: state.showGrid, stamp: state.stamp });
  const sync = (announce = false) => {
    engine.assistConfig = currentConfig();
    dialog.dataset.assistMode = state.mode;
    button.setAttribute('aria-pressed', String(state.enabled));
    document.body.dataset.assistEnabled = state.enabled ? 'true' : 'false';
    el('assist-status').textContent = state.enabled ? `${state.mode === 'radial' ? `${state.axes} 份环形` : modeLabel(state.mode)} · 新笔触立即生效` : '辅助已关闭';
    el('assist-axes').disabled = !state.enabled || state.mode !== 'radial';
    for (const id of ['assist-mode', 'assist-center-x', 'assist-center-y', 'assist-guides', 'assist-grid', 'assist-stamp']) el(id).disabled = !state.enabled;
    modeTrigger.disabled = !state.enabled;
    if (!state.enabled) closeModeMenu();
    syncModePicker();
    el('assist-axes-value').textContent = state.axes;
    el('assist-center-x-value').textContent = `${state.centerX}%`;
    el('assist-center-y-value').textContent = `${state.centerY}%`;
    engine.render();
    if (announce) toast(state.enabled ? '辅助绘画已开启' : '辅助绘画已关闭');
  };
  el('assist-enabled').onchange = event => { state.enabled = event.target.checked; sync(true); };
  modeSelect.onchange = event => { state.mode = event.target.value; sync(); };
  modeTrigger.onclick = () => { modeMenuOpen ? closeModeMenu({ focus: true }) : openModeMenu(); };
  modeTrigger.onkeydown = event => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!modeMenuOpen) openModeMenu();
      else modeOptions.find(option => option.dataset.assistModeOption === modeSelect.value)?.focus({ preventScroll: true });
    } else if (event.key === 'Escape' && modeMenuOpen) { event.preventDefault(); closeModeMenu({ focus: true }); }
  };
  modeOptions.forEach(option => {
    option.onclick = () => {
      modeSelect.value = option.dataset.assistModeOption;
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      closeModeMenu({ focus: true });
    };
    option.onkeydown = event => {
      const index = modeOptions.indexOf(option);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        modeOptions[(index + (event.key === 'ArrowDown' ? 1 : -1) + modeOptions.length) % modeOptions.length].focus({ preventScroll: true });
      } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); option.click(); }
      else if (event.key === 'Escape') { event.preventDefault(); closeModeMenu({ focus: true }); }
    };
  });
  document.addEventListener('pointerdown', event => {
    if (modeMenuOpen && !modeMenu.contains(event.target) && !modeTrigger.contains(event.target)) closeModeMenu();
  });
  window.addEventListener('resize', positionModeMenu, { passive: true });
  window.addEventListener('scroll', positionModeMenu, { passive: true, capture: true });
  el('assist-axes').oninput = event => { state.axes = Number(event.target.value); sync(); };
  el('assist-center-x').oninput = event => { state.centerX = Number(event.target.value); sync(); };
  el('assist-center-y').oninput = event => { state.centerY = Number(event.target.value); sync(); };
  el('assist-guides').onchange = event => { state.showGuides = event.target.checked; sync(); };
  el('assist-grid').onchange = event => { state.showGrid = event.target.checked; sync(); };
  el('assist-stamp').onchange = event => { state.stamp = event.target.checked; sync(); };
  button.onclick = () => { sync(); dialog.showModal(); };
  dialog.addEventListener('close', () => { closeModeMenu(); button.focus({ preventScroll: true }); });
  sync();
  return {
    options: () => { engine.assistConfig = currentConfig(); return { assist: { ...engine.assistConfig } }; },
    sync,
    reset: () => { Object.assign(state, { enabled: false, mode: 'vertical', axes: 8, centerX: 50, centerY: 50, showGuides: true, showGrid: false, stamp: false }); el('assist-enabled').checked = false; modeSelect.value = state.mode; el('assist-axes').value = state.axes; el('assist-center-x').value = state.centerX; el('assist-center-y').value = state.centerY; el('assist-guides').checked = true; el('assist-grid').checked = false; el('assist-stamp').checked = false; sync(); },
    open: () => { sync(); dialog.showModal(); },
  };
}
