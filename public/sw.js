// Macht Pedalo ohne laufenden Server startbar: Läuft der lokale Server, kommt immer die frische Version
// (und wird zwischengespeichert); ohne Server liefert der Zwischenspeicher die zuletzt geladene Version.
const CACHE = 'pedalo-app';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('/', { cache: 'no-store' });
      const html = await res.clone().text();
      await cache.put('/', res);
      const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(assets.map((a) => cache.add(a).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // intervals.icu usw. gehen direkt raus
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res.ok) void cache.put(req.mode === 'navigate' ? '/' : req, res.clone());
        return res;
      } catch (e) {
        const hit = await cache.match(req.mode === 'navigate' ? '/' : req);
        if (hit) return hit;
        throw e;
      }
    })(),
  );
});
