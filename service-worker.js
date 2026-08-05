const CACHE_NAME = 'walker-streets-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './municipality.js',
  './nordre-follo-data.js',
  './manifest.webmanifest',
  './data/nordre-follo-roads.json',
  './data/nordre-follo-roads-complete.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
