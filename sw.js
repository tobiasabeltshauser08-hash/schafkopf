// Service Worker: speichert die App, damit sie auch offline läuft.
// Nach Änderungen an den Dateien die Versionsnummer erhöhen.
const CACHE = 'schafkopf-v1';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/rules.js', 'js/ai.js', 'js/cards.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Erst aus dem Speicher antworten, im Hintergrund aktualisieren.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req)
      .then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => cached ?? new Response('', { status: 404 }));
    return cached ?? network;
  }));
});
