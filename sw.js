// Anton Refrigerantes — Service Worker
// Versión del caché: incrementar en cada actualización de la app
const CACHE_NAME = 'anton-ref-v4';

// Archivos propios: siempre se piden frescos al servidor (sin usar el caché HTTP del navegador)
const LOCAL_ASSETS = [
  './',
  './Anton_Refrigerantes.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// Librerías externas (versión fija): se cachean una vez
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js',
];

// Si el servidor tarda más que esto, se muestra la copia guardada (conexión lenta)
const NETWORK_TIMEOUT_MS = 4000;

// INSTALL: descarga todo directamente del servidor, salteando el caché HTTP
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(LOCAL_ASSETS.map(async url => {
        const res = await fetch(url, { cache: 'reload' });
        if (!res.ok) throw new Error('No se pudo descargar ' + url);
        await cache.put(url, res);
      }));
      // Las librerías externas no deben bloquear la instalación si fallan
      await Promise.all(CDN_ASSETS.map(url =>
        cache.add(url).catch(err => console.warn('[SW] CDN no cacheado:', url, err))
      ));
    }).then(() => self.skipWaiting())
  );
});

// ACTIVATE: borra cachés de versiones anteriores y toma el control de inmediato
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Red primero con respaldo en caché (archivos propios)
function networkFirst(event) {
  const request = event.request;
  const cachePromise = caches.open(CACHE_NAME);

  const network = fetch(request.url, { cache: 'no-cache' }).then(async res => {
    if (res && res.status === 200) {
      const cache = await cachePromise;
      cache.put(request.url, res.clone());
    }
    return res;
  });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)
  );

  return Promise.race([network, timeout]).catch(async () => {
    const cache = await cachePromise;
    const cached = await cache.match(request.url, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./Anton_Refrigerantes.html');
      if (fallback) return fallback;
    }
    // Sin copia guardada: se espera la respuesta real de la red
    return network;
  });
}

// FETCH
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Archivos propios (HTML, manifest, íconos): siempre lo más nuevo si hay conexión
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event));
    return;
  }

  // Librerías CDN (versión fija): caché primero
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
  // Cualquier otra cosa: comportamiento normal del navegador
});
