(() => {
  function mountTabletDrawers() {
    const bar = document.querySelector('.canvas-topbar');
    const brush = document.getElementById('classic-left');
    const parameters = document.querySelector('.classic-parameters');
    if (!bar || !brush || !parameters) return;

    const tablet = matchMedia('(orientation: landscape) and (min-width: 861px) and (min-height: 601px) and (any-pointer: coarse)');
    const drawers = new Map();
    let open;
    parameters.id = 'offline-tool-parameters';

    function setDrawer(next) {
      open = next;
      if (open) document.body.dataset.offlineDrawer = open;
      else delete document.body.dataset.offlineDrawer;
      for (const [name, { toggle }] of drawers) toggle.setAttribute('aria-expanded', String(name === open));
    }

    function addDrawer(name, element, labels) {
      const toggle = document.createElement('button');
      toggle.id = `offline-${name}-toggle`;
      toggle.type = 'button';
      toggle.className = 'offline-drawer-toggle';
      toggle.setAttribute('aria-controls', element.id);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.append(...labels);
      element.tabIndex = -1;
      toggle.addEventListener('click', () => {
        if (!tablet.matches) return;
        setDrawer(open === name ? undefined : name);
        if (open) element.focus({ preventScroll: true });
      });
      drawers.set(name, { toggle, element });
      return toggle;
    }

    const brushLabel = Object.assign(document.createElement('span'), { className: 'brush-label', textContent: '画笔盒' });
    const libraryLabel = Object.assign(document.createElement('span'), { className: 'library-label', textContent: '分类' });
    bar.prepend(addDrawer('brush', brush, [brushLabel, libraryLabel]), addDrawer('parameters', parameters, ['参数']));

    document.addEventListener('pointerdown', event => {
      if (!open) return;
      const { element, toggle } = drawers.get(open);
      if (element.contains(event.target) || toggle.contains(event.target)) return;
      setDrawer();
      if (event.target.closest?.('#viewport')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !open || document.querySelector('dialog[open]')) return;
      const { toggle } = drawers.get(open);
      setDrawer();
      toggle.focus({ preventScroll: true });
      event.preventDefault();
      event.stopPropagation();
    }, true);
    tablet.addEventListener('change', () => setDrawer());
  }

  mountTabletDrawers();

  const panel = document.getElementById('offline-setup');
  const status = document.getElementById('offline-state');
  const progress = document.getElementById('offline-progress');
  const retry = document.getElementById('offline-retry');
  const dismiss = document.getElementById('offline-dismiss');
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let hideTimer;
  let updateVersion;
  let dismissedVersion;

  function show(state, message) {
    clearTimeout(hideTimer);
    panel.dataset.state = state;
    panel.hidden = false;
    if (status.textContent !== message) status.textContent = message;
    progress.hidden = state !== 'downloading' && state !== 'updating';
    retry.hidden = state !== 'error' && state !== 'update-error';
    dismiss.hidden = state === 'downloading';
  }

  dismiss.addEventListener('click', () => {
    if (panel.dataset.state === 'updating') dismissedVersion = updateVersion;
    panel.hidden = true;
  });
  if (!navigator.serviceWorker) {
    show('unavailable', '离线下载需要通过 HTTPS 打开落叶画板。');
    return;
  }
  if (appleMobile && !standalone) {
    show('install', '点 Safari 的「分享 → 添加到主屏幕」。再从主屏幕打开，保持联网直到离线下载完成。');
    return;
  }

  const workers = navigator.serviceWorker;
  const watched = new WeakSet();
  const observedRegistrations = new WeakSet();
  let registration;
  let activeVersion;

  function failed() {
    if (activeVersion) show('update-error', '更新未下载完成。当前版本仍可使用，可联网后重试。');
    else show('error', '离线下载未完成。检查网络或可用空间后重试。');
  }

  function ready() {
    show('ready', '离线下载完成。断网也能打开画板，草稿保存在这台设备。');
    hideTimer = setTimeout(() => { panel.hidden = true; }, 6500);
  }

  function updateReady() {
    show('update-ready', '离线更新已下载。退出画板后重新打开，即可使用新版。');
  }

  function requestStatus() {
    (workers.controller || registration?.active)?.postMessage({ type: 'LUOYE_OFFLINE_STATUS' });
  }

  function watch(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') requestStatus();
      if (worker.state === 'installed' && activeVersion) updateReady();
      if (worker.state === 'redundant' && !registration?.active) failed();
    });
  }

  function observe(next) {
    registration = next;
    if (!next) return;
    watch(next.installing);
    if (!observedRegistrations.has(next)) {
      observedRegistrations.add(next);
      next.addEventListener('updatefound', () => watch(next.installing));
    }
  }

  workers.addEventListener('message', ({ data }) => {
    if (data?.type === 'LUOYE_OFFLINE_STATUS' && data.ready) {
      if (activeVersion === data.version) return;
      activeVersion = data.version;
      if (registration?.waiting) updateReady();
      else ready();
    } else if (data?.type === 'LUOYE_OFFLINE_PROGRESS' && data.version !== activeVersion) {
      updateVersion = data.version;
      if (activeVersion && dismissedVersion === updateVersion) return;
      const ratio = data.totalBytes ? data.downloadedBytes / data.totalBytes : data.completed / data.total;
      const percent = Math.min(100, Math.floor(ratio * 100));
      progress.value = percent;
      const size = data.totalBytes ? `，约 ${Math.ceil(data.totalBytes / 1024 ** 2)} MB` : '';
      const subject = activeVersion ? '离线更新' : '离线资源';
      show(activeVersion ? 'updating' : 'downloading',
        `正在下载${subject}（${Math.floor(percent / 5) * 5}%${size}），请保持页面打开。`);
    } else if (data?.type === 'LUOYE_OFFLINE_ERROR') {
      failed();
    }
  });
  workers.addEventListener('controllerchange', requestStatus);
  window.addEventListener('pageshow', requestStatus);

  async function prepare(retryDownload = false) {
    dismissedVersion = undefined;
    progress.removeAttribute('value');
    show(activeVersion ? 'updating' : 'downloading', '正在准备离线资源…');
    try {
      const prior = await workers.getRegistration();
      if (retryDownload && prior && !prior.active && !prior.waiting && !prior.installing) await prior.unregister();
      observe(prior);
      // An existing active worker can answer even when an update fetch fails offline.
      requestStatus();
      if (retryDownload && prior?.active) await prior.update();
      else observe(await workers.register('./offline-worker.js', { updateViaCache: 'none' }));
      requestStatus();
      if (activeVersion && registration.waiting) updateReady();
      else if (activeVersion && !registration.installing && panel.dataset.state === 'updating') ready();
      if (!registration.active && !registration.installing && !registration.waiting) failed();
    } catch {
      if (retryDownload || !registration?.active) failed();
    }
  }

  retry.addEventListener('click', () => prepare(true));
  prepare();
})();
