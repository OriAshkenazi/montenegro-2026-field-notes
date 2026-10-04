const CACHE='mne-field-notes-v70';
const TILE_CACHE='mne-map-tiles-v1';
const STATIC_CACHE='mne-static-v1';
const VERSION='70';
// Fonts and icons never change, so they live in their own cache that survives deploys and is not downloaded again.
const STATIC=['./fonts/plex-hebrew-400.woff2','./fonts/plex-hebrew-500.woff2','./fonts/plex-hebrew-700.woff2','./fonts/plex-latin-400.woff2','./fonts/plex-latin-500.woff2','./fonts/plex-latin-700.woff2','./fonts/plex-latin-ext-400.woff2','./fonts/plex-latin-ext-500.woff2','./fonts/plex-latin-ext-700.woff2','./icon.svg','./apple-touch-icon.png','./icon-192.png','./icon-512.png'];
const SHELL=['./','./index.html','./boot.js?rev=2026-10-04c','./vendor/leaflet/leaflet.css?rev=2026-10-04c','./vendor/leaflet/leaflet.js?rev=2026-10-04c','./style.css?rev=2026-10-04c','./timetable.js?rev=2026-10-04c','./i18n.js?rev=2026-10-04c','./app.js?rev=2026-10-04c','./weather.js?rev=2026-10-04c','./phrasebook.js?rev=2026-10-04c','./itinerary.json?rev=2026-10-04c','./waypoints.json?rev=2026-10-04c','./locales/en.json?rev=2026-10-04c','./locales/he.json?rev=2026-10-04c','./manifest.webmanifest'].map(path=>`${path}${path.includes('?')?'&':'?'}v=${VERSION}`);
async function cacheStatic(){const cache=await caches.open(STATIC_CACHE);for(const path of STATIC){if(!(await cache.match(path)))await cache.add(path).catch(()=>{});}}
self.addEventListener('install',event=>event.waitUntil(Promise.all([caches.open(CACHE).then(cache=>cache.addAll(SHELL)),cacheStatic()]).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key!==TILE_CACHE&&key!==STATIC_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function tileFetch(request){const cache=await caches.open(TILE_CACHE),cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok||response.type==='opaque'){cache.put(request,response.clone());const keys=await cache.keys();if(keys.length>240)await cache.delete(keys[0]);}return response;}catch{return cached||Response.error();}}
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.hostname==='tile.openstreetmap.org'){event.respondWith(tileFetch(event.request));return;}
 if(url.origin!==self.location.origin)return;
 if(/\/fonts\/[^/]+\.woff2$|\/(icon\.svg|apple-touch-icon\.png|icon-192\.png|icon-512\.png)$/.test(url.pathname)){event.respondWith(caches.open(STATIC_CACHE).then(cache=>cache.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok)cache.put(event.request,response.clone());return response;}))));return;}
 const cacheUrl=new URL(event.request.url);cacheUrl.searchParams.set('v',VERSION);
 event.respondWith(caches.match(cacheUrl.toString()).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(cacheUrl.toString(),copy));}return response;}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html',{ignoreSearch:true}):Response.error())));
});
