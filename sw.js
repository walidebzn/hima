/* ════════════════════════════════════════════════════════════
   HIMA Service Worker v1.5.0
   Stratégie : network-first HTML, cache-first assets
   Cache name versionné → cache busting auto à chaque deploy
   ════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'hima-v1.5.0';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/avatar.jpg',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // best-effort : si une URL échoue, on n'empêche pas l'install
      return Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('hima-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Méthode autre que GET → passthrough
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Jamais cacher : API, Firebase, ElevenLabs, Stripe, Google Fonts CSS
  if (url.pathname.startsWith('/api/') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('cloudfunctions.net') ||
      url.hostname.includes('stripe.com') ||
      url.hostname.includes('elevenlabs.io') ||
      url.hostname.includes('anthropic.com')) {
    return;
  }

  // HTML → network-first (fraîcheur >>> offline)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return resp;
      }).catch(() => caches.match(req).then((m) => m || caches.match('/index.html')))
    );
    return;
  }

  // Assets statiques → cache-first
  if (req.destination === 'image' || req.destination === 'font' ||
      req.destination === 'style' || req.destination === 'script') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Default : try network, fallback cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Message du client : skip waiting pour activer un nouveau SW immédiatement
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
