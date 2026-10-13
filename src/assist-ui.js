export function mountAssist({ engine, toast, parameter }) {
  const button = document.createElement('button');
  button.id = 'assist-open';
  button.className = 'assist-open';
  button.type = 'button';
  button.setAttribute('aria-controls', 'assist-dialog');
  button.setAttribute('aria-label', '打开对称画参数');
  button.innerHTML = '<span class="assist-open-mark" aria-hidden="true">✦</span><span>对称画</span>';

  const dialog = document.createElement('dialog');
  dialog.id = 'assist-dialog';
  dialog.className = 'assist-dialog assist-inline-panel';
  dialog.innerHTML = `<form method="dialog" class="assist-form">
    <header class="assist-header"><div class="assist-title"><strong>对称画</strong><span>左右、上下、四向和多轴对称</span></div><div class="assist-header-actions"><label class="assist-switch"><input id="assist-enabled" type="checkbox"><span class="assist-switch-track"></span><span class="assist-switch-copy"><b>启用</b><small>新笔触生效</small></span></label><button class="assist-close" value="cancel" aria-label="收起对称画参数">收起</button></div></header>
    <div class="assist-status" id="assist-status" role="status"></div>
    <div class="assist-layout">
      <section class="assist-card assist-core"><div class="assist-card-heading"><strong>对称设置</strong><small>选项已展开，直接选择</small></div><div class="assist-section assist-mode-row"><label for="assist-mode-toggle">对称方式</label><select id="assist-mode" class="assist-mode-source" data-direct-choice="true" aria-hidden="true" tabindex="-1" hidden><option value="vertical">左右对称</option><option value="horizontal">上下对称</option><option value="four">四向对称</option><option value="radial">多轴对称</option></select><button id="assist-mode-toggle" class="assist-mode-toggle" type="button" aria-expanded="true" aria-controls="assist-mode-options"><span class="assist-mode-toggle-value">左右对称</span><span class="assist-mode-toggle-arrow" aria-hidden="true">收起 ▴</span></button><div id="assist-mode-options" class="assist-mode-options" role="radiogroup" aria-label="对称方式选项"><button type="button" role="radio" data-assist-mode-option="vertical" aria-pressed="true">左右对称</button><button type="button" role="radio" data-assist-mode-option="horizontal" aria-pressed="false">上下对称</button><button type="button" role="radio" data-assist-mode-option="four" aria-pressed="false">四向对称</button><button type="button" role="radio" data-assist-mode-option="radial" aria-pressed="false">多轴对称</button></div></div><div class="assist-section assist-axes-row"><label for="assist-axes">环形份数 <output id="assist-axes-value">8</output></label><input id="assist-axes" type="range" min="2" max="16" step="1" value="8"></div><div class="assist-center-grid"><div class="assist-section"><label for="assist-center-x">中心横向 <output id="assist-center-x-value">50%</output></label><input id="assist-center-x" type="range" min="0" max="100" step="1" value="50"></div><div class="assist-section"><label for="assist-center-y">中心纵向 <output id="assist-center-y-value">50%</output></label><input id="assist-center-y" type="range" min="0" max="100" step="1" value="50"></div></div></section>
      <section class="assist-card assist-options"><div class="assist-card-heading"><strong>预览与素材</strong><small>辅助线不会导出</small></div><div class="assist-checks"><label class="assist-check"><input id="assist-guides" type="checkbox" checked><span>显示对称辅助线</span></label><label class="assist-check"><input id="assist-grid" type="checkbox"><span>显示淡色网格</span></label><label class="assist-check"><input id="assist-stamp" type="checkbox"><span>静态素材同步</span></label></div><p class="assist-note">动态魔法袋保持单点行为。</p></section>
    </div>
  </form>`;
  parameter.append(dialog);

  // The right rail owns the visible entry. Keep this launcher hidden as a
  // stable target for native smoke scripts and keyboard callers.
  button.hidden = true;
  document.body.append(button);

  const state = { enabled: false, mode: 'vertical', axes: 8, centerX: 50, centerY: 50, showGuides: true, showGrid: false, stamp: false };
  const el = id => dialog.querySelector('#' + id);
  const modeSelect = el('assist-mode');
  const modeToggle = el('assist-mode-toggle');
  const modeOptionsPanel = el('assist-mode-options');
  const modeOptions = [...modeOptionsPanel.querySelectorAll('[data-assist-mode-option]')];
  const modeLabel = value => modeOptions.find(option => option.dataset.assistModeOption === value)?.textContent.trim() || '左右对称';
  let modeOptionsOpen = true;
  const syncRailState = active => document.querySelectorAll('.tool-button[data-tool="assist"]').forEach(item => item.setAttribute('aria-pressed', String(active)));

  const setModeOptionsOpen = (open, { focus = false } = {}) => {
    modeOptionsOpen = Boolean(open);
    modeOptionsPanel.hidden = !modeOptionsOpen;
    modeToggle.setAttribute('aria-expanded', String(modeOptionsOpen));
    modeToggle.querySelector('.assist-mode-toggle-arrow').textContent = modeOptionsOpen ? '收起 ▴' : '展开 ▾';
    modeOptions.forEach(option => {
      option.disabled = !state.enabled;
      option.tabIndex = state.enabled && modeOptionsOpen && option.dataset.assistModeOption === modeSelect.value ? 0 : -1;
    });
    if (focus && modeOptionsOpen) modeOptions.find(option => option.dataset.assistModeOption === modeSelect.value)?.focus({ preventScroll: true });
    else if (focus && !modeOptionsOpen) modeToggle.focus({ preventScroll: true });
  };
  const syncModePicker = () => {
    const label = modeLabel(modeSelect.value);
    modeToggle.querySelector('.assist-mode-toggle-value').textContent = label;
    modeToggle.setAttribute('aria-label', '对称方式：' + label + '，' + (modeOptionsOpen ? '收起选项' : '展开选项'));
    modeOptions.forEach(option => {
      const selected = option.dataset.assistModeOption === modeSelect.value;
      option.setAttribute('aria-pressed', String(selected));
      option.classList.toggle('is-selected', selected);
    });
  };
  const currentConfig = () => ({ enabled: state.enabled, mode: state.mode, axes: state.axes, centerX: engine.width * state.centerX / 100, centerY: engine.height * state.centerY / 100, showGuides: state.showGuides, showGrid: state.showGrid, stamp: state.stamp });
  const sync = (announce = false) => {
    engine.assistConfig = currentConfig();
    dialog.dataset.assistMode = state.mode;
    button.setAttribute('aria-pressed', String(state.enabled));
    document.body.dataset.assistEnabled = state.enabled ? 'true' : 'false';
    el('assist-status').textContent = state.enabled ? `${state.mode === 'radial' ? `${state.axes} 份环形` : modeLabel(state.mode)} · 新笔触立即生效` : '辅助已关闭，开启后新笔触会使用当前方式';
    el('assist-axes').disabled = !state.enabled || state.mode !== 'radial';
    for (const id of ['assist-mode', 'assist-center-x', 'assist-center-y', 'assist-guides', 'assist-grid', 'assist-stamp']) el(id).disabled = !state.enabled;
    modeToggle.disabled = !state.enabled;
    setModeOptionsOpen(modeOptionsOpen);
    syncModePicker();
    el('assist-axes-value').textContent = state.axes;
    el('assist-center-x-value').textContent = `${state.centerX}%`;
    el('assist-center-y-value').textContent = `${state.centerY}%`;
    engine.render();
    if (announce) toast(state.enabled ? '对称画已开启' : '对称画已关闭');
  };
  const close = () => {
    if (dialog.open) dialog.close();
    parameter.classList.remove('assist-panel-open');
    if (document.body.dataset.parameterPanel === 'assist') document.body.removeAttribute('data-parameter-panel');
    button.setAttribute('aria-pressed', 'false');
    syncRailState(false);
  };
  const open = () => {
    // On compact web layouts the right rail and bottom shelf are separate
    // drawers. Selecting 对称画 should take the user straight to its
    // parameter surface instead of leaving the settings behind a closed tab.
    if (document.body.dataset.mobilePanel !== 'options') document.querySelector('.mobile-command[data-mobile-panel="options"]')?.click();
    parameter.classList.add('assist-panel-open');
    document.body.dataset.parameterPanel = 'assist';
    button.setAttribute('aria-pressed', 'true');
    syncRailState(true);
    sync();
    if (!dialog.open) dialog.show();
  };

  el('assist-enabled').onchange = event => { state.enabled = event.target.checked; sync(true); };
  modeSelect.onchange = event => { state.mode = event.target.value; sync(); };
  modeToggle.onclick = () => setModeOptionsOpen(!modeOptionsOpen, { focus: !modeOptionsOpen });
  modeToggle.onkeydown = event => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setModeOptionsOpen(!modeOptionsOpen, { focus: !modeOptionsOpen });
    } else if (event.key === 'Escape' && modeOptionsOpen) {
      event.preventDefault();
      setModeOptionsOpen(false, { focus: true });
    }
  };
  modeOptions.forEach(option => {
    option.onclick = () => {
      if (option.disabled) return;
      modeSelect.value = option.dataset.assistModeOption;
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      setModeOptionsOpen(true);
    };
    option.onkeydown = event => {
      const index = modeOptions.indexOf(option);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        modeOptions[(index + (event.key === 'ArrowDown' ? 1 : -1) + modeOptions.length) % modeOptions.length].focus({ preventScroll: true });
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        option.click();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setModeOptionsOpen(false, { focus: true });
      }
    };
  });
  el('assist-axes').oninput = event => { state.axes = Number(event.target.value); sync(); };
  el('assist-center-x').oninput = event => { state.centerX = Number(event.target.value); sync(); };
  el('assist-center-y').oninput = event => { state.centerY = Number(event.target.value); sync(); };
  el('assist-guides').onchange = event => { state.showGuides = event.target.checked; sync(); };
  el('assist-grid').onchange = event => { state.showGrid = event.target.checked; sync(); };
  el('assist-stamp').onchange = event => { state.stamp = event.target.checked; sync(); };
  button.onclick = open;
  dialog.addEventListener('close', () => {
    parameter.classList.remove('assist-panel-open');
    if (document.body.dataset.parameterPanel === 'assist') document.body.removeAttribute('data-parameter-panel');
    button.setAttribute('aria-pressed', 'false');
    syncRailState(false);
  });
  document.addEventListener('toolchange', () => {
    if (document.body.dataset.parameterPanel === 'assist') close();
  });
  sync();
  return {
    options: () => { engine.assistConfig = currentConfig(); return { assist: { ...engine.assistConfig } }; },
    sync,
    reset: () => { Object.assign(state, { enabled: false, mode: 'vertical', axes: 8, centerX: 50, centerY: 50, showGuides: true, showGrid: false, stamp: false }); el('assist-enabled').checked = false; modeSelect.value = state.mode; el('assist-axes').value = state.axes; el('assist-center-x').value = state.centerX; el('assist-center-y').value = state.centerY; el('assist-guides').checked = true; el('assist-grid').checked = false; el('assist-stamp').checked = false; setModeOptionsOpen(true); sync(); },
    open,
    close,
  };
}
