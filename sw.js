const CACHE_NAME = 'psychlearn-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/topics/experimentelle-psychologie/index.html',
  '/topics/experimentelle-psychologie/test.html',
  '/topics/experimentelle-psychologie/crash-course.html',
  '/topics/statistik/index.html',
  '/topics/statistik/test.html',
  '/topics/statistik/crash-course.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Cache-first for same-origin, network-first for CDN (fonts)
  if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached ||
        fetch(e.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
