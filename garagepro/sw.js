/* GaragePro service worker — makes the online version work offline and installable */
const CACHE = 'garagepro-v3.0.1';
const FILES = [
  './', './index.html', './book.html', './manifest.webmanifest', './css/app.css', './lib/qrcode.min.js',
  './js/config.js', './js/book.js', './js/mobile.js', './js/requests.js', './js/core.js', './js/icon-paths.js', './js/icons.js', './js/ui.js', './js/documents.js', './js/share.js', './js/pages-main.js', './js/pages-docs.js',
  './js/pages-stock.js', './js/pages-admin.js', './js/photos.js', './js/prints.js', './js/finance.js', './js/pro.js',
  './js/auth.js', './js/sync.js', './js/app.js',
  './lib/jspdf.umd.min.js', './lib/jspdf.plugin.autotable.min.js', './lib/xlsx.full.min.js', './lib/supabase.js',
  './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// App files: network first (always get updates), fall back to cache when offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // cloud sync calls go straight to the network
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
