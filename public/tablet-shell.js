(() => {
  'use strict';
  const MIN_WIDTH = 1600, MIN_HEIGHT = 1000;
  const frame = document.getElementById('tablet-frame');
  let layoutFrame = 0, metrics;

  function layout() {
    layoutFrame = 0;
    const root = document.documentElement;
    const width = Math.max(1, root.clientWidth || window.innerWidth);
    const height = Math.max(1, root.clientHeight || window.innerHeight);
    const scale = Math.min(width / MIN_WIDTH, height / MIN_HEIGHT);
    const logicalWidth = width / scale, logicalHeight = height / scale;
    metrics = Object.freeze({ width, height, scale, logicalWidth, logicalHeight });
    frame.style.width = `${logicalWidth}px`;
    frame.style.height = `${logicalHeight}px`;
    frame.style.transform = `scale(${scale})`;
    document.body.dataset.tabletScale = String(scale);
  }

  function scheduleLayout() {
    if (!layoutFrame) layoutFrame = requestAnimationFrame(layout);
  }

  function appWindow() { return frame.contentWindow; }
  window.LUOYETabletMetrics = () => metrics;
  window.LUOYEFlushBeforeClose = (...args) => appWindow()?.LUOYEFlushBeforeClose?.(...args);
  window.LUOYERequestClose = (...args) => appWindow()?.LUOYERequestClose?.(...args);

  // Native hosts evaluate their result callbacks in the main frame. Keep the
  // existing app unchanged by forwarding only its established event protocol.
  for (const name of ['native-display-result', 'native-file-result', 'native-music-result', 'native-asset-result']) {
    window.addEventListener(name, event => {
      const app = appWindow();
      app?.dispatchEvent(new app.CustomEvent(name, { detail: event.detail }));
    });
  }

  window.addEventListener('resize', scheduleLayout);
  window.visualViewport?.addEventListener('resize', scheduleLayout);
  new ResizeObserver(scheduleLayout).observe(document.documentElement);
  layout();
  document.body.dataset.tabletShellReady = 'true';
})();
