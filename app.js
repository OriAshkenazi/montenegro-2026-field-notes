const $ = (s) => document.querySelector(s);
let trip;
let waypointData=[];
let map;
let activeMapDay='all';
let activeWaypoint=null;
let mapMarkers=[];
let routeLine=null;
// UI strings come from t(); itinerary content is English data translated at render boundaries via tc()/tr(). Helpers: U/UB escaped UI strings, H escaped names, C escaped content (bidi-isolated in Hebrew).
const U=(k,v,f)=>escapeHTML(t(k,v,f)),UB=(k,v,f)=>bidi(escapeHTML(t(k,v,f))),H=s=>bidi(escapeHTML(s)),C=s=>bidi(escapeHTML(tc(s))),tf=(k,fb)=>{const s=t(k);return s===k?fb:s;};
let mapStatusKey='map.status.initial',connKey='conn.ready';
const setMapStatus=k=>{mapStatusKey=k;const el=$('#mapStatus');if(el)el.textContent=t(k);};
const setConn=k=>{connKey=k;const el=$('#connection');if(el)el.textContent=t(k);};
const numLocale=()=>getLang()==='he'?'he-IL':'en-IL';
Promise.all([fetch('./itinerary.json?rev=2026-09-29i').then(r=>r.json()),fetch('./waypoints.json?rev=2026-09-29i').then(r=>r.json()),i18nReady]).then(([data,points])=>{trip=data;waypointData=points.waypoints;applyStatic();setConn(connKey);setMapStatus(mapStatusKey);cashText();render();initializeMap();setDrawer($('#mapDrawer').dataset.state);}).catch(()=>Promise.resolve(i18nReady).then(()=>{try{applyStatic();}catch(e){}$('#days').innerHTML=`<p class="offline-note">${escapeHTML(tf('err.data','Trip data is not cached yet. Open this page online once, then reload offline.'))}</p>`;$('#mapStatus').textContent=tf('map.status.noIndex','Waypoint index unavailable. Reconnect once to save it for offline use.');}));

function activeRoute() { return trip.routes.primary; }
const segmentTypes = {
  DRIVE: ['↗', 'drive'], STAY: ['⌂', 'stay'], SEE: ['◉', 'see'], WALK: ['↟', 'walk'],
  EAT: ['◒', 'eat'], FOOD: ['◌', 'food'], WATER: ['≋', 'water'], WELLNESS: ['◇', 'wellness'], LOGISTICS: ['▪', 'logistics'], CAUTION: ['!', 'caution']
};
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
// Only data-driven links with these schemes are rendered; anything else (e.g. javascript:) becomes an inert '#'.
function safeHref(value,schemes=['https:']){try{const u=new URL(String(value),location.href);return escapeHTML(schemes.includes(u.protocol)?u.href:'#');}catch(e){return '#';}}
const waypointByName=name=>waypointData.find(w=>w.name===name);
const waypointById=id=>waypointData.find(w=>w.id===id);
function afterDrawerSettles(changed,fn){const drawer=$('#mapDrawer');if(!changed){fn();return;}let done=false;const finish=()=>{if(done)return;done=true;drawer.removeEventListener('transitionend',onEnd);fn();},onEnd=e=>{if(e.target===drawer)finish();};drawer.addEventListener('transitionend',onEnd);setTimeout(finish,320);}
function openWaypoint(id,contextDay){const point=waypointById(id);if(!point)return;if(contextDay&&waypointDays(point).includes(Number(contextDay)))activeMapDay=String(contextDay);else if(activeMapDay!=='all'&&!waypointDays(point).includes(Number(activeMapDay)))activeMapDay='all';activeWaypoint=point.id;const prior=$('#mapDrawer').dataset.state,next=prior==='full'?'full':'half';setDrawer(next);$('#mapDayFilter').value=String(activeMapDay);renderMapPoints();if(map)afterDrawerSettles(prior!==next,()=>{map.invalidateSize({pan:false});const marker=mapMarkers.find(x=>x.point.id===point.id)?.marker;map.once('moveend',()=>marker?.openPopup());map.flyTo([point.lat,point.lng],Math.max(map.getZoom(),13),{duration:.6});});renderWaypointList();}
function linkedLocations(text,plain){const aliases=[];for(const p of waypointData)for(const alias of [...(p.aliases||[]),p.name,...placeAliases(p.id)])if(alias.length>3)aliases.push({text:alias,point:p});const lead=getLang()==='he'?'((?:^|[^\\p{L}\\p{N}])[והבכלמש]{0,2})':'(^|[^\\p{L}\\p{N}])';aliases.sort((a,b)=>b.text.length-a.text.length);const matches=[];for(const a of aliases){const re=new RegExp(`${lead}(${a.text.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')})(?=$|[^\\p{L}\\p{N}])`,'giu');let m;while((m=re.exec(text))){const start=m.index+m[1].length,end=start+m[2].length;if(!matches.some(x=>start<x.end&&end>x.start))matches.push({start,end,id:a.point.id,label:m[2]});}}matches.sort((a,b)=>a.start-b.start);
  const emit=(a,b)=>{let o='',p=a;for(const m of matches)if(m.start>=a&&m.end<=b){o+=escapeHTML(text.slice(p,m.start))+`<button class="location-link" type="button" data-waypoint="${m.id}">${escapeHTML(m.label)}</button>`;p=m.end;}return o+escapeHTML(text.slice(p,b));};
  // Hebrew: Latin/digit runs (and any location button inside them) are isolated left-to-right.
  const runs=(!plain&&getLang()==='he')?bidiRuns(text).map(r=>r.slice()):[];for(const r of runs)for(const m of matches)if(m.start<r[1]&&m.end>r[0]){r[0]=Math.min(r[0],m.start);r[1]=Math.max(r[1],m.end);}runs.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of runs){const l=merged[merged.length-1];if(l&&r[0]<l[1])l[1]=Math.max(l[1],r[1]);else merged.push(r);}
  let out='',last=0;for(const r of merged){out+=emit(last,r[0])+`<bdi dir="ltr">${emit(r[0],r[1])}</bdi>`;last=r[1];}return out+emit(last,text.length);}
function renderSegments(segments, compact = false) {
  if (!Array.isArray(segments)) return '';
  return `<div class="segment-list${compact ? ' compact' : ''}">${segments.map(segment => {
    const type = segmentTypes[segment.type] ? segment.type : 'LOGISTICS';
    if (type !== segment.type) console.warn(`Unknown route segment type: ${segment.type}`);
    const [icon, className] = segmentTypes[type];
    return `<div class="route-segment ${className}" ${segment.id?`id="${escapeHTML(segment.id)}"`:''}><span class="segment-icon" aria-hidden="true">${icon}</span><b class="segment-label">${U('seg.'+type)}</b><span class="segment-text">${linkedLocations(tc(segment.text || ''))}</span></div>`;
  }).join('')}</div>`;
}
function renderFoodStop(item, type) {
  const point=waypointById(item.waypointId);
  const stopId=item.id || (point ? `food-${point.id}` : '');
  const slot = item.slot ? tr(item.slot) : type === 'market' ? tr('Stock-up') : t('food.coffeeRadar');
  const title = `<button type="button" class="food-map-link" data-waypoint="${point?.id||''}">${H(item.name)}</button>`;
  const details = type === 'meal'
    ? `<p>${C(item.specialty)}</p><small><b>${U('food.hours')}</b> ${C(item.hours)} · <b>${U('food.parking')}</b> ${C(item.parking)}</small><small><b>${U('food.payment')}</b> ${C(item.cash)} · <b>${U('food.allow')}</b> ${UB('food.min',{n:item.durationMinutes})}</small>${item.plan ? `<small class="food-plan">${C(item.plan)}</small>` : ''}`
    : type === 'coffee'
      ? `<p>${C(item.why||'')}</p><small><b>${U('food.hours')}</b> ${C(item.hours)} · <b>${U('food.parking')}</b> ${C(item.parking)}</small>`
      : `<p>${C(item.plan || '')}</p><small><b>${U('food.hours')}</b> ${C(item.hours)} · <b>${U('food.parking')}</b> ${C(item.parking)}</small>`;
  const badge = type === 'meal' ? (String(item.cash||'').toLowerCase().includes('cash-only') ? U('food.badge.cash') : U('food.badge.pay')) : U('food.badge.'+type, null, type.toUpperCase());
  return `<article class="food-stop ${type}" ${stopId?`id="${escapeHTML(stopId)}"`:''}><div class="food-stop-top"><span>${H(slot)}</span><b>${badge}</b></div><strong>${title}</strong>${details}</article>`;
}
function renderFoodTimeline(food) {
  if (!food) return '';
  const rows = foodRows(food);
  return `<section class="food-timeline"><div class="food-timeline-head"><span>◌</span><div><b>${U('food.along')}</b></div></div><div class="food-stop-grid">${rows.map(x => renderFoodStop(x,x.type)).join('')}</div></section>`;
}
let openDays=new Set([1]);// day numbers expanded by the next renderDays()
function renderDays() {
  const days=activeRoute().days;
  setRouteViewUI();
  $('#days').innerHTML=days.map(d=>`<article class="day-card" id="day-${d.day}"><div class="day-meta"><span>${C(d.date)} · ${C(d.region)} · ${U('day.base')} ${H(d.base)}</span><span class="day-drive">${C(d.drive)}</span></div><button class="day-toggle" data-day="${d.day}" aria-expanded="${openDays.has(d.day)}" aria-controls="day-content-${d.day}"><span class="day-no">${String(d.day).padStart(2,'0')}</span><span class="day-title"><strong>${d.heading?C(d.heading):H(t('day.title',{n:d.day,base:d.base==='—'?t('day.flyHome'):d.base}))}</strong></span><span class="chevron" aria-hidden="true">⌄</span></button><div class="day-content" id="day-content-${d.day}" ${openDays.has(d.day)?'':'hidden'}><div class="day-body">${renderDayBody(d)}</div></div></article>`).join('');
  document.querySelectorAll('.day-toggle').forEach(btn=>btn.addEventListener('click',()=>{const content=document.getElementById(btn.getAttribute('aria-controls'));const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));content.hidden=open;activeMapDay=String(btn.dataset.day);syncMapDay();}));
}
function syncDayStickyOffset(){const tabs=document.querySelector('.tabs'),bar=document.querySelector('.view-bar');if(!tabs||!bar)return;const offset=tabs.getBoundingClientRect().height+bar.getBoundingClientRect().height;document.documentElement.style.setProperty('--day-sticky-top',`${offset}px`);}
syncDayStickyOffset();
if('ResizeObserver'in window){const stickyOffsetObserver=new ResizeObserver(syncDayStickyOffset);['.tabs','.view-bar'].forEach(selector=>{const el=document.querySelector(selector);if(el)stickyOffsetObserver.observe(el);});}else window.addEventListener('resize',syncDayStickyOffset,{passive:true});
// Compact timetable is the default; the v2 key resets choices saved while Detailed was the default.
let routeView='table';try{const v=localStorage.getItem('mne-route-view-v2');if(v==='story'||v==='table')routeView=v;}catch(e){}
function renderStopLinks(d){return `<div class="stop-links"><b>${U('stops.title')}</b>${d.stops.map(([n],i)=>{const p=waypointByName(n);return p?`<button type="button" id="day-${d.day}-stop-${i}" data-waypoint="${p.id}">${U('glyph.out')} ${H(n)}</button>`:`<span>${H(n)}</span>`}).join('')}</div>`;}
// Timetable rows reuse the route-key category tokens (colour + icon) from the detailed view.
const periodLabel=p=>p==='morning'||p==='afternoon'||p==='evening'?t('period.'+p):'';
function timetableCategory(kind){const k=String(kind||'DAY');if(k.startsWith('FOOD-')){const type=k.slice(5).toLowerCase();return type==='meal'?['◒','eat',t('tt.cat.MEAL')]:['◌','food',t('tt.cat.'+type.toUpperCase(),null,type.toUpperCase())];}if(k==='DAY')return ['▪','logistics',t('tt.cat.PARK')];const [icon,cat]=segmentTypes[k]||segmentTypes.LOGISTICS;return [icon,cat,t('seg.'+(segmentTypes[k]?k:'LOGISTICS'))];}
function renderTimetable(d){let lastPeriod=null;const cell=x=>linkedLocations(tr(x||'')),rows=projectTimetable(d).rows.map(r=>{const what=r.waypointId?`<button type="button" class="location-link" data-waypoint="${escapeHTML(r.waypointId)}">${H(tr(r.what))}</button>`:cell(r.what),notes=(r.notes||[]).length?`<ul>${r.notes.map(n=>`<li>${cell(n)}</li>`).join('')}</ul>`:'';const [icon,cat,label]=timetableCategory(r.kind),divider=r.period!==lastPeriod&&periodLabel(r.period)?`<tr class="tt-period"><th colspan="4" scope="rowgroup">${U('period.'+r.period)}</th></tr>`:'';lastPeriod=r.period;return `${divider}<tr class="tt-row tt-${escapeHTML(String(r.kind||'day').toLowerCase())} ${cat}" data-seg="${escapeHTML((r.sourceIds||[]).join(' '))}"><td data-label="${U('tt.when')}">${cell(r.when)}</td><td data-label="${U('tt.what')}"><span class="route-key tt-badge ${cat}"><i aria-hidden="true">${icon}</i>${escapeHTML(label)}</span>${what}</td><td data-label="${U('tt.details')}">${(r.details||[]).map(x=>`<p>${cell(x)}</p>`).join('')}</td><td data-label="${U('tt.notes')}">${notes}</td></tr>`;}).join('');return `<div class="table-scroll timetable-scroll"><table class="timetable"><thead><tr><th scope="col">${U('tt.when')}</th><th scope="col">${U('tt.what')}</th><th scope="col">${U('tt.details')}</th><th scope="col">${U('tt.notes')}</th></tr></thead><tbody>${rows}</tbody></table></div>${renderStopLinks(d)}`;}
const routeOptionDays={2:[['bosacajablan-lake-viewpoint-short-out-and-back-optional-alternative','day.option.bosaca','day.option.day2Gate']],4:[['perast-our-lady-of-the-rocks-boat','day.option.perastBoat','day.option.day4Gate']]};
function waypointDays(point){const days=new Set(point.days?.primary||[]);for(const [day,options] of Object.entries(routeOptionDays))if(options.some(([id])=>id===point.id))days.add(Number(day));return [...days];}
function representedInDay(day,point){const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const texts=[...(day.stops||[]).map(x=>x[0]),...['morning','afternoon','evening'].flatMap(p=>(day[p]||[]).flatMap(s=>[s.title,s.text])),...Object.values(day.food||{}).flatMap(items=>items.map(x=>x.name))].map(norm);if(Object.values(day.food||{}).some(items=>items.some(x=>x.waypointId===point.id)))return true;const names=[point.name,...(point.aliases||[])].map(norm).filter(x=>x.length>4);return names.some(name=>texts.some(text=>text.includes(name)));}
function renderRouteOptions(d){const options=routeOptionDays[d.day]||[],pool=trip?.curatedPool||[],points=options.map(([id,label,gate])=>({entry:pool.find(x=>x.waypointId===id),label,gate})).filter(x=>x.entry).map(x=>({point:waypointById(x.entry.waypointId),label:x.label,gate:x.gate})).filter(x=>x.point&&!representedInDay(d,x.point));if(!points.length)return '';return `<section class="day-options"><h3>${U('day.options')}</h3><ul>${points.map(({point,label,gate})=>`<li><button type="button" data-waypoint="${escapeHTML(point.id)}" data-waypoint-day="${d.day}">${UB(label)}</button><small>${U(gate)}</small></li>`).join('')}</ul></section>`;}
function renderDayBody(d){if(routeView==='table')return `${renderTimetable(d)}${renderRouteOptions(d)}`;return `<div class="blocks"><section><span>${U('period.morning')}</span>${renderSegments(d.morning)}</section><section><span>${U('period.afternoon')}</span>${renderSegments(d.afternoon)}</section><section><span>${U('period.evening')}</span>${renderSegments(d.evening)}</section></div>${renderFoodTimeline(d.food)}<div class="day-footer"><span><b>${U('day.parkLuggage')}</b>${C(d.parking)}</span><span><b>${U('day.cashTickets')}</b>${C(d.cash)}</span></div>${renderStopLinks(d)}${renderRouteOptions(d)}<div class="tag-row">${d.tags.map(tag=>`<span>${C(tag)}</span>`).join('')}</div>`;}
function setRouteViewUI(){document.body.dataset.routeView=routeView;document.querySelectorAll('.view-toggle [data-view]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.view===routeView)));}
setRouteViewUI();
// Keeps the first visible day card at the same viewport offset across a re-render (view toggle, language switch).
function preserveScroll(fn){const bar=document.querySelector('.view-bar'),h=bar?bar.getBoundingClientRect().bottom:0,anchor=[...document.querySelectorAll('.day-card')].find(c=>c.getBoundingClientRect().bottom>h),anchorId=anchor?anchor.id:'',savedTop=anchor?anchor.getBoundingClientRect().top:0;fn();if(!anchorId)return;const correct=()=>{const next=document.getElementById(anchorId);if(!next)return;const root=document.documentElement;root.style.scrollBehavior='auto';window.scrollBy({top:next.getBoundingClientRect().top-savedTop,behavior:'instant'});root.style.scrollBehavior='';};correct();requestAnimationFrame(correct);document.fonts?.ready.then(()=>requestAnimationFrame(correct));}
document.querySelectorAll('.view-toggle [data-view]').forEach(btn=>btn.addEventListener('click',()=>{const v=btn.dataset.view;if(v===routeView||!trip)return;preserveScroll(()=>{routeView=v;try{localStorage.setItem('mne-route-view-v2',v);}catch(e){}setRouteViewUI();const days=activeRoute().days;document.querySelectorAll('.day-card').forEach(c=>{const d=days.find(x=>'day-'+x.day===c.id),body=c.querySelector('.day-body');if(d&&body)body.innerHTML=renderDayBody(d);});linkStaticLocations();});}));
function renderTripOps() {
  const route=activeRoute();
  $('#nightBreakdown').innerHTML=route.nightBreakdown.map(n=>`<li><b>${H(n.base)} · ${UB(n.nights===1?'night.one':'night.other',{n:n.nights})}</b><span>${C(n.dates)}</span></li>`).join('');
  $('#stayDirectory').innerHTML=trip.stays.map(stay=>{const point=waypointById(stay.mapWaypointId);return `<article class="stay-reference"><span class="stay-badge">${U('stay.badge')}</span><h3>${H(stay.name)}</h3><small>${C(stay.dates)}</small><p>${H(stay.address)}</p><small>${C(stay.room)} · ${C(stay.checkIn)} · ${C(stay.checkout)}</small><small>${C(stay.confirmation)} · ${C(stay.price)}</small><small>${C(stay.payment)}</small>${stay.phone?`<a href="${safeHref('tel:'+stay.phone.replaceAll(' ',''),['tel:'])}" dir="ltr">${escapeHTML(stay.phone)}</a>`:''}${point?`<button type="button" class="food-map-link" data-waypoint="${point.id}">${U('food.pin')}</button>`:''}</article>`;}).join('');
}
function renderInsurance(){
  const policy=trip.insurancePolicy,locale=getLang()==='he'?'he-IL':'en-GB',date=value=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
  $('#insuranceCard').innerHTML=`<span class="card-kicker">${U('insurance.kicker')}</span><h3>${U('insurance.title')}</h3><p>${UB('insurance.policy',{insurer:policy.insurer,number:policy.policyNumber})}</p><p>${UB('insurance.dates',{from:date(policy.validFrom),to:date(policy.validTo)})} · ${UB('insurance.travelers',{n:policy.travelers})}</p><p>${UB('insurance.coverage',{limit:Number(policy.medicalLimit).toLocaleString('en-US')})}${policy.adventureSportsExtension?` ${U('insurance.adventure')}`:''}</p><p>${UB('insurance.premium',{amount:policy.premiumAmount.toFixed(2),ils:policy.premiumIlsEquivalent.toFixed(2)})}</p><h4>${U('insurance.assistance')}</h4><ul class="insurance-contacts">${policy.assistanceContacts.map(contact=>`<li><b>${H(contact.provider)}</b><a href="${safeHref(`tel:${contact.phone}`,['tel:'])}" dir="ltr">${escapeHTML(contact.phone)}</a><a href="${safeHref(`https://wa.me/${contact.whatsapp.replaceAll('+','')}`)}" dir="ltr">WhatsApp ${escapeHTML(contact.whatsapp)}</a><a href="${safeHref(`mailto:${contact.email}`,['mailto:'])}" dir="ltr">${escapeHTML(contact.email)}</a></li>`).join('')}</ul><small>${U('insurance.terms')}</small>`;
}
function render(open) {
  openDays=open||new Set([1]);
  $('#days').setAttribute('aria-label',tc(trip.routeNames.primary));
  renderDays();renderTripOps();renderInsurance();
  $('#budgetRows').innerHTML=trip.budget.map(x=>`<div class="budget-row"><div><b>${C(x.label)}</b><small>${C(x.note)}</small></div><strong>${x.currency==='ILS'?H(`₪${Number(x.amount).toLocaleString(numLocale(),{minimumFractionDigits:2,maximumFractionDigits:2})}`):x.currency==='USD'?UB('budget.currencyActual',{currency:x.currency,v:Number(x.actual??x.amount).toFixed(2)}):x.actual!==undefined?UB('budget.actual',{v:Number(x.actual).toFixed(2)}):H(`€${x.min}–€${x.max}`)}</strong></div>`).join('');
  $('#contactNumbers').innerHTML=trip.contacts.map(x=>`<li><div><b>${C(x.label)}</b><small>${C(x.note)}</small></div><a href="${safeHref(x.href,['tel:'])}" dir="ltr">${escapeHTML(x.number)}</a></li>`).join('');
  const euroTotal=key=>(Math.round(trip.budget.filter(x=>!x.currency||x.currency==='EUR').reduce((s,x)=>s+x[key],0)*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});$('#budgetMin').textContent=euroTotal('min');$('#budgetMax').textContent=euroTotal('max');
  const filter=$('#mapDayFilter'),prior=activeMapDay;filter.innerHTML=`<option value="all">${U('filter.all')}</option>`+activeRoute().days.map(d=>`<option value="${d.day}">${U('filter.day',{n:d.day,date:tc(d.date)})}</option>`).join('');activeMapDay=[...filter.options].some(o=>o.value===prior)?prior:'all';filter.value=activeMapDay;
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
function popupHTML(p){const days=waypointDays(p),jumpDay=days.includes(Number(activeMapDay))?Number(activeMapDay):days[0],target=jumpDay?waypointPlanTarget(p,jumpDay):'',payment=String(p.cash||'Ask');return `<article class="map-popup"><h3>${H(p.name)}</h3><span class="popup-category ${p.category.toLowerCase()}">${U('cat.'+p.category,null,p.category)}</span><span class="popup-payment">${U('pay.'+payment,null,payment)}</span><a href="${safeHref(p.googleUrl)}" target="_blank" rel="noopener noreferrer">${U('map.googleMaps')}</a>${target?`<button type="button" data-plan-target="${escapeHTML(target)}">${U('map.jump')}</button>`:''}</article>`;}
function initializeMap(){if(!window.L){setMapStatus('map.status.lib');renderWaypointList();return;}
  map=L.map('mapCanvas',{zoomControl:true,scrollWheelZoom:false,preferCanvas:true}).setView([42.75,19.0],8);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors',crossOrigin:true});tiles.addTo(map);
  tiles.on('tileerror',()=>setMapStatus(navigator.onLine?'map.status.tileErrOn':'map.status.tileErrOff'));
  tiles.on('load',()=>setMapStatus(navigator.onLine?'map.status.loadOn':'map.status.loadOff'));
  setTimeout(()=>{if(mapStatusKey==='map.status.initial')setMapStatus('map.status.hint');},4500);
  renderMapPoints();renderWaypointList();
}
function renderMapPoints(){if(!trip||!waypointData.length)return;const day=activeMapDay,route=activeRoute(),points=waypointData.filter(p=>p.mapPin!==false&&(day==='all'||waypointDays(p).includes(Number(day))));
  mapMarkers.forEach(x=>x.marker.remove());mapMarkers=[];
  for(const p of points){if(!map)continue;const color=categoryColor(p.category);const icon=L.divIcon({className:'field-marker-wrap',html:`<span class="field-marker ${p.category.toLowerCase()}" style="--marker-color:${color}"></span>`,iconSize:[18,22],iconAnchor:[9,21.7],popupAnchor:[0,-24]});const marker=L.marker([p.lat,p.lng],{icon,title:p.name,keyboard:true}).bindPopup(popupHTML(p),{maxWidth:260});marker.addTo(map);marker.on('click',()=>{activeWaypoint=p.id;renderWaypointList();});mapMarkers.push({point:p,marker});}
  if(routeLine){routeLine.remove();routeLine=null;}
  if(day!=='all'){const itineraryDay=route.days.find(d=>String(d.day)===day);const path=(itineraryDay?.stops||[]).map(([name])=>waypointByName(name)).filter(p=>p&&p.mapPin!==false);if(path.length>1&&map)routeLine=L.polyline(path.map(p=>[p.lat,p.lng]),{color:cssToken('--pin-route'),weight:3,opacity:.75,dashArray:'7 7'}).addTo(map);}
  $('#mapDayLabel').innerHTML=day==='all'?U('map.allStops'):UB('filter.day',{n:day,date:tc(route.days.find(d=>String(d.day)===day)?.date||'')});
  renderWaypointList();
}
function renderWaypointList(){const day=activeMapDay;const points=waypointData.filter(p=>p.mapPin!==false&&(day==='all'||waypointDays(p).includes(Number(day))));$('#mapWaypoints').innerHTML=points.map(p=>`<button type="button" class="waypoint-row ${activeWaypoint===p.id?'selected':''}" data-waypoint="${p.id}"><i class="waypoint-dot ${p.category.toLowerCase()}"></i><span>${H(p.name)}</span><small>${H(`${t('cat.'+p.category,null,p.category)} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}${p.precision?.includes('approximate')?` · ${t('map.approx')}`:''}`)}</small></button>`).join('');}
function linkStaticLocations(){if(!waypointData.length)return;const root=$('main');const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){if(!node.nodeValue.trim()||node.parentElement.closest('a,button,script,style,select,textarea,.location-link'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const value=node.nodeValue,html=linkedLocations(value,true);if(html===escapeHTML(value))continue;const holder=document.createElement('span');holder.innerHTML=html;node.replaceWith(...holder.childNodes);}}
function syncMapDay(){const f=$('#mapDayFilter');f.value=activeMapDay;renderMapPoints();if(map){const path=activeMapDay==='all'?[]:(activeRoute().days.find(d=>String(d.day)===activeMapDay)?.stops||[]).map(([n])=>waypointByName(n)).filter(Boolean);if(path.length)map.fitBounds(L.latLngBounds(path.map(p=>[p.lat,p.lng])).pad(.18),{animate:true});}}
function setDrawer(state){const drawer=$('#mapDrawer'),side=matchMedia('(orientation: landscape)').matches;drawer.dataset.state=state;document.body.dataset.mapState=state;$('#mapHandle').setAttribute('aria-expanded',String(state!=='peek'));$('#mapStateLabel').textContent=t(state==='full'?'map.state.full':state==='half'?'map.state.half':'map.state.peek');$('#mapToggleIcon').textContent=side?((state==='full')!==(hs()<0)?'›':'‹'):(state==='peek'?'⌃':'⌄');}
// Horizontal sign: the landscape side drawer sits on the inline-end edge, i.e. on the left in RTL.
const hs=()=>document.documentElement.dir==='rtl'?-1:1;
// Leaflet re-measures whenever the canvas box changes (drawer snaps, live drags, rotation), once per frame.
let mapResizeQueued=false;if('ResizeObserver'in window)new ResizeObserver(()=>{if(!map||mapResizeQueued)return;mapResizeQueued=true;requestAnimationFrame(()=>{mapResizeQueued=false;map.invalidateSize({pan:false});});}).observe($('#mapCanvas'));
document.addEventListener('click',e=>{const jump=e.target.closest('[data-plan-target]');if(jump){e.preventDefault();const routeTab=document.querySelector('.tab[data-pane="plan"]');if(routeTab&&!routeTab.classList.contains('active'))routeTab.click();const targetId=jump.dataset.planTarget,segNode=routeView==='table'&&!document.getElementById(targetId)?document.querySelector(`[data-seg~="${CSS.escape(targetId)}"]`):null,targetNode=segNode||document.getElementById(targetId),card=targetNode?.closest('.day-card');if(card){const day=card.id.replace('day-',''),button=card.querySelector('.day-toggle'),content=card.querySelector('.day-content');button.setAttribute('aria-expanded','true');content.hidden=false;activeMapDay=day;syncMapDay();setTimeout(()=>{targetNode?.scrollIntoView({behavior:'smooth',block:'center'});},60);}return;}const target=e.target.closest('[data-waypoint]');if(target?.dataset.waypoint){e.preventDefault();openWaypoint(target.dataset.waypoint,target.dataset.waypointDay);}});
$('#mapClose').addEventListener('click',()=>setDrawer('peek'));
$('#mapDayFilter').addEventListener('change',e=>{activeMapDay=e.target.value;syncMapDay();});
// Live drag: the sheet follows the finger, then snaps to the nearest peek/half/full point (flicks carry momentum).
function drawerSnapSizes(side){const narrow=matchMedia('(max-width: 760px)').matches,peek=side?72:$('#mapHandle').offsetHeight;return side?{peek,half:Math.min(440,innerWidth*.42),full:Math.min(720,innerWidth*.58)}:{peek,half:innerHeight*(narrow?.6:.54),full:innerHeight*(narrow?1:.96)};}
let dragStart=null,suppressMapHandleClick=false;
$('#mapHandle').addEventListener('pointerdown',e=>{const drawer=$('#mapDrawer'),side=matchMedia('(orientation: landscape)').matches,rect=drawer.getBoundingClientRect();dragStart={x:e.clientX,y:e.clientY,side,size:side?rect.width:rect.height,moved:false,lastPos:side?e.clientX:e.clientY,lastTime:e.timeStamp,velocity:0};$('#mapHandle').setPointerCapture?.(e.pointerId);});
$('#mapHandle').addEventListener('pointermove',e=>{if(!dragStart)return;const drawer=$('#mapDrawer'),pos=dragStart.side?e.clientX:e.clientY,delta=(dragStart.side?dragStart.x-pos:dragStart.y-pos)*(dragStart.side?hs():1);if(!dragStart.moved&&Math.abs(delta)<6)return;dragStart.moved=true;drawer.classList.add('dragging');const sizes=drawerSnapSizes(dragStart.side),size=Math.max(sizes.peek,Math.min(sizes.full,dragStart.size+delta));drawer.style[dragStart.side?'width':'height']=`${size}px`;const dt=e.timeStamp-dragStart.lastTime;if(dt>0)dragStart.velocity=(dragStart.lastPos-pos)/dt*(dragStart.side?hs():1);dragStart.lastPos=pos;dragStart.lastTime=e.timeStamp;});
function endDrawerDrag(e){if(!dragStart)return;const drawer=$('#mapDrawer'),{side,moved,velocity}=dragStart,delta=(side?dragStart.x-e.clientX:dragStart.y-e.clientY)*(side?hs():1),start=dragStart.size;dragStart=null;if(!moved)return;const current=side?drawer.getBoundingClientRect().width:drawer.getBoundingClientRect().height;drawer.style.height='';drawer.style.width='';drawer.classList.remove('dragging');if(Math.abs(delta)<35&&Math.abs(velocity)<.5){setDrawer(drawer.dataset.state);return;}suppressMapHandleClick=true;setTimeout(()=>{suppressMapHandleClick=false;},500);const sizes=drawerSnapSizes(side),projected=current+velocity*180;let next=Object.keys(sizes).reduce((best,key)=>Math.abs(sizes[key]-projected)<Math.abs(sizes[best]-projected)?key:best,'peek');if(next===drawer.dataset.state&&Math.abs(velocity)>.5)next=velocity>0?(next==='peek'?'half':'full'):(next==='full'?'half':'peek');if(current<start&&next!=='peek'&&sizes[next]>start)next=drawer.dataset.state;setDrawer(next);}
$('#mapHandle').addEventListener('pointerup',endDrawerDrag);$('#mapHandle').addEventListener('pointercancel',endDrawerDrag);
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#mapDrawer').dataset.state!=='peek'){setDrawer('peek');$('#mapHandle').focus();}});$('#mapHandle').addEventListener('click',e=>{if(suppressMapHandleClick){e.preventDefault();e.stopPropagation();suppressMapHandleClick=false;return;}const state=$('#mapDrawer').dataset.state;setDrawer(state==='peek'?'half':state==='half'?'full':'peek');});
addEventListener('online',()=>{if($('#mapStatus'))setMapStatus('map.status.online');});
let orientationResizeTimer;addEventListener('resize',()=>{clearTimeout(orientationResizeTimer);orientationResizeTimer=setTimeout(()=>setDrawer($('#mapDrawer').dataset.state),120);});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>renderMapPoints());
// Each section keeps its own scroll position; a first visit starts at the tab bar rather than mid-page.
const paneScroll={};
function syncTabsUI(){document.querySelectorAll('.tab').forEach(tab=>tab.setAttribute('aria-selected',String(tab.classList.contains('active'))));}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{const current=document.querySelector('.tab.active')?.dataset.pane,next=btn.dataset.pane;if(current===next)return;if(current)paneScroll[current]=scrollY;document.querySelectorAll('.tab,.pane').forEach(el=>el.classList.remove('active'));btn.classList.add('active');$('#pane-'+next).classList.add('active');syncTabsUI();btn.scrollIntoView({block:'nearest',inline:'nearest'});const hero=$('.hero'),tabsStart=hero.offsetTop+hero.offsetHeight,target=paneScroll[next]??Math.min(scrollY,tabsStart);document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:target,behavior:'instant'});document.documentElement.style.scrollBehavior='';}));
syncTabsUI();

// Packing list: static items keyed pack.<group>.<n> in the locales; ticks are a per-device convenience kept in localStorage.
const packingGroups=[['big',18],['toiletries',11],['carry',11],['backpack',26]],packKey='mne-packing-v1';let packed=new Set();try{packed=new Set(JSON.parse(localStorage.getItem(packKey)||'[]'));}catch(e){}
function savePacked(){try{localStorage.setItem(packKey,JSON.stringify([...packed]));}catch(e){}}
function packingCounts(){const total=packingGroups.reduce((n,[,c])=>n+c,0);$('#packingProgress').innerHTML=UB('pack.progress',{done:packed.size,total});packingGroups.forEach(([g,c])=>{const el=document.querySelector(`[data-pack-count="${g}"]`);if(el)el.textContent=`${[...packed].filter(id=>id.startsWith(g+'.')).length}/${c}`;});}
function renderPacking(){$('#packingGroups').innerHTML=packingGroups.map(([g,c])=>`<article class="field-card packing-card"><header><h3>${UB('pack.'+g+'.title')}</h3><span class="card-kicker" data-pack-count="${g}"></span></header><ul>${Array.from({length:c},(_,i)=>{const id=`${g}.${i+1}`;return `<li><label><input type="checkbox" data-pack="${id}"${packed.has(id)?' checked':''}><span>${UB('pack.'+id)}</span></label></li>`;}).join('')}</ul></article>`).join('');packingCounts();}
$('#packingGroups').addEventListener('change',e=>{const id=e.target.dataset?.pack;if(!id)return;if(e.target.checked)packed.add(id);else packed.delete(id);savePacked();packingCounts();});
$('#packingReset').addEventListener('click',()=>{if(!packed.size||!confirm(t('pack.resetConfirm')))return;packed.clear();savePacked();renderPacking();});
Promise.resolve(i18nReady).then(renderPacking);onLangChange(renderPacking);
const storageKey='montenegro-cash-2026';let carried=Number(localStorage.getItem(storageKey)||0);function cashText(){const b=$('#cashButton');b.innerHTML=carried>0?UB('cash.carried',{n:carried}):UB('cash.mark');$('#cashStatus').innerHTML=carried>0?UB('cash.saved'):UB('cash.note');}$('#cashButton').addEventListener('click',()=>{carried=carried>0?0:225.39;localStorage.setItem(storageKey,String(carried));cashText();});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(()=>setConn('conn.offlineReady')).catch(()=>setConn('conn.unavailable')));
// Install: the native prompt where the browser offers one (Chromium); otherwise a how-to dialog for this device.
let installPrompt;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function installPlatform(){const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);if(ios)return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)?'iosOther':'ios';if(/Android/.test(ua))return 'android';if(/Macintosh/.test(ua)&&/Safari/.test(ua)&&!/Chrome|Chromium|Edg|Firefox/.test(ua))return 'mac';return 'desktop';}
const installIcon=d=>`<svg viewBox="0 0 24 24" width="20" height="20" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const installIcons={share:installIcon('M12 3v12M8 7l4-4 4 4M8 10H5v11h14V10h-3'),add:installIcon('M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM12 8v8M8 12h8'),menu:installIcon('M12 5h.01M12 12h.01M12 19h.01')};
const installSteps={ios:[['share','ios.1'],['add','ios.2'],[null,'ios.3']],iosOther:[['share','iosOther.1'],['add','iosOther.2'],[null,'iosOther.3']],android:[['menu','android.1'],['add','android.2']],mac:[[null,'mac.1']],desktop:[[null,'desktop.1']]};
function renderInstallHelp(){$('#installSteps').innerHTML=installSteps[installPlatform()].map(([icon,key])=>`<li>${icon?`<span class="install-step-icon" aria-hidden="true">${installIcons[icon]}</span>`:''}<span>${UB('installHelp.'+key)}</span></li>`).join('');}
$('#install').hidden=isStandalone();
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
addEventListener('appinstalled',()=>{installPrompt=null;$('#install').hidden=true;});
$('#install').addEventListener('click',async()=>{if(installPrompt){const prompt=installPrompt;installPrompt=null;prompt.prompt();const {outcome}=await prompt.userChoice;if(outcome==='accepted')$('#install').hidden=true;return;}renderInstallHelp();const dialog=$('#installDialog');if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');});
$('#installDialog').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
onLangChange(()=>{if($('#installDialog').open)renderInstallHelp();});
// Language switch: radios with arrow-key navigation; the re-render below runs synchronously inside setLang via onLangChange.
document.querySelectorAll('.lang-switch [data-lang]').forEach(btn=>{const pick=b=>{if(b.dataset.lang!==getLang())preserveScroll(()=>setLang(b.dataset.lang));};btn.addEventListener('click',()=>pick(btn));btn.addEventListener('keydown',e=>{const step={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];if(!step)return;e.preventDefault();const all=[...document.querySelectorAll('.lang-switch [data-lang]')],next=all[(all.indexOf(btn)+step+all.length)%all.length];next.focus();pick(next);});});
onLangChange(()=>{if(!trip)return;const open=new Set([...document.querySelectorAll('.day-toggle[aria-expanded="true"]')].map(b=>Number(b.dataset.day))),drawerState=$('#mapDrawer').dataset.state,popupId=mapMarkers.find(x=>x.marker.isPopupOpen&&x.marker.isPopupOpen())?.point.id;render(open);setDrawer(drawerState);setConn(connKey);setMapStatus(mapStatusKey);cashText();renderMapPoints();if(popupId)mapMarkers.find(x=>x.point.id===popupId)?.marker.openPopup();window.weatherRerender?.();});
// Hairline under the view bar only while it is stuck beneath the tab bar.
{const bar=$('.view-bar'),tabs=$('.tabs');if(bar&&tabs){const update=()=>bar.classList.toggle('stuck',scrollY>0&&bar.getBoundingClientRect().top<=tabs.getBoundingClientRect().bottom+.5);addEventListener('scroll',update,{passive:true});update();}}
