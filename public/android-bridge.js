// Android installs a trusted bridge before this page starts. Browsers and
// desktop hosts leave it undefined, so the existing web fallbacks stay intact.
(() => {
  if (!globalThis.AndroidBridge?.post || globalThis.webkit?.messageHandlers) return;
  const channels = ['ready', 'files', 'music', 'display'];
  globalThis.webkit = { messageHandlers: Object.fromEntries(channels.map(channel => [channel, {
    postMessage(payload) {
      globalThis.AndroidBridge.post(channel, JSON.stringify(payload ?? null));
    },
  }])) };
})();
