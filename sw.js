// sw.js — Service Worker HIMA (PWA cache minimal)
// À déployer à la racine du site (/sw.js)

const CACHE = 'hima-v1';
const SHELL = [
  '/',
  '/index.html',
  '/avatar.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(c) {
      // Cache best-effort (ignore les 404)
      return Promise.all(SHELL.map(function(url) {
        return c.add(url).catch(function(e) {
          console.log('[SW] skip cache for', url, e.message);
        });
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

// Stratégie : network-first, fallback cache
self.addEventListener('fetch', function(event) {
  // Skip non-GET et requêtes API
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname !== self.location.hostname) return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        if (response.ok && url.pathname === '/') {
          // Met à jour le shell en cache
          const clone = response.clone();
          caches.open(CACHE).then(function(c) { c.put(event.request, clone); });
        }
        return response;
      })
      .catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/');
        });
      })
  );
});
