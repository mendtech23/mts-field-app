/* Wealth OS — offline shell.
   Bump CACHE on every release so returning devices pick up new assets. */
const CACHE = "wealth-os-v2";
const ASSETS = [
  "./", "./index.html", "./styles.css?v=2", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png",
  "./js/util.js?v=2", "./js/data.js?v=2", "./js/store.js?v=2", "./js/engine.js?v=2",
  "./js/advisor.js?v=2", "./js/charts.js?v=2", "./js/importers.js?v=2", "./js/ui.js?v=2",
  "./js/views.js?v=2", "./js/modals.js?v=2", "./js/app.js?v=2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Network-first for the app shell: a deploy is picked up as soon as the
  // device is online, and the cache is the fallback rather than the source.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
