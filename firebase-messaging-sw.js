// firebase-messaging-sw.js
// Service worker pour les notifications push HIMA en arrière-plan
// À déployer à la racine du site (/firebase-messaging-sw.js)

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCYDOwHWKIIgmUsIVNfu4L7jJ7TCRfTQtk",
  authDomain: "hima-app-ef059.firebaseapp.com",
  projectId: "hima-app-ef059",
  storageBucket: "hima-app-ef059.firebasestorage.app",
  messagingSenderId: "6469064622",
  appId: "1:6469064622:web:40c6f3a96dc44967f25a3f"
});

const messaging = firebase.messaging();

// Notifications reçues en arrière-plan
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW HIMA] Background message:', payload);
  const title = (payload.notification && payload.notification.title) || 'HIMA';
  const body = (payload.notification && payload.notification.body) || '';
  const url = (payload.data && payload.data.url) || '/';
  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'hima-push',
    renotify: false,
    requireInteraction: false,
    data: { url: url }
  };
  return self.registration.showNotification(title, options);
});

// Clic sur la notification → ouvre l'app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      // Si une fenêtre HIMA est déjà ouverte, focus dessus
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(targetUrl);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
