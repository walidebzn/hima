/* ============================================================
   HIMA — Firebase Messaging Service Worker
   Projet: hima-app-ef059
   Rôle: réception des push notifications en background (app fermée
   ou onglet inactif). Les push foreground sont gérés dans index.html
   via onMessage().
   Placement: RACINE du repo (sert /firebase-messaging-sw.js)
   ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Config Firebase HIMA (projet ef059)
firebase.initializeApp({
  apiKey: "AIzaSyCYDOwHWKIIgmUsIVNfu4L7jJ7TCRfTQtk",
  authDomain: "hima-app-ef059.firebaseapp.com",
  projectId: "hima-app-ef059",
  storageBucket: "hima-app-ef059.firebasestorage.app",
  messagingSenderId: "6469064622",
  appId: "1:6469064622:web:40c6f3a96dc44967f25a3f"
});

const messaging = firebase.messaging();

// Handler push background
messaging.onBackgroundMessage((payload) => {
  console.log('[HIMA SW] Push reçu en background:', payload);

  const title = payload.notification?.title || payload.data?.title || 'HIMA';
  const body  = payload.notification?.body  || payload.data?.body  || 'Nouveau message du coach';
  const tag   = payload.data?.tag || 'hima-default';
  const url   = payload.data?.url || '/';

  const options = {
    body,
    tag,                          // évite empilage
    renotify: true,
    icon: '/avatar.jpg',          // pixar 3D avatar (racine repo)
    badge: '/avatar.jpg',
    vibrate: [120, 60, 120],
    requireInteraction: false,
    data: { url, payload },
    actions: [
      { action: 'open',    title: 'Ouvrir' },
      { action: 'dismiss', title: 'Plus tard' }
    ]
  };

  return self.registration.showNotification(title, options);
});

// Clic sur la notif → ouvre/focus l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Si HIMA est déjà ouvert quelque part → focus
      for (const w of wins) {
        if (w.url.includes(self.location.origin) && 'focus' in w) {
          w.postMessage({ type: 'HIMA_NOTIF_CLICK', url: targetUrl, payload: event.notification.data?.payload });
          return w.focus();
        }
      }
      // Sinon → ouvre un nouvel onglet
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// Skip waiting → SW actif tout de suite après update
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
