const CACHE = 'mne-field-notes-v10';
const VERSION = '10';
const SHELL = ['./','./index.html','./style.css','./app.js?rev=2026-09-27c','./itinerary.json?rev=2026-09-27c','./manifest.webmanifest','./icon.svg'].map(path => `${path}${path.includes('?')?'&':'?'}v=${VERSION}`);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const cacheUrl = new URL(event.request.url); cacheUrl.searchParams.set('v', VERSION);
  event.respondWith(caches.match(cacheUrl.toString()).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(cacheUrl.toString(), copy)); }
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
