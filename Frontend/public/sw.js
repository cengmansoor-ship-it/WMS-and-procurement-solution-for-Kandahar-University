// This self-removing worker replaces the old cache worker.
// It clears stale browser caches and unregisters itself as soon as it loads.

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => {}),
      self.registration.unregister(),
      self.clients.claim(),
    ]).then(() =>
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      })
    )
  );
});

self.addEventListener('fetch', () => {
  return;
});
