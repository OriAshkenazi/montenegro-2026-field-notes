const CACHE='mne-field-notes-v26';
const TILE_CACHE='mne-map-tiles-v1';
const VERSION='26';
const SHELL=['./','./index.html','./style.css?rev=2026-09-27p','./app.js?rev=2026-09-27m','./weather.js?rev=2026-09-27a','./itinerary.json?rev=2026-09-27i','./waypoints.json?rev=2026-09-27i','./manifest.webmanifest','./icon.svg','./food-stops.json'].map(path=>`${path}${path.includes('?')?'&':'?'}v=${VERSION}`);
const CDN=['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>caches.open(CACHE)).then(cache=>Promise.allSettled(CDN.map(url=>cache.add(url)))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key!==TILE_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function tileFetch(request){const cache=await caches.open(TILE_CACHE),cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok||response.type==='opaque'){cache.put(request,response.clone());const keys=await cache.keys();if(keys.length>240)await cache.delete(keys[0]);}return response;}catch{return cached||Response.error();}}
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.hostname==='tile.openstreetmap.org'){event.respondWith(tileFetch(event.request));return;}
 if(url.hostname==='unpkg.com'&&url.pathname.startsWith('/leaflet@1.9.4/')){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request).then(response=>{if(response.ok)cache.put(event.request,response.clone());return response;})));return;}
 if(url.origin!==self.location.origin)return;
 const cacheUrl=new URL(event.request.url);cacheUrl.searchParams.set('v',VERSION);
 event.respondWith(caches.match(cacheUrl.toString()).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(cacheUrl.toString(),copy));}return response;}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html',{ignoreSearch:true}):Response.error())));
});
