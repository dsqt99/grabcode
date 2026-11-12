// WebPush service worker (scope /, so it also covers /coder served through the web rewrite).
// Payload from workers/notifier: { title, body, url, tag }.
self.addEventListener('push', (e) => {
  const n = e.data ? e.data.json() : { title: 'GrabCode', body: '' };
  e.waitUntil(self.registration.showNotification(n.title, { body: n.body, tag: n.tag, icon: '/icon.png', data: { url: n.url || '/' } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const tab = tabs.find((t) => t.url === url);
      return tab ? tab.focus() : self.clients.openWindow(url);
    }),
  );
});
