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
Promise.all([fetch('./itinerary.json?rev=2026-10-05e').then(r=>r.json()),fetch('./waypoints.json?rev=2026-10-05e').then(r=>r.json()),i18nReady]).then(([data,points])=>{trip=data;waypointData=points.waypoints;applyStatic();setConn(connKey);setMapStatus(mapStatusKey);cashText();const startDay=tripDayToday();render(new Set([startDay]));if(startDay!==1||new Date().getMonth()===9)jumpToDay(startDay);afterFirstPaint(ensureMap);setDrawer($('#mapDrawer').dataset.state);}).catch(()=>Promise.resolve(i18nReady).then(()=>{try{applyStatic();}catch(e){}$('#days').innerHTML=`<p class="offline-note">${escapeHTML(tf('err.data','Trip data is not cached yet. Open this page online once, then reload offline.'))}</p>`;$('#mapStatus').textContent=tf('map.status.noIndex','Waypoint index unavailable. Reconnect once to save it for offline use.');}));

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
function openWaypoint(id,contextDay){const point=waypointById(id);if(!point)return;if(contextDay&&waypointDays(point).includes(Number(contextDay)))activeMapDay=String(contextDay);else if(activeMapDay!=='all'&&!waypointDays(point).includes(Number(activeMapDay)))activeMapDay='all';activeWaypoint=point.id;const prior=$('#mapDrawer').dataset.state,next=prior==='full'?'full':'half';setDrawer(next);$('#mapDayFilter').value=String(activeMapDay);renderMapPoints();ensureMap().then(()=>{if(map)afterDrawerSettles(prior!==next,()=>{map.invalidateSize({pan:false});const marker=mapMarkers.find(x=>x.point.id===point.id)?.marker;map.once('moveend',()=>marker?.openPopup());map.flyTo([point.lat,point.lng],Math.max(map.getZoom(),13),{duration:.6});});});renderWaypointList();}
// Compiling a regex per place name on every call froze first paint on phones, so the alias matchers are built once per language.
let aliasCache=null;
function aliasMatchers(){const lang=getLang();if(aliasCache&&aliasCache.lang===lang&&aliasCache.data===waypointData)return aliasCache.list;const list=[];for(const p of waypointData)for(const alias of [...(p.aliases||[]),p.name,...placeAliases(p.id)])if(alias.length>3)list.push({text:alias,lower:alias.toLowerCase(),point:p});const lead=lang==='he'?'((?:^|[^\\p{L}\\p{N}])[והבכלמש]{0,2})':'(^|[^\\p{L}\\p{N}])';list.sort((a,b)=>b.text.length-a.text.length);for(const a of list)a.re=new RegExp(`${lead}(${a.text.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')})(?=$|[^\\p{L}\\p{N}])`,'giu');aliasCache={lang,data:waypointData,list};return list;}
function linkedLocations(text,plain){if(!plain&&getLang()==='he')text=text.replace(/→/g,'←');// Hebrew reads right to left, so route arrows point left, as bidi() does elsewhere.
  const lowerText=text.toLowerCase();const matches=[];for(const a of aliasMatchers()){if(!lowerText.includes(a.lower))continue;const re=a.re;re.lastIndex=0;let m;while((m=re.exec(text))){const start=m.index+m[1].length,end=start+m[2].length;if(!matches.some(x=>start<x.end&&end>x.start))matches.push({start,end,id:a.point.id,label:m[2]});}}matches.sort((a,b)=>a.start-b.start);
  const emit=(a,b)=>{let o='',p=a;for(const m of matches)if(m.start>=a&&m.end<=b){o+=escapeHTML(text.slice(p,m.start))+`<button class="location-link" type="button" data-waypoint="${m.id}">${escapeHTML(m.label)}</button>`;p=m.end;}return o+escapeHTML(text.slice(p,b));};
  // Hebrew: Latin/digit runs (and any location button inside them) are isolated left-to-right.
  const runs=(!plain&&getLang()==='he')?bidiRuns(text).map(r=>r.slice()):[];const heb=m=>/[\u0590-\u05FF]/.test(m.label);for(let i=runs.length-1;i>=0;i--)if(matches.some(m=>heb(m)&&m.start<=runs[i][0]&&m.end>=runs[i][1]))runs.splice(i,1);for(const r of runs)for(const m of matches)if(!heb(m)&&m.start<r[1]&&m.end>r[0]){r[0]=Math.min(r[0],m.start);r[1]=Math.max(r[1],m.end);}runs.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of runs){const l=merged[merged.length-1];if(l&&r[0]<l[1])l[1]=Math.max(l[1],r[1]);else merged.push(r);}
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
    ? `<p>${C(item.specialty)}</p><small><b>${U('food.hours')}</b> ${C(item.hours)} · <b>${U('food.parking')}</b> ${C(item.parking)}</small><small><b>${U('food.payment')}</b> ${C(item.cash)}${item.durationMinutes!==undefined?` · <b>${U('food.allow')}</b> ${UB('food.min',{n:item.durationMinutes})}`:''}</small>${item.plan ? `<small class="food-plan">${C(item.plan)}</small>` : ''}`
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
// Trip is Oct 1-6; outside those dates (local time) fall back to day 1.
function tripDayToday(){const n=new Date(),d=n.getDate();return n.getMonth()===9&&d>=1&&d<=6&&activeRoute().days.some(x=>x.day===d)?d:1;}
function jumpToDay(day){const card=document.getElementById('day-'+day);if(!card)return;requestAnimationFrame(()=>setTimeout(()=>card.scrollIntoView({block:'start'}),60));}
let openDays=new Set([1]);// day numbers expanded by the next renderDays()
function renderDays() {
  const days=activeRoute().days;
  setRouteViewUI();
  $('#days').innerHTML=days.map(d=>`<article class="day-card" id="day-${d.day}"><div class="day-meta"><span>${C(d.date)}</span><span class="day-drive">${UB('day.driveHours',{h:d.adjustedHours})}</span></div><button class="day-toggle" data-day="${d.day}" aria-expanded="${openDays.has(d.day)}" aria-controls="day-content-${d.day}"><span class="day-no">${String(d.day).padStart(2,'0')}</span><span class="day-title"><strong>${C(d.heading)}</strong></span><span class="chevron" aria-hidden="true">⌄</span></button><div class="day-content" id="day-content-${d.day}" ${openDays.has(d.day)?'':'hidden'}><div class="day-body">${renderDayBody(d)}</div></div></article>`).join('');
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
// Each source carries its placement ({days, waypoints, cards}); links render where the fact is used, one per URL.
function sourceLinks(match){const seen=new Set(),items=(trip?.sources||[]).filter(([,url,at])=>at&&match(at)&&!seen.has(url)&&seen.add(url));return items.length?`<p class="source-links"><b>${U('src.label')}</b>${items.map(([name,url])=>`<a href="${safeHref(url)}" target="_blank" rel="noopener noreferrer">${C(name)} ${U('glyph.out')}</a>`).join('')}</p>`:'';}
const daySources=d=>sourceLinks(at=>at.days?.includes(d.day));
function renderDayRoute(d){return `<p class="day-route"><b>${U('day.route')}</b><span>${linkedLocations(tc(d.drive))}</span></p>`;}
// Optional places recommended in the Facebook travelers' group; kept out of the timetable.
function renderCommunityPicks(d){const picks=d.communityPicks||[];if(!picks.length)return '';return `<section class="day-options day-picks"><h3>${U('picks.title')}</h3><p class="stat-note">${U('picks.note')}</p><ul>${picks.map(p=>`<li id="${escapeHTML(p.id)}"><a href="${safeHref(p.mapUrl)}" target="_blank" rel="noopener noreferrer">${H(p.name)} ${U('glyph.out')}</a><small>${C(p.note)}</small></li>`).join('')}</ul></section>`;}
function renderDayBody(d){if(routeView==='table')return `${renderDayRoute(d)}${renderTimetable(d)}${renderCommunityPicks(d)}${renderRouteOptions(d)}${daySources(d)}`;return `${renderDayRoute(d)}<div class="blocks"><section><span>${U('period.morning')}</span>${renderSegments(d.morning)}</section><section><span>${U('period.afternoon')}</span>${renderSegments(d.afternoon)}</section><section><span>${U('period.evening')}</span>${renderSegments(d.evening)}</section></div>${renderFoodTimeline(d.food)}${renderCommunityPicks(d)}<div class="day-footer"><span><b>${U('day.parkLuggage')}</b>${C(d.parking)}</span><span><b>${U('day.cashTickets')}</b>${C(d.cash)}</span></div>${renderStopLinks(d)}${renderRouteOptions(d)}${daySources(d)}<div class="tag-row">${d.tags.map(tag=>`<span>${C(tag)}</span>`).join('')}</div>`;}
function setRouteViewUI(){document.body.dataset.routeView=routeView;document.querySelectorAll('.view-toggle [data-view]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.view===routeView)));}
setRouteViewUI();
// Keeps the first visible day card at the same viewport offset across a re-render (view toggle, language switch).
function preserveScroll(fn){const bar=document.querySelector('.view-bar'),h=bar?bar.getBoundingClientRect().bottom:0,anchor=[...document.querySelectorAll('.day-card')].find(c=>c.getBoundingClientRect().bottom>h),anchorId=anchor?anchor.id:'',savedTop=anchor?anchor.getBoundingClientRect().top:0;fn();if(!anchorId)return;const correct=()=>{const next=document.getElementById(anchorId);if(!next)return;const root=document.documentElement;root.style.scrollBehavior='auto';window.scrollBy({top:next.getBoundingClientRect().top-savedTop,behavior:'instant'});root.style.scrollBehavior='';};correct();requestAnimationFrame(correct);document.fonts?.ready.then(()=>requestAnimationFrame(correct));}
document.querySelectorAll('.view-toggle [data-view]').forEach(btn=>btn.addEventListener('click',()=>{const v=btn.dataset.view;if(v===routeView||!trip)return;preserveScroll(()=>{routeView=v;try{localStorage.setItem('mne-route-view-v2',v);}catch(e){}setRouteViewUI();const days=activeRoute().days;document.querySelectorAll('.day-card').forEach(c=>{const d=days.find(x=>'day-'+x.day===c.id),body=c.querySelector('.day-body');if(d&&body)body.innerHTML=renderDayBody(d);});linkStaticLocations();});}));
function renderTripOps() {
  const route=activeRoute();
  $('#nightBreakdown').innerHTML=route.nightBreakdown.map(n=>`<li><b>${H(n.base)} · ${UB(n.nights===1?'night.one':'night.other',{n:n.nights})}</b><span>${C(n.dates)}</span></li>`).join('');
  $('#stayDirectory').innerHTML=trip.stays.map(stay=>{const point=waypointById(stay.mapWaypointId);return `<article class="stay-reference"><span class="stay-badge">${U('stay.badge')}</span><h3>${H(stay.name)}</h3><small>${C(stay.dates)}</small><p>${H(stay.address)}</p><small>${C(stay.room)} · ${C(stay.checkIn)} · ${C(stay.checkout)}</small><small>${C(stay.confirmation)}</small><div class="stay-actions">${stay.phone?`<a href="${safeHref('tel:'+stay.phone.replaceAll(' ',''),['tel:'])}" dir="ltr">${escapeHTML(stay.phone)}</a>`:''}${point?`<button type="button" class="food-map-link" data-waypoint="${point.id}">${U('food.pin')}</button>`:''}</div>${sourceLinks(at=>at.waypoints?.includes(stay.mapWaypointId))}</article>`;}).join('');
}
function renderCardSources(){
  $('#emergencySources').innerHTML=sourceLinks(at=>at.cards?.includes('emergency'));
  $('#setupSources').innerHTML=sourceLinks(at=>at.cards?.includes('setup'));
  $('#budgetSources').innerHTML=sourceLinks(at=>at.cards?.includes('budget'));
}
// Emergency numbers are grouped by situation and mix the national lines (trip.emergency) with the insurer's assistance lines.
const EMBASSY_BELGRADE='+381 11 364 3500';
function renderHelp(){
  const em=n=>trip.emergency.find(x=>x.number===n),call=(num,href,label)=>`<a href="${safeHref(href,['tel:'])}"><b dir="ltr">${escapeHTML(num)}</b><span>${label}</span></a>`;
  const line=n=>{const x=em(n);return x?call(x.number,x.href,C(x.label)):'';};
  const [medical,rescue]=trip.insurancePolicy.assistanceContacts,insurer=c=>call(c.phone.replace(/^(\+972)(\d)(\d{3})(\d{4})$/,'$1 $2 $3 $4'),`tel:${c.phone}`,H(c.provider));
  const row=(k,html,extra='')=>`<div class="help-row"><h4>${U(k)}</h4><div class="numbers">${html}</div>${extra}</div>`;
  $('#emergencyNumbers').innerHTML=row('help.emergency',line('112')+line('122')+line('123'))+row('help.medical',line('124')+insurer(medical))+row('help.mountain',line('+382 40 256 084')+insurer(rescue))+row('help.road',line('19807'))+row('help.sea',line('129'))+row('help.consular',call(EMBASSY_BELGRADE,`tel:${EMBASSY_BELGRADE.replaceAll(' ','')}`,U('help.embassy')),`<p class="stat-note">${U('help.embassy.note')}</p>`);
}
function renderInsurance(){
  const policy=trip.insurancePolicy,locale=getLang()==='he'?'he-IL':'en-GB',date=value=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
  $('#insuranceCard').innerHTML=`<p>${UB('insurance.policy',{insurer:policy.insurer,number:policy.policyNumber})}</p><p>${UB('insurance.dates',{from:date(policy.validFrom),to:date(policy.validTo)})} · ${UB('insurance.travelers',{n:policy.travelers})}</p><p>${UB('insurance.coverage',{limit:Number(policy.medicalLimit).toLocaleString('en-US')})}${policy.adventureSportsExtension?` ${U('insurance.adventure')}`:''}</p><ul class="insurance-contacts">${policy.assistanceContacts.map(contact=>`<li><b>${H(contact.provider)}</b><a href="${safeHref(`https://wa.me/${contact.whatsapp.replaceAll('+','')}`)}" dir="ltr">WhatsApp ${escapeHTML(contact.whatsapp)}</a><a href="${safeHref(`mailto:${contact.email}`,['mailto:'])}" dir="ltr">${escapeHTML(contact.email)}</a></li>`).join('')}</ul><small>${U('insurance.terms')}</small>`;
}
// Budget: paid items carry an exact amount in their own currency; trip items carry a EUR planning range. Non-EUR amounts convert through trip.fx (ILS per unit), preferring a recorded ₪ equivalent.
function renderBudget(){
  const fx=trip.fx,round=v=>Math.round(v*100)/100,money=(v,d=2)=>Number(v).toLocaleString(numLocale(),{minimumFractionDigits:d,maximumFractionDigits:d});
  const ils=x=>x.currency==='ILS'?x.amount:x.ils??(x.currency==='USD'?x.amount*fx.USDILS:x.amount*fx.EURILS),eur=x=>!x.currency||x.currency==='EUR'?x.amount:round(ils(x)/fx.EURILS);
  const sum=(list,f)=>round(list.reduce((n,x)=>n+f(x),0)),paid=trip.budget.filter(x=>x.group==='paid'),spend=trip.budget.filter(x=>x.group==='trip');
  const paidEur=sum(paid.filter(x=>x.kind==='paid'),eur),pending=sum(paid.filter(x=>x.kind!=='paid'),eur),allPaid=round(paidEur+pending),tripMin=sum(spend,x=>x.min),tripMax=sum(spend,x=>x.max);
  const euro=(a,b)=>H(b===undefined||a===b?`€${money(a,0)}`:`€${money(a,0)}–${money(b,0)}`),shekel=(a,b)=>H(b===undefined?`₪${money(a,0)}`:`₪${money(a,0)}–${money(b,0)}`);
  const tile=(label,value,...subs)=>`<div class="budget-tile"><span>${label}</span><strong>${value}</strong>${subs.map(sub=>`<small>${sub}</small>`).join('')}</div>`;
  $('#budgetSummary').innerHTML=tile(U('budget.tile.paid'),euro(paidEur),shekel(paidEur*fx.EURILS),UB('budget.tile.paidSub',{v:money(pending)}))+tile(U('budget.tile.trip'),euro(tripMin,tripMax),U('budget.tile.tripSub'))+tile(U('budget.tile.all'),euro(allPaid+tripMin,allPaid+tripMax),shekel((allPaid+tripMin)*fx.EURILS,(allPaid+tripMax)*fx.EURILS));
  $('#budgetFx').innerHTML=UB('budget.fx',{date:new Intl.DateTimeFormat(getLang()==='he'?'he-IL':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${fx.asOf}T12:00:00Z`)),eur:fx.EURILS,usd:fx.USDILS});
  const row=(x,amount)=>`<div class="budget-row" data-kind="${x.kind}"><div><b>${C(x.label)}</b><span class="budget-kind">${U(`budget.kind.${x.kind}`)}</span><small>${C(x.summary)}</small><details><summary>${U('budget.details')}</summary><p>${C(x.note)}</p></details></div><strong>${amount}</strong></div>`;
  const original=x=>x.currency==='ILS'?`₪${money(x.amount)}`:x.currency==='USD'?`$${money(x.amount)}`:`€${money(x.amount)}`;
  $('#budgetPaid').innerHTML=paid.map(x=>row(x,`${H(original(x))}${x.currency&&x.currency!=='EUR'?`<small>${UB('budget.approx',{v:money(eur(x))})}</small>`:''}`)).join('');
  $('#budgetTrip').innerHTML=spend.map(x=>row(x,euro(x.min,x.max))).join('');
  const days=activeRoute().days,dayRange=d=>Object.values(d.costs).reduce(([a,b],[lo,hi])=>[a+lo,b+hi],[0,0]),assigned=trip.budgetDays.reduce(([a,b],d)=>{const[lo,hi]=dayRange(d);return[a+lo,b+hi];},[0,0]);
  $('#budgetDays').innerHTML=`<table class="budget-day-table"><thead><tr><th>${U('budget.days.day')}</th><th>${U('budget.days.spend')}</th><th>${U('budget.days.pay')}</th></tr></thead><tbody>${trip.budgetDays.map(d=>{const day=days.find(x=>Number(x.day)===d.day),[lo,hi]=dayRange(d);return `<tr><th scope="row"><b>${UB('filter.day',{n:d.day,date:tc(day?.date||'')})}</b><small>${C(day?.region||'')}</small></th><td class="budget-amount">${euro(lo,hi)}</td><td><ul>${d.onTheSpot.map(s=>`<li>${C(s)}</li>`).join('')}</ul></td></tr>`;}).join('')}<tr class="budget-day-extra"><th scope="row"><b>${U('budget.days.unassigned')}</b></th><td class="budget-amount">${euro(tripMin-assigned[0],tripMax-assigned[1])}</td><td>${U('budget.days.unassignedNote')}</td></tr></tbody><tfoot><tr><th scope="row">${U('budget.days.total')}</th><td class="budget-amount">${euro(tripMin,tripMax)}</td><td></td></tr></tfoot></table>`;
}
// Phrasebook: data lives in phrasebook.js. Each row reads meaning, then the phonetics in the UI language (the line to say aloud), then the Montenegrin original with the other phonetic spelling muted. Groups are collapsed to keep the page short, and the search box opens whatever matches.
const pbNorm=s=>String(s).toLowerCase().replace(/đ/g,'dj').normalize('NFD').replace(/[̀-ͯ]/g,'');
function renderPhrasebook(){
  const he=getLang()==='he',pick=pair=>he?pair[1]:pair[0],host=$('#phrasebook'),openIds=new Set([...host.querySelectorAll('details[open]')].map(d=>d.dataset.group)),first=!host.children.length;
  $('#pbKey').innerHTML=PHRASEBOOK.pronunciation.map(([k,en,hb])=>`<div><dt lang="sr-Latn-ME">${escapeHTML(k)}</dt><dd>${H(he?hb:en)}</dd></div>`).join('');
  host.innerHTML=PHRASEBOOK.groups.map(g=>{const isOpen=first?g.open:openIds.has(g.id);return `<details class="pb-group${g.compact?' compact':''}" data-group="${g.id}"${isOpen?' open':''}><summary><span>${H(pick(g.title))}</span><small>${UB('pb.count',{n:g.items.length})}</small><span class="chevron" aria-hidden="true">⌄</span></summary><p class="pb-tip">${H(pick(g.tip))}</p><ul class="pb-list">${g.items.map(([me,en,hb,phEn,phHe],i)=>`<li class="pb-item" role="button" tabindex="0" data-g="${g.id}" data-i="${i}" aria-label="${escapeHTML(t('pb.show')+': '+me)}" data-s="${escapeHTML(pbNorm([me,en,hb,phEn,phHe].join(' ')))}"><div class="pb-mean">${H(he?hb:en)}</div><div class="pb-say" ${he?'lang="he" dir="rtl"':'dir="ltr"'}>${escapeHTML(he?phHe:phEn)}</div><div class="pb-orig"><b class="pb-me" lang="sr-Latn-ME" dir="ltr">${escapeHTML(me)}</b><span class="pb-alt" ${he?'dir="ltr"':'lang="he" dir="rtl"'}>${escapeHTML(he?phEn:phHe)}</span></div></li>`).join('')}</ul></details>`;}).join('');
  filterPhrasebook();
}
function filterPhrasebook(){
  const q=pbNorm($('#pbSearch').value.trim());let any=false;
  document.querySelectorAll('#phrasebook .pb-group').forEach(g=>{let n=0;g.querySelectorAll('.pb-item').forEach(li=>{const hit=!q||li.dataset.s.includes(q);li.hidden=!hit;if(hit)n++;});g.hidden=n===0;if(q&&n)g.open=true;if(n)any=true;});
  $('#pbEmpty').hidden=any;
}
$('#pbSearch').addEventListener('input',filterPhrasebook);
// "Show to a local": a full-screen, high-contrast card with the phrase as large as it fits. It starts upright in portrait and re-fits whenever the screen turns.
let showGroup=null,showIndex=0,showWake=null;
const showDialog=$('#showDialog');
function fitShow(){
  if(!showDialog.open)return;
  // Sizes come from the dialog's real laid-out box, not from window dimensions or vh/vw units, which lag behind a phone's rotation.
  const box=$('#showBox'),text=$('#showText');
  let lo=14,hi=Math.max(showDialog.clientWidth,showDialog.clientHeight);
  while(lo<hi-1){const mid=(lo+hi)>>1;text.style.fontSize=mid+'px';if(text.scrollWidth<=box.clientWidth&&text.scrollHeight<=box.clientHeight)lo=mid;else hi=mid;}
  text.style.fontSize=lo+'px';
}
function showPhrase(){const item=showGroup.items[showIndex];$('#showText').textContent=item[0].split(' / ').join('\n');$('#showSub').textContent=item[1];fitShow();}
function openShow(groupId,i){showGroup=PHRASEBOOK.groups.find(g=>g.id===groupId);if(!showGroup)return;showIndex=i;if(!showDialog.open)showDialog.showModal();showPhrase();requestAnimationFrame(fitShow);try{navigator.wakeLock?.request('screen').then(l=>{showWake=l;}).catch(()=>{});}catch(e){}}
function stepShow(d){const n=showGroup.items.length;showIndex=(showIndex+d+n)%n;showPhrase();}
const openShowFrom=e=>{const b=e.target.closest('.pb-item');if(b)openShow(b.dataset.g,Number(b.dataset.i));};
$('#phrasebook').addEventListener('click',openShowFrom);
$('#phrasebook').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openShowFrom(e);}});
$('#showPrev').addEventListener('click',()=>stepShow(-1));$('#showNext').addEventListener('click',()=>stepShow(1));
$('#showClose').addEventListener('click',()=>showDialog.close());
showDialog.addEventListener('close',()=>{showWake?.release?.().catch(()=>{});showWake=null;});
const refitShow=()=>{fitShow();requestAnimationFrame(fitShow);setTimeout(fitShow,250);};
addEventListener('resize',refitShow,{passive:true});addEventListener('orientationchange',refitShow);window.visualViewport?.addEventListener('resize',refitShow);
if('ResizeObserver'in window)new ResizeObserver(fitShow).observe(showDialog);
function render(open) {
  openDays=open||new Set([1]);
  $('#days').setAttribute('aria-label',tc(trip.routeNames.primary));
  renderDays();renderTripOps();renderPhrasebook();renderHelp();renderInsurance();renderBudget();renderCardSources();
  $('#glanceFx').textContent=trip.fx.EURILS.toFixed(2);
  const stayPhones=new Set(trip.stays.map(x=>String(x.phone||'').replaceAll(' ','')));
  $('#contactNumbers').innerHTML=trip.contacts.filter(x=>!stayPhones.has(x.number.replaceAll(' ',''))).map(x=>`<li><div><b>${C(x.label)}</b><small>${C(x.note)}</small></div><a href="${safeHref(x.href,['tel:'])}" dir="ltr">${escapeHTML(x.number)}</a></li>`).join('');
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
// Popups stay inside the visible map: the drawer is short in portrait and narrow in landscape, so they scroll instead.
const popupMaxHeight=()=>map?Math.max(140,map.getSize().y-72):null;
const popupMaxWidth=()=>map?Math.max(180,Math.min(260,map.getSize().x-64)):260;
function syncPopupHeights(){const h=popupMaxHeight(),w=popupMaxWidth();for(const {marker} of mapMarkers){const pop=marker.getPopup();if(pop){pop.options.maxHeight=h;pop.options.maxWidth=w;}}}
function popupHTML(p){const days=waypointDays(p),jumpDay=days.includes(Number(activeMapDay))?Number(activeMapDay):days[0],target=jumpDay?waypointPlanTarget(p,jumpDay):'',payment=String(p.cash||'Ask');return `<article class="map-popup"><h3>${H(p.name)}</h3><span class="popup-category ${p.category.toLowerCase()}">${U('cat.'+p.category,null,p.category)}</span><span class="popup-payment">${U('pay.'+payment,null,payment)}</span><a href="${safeHref(p.googleUrl)}" target="_blank" rel="noopener noreferrer">${U('map.googleMaps')}</a>${target?`<button type="button" data-plan-target="${escapeHTML(target)}">${U('map.jump')}</button>`:''}${sourceLinks(at=>at.waypoints?.includes(p.id))}</article>`;}
// Leaflet (~150 KB) loads only after the itinerary has painted, or at once when someone opens the map.
let mapLoading=null;
const afterFirstPaint=fn=>requestAnimationFrame(()=>setTimeout(()=>window.requestIdleCallback?requestIdleCallback(fn,{timeout:1500}):setTimeout(fn,150),0));
function ensureMap(){if(!mapLoading)mapLoading=new Promise(resolve=>{if(window.L)return resolve();const script=document.createElement('script');script.src='vendor/leaflet/leaflet.js?rev=2026-10-05e';script.onload=script.onerror=()=>resolve();document.head.append(script);}).then(initializeMap);return mapLoading;}
function initializeMap(){if(!window.L){setMapStatus('map.status.lib');renderWaypointList();return;}
  map=L.map('mapCanvas',{zoomControl:true,scrollWheelZoom:false,preferCanvas:true}).setView([42.75,19.0],8);map.on('resize',syncPopupHeights);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors',crossOrigin:true});tiles.addTo(map);
  tiles.on('tileerror',()=>setMapStatus(navigator.onLine?'map.status.tileErrOn':'map.status.tileErrOff'));
  tiles.on('load',()=>setMapStatus(navigator.onLine?'map.status.loadOn':'map.status.loadOff'));
  setTimeout(()=>{if(mapStatusKey==='map.status.initial')setMapStatus('map.status.hint');},4500);
  renderMapPoints();renderWaypointList();
}
function renderMapPoints(){if(!trip||!waypointData.length)return;const day=activeMapDay,route=activeRoute(),points=waypointData.filter(p=>p.mapPin!==false&&(day==='all'||waypointDays(p).includes(Number(day))));
  mapMarkers.forEach(x=>x.marker.remove());mapMarkers=[];
  for(const p of points){if(!map)continue;const color=categoryColor(p.category);const icon=L.divIcon({className:'field-marker-wrap',html:`<span class="field-marker ${p.category.toLowerCase()}" style="--marker-color:${color}"></span>`,iconSize:[18,22],iconAnchor:[9,21.7],popupAnchor:[0,-24]});const marker=L.marker([p.lat,p.lng],{icon,title:p.name,keyboard:true}).bindPopup(popupHTML(p),{maxWidth:popupMaxWidth(),maxHeight:popupMaxHeight()});marker.addTo(map);marker.on('click',()=>{activeWaypoint=p.id;renderWaypointList();});mapMarkers.push({point:p,marker});}
  if(routeLine){routeLine.remove();routeLine=null;}
  if(day!=='all'){const itineraryDay=route.days.find(d=>String(d.day)===day);const path=(itineraryDay?.stops||[]).map(([name])=>waypointByName(name)).filter(p=>p&&p.mapPin!==false);if(path.length>1&&map)routeLine=L.polyline(path.map(p=>[p.lat,p.lng]),{color:cssToken('--pin-route'),weight:3,opacity:.75,dashArray:'7 7'}).addTo(map);}
  $('#mapDayLabel').innerHTML=day==='all'?U('map.allStops'):UB('filter.day',{n:day,date:tc(route.days.find(d=>String(d.day)===day)?.date||'')});
  renderWaypointList();
}
function renderWaypointList(){const day=activeMapDay;const points=waypointData.filter(p=>p.mapPin!==false&&(day==='all'||waypointDays(p).includes(Number(day))));$('#mapWaypoints').innerHTML=points.map(p=>`<button type="button" class="waypoint-row ${activeWaypoint===p.id?'selected':''}" data-waypoint="${p.id}"><i class="waypoint-dot ${p.category.toLowerCase()}"></i><span>${H(p.name)}</span><small>${H(`${t('cat.'+p.category,null,p.category)} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}${p.precision?.includes('approximate')?` · ${t('map.approx')}`:''}`)}</small></button>`).join('');}
function linkStaticLocations(){if(!waypointData.length)return;const root=$('main');const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){if(!node.nodeValue.trim()||node.parentElement.closest('a,button,script,style,select,textarea,.location-link'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const value=node.nodeValue,html=linkedLocations(value,true);if(html===escapeHTML(value))continue;const holder=document.createElement('span');holder.innerHTML=html;node.replaceWith(...holder.childNodes);}}
function syncMapDay(){const f=$('#mapDayFilter');f.value=activeMapDay;renderMapPoints();if(map){const path=activeMapDay==='all'?[]:(activeRoute().days.find(d=>String(d.day)===activeMapDay)?.stops||[]).map(([n])=>waypointByName(n)).filter(Boolean);if(path.length)map.fitBounds(L.latLngBounds(path.map(p=>[p.lat,p.lng])).pad(.18),{animate:true});}}
function setDrawer(state){if(state!=='peek'&&trip)ensureMap();const drawer=$('#mapDrawer'),side=matchMedia('(orientation: landscape)').matches;drawer.dataset.state=state;document.body.dataset.mapState=state;$('#mapHandle').setAttribute('aria-expanded',String(state!=='peek'));$('#mapStateLabel').textContent=t(state==='full'?'map.state.full':state==='half'?'map.state.half':'map.state.peek');$('#mapToggleIcon').textContent=side?((state==='full')!==(hs()<0)?'›':'‹'):(state==='peek'?'⌃':'⌄');}
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
// iOS's swipe-home gesture starts on the peek handle: the OS cancels the pointer (or hides the page) mid-fling, so neither may open the map.
let lastDrawerDrag=null;function cancelDrawerDrag(){if(!dragStart)return;const drawer=$('#mapDrawer');dragStart=null;drawer.style.height='';drawer.style.width='';drawer.classList.remove('dragging');setDrawer(drawer.dataset.state);}
$('#mapHandle').addEventListener('pointerup',e=>{const from=$('#mapDrawer').dataset.state;endDrawerDrag(e);const to=$('#mapDrawer').dataset.state;lastDrawerDrag=to!==from?{from,at:Date.now()}:null;});$('#mapHandle').addEventListener('pointercancel',cancelDrawerDrag);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')return;cancelDrawerDrag();if(lastDrawerDrag&&Date.now()-lastDrawerDrag.at<1000)setDrawer(lastDrawerDrag.from);lastDrawerDrag=null;});
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#mapDrawer').dataset.state!=='peek'){setDrawer('peek');$('#mapHandle').focus();}});$('#mapHandle').addEventListener('click',e=>{if(suppressMapHandleClick){e.preventDefault();e.stopPropagation();suppressMapHandleClick=false;return;}const state=$('#mapDrawer').dataset.state;setDrawer(state==='peek'?'half':state==='half'?'full':'peek');});
addEventListener('online',()=>{if($('#mapStatus'))setMapStatus('map.status.online');});
let orientationResizeTimer;addEventListener('resize',()=>{clearTimeout(orientationResizeTimer);orientationResizeTimer=setTimeout(()=>setDrawer($('#mapDrawer').dataset.state),120);});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>renderMapPoints());
// Each section keeps its own scroll position; a first visit starts at the tab bar rather than mid-page.
const paneScroll={};
function syncTabsUI(){document.querySelectorAll('.tab').forEach(tab=>tab.setAttribute('aria-selected',String(tab.classList.contains('active'))));}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{const current=document.querySelector('.tab.active')?.dataset.pane,next=btn.dataset.pane;if(current===next)return;if(current)paneScroll[current]=scrollY;document.querySelectorAll('.tab,.pane').forEach(el=>el.classList.remove('active'));btn.classList.add('active');$('#pane-'+next).classList.add('active');syncTabsUI();btn.scrollIntoView({block:'nearest',inline:'nearest'});const hero=$('.hero'),tabsStart=hero.offsetTop+hero.offsetHeight,target=paneScroll[next]??Math.min(scrollY,tabsStart);document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:target,behavior:'instant'});document.documentElement.style.scrollBehavior='';}));
syncTabsUI();
// Field Guide jump-bar: buttons scroll to their section; the section under the sticky bars is marked current.
const fgButtons=[...document.querySelectorAll('.fg-nav [data-fg]')];
fgButtons.forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.fg)?.scrollIntoView({block:'start'})));
if('IntersectionObserver'in window){const fgSeen=new Set(),fgObserver=new IntersectionObserver(entries=>{for(const e of entries)e.isIntersecting?fgSeen.add(e.target.id):fgSeen.delete(e.target.id);const current=[...fgButtons].reverse().find(b=>fgSeen.has(b.dataset.fg));if(current)fgButtons.forEach(b=>b.toggleAttribute('aria-current',b===current));},{rootMargin:'-120px 0px -55% 0px'});fgButtons.forEach(b=>{const el=document.getElementById(b.dataset.fg);if(el)fgObserver.observe(el);});}
// Cross-links between tabs (e.g. the Field Guide cash line opens Budget).
document.addEventListener('click',e=>{const go=e.target.closest('[data-goto]');if(go)document.querySelector(`.tab[data-pane="${go.dataset.goto}"]`)?.click();});

// Packing list: defaults are keyed pack.<group>.<n> in the locales so they follow the language switch; once edited,
// the whole list lives in localStorage and edited or added entries keep the text as typed. Ticks are per device too.
const packDefaults=[['big',18],['toiletries',11],['carry',11],['backpack',26]],packKey='mne-packing-v1',packListKey='mne-packing-list-v1';
const packDefaultList=()=>packDefaults.map(([g,c])=>({id:g,items:Array.from({length:c},(_,i)=>({id:`${g}.${i+1}`}))}));
let packed=new Set(),packList=null;try{packed=new Set(JSON.parse(localStorage.getItem(packKey)||'[]'));packList=JSON.parse(localStorage.getItem(packListKey)||'null');}catch(e){}
if(!Array.isArray(packList))packList=packDefaultList();
function savePacked(){try{localStorage.setItem(packKey,JSON.stringify([...packed]));}catch(e){}}
function savePackList(){try{localStorage.setItem(packListKey,JSON.stringify(packList));}catch(e){}}
const packId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6),packGroup=id=>packList.find(g=>g.id===id);
const packItemText=it=>it.text??t('pack.'+it.id),packGroupTitle=g=>g.title??t('pack.'+g.id+'.title'),packAttr=s=>escapeHTML(String(s));
function packingCounts(){const all=packList.flatMap(g=>g.items),done=all.filter(it=>packed.has(it.id)).length;$('#packingProgress').innerHTML=UB('pack.progress',{done,total:all.length});packList.forEach(g=>{const el=document.querySelector(`[data-pack-count="${CSS.escape(g.id)}"]`);if(el)el.textContent=`${g.items.filter(it=>packed.has(it.id)).length}/${g.items.length}`;});}
// Reminders-style: the checkbox ticks, the text is edited in place, clearing it removes the row; the × only shows on the row being edited.
// Textareas grow to fit; they can only be measured while the tab is visible, so refit on open and resize.
const packFit=el=>{if(!el.offsetParent)return;el.style.height='auto';el.style.height=el.scrollHeight+'px';},packFitAll=()=>document.querySelectorAll('#packingGroups textarea').forEach(packFit);
function packRow(g,it){const id=packAttr(it.id),text=packItemText(it);return `<li class="pack-row"><label class="pack-check"><input type="checkbox" data-pack="${id}"${packed.has(it.id)?' checked':''} aria-label="${packAttr(text)}"></label><textarea rows="1" class="pack-text" data-pack-item="${id}" data-pack-group="${packAttr(g.id)}" enterkeyhint="done" aria-label="${U('pack.itemName')}">${packAttr(text)}</textarea><button type="button" class="pack-remove" tabindex="-1" data-pack-remove="${id}" data-pack-group="${packAttr(g.id)}" aria-label="${packAttr(t('pack.remove',{item:text}))}">×</button></li>`;}
function renderPacking(){$('#packingGroups').innerHTML=packList.map(g=>{const gid=packAttr(g.id);return `<article class="field-card packing-card" data-group="${gid}"><header><input type="text" class="pack-title" data-pack-title="${gid}" value="${packAttr(packGroupTitle(g))}" enterkeyhint="done" aria-label="${U('pack.groupName')}"><span class="card-kicker" data-pack-count="${gid}"></span><button type="button" class="pack-remove" tabindex="-1" data-pack-remove-group="${gid}" aria-label="${U('pack.removeGroup')}">×</button></header><ul><li class="pack-add-row"><span aria-hidden="true">+</span><textarea rows="1" class="pack-text" data-pack-add="${gid}" enterkeyhint="enter" placeholder="${U('pack.addItem')}" aria-label="${U('pack.addItem')}"></textarea></li>${g.items.map(it=>packRow(g,it)).join('')}</ul></article>`;}).join('');packFitAll();packingCounts();}
function packRemoveItem(gid,id){const g=packGroup(gid);if(!g)return;g.items=g.items.filter(it=>it.id!==id);packed.delete(id);savePackList();savePacked();document.querySelector(`[data-pack-item="${CSS.escape(id)}"]`)?.closest('li').remove();packingCounts();}
function packAddItem(field){const v=field.value.trim(),g=packGroup(field.dataset.packAdd);if(!v||!g)return;const it={id:packId('u'),text:v};g.items.unshift(it);savePackList();field.closest('li').insertAdjacentHTML('afterend',packRow(g,it));packFit(field.closest('li').nextElementSibling.querySelector('textarea'));field.value='';packFit(field);packingCounts();}
const packGroupsEl=$('#packingGroups');$('.tab[data-pane="packing"]').addEventListener('click',()=>requestAnimationFrame(packFitAll));addEventListener('resize',packFitAll,{passive:true});
packGroupsEl.addEventListener('input',e=>{if(e.target.tagName==='TEXTAREA')packFit(e.target);});
packGroupsEl.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing)return;const el=e.target;if(el.dataset.packAdd!=null){e.preventDefault();packAddItem(el);}else if(el.dataset.packItem||el.dataset.packTitle){e.preventDefault();el.blur();}});
packGroupsEl.addEventListener('focusout',e=>{const el=e.target;if(el.dataset.packAdd)packAddItem(el);});
packGroupsEl.addEventListener('change',e=>{const el=e.target;
  if(el.dataset.pack){if(el.checked)packed.add(el.dataset.pack);else packed.delete(el.dataset.pack);savePacked();packingCounts();return;}
  if(el.dataset.packItem){const it=packGroup(el.dataset.packGroup)?.items.find(x=>x.id===el.dataset.packItem),v=el.value.replace(/\s+/g,' ').trim();if(!it)return;if(!v){packRemoveItem(el.dataset.packGroup,it.id);return;}if(v!==packItemText(it)){it.text=v;savePackList();}el.value=v;packFit(el);const row=el.closest('li');row.querySelector('[data-pack]').setAttribute('aria-label',v);row.querySelector('.pack-remove').setAttribute('aria-label',t('pack.remove',{item:v}));return;}
  if(el.dataset.packTitle){const g=packGroup(el.dataset.packTitle),v=el.value.trim();if(!g)return;if(!v){el.value=packGroupTitle(g);return;}if(v!==packGroupTitle(g)){g.title=v;savePackList();}}});
// pointerdown fires before the field blurs, so the × is still there to be hit.
packGroupsEl.addEventListener('pointerdown',e=>{const rm=e.target.closest('[data-pack-remove]'),rmg=e.target.closest('[data-pack-remove-group]');if(!rm&&!rmg)return;e.preventDefault();
  if(rm){packRemoveItem(rm.dataset.packGroup,rm.dataset.packRemove);return;}
  const g=packGroup(rmg.dataset.packRemoveGroup);if(!g||(g.items.length&&!confirm(t('pack.removeGroupConfirm',{name:packGroupTitle(g)}))))return;packList=packList.filter(x=>x!==g);g.items.forEach(it=>packed.delete(it.id));savePackList();savePacked();renderPacking();});
$('#packingAddGroup').addEventListener('click',()=>{packList.push({id:packId('g'),title:t('pack.newGroup'),items:[]});savePackList();renderPacking();const titles=document.querySelectorAll('.pack-title');titles[titles.length-1]?.select();});
$('#packingRestore').addEventListener('click',()=>{if(!confirm(t('pack.restoreConfirm')))return;packList=packDefaultList();try{localStorage.removeItem(packListKey);}catch(err){}const ids=new Set(packList.flatMap(g=>g.items.map(it=>it.id)));packed=new Set([...packed].filter(id=>ids.has(id)));savePacked();renderPacking();});
$('#packingReset').addEventListener('click',()=>{if(!packed.size||!confirm(t('pack.resetConfirm')))return;packed.clear();savePacked();renderPacking();});
Promise.resolve(i18nReady).then(renderPacking);onLangChange(renderPacking);
const storageKey='montenegro-cash-2026';let carried=Number(localStorage.getItem(storageKey)||0);function cashText(){const b=$('#cashButton');b.innerHTML=carried>0?UB('cash.carried',{n:carried}):UB('cash.mark');$('#cashStatus').innerHTML=carried>0?UB('cash.saved'):UB('cash.note');}$('#cashButton').addEventListener('click',()=>{carried=carried>0?0:225.39;localStorage.setItem(storageKey,String(carried));cashText();});
// A new deploy takes over on the next launch or return to the app (sw.js skips waiting), then reloads once so it shows without reinstalling,
// but only if the traveller has not started tapping since opening or returning; otherwise it shows on the next open.
// update() is called explicitly because iOS WebKit otherwise only rechecks sw.js about once a day.
if('serviceWorker'in navigator){const hadController=!!navigator.serviceWorker.controller;let reloading=false,touched=false;for(const type of ['pointerdown','keydown','wheel'])addEventListener(type,()=>{touched=true;},{passive:true});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')touched=false;});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadController||reloading||touched||document.activeElement?.closest?.('#packingGroups'))return;reloading=true;location.reload();});addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(reg=>{setConn('conn.offlineReady');reg.update().catch(()=>{});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{});});}).catch(()=>setConn('conn.unavailable')));}
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
// Hero art: one landscape per main stop, shuffled on every visit and cross-faded every few seconds. Paused while hidden, hovered or keyboard-focused, and never automatic under reduced motion.
{const art=$('.hero-art'),scenes=[...art.querySelectorAll('.hero-landscape[data-scene]')],ids=scenes.map(s=>s.dataset.scene),dots=[...art.querySelectorAll('.art-dots button')],caption=art.querySelector('.art-caption'),coords=caption.querySelector('bdi'),place=caption.querySelector('span'),still=matchMedia('(prefers-reduced-motion: reduce)'),HOLD=9000;
let current=ids[0],order=[],pos=0,timer=0,swap=0,hovered=false,focused=false;
const shuffle=avoid=>{const a=ids.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}if(a[0]===avoid)[a[0],a[1]]=[a[1],a[0]];return a;};
const next=()=>{if(++pos>=order.length){order=shuffle(current);pos=0;}return order[pos];};
const text=()=>{coords.dataset.i18n=`art.${current}.coords`;place.dataset.i18n=`art.${current}.place`;coords.textContent=t(coords.dataset.i18n);place.innerHTML=linkedLocations(t(place.dataset.i18n));};
const show=(id,{instant=false,user=false}={})=>{current=id;if(!instant)art.classList.remove('instant');scenes.forEach(s=>{const on=s.dataset.scene===id;s.classList.toggle('is-active',on);if(on)s.removeAttribute('aria-hidden');else s.setAttribute('aria-hidden','true');});dots.forEach(d=>d.setAttribute('aria-current',String(d.dataset.scene===id)));caption.setAttribute('aria-live',user?'polite':'off');clearTimeout(swap);if(instant||still.matches){caption.classList.remove('is-swapping');text();return;}caption.classList.add('is-swapping');swap=setTimeout(()=>{text();caption.classList.remove('is-swapping');},250);};
const schedule=()=>{clearTimeout(timer);if(!still.matches&&!hovered&&!focused&&!document.hidden)timer=setTimeout(()=>{show(next());schedule();},HOLD);};
const pick=id=>{if(id!==current)show(id,{user:true});pos=Math.max(0,order.indexOf(id));schedule();};
art.classList.add('rotating','instant');order=shuffle();show(order[0],{instant:true});requestAnimationFrame(()=>requestAnimationFrame(()=>art.classList.remove('instant')));
art.addEventListener('click',e=>{if(!e.target.closest('button,a'))pick(next());});
dots.forEach(d=>d.addEventListener('click',()=>pick(d.dataset.scene)));
art.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){hovered=true;schedule();}});
art.addEventListener('pointerleave',()=>{hovered=false;schedule();});
art.addEventListener('focusin',e=>{focused=e.target.matches(':focus-visible');schedule();});
art.addEventListener('focusout',e=>{focused=art.contains(e.relatedTarget);schedule();});
document.addEventListener('visibilitychange',schedule);still.addEventListener('change',schedule);
onLangChange(text);schedule();}
// Hairline under the view bar only while it is stuck beneath the tab bar.
{const bar=$('.view-bar'),tabs=$('.tabs');if(bar&&tabs){const update=()=>bar.classList.toggle('stuck',scrollY>0&&bar.getBoundingClientRect().top<=tabs.getBoundingClientRect().bottom+.5);addEventListener('scroll',update,{passive:true});update();}}
