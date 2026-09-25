// Anton Refrigerantes — Service Worker
// Versión del caché: incrementar para forzar actualización
const CACHE_NAME = 'anton-ref-v1';

// Archivos a cachear para uso offline
const ASSETS = [
  './Anton_Refrigerantes.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // CDN resources (React, Babel)
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js',
];

// INSTALL: cachea todo al instalar
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando assets...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ACTIVATE: limpia cachés viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH: cache-first para assets propios, network-first para CDN
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Cache-first: archivos locales
  if (url.includes('Anton_Refrigerantes') || url.includes('manifest') || url.includes('icon')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Cache-first también para CDN (funciona offline una vez cacheado)
  if (url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Default: network
  event.respondWith(fetch(event.request));
});
