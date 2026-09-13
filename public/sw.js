const CACHE_NAME = 'sum-ten-shell-v3';
const CORE_SHELL = ['/', '/index.html', '/manifest.webmanifest'];
const OFFLINE_ASSETS = [
  ...CORE_SHELL, '/audio/background.mp3', '/audio/start.mp3', '/audio/merge.mp3',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sum-ten-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port) return;
  if (event.data?.type === 'CHECK_OFFLINE') {
    event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
      const matches = await Promise.all(OFFLINE_ASSETS.map(asset => cache.match(asset)));
      port.postMessage({ type: 'status', ready: matches.every(Boolean), version: CACHE_NAME });
    }));
    return;
  }
  if (event.data?.type === 'DOWNLOAD_OFFLINE') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        for (let index = 0; index < OFFLINE_ASSETS.length; index += 1) {
          const asset = OFFLINE_ASSETS[index];
          const response = await fetch(asset, { cache: 'reload' });
          if (!response.ok) throw new Error(`资源下载失败：${asset}`);
          await cache.put(asset, response);
          port.postMessage({ type: 'progress', current: index + 1, total: OFFLINE_ASSETS.length });
        }
        port.postMessage({ type: 'complete', version: CACHE_NAME });
      } catch (error) {
        port.postMessage({ type: 'error', message: error.message || '离线资源下载失败' });
      }
    })());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => request.mode === 'navigate' ? caches.match('/index.html') : Response.error())));
});
