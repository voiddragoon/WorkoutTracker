/* Overload service worker: makes the app open instantly and work with no signal.
   Pages: network first (so a new deploy shows up right away), falling back to the cached copy
   after 2.5 seconds or when offline.  Icons and other files: cache first.
   Requests to other sites (cloud sync) are never touched. */
const CACHE = 'overload-v14';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate'){
    const network = fetch(req).then(res => {
      if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      return res;
    });
    const timeout = new Promise(resolve => setTimeout(resolve, 2500)).then(() => caches.match('./index.html'));
    e.respondWith(
      Promise.race([network, timeout]).then(r => r || network)
        .catch(() => caches.match('./index.html'))
        .then(r => r || caches.match('./index.html'))
    );
    e.waitUntil(network.catch(() => {}));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
