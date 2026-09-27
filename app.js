const $ = (s) => document.querySelector(s);
let trip;
let waypointData=[];
let map;
let activeMapDay='all';
let activeWaypoint=null;
let mapMarkers=[];
let routeLine=null;
let branch = 'primary';
Promise.all([fetch('./itinerary.json?rev=2026-09-27i').then(r=>r.json()),fetch('./waypoints.json?rev=2026-09-27i').then(r=>r.json())]).then(([data,points])=>{trip=data;waypointData=points.waypoints;render();initializeMap();}).catch(()=>{$('#days').innerHTML='<p class="offline-note">Trip data is not cached yet. Open this page online once, then reload offline.</p>';$('#mapStatus').textContent='Waypoint index unavailable. Reconnect once to save it for offline use.';});

function activeRoute() { return trip.routes[branch]; }
const segmentTypes = {
  DRIVE: ['↗', 'drive'], STAY: ['⌂', 'stay'], SEE: ['◉', 'see'], WALK: ['↟', 'walk'],
  EAT: ['◒', 'eat'], FOOD: ['◌', 'food'], WATER: ['≋', 'water'], WELLNESS: ['◇', 'wellness'], LOGISTICS: ['▪', 'logistics'], CAUTION: ['!', 'caution']
};
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
const waypointByName=name=>waypointData.find(w=>w.name===name);
const waypointById=id=>waypointData.find(w=>w.id===id);
function openWaypoint(id){const point=waypointById(id);if(!point)return;if(activeMapDay!=='all'&&!(point.days?.[branch]||[]).includes(Number(activeMapDay)))activeMapDay='all';activeWaypoint=point.id;setDrawer('half');$('#mapDayFilter').value=String(activeMapDay);renderMapPoints();if(map)setTimeout(()=>{map.invalidateSize({pan:false});map.flyTo([point.lat,point.lng],Math.max(map.getZoom(),13),{duration:.8});setTimeout(()=>mapMarkers.find(x=>x.point.id===point.id)?.marker.openPopup(),850);},360);renderWaypointList();}
function linkedLocations(text){const aliases=[];for(const p of waypointData)for(const alias of [...(p.aliases||[]),p.name])if(alias.length>3)aliases.push({text:alias,point:p});aliases.sort((a,b)=>b.text.length-a.text.length);const matches=[];for(const a of aliases){const re=new RegExp(`(^|[^\\p{L}\\p{N}])(${a.text.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')})(?=$|[^\\p{L}\\p{N}])`,'giu');let m;while((m=re.exec(text))){const start=m.index+m[1].length,end=start+m[2].length;if(!matches.some(x=>start<x.end&&end>x.start))matches.push({start,end,id:a.point.id,label:m[2]});}}matches.sort((a,b)=>a.start-b.start);let out='',last=0;for(const m of matches){out+=escapeHTML(text.slice(last,m.start))+`<button class="location-link" type="button" data-waypoint="${m.id}">${escapeHTML(m.label)}</button>`;last=m.end;}return out+escapeHTML(text.slice(last));}
function renderSegments(segments, compact = false) {
  if (!Array.isArray(segments)) return '';
  return `<div class="segment-list${compact ? ' compact' : ''}">${segments.map(segment => {
    const type = segmentTypes[segment.type] ? segment.type : 'LOGISTICS';
    if (type !== segment.type) console.warn(`Unknown route segment type: ${segment.type}`);
    const [icon, className] = segmentTypes[type];
    return `<div class="route-segment ${className}"><span class="segment-icon" aria-hidden="true">${icon}</span><b class="segment-label">${type}</b><span class="segment-text">${linkedLocations(segment.text || '')}</span></div>`;
  }).join('')}</div>`;
}
function renderSchedule() {
  $('#schedule').innerHTML = activeRoute().days.map(d => `<tr><td><b>${d.day}</b><small>${d.date}</small></td><td>${d.region}<small>Base: ${d.base}</small></td><td>${renderSegments(d.morning, true)}</td><td>${renderSegments(d.afternoon, true)}</td><td>${renderSegments(d.evening, true)}</td><td><b>${d.drive}</b><small>${d.parking} ${d.cash}</small></td></tr>`).join('');
}
function renderChecks() {
  $('#checks').innerHTML = activeRoute().checks.map(g => `<div class="check ${g.status.toLowerCase()}"><span>${g.status==='PASS'?'✓':g.status==='CONDITIONAL'?'~':'!'}</span><div><b>${g.name}</b><small>${g.detail}</small></div><strong>${g.status}</strong></div>`).join('');
  $('#checksTitle').textContent = branch === 'primary' ? 'Guardrail check · coast + mountains' : 'Guardrail check · alpine fallback';
}

function renderFoodStop(item, type) {
  const slot = item.slot || (type === 'market' ? 'Stock-up' : 'Coffee radar');
  const point=waypointByName(item.name);const title = `<button type="button" class="food-map-link" data-waypoint="${point?.id||''}">${escapeHTML(item.name)} ↗</button>`;
  const details = type === 'meal'
    ? `<p>${escapeHTML(item.specialty)}</p><small><b>Hours</b> ${escapeHTML(item.hours)} · <b>Parking</b> ${escapeHTML(item.parking)}</small><small><b>Payment</b> ${escapeHTML(item.cash)} · <b>Allow</b> ${item.durationMinutes} min</small>${item.plan ? `<small class="food-plan">${escapeHTML(item.plan)}</small>` : ''}`
    : type === 'coffee'
      ? `<p>${escapeHTML(item.why)}</p><small><b>Hours</b> ${escapeHTML(item.hours)} · <b>Parking</b> ${escapeHTML(item.parking)}</small>`
      : `<p>${escapeHTML(item.plan || '')}</p><small><b>Hours</b> ${escapeHTML(item.hours)} · <b>Parking</b> ${escapeHTML(item.parking)}</small>`;
  const badge = type === 'meal' ? (item.cash.toLowerCase().includes('cash-only') ? 'CASH STATUS · ASK' : 'PAYMENT CHECK') : type.toUpperCase();
  return `<article class="food-stop ${type}"><div class="food-stop-top"><span>${escapeHTML(slot)}</span><b>${badge}</b></div><strong>${title}</strong>${details}</article>`;
}
function foodRows(food) {
  if (!food) return [];
  const rows = [
    ...(food.coffee || []).map(x => ({...x, type:'coffee'})),
    ...(food.supermarkets || []).map(x => ({...x, type:'market', slot:'Stock-up'})),
    ...(food.meals || []).map(x => ({...x, type:'meal'}))
  ];
  const rank = x => { const s=(x.slot||'').toLowerCase(); return s.includes('morning') ? 0 : s.includes('breakfast') ? 1 : s.includes('stock-up') ? 2 : s.includes('lunch') ? 3 : s.includes('dinner') ? 4 : 5; };
  return rows.map((x,i)=>({...x,_i:i})).sort((a,b)=>rank(a)-rank(b)||a._i-b._i);
}
function renderFoodTimeline(food) {
  if (!food) return '';
  const rows = foodRows(food);
  return `<section class="food-timeline"><div class="food-timeline-head"><span>◌</span><div><b>Food &amp; provisions along the day</b><small>Stops are options; follow the timing and safety notes.</small></div><button type="button" class="food-open" data-open-food>Open food drawer ↗</button></div><div class="food-stop-grid">${rows.map(x => renderFoodStop(x,x.type)).join('')}</div></section>`;
}
function renderFoodPane() {
  const days = activeRoute().days;
  const filter = $('#foodDayFilter');
  const prior = filter.value || 'all';
  filter.innerHTML = '<option value="all">All days</option>' + days.map(d => `<option value="${d.day}">Day ${d.day} · ${escapeHTML(d.date)}</option>`).join('');
  filter.value = [...filter.options].some(o => o.value === prior) ? prior : 'all';
  $('#foodDays').innerHTML = days.filter(d => filter.value === 'all' || String(d.day) === filter.value).map(d => `<article class="food-day"><header><span>DAY ${String(d.day).padStart(2,'0')}</span><div><small>${escapeHTML(d.date)} · ${escapeHTML(d.region)} · ${escapeHTML(d.drive)}</small><h3>${escapeHTML(d.heading || `Day ${d.day}`)}</h3></div></header><div class="food-stop-grid">${foodRows(d.food).map(x=>renderFoodStop(x,x.type)).join('')}</div></article>`).join('');
  $('#pantryTitle').textContent=branch === 'primary' ? 'Pack before the mountain transfer.' : 'Pack before the Bay / ferry day.';
  $('#pantryTiming').textContent=branch === 'primary' ? trip.foodNotes.day1Timing : trip.foodNotes.fallbackDay1Timing;
  $('#pantryChecklist').innerHTML=trip.foodNotes.day1Pantry.map(x=>`<li>${escapeHTML(x)}</li>`).join('');
  document.querySelectorAll('[data-open-food]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector('[data-pane="food"]').click()));
}

function renderDays() {
  const days=activeRoute().days;
  $('#days').innerHTML=days.map(d=>`<article class="day-card"><button class="day-toggle" data-day="${d.day}" aria-expanded="${d.day===1}" aria-controls="day-${d.day}"><span class="day-no">${String(d.day).padStart(2,'0')}</span><span class="day-title"><small>${d.date} · ${d.region} · Base ${escapeHTML(d.base)}</small><strong>${escapeHTML(d.heading||`Day ${d.day} - ${d.base==='—'?'Fly home':d.base}`)}</strong></span><span class="day-drive">${escapeHTML(d.drive)}</span><span class="chevron">⌄</span></button><div class="day-content" id="day-${d.day}" ${d.day!==1?'hidden':''}><div class="blocks"><section><span>Morning</span>${renderSegments(d.morning)}</section><section><span>Afternoon</span>${renderSegments(d.afternoon)}</section><section><span>Evening</span>${renderSegments(d.evening)}</section></div>${renderFoodTimeline(d.food)}<div class="day-footer"><span><b>Park / luggage</b>${escapeHTML(d.parking)}</span><span><b>Cash / tickets</b>${escapeHTML(d.cash)}</span></div><div class="stop-links"><b>Maps & parking</b>${d.stops.map(([n])=>{const p=waypointByName(n);return p?`<button type="button" data-waypoint="${p.id}">↗ ${escapeHTML(n)}</button>`:`<span>${escapeHTML(n)}</span>`}).join('')}</div><div class="tag-row">${d.tags.map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div></div></article>`).join('');
  document.querySelectorAll('.day-toggle').forEach(btn=>btn.addEventListener('click',()=>{const content=document.getElementById(btn.getAttribute('aria-controls'));const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));content.hidden=open;activeMapDay=String(btn.dataset.day);syncMapDay();}));
}
function renderTripOps() {
  const route=activeRoute();
  $('#nightBreakdown').innerHTML=route.nightBreakdown.map(n=>`<li><b>${n.base} · ${n.nights} ${n.nights===1?'night':'nights'}</b><span>${n.dates}</span></li>`).join('');
  $('#groundTips').innerHTML=route.crucialGroundTips.map(t=>`<li>${t}</li>`).join('');
}
function render() {
  $('#routeTitle').textContent=trip.routeNames[branch];
  $('#routeToggle').checked=branch==='fallback';
  $('#routeWarning').hidden=branch!=='fallback';
  $('#routeNoticeTitle').textContent=branch==='primary'?'Day 1 includes an accepted after-sunset mountain drive; check the go/no-go contingency.':'Weather-safe route branch selected.';
  $('#routeWarningText').textContent=branch==='primary'?trip.primaryNotice:trip.fallbackNotice;
  $('#fallbackCopy').textContent=trip.fallbackNotice;
  $('#days').setAttribute('aria-label',trip.routeNames[branch]);
  renderDays();renderSchedule();renderChecks();renderTripOps();renderFoodPane();
  $('#budgetRows').innerHTML=trip.budget.map(x=>`<div class="budget-row"><div><b>${x.label}</b><small>${x.note}</small></div><strong>€${x.min}–${x.max}</strong></div>`).join('');
  $('#budgetMin').textContent=trip.budget.reduce((s,x)=>s+x.min,0);$('#budgetMax').textContent=trip.budget.reduce((s,x)=>s+x.max,0);
  $('#sourceList').innerHTML=trip.sources.map(([n,u])=>`<li><a href="${u}" target="_blank" rel="noreferrer">${n} ↗</a></li>`).join('');
  $('#emergencyNumbers').innerHTML=trip.emergency.map(x=>`<a href="${x.href}"><b>${x.number}</b><span>${x.label}</span></a>`).join('');
  $('#curatedRows').innerHTML=trip.curatedPool.map(x=>{const p=waypointByName(x.name);return `<tr><td>${escapeHTML(x.itemId)}</td><td>${escapeHTML(x.region)}</td><td>${p?`<button class="curated-map-link" type="button" data-waypoint="${p.id}">${escapeHTML(x.name)} ↗</button>`:escapeHTML(x.name)}<small>${escapeHTML(x.note)}</small></td><td>${escapeHTML(x.tag)}</td><td>${escapeHTML(x.durationHours)}</td><td>${x.cashRequired?'Yes':'No'}</td><td>€${x.estimatedCostEUR}</td><td>${x.daylightSensitive?'Yes':'No'}</td><td>${x.operatingStatusVerified?'Verified listing':'Confirm date'}</td></tr>`;}).join('');
  const filter=$('#mapDayFilter'),prior=activeMapDay;filter.innerHTML='<option value="all">All days</option>'+activeRoute().days.map(d=>`<option value="${d.day}">Day ${d.day} · ${escapeHTML(d.date)}</option>`).join('');activeMapDay=[...filter.options].some(o=>o.value===prior)?prior:'all';filter.value=activeMapDay;
  linkStaticLocations();
}
const categoryColor={Viewpoint:'#397c91',Activity:'#397c91',Meal:'#c87934',Coffee:'#79533a',Supermarket:'#578052',Parking:'#b64c3f'};
function popupHTML(p){return `<article class="map-popup"><span class="popup-category ${p.category.toLowerCase()}">${escapeHTML(p.category)}</span><h3>${escapeHTML(p.name)}</h3><p><b>Cash / card</b> · ${escapeHTML(p.cash)}</p><p>${escapeHTML(p.tip)}</p><a href="${escapeHTML(p.googleUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a></article>`;}
function initializeMap(){if(!window.L){$('#mapStatus').textContent='Interactive map library unavailable. Offline waypoint list remains available below.';renderWaypointList();return;}
  map=L.map('mapCanvas',{zoomControl:true,scrollWheelZoom:false,preferCanvas:true}).setView([42.75,19.0],8);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors',crossOrigin:true});tiles.addTo(map);
  tiles.on('tileerror',()=>{$('#mapStatus').textContent=navigator.onLine?'Some map tiles could not load; saved pins remain visible.':'Offline: map tiles unavailable, showing cached waypoint pins.';});
  tiles.on('load',()=>{$('#mapStatus').textContent=navigator.onLine?'OpenStreetMap · select a pin for field notes.':'Offline map · saved pins and coordinates are available.';});
  setTimeout(()=>{if($('#mapStatus').textContent.startsWith('Map tiles load'))$('#mapStatus').textContent='If tiles are offline, use the saved pins and waypoint list.';},4500);
  renderMapPoints();renderWaypointList();
}
function renderMapPoints(){if(!trip||!waypointData.length)return;const day=activeMapDay,route=activeRoute(),points=waypointData.filter(p=>day==='all'||(p.days?.[branch]||[]).includes(Number(day)));
  mapMarkers.forEach(x=>x.marker.remove());mapMarkers=[];
  for(const p of points){if(!map)continue;const color=categoryColor[p.category]||'#397c91';const icon=L.divIcon({className:'field-marker-wrap',html:`<span class="field-marker ${p.category.toLowerCase()}" style="--marker-color:${color}"></span>`,iconSize:[22,28],iconAnchor:[11,25],popupAnchor:[0,-23]});const marker=L.marker([p.lat,p.lng],{icon,title:p.name,keyboard:true}).bindPopup(popupHTML(p),{maxWidth:260});marker.addTo(map);marker.on('click',()=>{activeWaypoint=p.id;renderWaypointList();});mapMarkers.push({point:p,marker});}
  if(routeLine){routeLine.remove();routeLine=null;}
  if(day!=='all'){const itineraryDay=route.days.find(d=>String(d.day)===day);const path=(itineraryDay?.stops||[]).map(([name])=>waypointByName(name)).filter(Boolean);if(path.length>1&&map)routeLine=L.polyline(path.map(p=>[p.lat,p.lng]),{color:'#b56d48',weight:3,opacity:.75,dashArray:'7 7'}).addTo(map);}
  $('#mapDayLabel').textContent=day==='all'?'All itinerary stops':`Day ${day} · ${route.days.find(d=>String(d.day)===day)?.date||''}`;
  renderWaypointList();
}
function renderWaypointList(){const day=activeMapDay;const points=waypointData.filter(p=>day==='all'||(p.days?.[branch]||[]).includes(Number(day)));$('#mapWaypoints').innerHTML=points.map(p=>`<button type="button" class="waypoint-row ${activeWaypoint===p.id?'selected':''}" data-waypoint="${p.id}"><i class="waypoint-dot ${p.category.toLowerCase()}"></i><span>${escapeHTML(p.name)}</span><small>${escapeHTML(p.category)} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</small></button>`).join('');}
function linkStaticLocations(){if(!waypointData.length)return;const root=$('main');const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){if(!node.nodeValue.trim()||node.parentElement.closest('a,button,script,style,select,textarea,.location-link'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const value=node.nodeValue,html=linkedLocations(value);if(html===escapeHTML(value))continue;const holder=document.createElement('span');holder.innerHTML=html;node.replaceWith(...holder.childNodes);}}
function syncMapDay(){const f=$('#mapDayFilter');f.value=activeMapDay;renderMapPoints();if(map){const path=activeMapDay==='all'?[]:(activeRoute().days.find(d=>String(d.day)===activeMapDay)?.stops||[]).map(([n])=>waypointByName(n)).filter(Boolean);if(path.length)map.fitBounds(L.latLngBounds(path.map(p=>[p.lat,p.lng])).pad(.18),{animate:true});}}
function setDrawer(state){const drawer=$('#mapDrawer');drawer.dataset.state=state;$('#mapHandle').setAttribute('aria-expanded',String(state!=='peek'));$('#mapStateLabel').textContent=state==='full'?'Full map':state==='half'?'Swipe or tap to expand':'Tap to explore';$('#mapToggleIcon').textContent=state==='full'?'⌄':state==='half'?'⌄':'⌃';if(map){requestAnimationFrame(()=>map.invalidateSize({pan:false}));setTimeout(()=>map.invalidateSize({pan:false}),360);}}
document.addEventListener('click',e=>{const target=e.target.closest('[data-waypoint]');if(target?.dataset.waypoint){e.preventDefault();openWaypoint(target.dataset.waypoint);}});
$('#mapHandle').addEventListener('click',()=>setDrawer($('#mapDrawer').dataset.state==='peek'?'half':$('#mapDrawer').dataset.state==='half'?'full':'peek'));
$('#mapClose').addEventListener('click',()=>setDrawer('peek'));
$('#mapDayFilter').addEventListener('change',e=>{activeMapDay=e.target.value;syncMapDay();});
let dragStart=null;$('#mapHandle').addEventListener('pointerdown',e=>{dragStart=e.clientY;});$('#mapHandle').addEventListener('pointerup',e=>{if(dragStart===null)return;const delta=dragStart-e.clientY;dragStart=null;if(Math.abs(delta)<35)return;const state=$('#mapDrawer').dataset.state;setDrawer(delta>0?(state==='peek'?'half':'full'):(state==='full'?'half':'peek'));});
addEventListener('online',()=>{if($('#mapStatus'))$('#mapStatus').textContent='Back online · map tiles will reload as needed.';});
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab,.pane').forEach(el=>el.classList.remove('active'));btn.classList.add('active');$('#pane-'+btn.dataset.pane).classList.add('active');}));
$('#foodDayFilter').addEventListener('change',()=>renderFoodPane());
$('#routeToggle').addEventListener('change',e=>{branch=e.target.checked?'fallback':'primary';if(trip){activeMapDay='all';activeWaypoint=null;render();renderMapPoints();}});
const storageKey='montenegro-cash-2026';let carried=Number(localStorage.getItem(storageKey)||0);function cashText(){const b=$('#cashButton');b.textContent=carried>0?`€${carried} marked as carried · undo`:'Mark €150 as carried';$('#cashStatus').textContent=carried>0?'Saved on this device':'Tap to save your cash reminder';}cashText();$('#cashButton').addEventListener('click',()=>{carried=carried>0?0:150;localStorage.setItem(storageKey,String(carried));cashText();});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(()=>$('#connection').textContent='Offline trip data ready').catch(()=>$('#connection').textContent='Offline cache unavailable'));
let installPrompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install').hidden=false;});$('#install').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;});
