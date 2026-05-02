/* global self, clients */
self.addEventListener('push', (event) => {
  let payload = { title: 'Run iT Arcade', body: '', url: '/' };
  try {
    if (event.data) {
      const j = event.data.json();
      payload = { ...payload, ...j };
    }
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'open-match',
      renotify: true,
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if (c.url && 'focus' in c) {
          try {
            await c.focus();
            return;
          } catch {
            /* continue */
          }
        }
      }
      if (clients.openWindow) await clients.openWindow(url);
    })(),
  );
});
