(() => {
  const panel = document.getElementById('offline-setup');
  const status = document.getElementById('offline-state');
  const progress = document.getElementById('offline-progress');
  const retry = document.getElementById('offline-retry');
  const dismiss = document.getElementById('offline-dismiss');
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function show(state, message) {
    panel.dataset.state = state;
    panel.hidden = false;
    if (status.textContent !== message) status.textContent = message;
    progress.hidden = state !== 'downloading';
    retry.hidden = state !== 'error';
    dismiss.hidden = state === 'downloading';
  }

  dismiss.addEventListener('click', () => { panel.hidden = true; });
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
  let registration;
  let ready = false;
  let hideTimer;

  function failed() {
    if (!ready) show('error', '离线下载未完成。检查网络或可用空间后重试。');
  }

  function requestStatus() {
    (workers.controller || registration?.active)?.postMessage({ type: 'LUOYE_OFFLINE_STATUS' });
  }

  function watch(worker) {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') requestStatus();
      if (worker.state === 'redundant' && !registration?.active) failed();
    });
  }

  workers.addEventListener('message', ({ data }) => {
    if (data?.type === 'LUOYE_OFFLINE_STATUS' && data.ready) {
      if (ready) return;
      ready = true;
      show('ready', '离线下载完成。断网也能打开画板，草稿保存在这台设备。');
      hideTimer = setTimeout(() => { panel.hidden = true; }, 6500);
    } else if (data?.type === 'LUOYE_OFFLINE_PROGRESS' && !ready) {
      const ratio = data.totalBytes ? data.downloadedBytes / data.totalBytes : data.completed / data.total;
      const percent = Math.min(100, Math.floor(ratio * 100));
      progress.value = percent;
      const size = data.totalBytes ? `，约 ${Math.ceil(data.totalBytes / 1024 ** 2)} MB` : '';
      show('downloading', `正在下载离线资源（${Math.floor(percent / 5) * 5}%${size}），请保持页面打开。`);
    } else if (data?.type === 'LUOYE_OFFLINE_ERROR') {
      failed();
    }
  });
  workers.addEventListener('controllerchange', requestStatus);
  window.addEventListener('pageshow', requestStatus);

  async function prepare(retryDownload = false) {
    clearTimeout(hideTimer);
    progress.removeAttribute('value');
    show('downloading', '正在准备离线资源…');
    try {
      if (retryDownload) {
        const prior = await workers.getRegistration();
        if (prior && !prior.active && !prior.waiting && !prior.installing) await prior.unregister();
      }
      registration = await workers.getRegistration();
      // An existing active worker can answer even when an update fetch fails offline.
      requestStatus();
      registration = await workers.register('./offline-worker.js', { updateViaCache: 'none' });
      watch(registration.installing);
      registration.addEventListener('updatefound', () => watch(registration.installing));
      requestStatus();
      if (!registration.active && !registration.installing && !registration.waiting) failed();
    } catch {
      if (!registration?.active) failed();
    }
  }

  retry.addEventListener('click', () => prepare(true));
  prepare();
})();
