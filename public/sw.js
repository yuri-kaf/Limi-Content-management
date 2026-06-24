// Limi Service Worker — handles scheduled post notifications

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Main thread sends SHOW_NOTIFICATION when a timer fires
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_NOTIFICATION') return;

  const { title, body, clientId, itemId } = event.data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/limi-icon.png',
      badge: '/limi-icon.png',
      tag: `limi-post-${itemId}`,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { clientId },
      actions: [
        { action: 'open', title: 'Open board' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// Tap on notification → open (or focus) the right client board
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const clientId = event.notification.data?.clientId;
  const url = clientId ? `/client/${clientId}` : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url });
            return;
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
