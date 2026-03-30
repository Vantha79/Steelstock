// SteelStock Service Worker - v12
// Stratégie : toujours charger depuis le réseau, cache uniquement en fallback offline

self.addEventListener('install', e => {
  self.skipWaiting(); // Prendre le contrôle immédiatement
});

self.addEventListener('activate', e => {
  // Supprimer TOUS les anciens caches
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim()) // Prendre contrôle de tous les onglets ouverts
  );
});

self.addEventListener('fetch', e => {
  // Ne jamais intercepter POST ou requêtes Google
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('google') || e.request.url.includes('googleapis')) return;
  if (e.request.url.includes('script.google')) return;
  if (e.request.url.includes('fonts.')) return;

  // Network-first : toujours essayer le réseau en premier
  // Le cache n'est utilisé qu'en cas de panne réseau (mode offline)
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(resp => {
        // Mettre en cache pour usage offline uniquement
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const clone = resp.clone();
          caches.open('steelstock-offline').then(cache => cache.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request)) // Fallback offline
  );
});
