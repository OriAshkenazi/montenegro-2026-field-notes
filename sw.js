const CACHE='mne-field-notes-v43';
const TILE_CACHE='mne-map-tiles-v1';
const VERSION='43';
const SHELL=['./','./index.html','./boot.js?rev=2026-09-29h','./vendor/leaflet/leaflet.css?rev=2026-09-29h','./vendor/leaflet/leaflet.js?rev=2026-09-29h','./style.css?rev=2026-09-29h','./timetable.js?rev=2026-09-29h','./i18n.js?rev=2026-09-29h','./app.js?rev=2026-09-29h','./weather.js?rev=2026-09-29h','./itinerary.json?rev=2026-09-29h','./waypoints.json?rev=2026-09-29h','./locales/en.json?rev=2026-09-29h','./locales/he.json?rev=2026-09-29h','./fonts/plex-hebrew-400.woff2','./fonts/plex-hebrew-500.woff2','./fonts/plex-hebrew-700.woff2','./fonts/plex-latin-400.woff2','./fonts/plex-latin-500.woff2','./fonts/plex-latin-700.woff2','./fonts/plex-latin-ext-400.woff2','./fonts/plex-latin-ext-500.woff2','./fonts/plex-latin-ext-700.woff2','./manifest.webmanifest','./icon.svg'].map(path=>`${path}${path.includes('?')?'&':'?'}v=${VERSION}`);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key!==TILE_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function tileFetch(request){const cache=await caches.open(TILE_CACHE),cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok||response.type==='opaque'){cache.put(request,response.clone());const keys=await cache.keys();if(keys.length>240)await cache.delete(keys[0]);}return response;}catch{return cached||Response.error();}}
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.hostname==='tile.openstreetmap.org'){event.respondWith(tileFetch(event.request));return;}
 if(url.origin!==self.location.origin)return;
 const cacheUrl=new URL(event.request.url);cacheUrl.searchParams.set('v',VERSION);
 event.respondWith(caches.match(cacheUrl.toString()).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(cacheUrl.toString(),copy));}return response;}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html',{ignoreSearch:true}):Response.error())));
});
