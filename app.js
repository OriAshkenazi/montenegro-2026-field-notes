const $ = (s) => document.querySelector(s);
let trip;
let waypointData=[];
let map;
let activeMapDay='all';
let activeWaypoint=null;
let mapMarkers=[];
let routeLine=null;
Promise.all([fetch('./itinerary.json?rev=2026-09-29c').then(r=>r.json()),fetch('./waypoints.json?rev=2026-09-29c').then(r=>r.json())]).then(([data,points])=>{trip=data;waypointData=points.waypoints;render();initializeMap();}).catch(()=>{$('#days').innerHTML='<p class="offline-note">Trip data is not cached yet. Open this page online once, then reload offline.</p>';$('#mapStatus').textContent='Waypoint index unavailable. Reconnect once to save it for offline use.';});

function activeRoute() { return trip.routes.primary; }
const segmentTypes = {
  DRIVE: ['↗', 'drive'], STAY: ['⌂', 'stay'], SEE: ['◉', 'see'], WALK: ['↟', 'walk'],
  EAT: ['◒', 'eat'], FOOD: ['◌', 'food'], WATER: ['≋', 'water'], WELLNESS: ['◇', 'wellness'], LOGISTICS: ['▪', 'logistics'], CAUTION: ['!', 'caution']
};
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
const waypointByName=name=>waypointData.find(w=>w.name===name);
const waypointById=id=>waypointData.find(w=>w.id===id);
function afterDrawerSettles(changed,fn){const drawer=$('#mapDrawer');if(!changed){fn();return;}let done=false;const finish=()=>{if(done)return;done=true;drawer.removeEventListener('transitionend',onEnd);fn();},onEnd=e=>{if(e.target===drawer)finish();};drawer.addEventListener('transitionend',onEnd);setTimeout(finish,320);}
function openWaypoint(id){const point=waypointById(id);if(!point)return;if(activeMapDay!=='all'&&!(point.days?.primary||[]).includes(Number(activeMapDay)))activeMapDay='all';activeWaypoint=point.id;const prior=$('#mapDrawer').dataset.state,next=prior==='full'?'full':'half';setDrawer(next);$('#mapDayFilter').value=String(activeMapDay);renderMapPoints();if(map)afterDrawerSettles(prior!==next,()=>{map.invalidateSize({pan:false});const marker=mapMarkers.find(x=>x.point.id===point.id)?.marker;map.once('moveend',()=>marker?.openPopup());map.flyTo([point.lat,point.lng],Math.max(map.getZoom(),13),{duration:.6});});renderWaypointList();}
function linkedLocations(text){const aliases=[];for(const p of waypointData)for(const alias of [...(p.aliases||[]),p.name])if(alias.length>3)aliases.push({text:alias,point:p});aliases.sort((a,b)=>b.text.length-a.text.length);const matches=[];for(const a of aliases){const re=new RegExp(`(^|[^\\p{L}\\p{N}])(${a.text.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')})(?=$|[^\\p{L}\\p{N}])`,'giu');let m;while((m=re.exec(text))){const start=m.index+m[1].length,end=start+m[2].length;if(!matches.some(x=>start<x.end&&end>x.start))matches.push({start,end,id:a.point.id,label:m[2]});}}matches.sort((a,b)=>a.start-b.start);let out='',last=0;for(const m of matches){out+=escapeHTML(text.slice(last,m.start))+`<button class="location-link" type="button" data-waypoint="${m.id}">${escapeHTML(m.label)}</button>`;last=m.end;}return out+escapeHTML(text.slice(last));}
function renderSegments(segments, compact = false) {
  if (!Array.isArray(segments)) return '';
  return `<div class="segment-list${compact ? ' compact' : ''}">${segments.map(segment => {
    const type = segmentTypes[segment.type] ? segment.type : 'LOGISTICS';
    if (type !== segment.type) console.warn(`Unknown route segment type: ${segment.type}`);
    const [icon, className] = segmentTypes[type];
    return `<div class="route-segment ${className}" ${segment.id?`id="${escapeHTML(segment.id)}"`:''}><span class="segment-icon" aria-hidden="true">${icon}</span><b class="segment-label">${type}</b><span class="segment-text">${linkedLocations(segment.text || '')}</span></div>`;
  }).join('')}</div>`;
}
function renderChecks() {
  $('#checks').innerHTML = activeRoute().checks.map(g => `<div class="check ${g.status.toLowerCase()}"><span>${g.status==='PASS'?'✓':g.status==='CONDITIONAL'?'~':'!'}</span><div><b>${g.name}</b></div><strong>${g.status}</strong></div>`).join('');
  $('#checksTitle').textContent = 'Quick status';
}

function renderFoodStop(item, type) {
  const point=waypointById(item.waypointId);
  const stopId=item.id || (point ? `food-${point.id}` : '');
  if(type==='index') return `<article class="food-stop index-stop ${item.type||'meal'}"><strong>${escapeHTML(item.name)}</strong><span class="food-category">${escapeHTML(item.type||'Stop')}</span><div class="food-index-actions"><button type="button" data-plan-target="${escapeHTML(stopId)}">Timeline ↗</button>${point?`<button type="button" data-waypoint="${point.id}">Map pin ↗</button>`:''}</div></article>`;
  const slot = item.slot || (type === 'market' ? 'Stock-up' : 'Coffee radar');
  const title = `<button type="button" class="food-map-link" data-waypoint="${point?.id||''}">${escapeHTML(item.name)}</button>`;
  const details = type === 'meal'
    ? `<p>${escapeHTML(item.specialty)}</p><small><b>Hours</b> ${escapeHTML(item.hours)} · <b>Parking</b> ${escapeHTML(item.parking)}</small><small><b>Payment</b> ${escapeHTML(item.cash)} · <b>Allow</b> ${item.durationMinutes} min</small>${item.plan ? `<small class="food-plan">${escapeHTML(item.plan)}</small>` : ''}`
    : type === 'coffee'
      ? `<p>${escapeHTML(item.why||'')}</p><small><b>Hours</b> ${escapeHTML(item.hours)} · <b>Parking</b> ${escapeHTML(item.parking)}</small>`
      : `<p>${escapeHTML(item.plan || '')}</p><small><b>Hours</b> ${escapeHTML(item.hours)} · <b>Parking</b> ${escapeHTML(item.parking)}</small>`;
  const badge = type === 'meal' ? (String(item.cash||'').toLowerCase().includes('cash-only') ? 'CASH STATUS · ASK' : 'PAYMENT CHECK') : type.toUpperCase();
  return `<article class="food-stop ${type}" ${stopId?`id="${escapeHTML(stopId)}"`:''}><div class="food-stop-top"><span>${escapeHTML(slot)}</span><b>${badge}</b></div><strong>${title}</strong>${details}</article>`;
}
function renderFoodTimeline(food) {
  if (!food) return '';
  const rows = foodRows(food);
  return `<section class="food-timeline"><div class="food-timeline-head"><span>◌</span><div><b>Food &amp; provisions along the day</b></div><button type="button" class="food-open" data-open-food>Open directory ↗</button></div><div class="food-stop-grid">${rows.map(x => renderFoodStop(x,x.type)).join('')}</div></section>`;
}
function renderFoodPane() {
  const days = activeRoute().days;
  const filter = $('#foodDayFilter');
  const prior = filter.value || 'all';
  filter.innerHTML = '<option value="all">All days</option>' + days.map(d => `<option value="${d.day}">Day ${d.day} · ${escapeHTML(d.date)}</option>`).join('');
  filter.value = [...filter.options].some(o => o.value === prior) ? prior : 'all';
  $('#foodDays').innerHTML = days.filter(d => filter.value === 'all' || String(d.day) === filter.value).map(d => `<article class="food-day"><header><span>DAY ${String(d.day).padStart(2,'0')}</span><div><small>${escapeHTML(d.date)}</small><h3>${escapeHTML(d.heading || `Day ${d.day}`)}</h3></div></header><div class="food-stop-grid">${foodRows(d.food).map(x=>renderFoodStop({...x,type:x.type},'index')).join('')}</div></article>`).join('');
  document.querySelectorAll('[data-open-food]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector('[data-pane="food"]').click()));
}

function renderDays() {
  const days=activeRoute().days;
  setRouteViewUI();
  $('#days').innerHTML=days.map(d=>`<article class="day-card" id="day-${d.day}"><button class="day-toggle" data-day="${d.day}" aria-expanded="${d.day===1}" aria-controls="day-content-${d.day}"><span class="day-no">${String(d.day).padStart(2,'0')}</span><span class="day-title"><small>${d.date} · ${d.region} · Base ${escapeHTML(d.base)}</small><strong>${escapeHTML(d.heading||`Day ${d.day} - ${d.base==='—'?'Fly home':d.base}`)}</strong></span><span class="day-drive">${escapeHTML(d.drive)}</span><span class="chevron">⌄</span></button><div class="day-content" id="day-content-${d.day}" ${d.day!==1?'hidden':''}><div class="day-body">${renderDayBody(d)}</div></div></article>`).join('');
  document.querySelectorAll('.day-toggle').forEach(btn=>btn.addEventListener('click',()=>{const content=document.getElementById(btn.getAttribute('aria-controls'));const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));content.hidden=open;activeMapDay=String(btn.dataset.day);syncMapDay();}));
}
// Compact timetable is the default; the v2 key resets choices saved while Detailed was the default.
let routeView='table';try{const v=localStorage.getItem('mne-route-view-v2');if(v==='story'||v==='table')routeView=v;}catch(e){}
function renderStopLinks(d){return `<div class="stop-links"><b>Maps & parking</b>${d.stops.map(([n],i)=>{const p=waypointByName(n);return p?`<button type="button" id="day-${d.day}-stop-${i}" data-waypoint="${p.id}">↗ ${escapeHTML(n)}</button>`:`<span>${escapeHTML(n)}</span>`}).join('')}</div>`;}
// Timetable rows reuse the route-key category tokens (colour + icon) from the detailed view.
const periodLabels={morning:'Morning',afternoon:'Afternoon',evening:'Evening'};
function timetableCategory(kind){const k=String(kind||'DAY');if(k.startsWith('FOOD-')){const type=k.slice(5).toLowerCase();return type==='meal'?['◒','eat','MEAL']:['◌','food',type.toUpperCase()];}if(k==='DAY')return ['▪','logistics','PARK / CASH'];const [icon,cat]=segmentTypes[k]||segmentTypes.LOGISTICS;return [icon,cat,segmentTypes[k]?k:'LOGISTICS'];}
function renderTimetable(d){let lastPeriod=null;const cell=t=>linkedLocations(t||''),rows=projectTimetable(d).rows.map(r=>{const what=r.waypointId?`<button type="button" class="location-link" data-waypoint="${escapeHTML(r.waypointId)}">${escapeHTML(r.what)}</button>`:cell(r.what),notes=(r.notes||[]).length?`<ul>${r.notes.map(n=>`<li>${cell(n)}</li>`).join('')}</ul>`:'';const [icon,cat,label]=timetableCategory(r.kind),divider=r.period!==lastPeriod&&periodLabels[r.period]?`<tr class="tt-period"><th colspan="4" scope="rowgroup">${periodLabels[r.period]}</th></tr>`:'';lastPeriod=r.period;return `${divider}<tr class="tt-row tt-${escapeHTML(String(r.kind||'day').toLowerCase())} ${cat}" data-seg="${escapeHTML((r.sourceIds||[]).join(' '))}"><td data-label="When">${cell(r.when)}</td><td data-label="What"><span class="route-key tt-badge ${cat}"><i aria-hidden="true">${icon}</i>${label}</span>${what}</td><td data-label="Details">${(r.details||[]).map(x=>`<p>${cell(x)}</p>`).join('')}</td><td data-label="Notes &amp; Highlights">${notes}</td></tr>`;}).join('');return `<div class="table-scroll timetable-scroll"><table class="timetable"><thead><tr><th scope="col">When</th><th scope="col">What</th><th scope="col">Details</th><th scope="col">Notes &amp; Highlights</th></tr></thead><tbody>${rows}</tbody></table></div>${renderStopLinks(d)}`;}
function renderDayBody(d){if(routeView==='table')return renderTimetable(d);return `<div class="blocks"><section><span>Morning</span>${renderSegments(d.morning)}</section><section><span>Afternoon</span>${renderSegments(d.afternoon)}</section><section><span>Evening</span>${renderSegments(d.evening)}</section></div>${renderFoodTimeline(d.food)}<div class="day-footer"><span><b>Park / luggage</b>${escapeHTML(d.parking)}</span><span><b>Cash / tickets</b>${escapeHTML(d.cash)}</span></div>${renderStopLinks(d)}<div class="tag-row">${d.tags.map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div>`;}
function setRouteViewUI(){document.body.dataset.routeView=routeView;document.querySelectorAll('.view-toggle [data-view]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.view===routeView)));}
setRouteViewUI();
document.querySelectorAll('.view-toggle [data-view]').forEach(btn=>btn.addEventListener('click',()=>{const v=btn.dataset.view;if(v===routeView||!trip)return;const bar=document.querySelector('.view-bar'),h=bar?bar.getBoundingClientRect().bottom:0,anchor=[...document.querySelectorAll('.day-card')].find(c=>c.getBoundingClientRect().bottom>h),savedTop=anchor?anchor.getBoundingClientRect().top:0;routeView=v;try{localStorage.setItem('mne-route-view-v2',v);}catch(e){}setRouteViewUI();const days=activeRoute().days;document.querySelectorAll('.day-card').forEach(c=>{const d=days.find(x=>'day-'+x.day===c.id),body=c.querySelector('.day-body');if(d&&body)body.innerHTML=renderDayBody(d);});linkStaticLocations();if(anchor){const root=document.documentElement;root.style.scrollBehavior='auto';window.scrollBy({top:anchor.getBoundingClientRect().top-savedTop,behavior:'instant'});root.style.scrollBehavior='';}}));
function renderTripOps() {
  const route=activeRoute();
  $('#nightBreakdown').innerHTML=route.nightBreakdown.map(n=>`<li><b>${n.base} · ${n.nights} ${n.nights===1?'night':'nights'}</b><span>${n.dates}</span></li>`).join('');
  $('#stayDirectory').innerHTML=trip.stays.map(stay=>{const point=waypointById(stay.mapWaypointId);return `<article class="stay-reference"><span class="stay-badge">Confirmed</span><h3>${escapeHTML(stay.name)}</h3><small>${escapeHTML(stay.dates)}</small><p>${escapeHTML(stay.address)}</p><small>${escapeHTML(stay.room)} · ${escapeHTML(stay.checkIn)} · ${escapeHTML(stay.checkout)}</small><small>${escapeHTML(stay.confirmation)} · ${escapeHTML(stay.price)}</small><small>${escapeHTML(stay.payment)}</small>${stay.phone?`<a href="tel:${escapeHTML(stay.phone.replaceAll(' ',''))}">${escapeHTML(stay.phone)}</a>`:''}${point?`<button type="button" class="food-map-link" data-waypoint="${point.id}">Map pin ↗</button>`:''}</article>`;}).join('');
}
function render() {
  $('#days').setAttribute('aria-label',trip.routeNames.primary);
  renderDays();renderChecks();renderTripOps();renderFoodPane();
  $('#budgetRows').innerHTML=trip.budget.map(x=>`<div class="budget-row"><div><b>${escapeHTML(x.label)}</b><small>${escapeHTML(x.note)}</small></div><strong>${x.currency==='ILS'?`₪${Number(x.amount).toLocaleString('en-IL',{minimumFractionDigits:2,maximumFractionDigits:2})}`:x.actual!==undefined?`€${Number(x.actual).toFixed(2)} actual`:`€${x.min}–${x.max}`}</strong></div>`).join('');
  $('#budgetMin').textContent=trip.budget.reduce((s,x)=>s+x.min,0);$('#budgetMax').textContent=trip.budget.reduce((s,x)=>s+x.max,0);
  $('#sourceList').innerHTML=trip.sources.map(([n,u])=>`<li><a href="${u}" target="_blank" rel="noreferrer">${n} ↗</a></li>`).join('');
  $('#emergencyNumbers').innerHTML=trip.emergency.map(x=>`<a href="${x.href}"><b>${x.number}</b><span>${x.label}</span></a>`).join('');
  $('#curatedRows').innerHTML=trip.curatedPool.map(x=>{const p=waypointById(x.waypointId),day=p?.days?.primary?.[0],target=p&&day?waypointPlanTarget(p,day):'';return `<tr><td>${escapeHTML(x.itemId)}</td><td>${escapeHTML(x.region)}</td><td>${p?escapeHTML(p.name):'Unavailable'}${p?`<small>${escapeHTML(p.category)}</small><div class="food-index-actions">${target?`<button type="button" data-plan-target="${escapeHTML(target)}">Timeline ↗</button>`:''}<button type="button" data-waypoint="${p.id}">Map pin ↗</button></div>`:''}</td><td>${escapeHTML(x.tag)}</td></tr>`;}).join('');
  const filter=$('#mapDayFilter'),prior=activeMapDay;filter.innerHTML='<option value="all">All days</option>'+activeRoute().days.map(d=>`<option value="${d.day}">Day ${d.day} · ${escapeHTML(d.date)}</option>`).join('');activeMapDay=[...filter.options].some(o=>o.value===prior)?prior:'all';filter.value=activeMapDay;
  linkStaticLocations();
}
// Pin colours live in style.css tokens so markers, dots and chips share one palette in both themes.
const cssToken=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const categoryColor=category=>cssToken(`--pin-${String(category).toLowerCase()}`)||cssToken('--pin-viewpoint');
function waypointPlanTarget(point,day){
  const itineraryDay=activeRoute().days.find(d=>Number(d.day)===Number(day));if(!itineraryDay)return '';
  for(const item of foodRows(itineraryDay.food))if(item.waypointId===point.id)return item.id||`day-${day}`;
  for(const [i,[name]] of (itineraryDay.stops||[]).entries())if(waypointByName(name)?.id===point.id)return `day-${day}-stop-${i}`;
  const names=[point.name,...(point.aliases||[])].map(x=>String(x).toLocaleLowerCase());
  for(const [period,segments] of [['morning',itineraryDay.morning],['afternoon',itineraryDay.afternoon],['evening',itineraryDay.evening]])for(const [i,segment] of (segments||[]).entries())if(names.some(name=>(segment.text||'').toLocaleLowerCase().includes(name)))return segment.id||`day-${day}`;
  return `day-${day}`;
}
function popupHTML(p){const days=p.days?.primary||[],jumpDay=days.includes(Number(activeMapDay))?Number(activeMapDay):days[0],target=jumpDay?waypointPlanTarget(p,jumpDay):'',payment=String(p.cash||'Ask');return `<article class="map-popup"><h3>${escapeHTML(p.name)}</h3><span class="popup-category ${p.category.toLowerCase()}">${escapeHTML(p.category)}</span><span class="popup-payment">${escapeHTML(payment)}</span><a href="${escapeHTML(p.googleUrl)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>${target?`<button type="button" data-plan-target="${escapeHTML(target)}">Jump to Plan ↗</button>`:''}</article>`;}
function initializeMap(){if(!window.L){$('#mapStatus').textContent='Interactive map library unavailable. Offline waypoint list remains available below.';renderWaypointList();return;}
  map=L.map('mapCanvas',{zoomControl:true,scrollWheelZoom:false,preferCanvas:true}).setView([42.75,19.0],8);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors',crossOrigin:true});tiles.addTo(map);
  tiles.on('tileerror',()=>{$('#mapStatus').textContent=navigator.onLine?'Some map tiles could not load; saved pins remain visible.':'Offline: map tiles unavailable, showing cached waypoint pins.';});
  tiles.on('load',()=>{$('#mapStatus').textContent=navigator.onLine?'OpenStreetMap · select a pin for field notes.':'Offline map · saved pins and coordinates are available.';});
  setTimeout(()=>{if($('#mapStatus').textContent.startsWith('Map tiles load'))$('#mapStatus').textContent='If tiles are offline, use the saved pins and waypoint list.';},4500);
  renderMapPoints();renderWaypointList();
}
function renderMapPoints(){if(!trip||!waypointData.length)return;const day=activeMapDay,route=activeRoute(),points=waypointData.filter(p=>day==='all'||(p.days?.primary||[]).includes(Number(day)));
  mapMarkers.forEach(x=>x.marker.remove());mapMarkers=[];
  for(const p of points){if(!map)continue;const color=categoryColor(p.category);const icon=L.divIcon({className:'field-marker-wrap',html:`<span class="field-marker ${p.category.toLowerCase()}" style="--marker-color:${color}"></span>`,iconSize:[22,28],iconAnchor:[11,25],popupAnchor:[0,-23]});const marker=L.marker([p.lat,p.lng],{icon,title:p.name,keyboard:true}).bindPopup(popupHTML(p),{maxWidth:260});marker.addTo(map);marker.on('click',()=>{activeWaypoint=p.id;renderWaypointList();});mapMarkers.push({point:p,marker});}
  if(routeLine){routeLine.remove();routeLine=null;}
  if(day!=='all'){const itineraryDay=route.days.find(d=>String(d.day)===day);const path=(itineraryDay?.stops||[]).map(([name])=>waypointByName(name)).filter(Boolean);if(path.length>1&&map)routeLine=L.polyline(path.map(p=>[p.lat,p.lng]),{color:cssToken('--pin-route'),weight:3,opacity:.75,dashArray:'7 7'}).addTo(map);}
  $('#mapDayLabel').textContent=day==='all'?'All itinerary stops':`Day ${day} · ${route.days.find(d=>String(d.day)===day)?.date||''}`;
  renderWaypointList();
}
function renderWaypointList(){const day=activeMapDay;const points=waypointData.filter(p=>day==='all'||(p.days?.primary||[]).includes(Number(day)));$('#mapWaypoints').innerHTML=points.map(p=>`<button type="button" class="waypoint-row ${activeWaypoint===p.id?'selected':''}" data-waypoint="${p.id}"><i class="waypoint-dot ${p.category.toLowerCase()}"></i><span>${escapeHTML(p.name)}</span><small>${escapeHTML(p.category)} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}${p.precision?.includes('approximate')?' · approximate property pin':''}</small></button>`).join('');}
function linkStaticLocations(){if(!waypointData.length)return;const root=$('main');const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){if(!node.nodeValue.trim()||node.parentElement.closest('a,button,script,style,select,textarea,.location-link'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const value=node.nodeValue,html=linkedLocations(value);if(html===escapeHTML(value))continue;const holder=document.createElement('span');holder.innerHTML=html;node.replaceWith(...holder.childNodes);}}
function syncMapDay(){const f=$('#mapDayFilter');f.value=activeMapDay;renderMapPoints();if(map){const path=activeMapDay==='all'?[]:(activeRoute().days.find(d=>String(d.day)===activeMapDay)?.stops||[]).map(([n])=>waypointByName(n)).filter(Boolean);if(path.length)map.fitBounds(L.latLngBounds(path.map(p=>[p.lat,p.lng])).pad(.18),{animate:true});}}
function setDrawer(state){const drawer=$('#mapDrawer'),side=matchMedia('(orientation: landscape)').matches;drawer.dataset.state=state;document.body.dataset.mapState=state;$('#mapHandle').setAttribute('aria-expanded',String(state!=='peek'));$('#mapStateLabel').textContent=state==='full'?'Full map':state==='half'?'Swipe or tap to expand':'Tap to explore';$('#mapToggleIcon').textContent=side?(state==='full'?'›':'‹'):(state==='peek'?'⌃':'⌄');}
// Leaflet re-measures whenever the canvas box changes (drawer snaps, live drags, rotation), once per frame.
let mapResizeQueued=false;if('ResizeObserver'in window)new ResizeObserver(()=>{if(!map||mapResizeQueued)return;mapResizeQueued=true;requestAnimationFrame(()=>{mapResizeQueued=false;map.invalidateSize({pan:false});});}).observe($('#mapCanvas'));
document.addEventListener('click',e=>{const jump=e.target.closest('[data-plan-target]');if(jump){e.preventDefault();const routeTab=document.querySelector('.tab[data-pane="plan"]');if(routeTab&&!routeTab.classList.contains('active'))routeTab.click();const targetId=jump.dataset.planTarget,segNode=routeView==='table'&&!document.getElementById(targetId)?document.querySelector(`[data-seg~="${CSS.escape(targetId)}"]`):null,targetNode=segNode||document.getElementById(targetId),card=targetNode?.closest('.day-card');if(card){const day=card.id.replace('day-',''),button=card.querySelector('.day-toggle'),content=card.querySelector('.day-content');button.setAttribute('aria-expanded','true');content.hidden=false;activeMapDay=day;syncMapDay();setTimeout(()=>{targetNode?.scrollIntoView({behavior:'smooth',block:'center'});},60);}return;}const target=e.target.closest('[data-waypoint]');if(target?.dataset.waypoint){e.preventDefault();openWaypoint(target.dataset.waypoint);}});
$('#mapClose').addEventListener('click',()=>setDrawer('peek'));
$('#mapDayFilter').addEventListener('change',e=>{activeMapDay=e.target.value;syncMapDay();});
// Live drag: the sheet follows the finger, then snaps to the nearest peek/half/full point (flicks carry momentum).
function drawerSnapSizes(side){const narrow=matchMedia('(max-width: 760px)').matches,peek=side?72:$('#mapHandle').offsetHeight;return side?{peek,half:Math.min(440,innerWidth*.42),full:Math.min(720,innerWidth*.58)}:{peek,half:innerHeight*(narrow?.6:.54),full:innerHeight*(narrow?1:.96)};}
let dragStart=null,suppressMapHandleClick=false;
$('#mapHandle').addEventListener('pointerdown',e=>{const drawer=$('#mapDrawer'),side=matchMedia('(orientation: landscape)').matches,rect=drawer.getBoundingClientRect();dragStart={x:e.clientX,y:e.clientY,side,size:side?rect.width:rect.height,moved:false,lastPos:side?e.clientX:e.clientY,lastTime:e.timeStamp,velocity:0};$('#mapHandle').setPointerCapture?.(e.pointerId);});
$('#mapHandle').addEventListener('pointermove',e=>{if(!dragStart)return;const drawer=$('#mapDrawer'),pos=dragStart.side?e.clientX:e.clientY,delta=dragStart.side?dragStart.x-pos:dragStart.y-pos;if(!dragStart.moved&&Math.abs(delta)<6)return;dragStart.moved=true;drawer.classList.add('dragging');const sizes=drawerSnapSizes(dragStart.side),size=Math.max(sizes.peek,Math.min(sizes.full,dragStart.size+delta));drawer.style[dragStart.side?'width':'height']=`${size}px`;const dt=e.timeStamp-dragStart.lastTime;if(dt>0)dragStart.velocity=(dragStart.lastPos-pos)/dt;dragStart.lastPos=pos;dragStart.lastTime=e.timeStamp;});
function endDrawerDrag(e){if(!dragStart)return;const drawer=$('#mapDrawer'),{side,moved,velocity}=dragStart,delta=side?dragStart.x-e.clientX:dragStart.y-e.clientY,start=dragStart.size;dragStart=null;if(!moved)return;const current=side?drawer.getBoundingClientRect().width:drawer.getBoundingClientRect().height;drawer.style.height='';drawer.style.width='';drawer.classList.remove('dragging');if(Math.abs(delta)<35&&Math.abs(velocity)<.5){setDrawer(drawer.dataset.state);return;}suppressMapHandleClick=true;setTimeout(()=>{suppressMapHandleClick=false;},500);const sizes=drawerSnapSizes(side),projected=current+velocity*180;let next=Object.keys(sizes).reduce((best,key)=>Math.abs(sizes[key]-projected)<Math.abs(sizes[best]-projected)?key:best,'peek');if(next===drawer.dataset.state&&Math.abs(velocity)>.5)next=velocity>0?(next==='peek'?'half':'full'):(next==='full'?'half':'peek');if(current<start&&next!=='peek'&&sizes[next]>start)next=drawer.dataset.state;setDrawer(next);}
$('#mapHandle').addEventListener('pointerup',endDrawerDrag);$('#mapHandle').addEventListener('pointercancel',endDrawerDrag);
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#mapDrawer').dataset.state!=='peek'){setDrawer('peek');$('#mapHandle').focus();}});$('#mapHandle').addEventListener('click',e=>{if(suppressMapHandleClick){e.preventDefault();e.stopPropagation();suppressMapHandleClick=false;return;}const state=$('#mapDrawer').dataset.state;setDrawer(state==='peek'?'half':state==='half'?'full':'peek');});
addEventListener('online',()=>{if($('#mapStatus'))$('#mapStatus').textContent='Back online · map tiles will reload as needed.';});
let orientationResizeTimer;addEventListener('resize',()=>{clearTimeout(orientationResizeTimer);orientationResizeTimer=setTimeout(()=>setDrawer($('#mapDrawer').dataset.state),120);});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>renderMapPoints());
// Each section keeps its own scroll position; a first visit starts at the tab bar rather than mid-page.
const paneScroll={};
function syncTabsUI(){document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected',String(t.classList.contains('active'))));}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{const current=document.querySelector('.tab.active')?.dataset.pane,next=btn.dataset.pane;if(current===next)return;if(current)paneScroll[current]=scrollY;document.querySelectorAll('.tab,.pane').forEach(el=>el.classList.remove('active'));btn.classList.add('active');$('#pane-'+next).classList.add('active');syncTabsUI();btn.scrollIntoView({block:'nearest',inline:'nearest'});const hero=$('.hero'),tabsStart=hero.offsetTop+hero.offsetHeight,target=paneScroll[next]??Math.min(scrollY,tabsStart);document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:target,behavior:'instant'});document.documentElement.style.scrollBehavior='';}));
syncTabsUI();
$('#foodDayFilter').addEventListener('change',()=>renderFoodPane());

const storageKey='montenegro-cash-2026';let carried=Number(localStorage.getItem(storageKey)||0);function cashText(){const b=$('#cashButton');b.textContent=carried>0?`€${carried} marked as carried · undo`:'Mark up to €225.39 available';$('#cashStatus').textContent=carried>0?'Saved on this device':'Runolist is cash-only; outstanding balance is not stated.';}cashText();$('#cashButton').addEventListener('click',()=>{carried=carried>0?0:225.39;localStorage.setItem(storageKey,String(carried));cashText();});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(()=>$('#connection').textContent='Offline trip data ready').catch(()=>$('#connection').textContent='Offline cache unavailable'));
let installPrompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install').hidden=false;});$('#install').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;});
