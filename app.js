const $ = (s) => document.querySelector(s);
let trip;
let branch = 'primary';
fetch('./itinerary.json?rev=2026-09-27e').then(r => r.json()).then(data => { trip = data; render(); }).catch(() => { $('#days').innerHTML = '<p class="offline-note">Trip data is not cached yet. Open this page online once, then reload offline.</p>'; });

function activeRoute() { return trip.routes[branch]; }
const segmentTypes = {
  DRIVE: ['↗', 'drive'], STAY: ['⌂', 'stay'], SEE: ['◉', 'see'], WALK: ['↟', 'walk'],
  EAT: ['◒', 'eat'], WATER: ['≋', 'water'], WELLNESS: ['◇', 'wellness'], LOGISTICS: ['▪', 'logistics'], CAUTION: ['!', 'caution']
};
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function renderSegments(segments, compact = false) {
  if (!Array.isArray(segments)) return '';
  return `<div class="segment-list${compact ? ' compact' : ''}">${segments.map(segment => {
    const type = segmentTypes[segment.type] ? segment.type : 'LOGISTICS';
    if (type !== segment.type) console.warn(`Unknown route segment type: ${segment.type}`);
    const [icon, className] = segmentTypes[type];
    return `<div class="route-segment ${className}"><span class="segment-icon" aria-hidden="true">${icon}</span><b class="segment-label">${type}</b><span class="segment-text">${escapeHTML(segment.text || '')}</span></div>`;
  }).join('')}</div>`;
}
function renderSchedule() {
  $('#schedule').innerHTML = activeRoute().days.map(d => `<tr><td><b>${d.day}</b><small>${d.date}</small></td><td>${d.region}<small>Base: ${d.base}</small></td><td>${renderSegments(d.morning, true)}</td><td>${renderSegments(d.afternoon, true)}</td><td>${renderSegments(d.evening, true)}</td><td><b>${d.drive}</b><small>${d.parking} ${d.cash}</small></td></tr>`).join('');
}
function renderChecks() {
  $('#checks').innerHTML = activeRoute().checks.map(g => `<div class="check ${g.status.toLowerCase()}"><span>${g.status==='PASS'?'✓':g.status==='CONDITIONAL'?'~':'!'}</span><div><b>${g.name}</b><small>${g.detail}</small></div><strong>${g.status}</strong></div>`).join('');
  $('#checksTitle').textContent = branch === 'primary' ? 'Guardrail check · coast + mountains' : 'Guardrail check · alpine fallback';
}
function renderDays() {
  const days=activeRoute().days;
  $('#days').innerHTML=days.map(d=>`<article class="day-card"><button class="day-toggle" aria-expanded="${d.day===1}" aria-controls="day-${d.day}"><span class="day-no">${String(d.day).padStart(2,'0')}</span><span class="day-title"><small>${d.date} · ${d.region} · Base ${d.base}</small><strong>${d.heading||`Day ${d.day} - ${d.base==='—'?'Fly home':d.base}`}</strong></span><span class="day-drive">${d.drive}</span><span class="chevron">⌄</span></button><div class="day-content" id="day-${d.day}" ${d.day!==1?'hidden':''}><div class="blocks"><section><span>Morning</span>${renderSegments(d.morning)}</section><section><span>Afternoon</span>${renderSegments(d.afternoon)}</section><section><span>Evening</span>${renderSegments(d.evening)}</section></div><div class="day-footer"><span><b>Park / luggage</b>${d.parking}</span><span><b>Cash / tickets</b>${d.cash}</span></div><div class="stop-links"><b>Maps & parking</b>${d.stops.map(([n,u])=>`<a href="${u}" target="_blank" rel="noreferrer">↗ ${n}</a>`).join('')}</div><div class="tag-row">${d.tags.map(t=>`<span>${t}</span>`).join('')}</div></div></article>`).join('');
  document.querySelectorAll('.day-toggle').forEach(btn=>btn.addEventListener('click',()=>{const content=document.getElementById(btn.getAttribute('aria-controls'));const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));content.hidden=open;}));
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
  renderDays();renderSchedule();renderChecks();renderTripOps();
  $('#budgetRows').innerHTML=trip.budget.map(x=>`<div class="budget-row"><div><b>${x.label}</b><small>${x.note}</small></div><strong>€${x.min}–${x.max}</strong></div>`).join('');
  $('#budgetMin').textContent=trip.budget.reduce((s,x)=>s+x.min,0);$('#budgetMax').textContent=trip.budget.reduce((s,x)=>s+x.max,0);
  $('#sourceList').innerHTML=trip.sources.map(([n,u])=>`<li><a href="${u}" target="_blank" rel="noreferrer">${n} ↗</a></li>`).join('');
  $('#emergencyNumbers').innerHTML=trip.emergency.map(x=>`<a href="${x.href}"><b>${x.number}</b><span>${x.label}</span></a>`).join('');
  $('#curatedRows').innerHTML=trip.curatedPool.map(x=>`<tr><td>${x.itemId}</td><td>${x.region}</td><td>${x.name}<small>${x.note}</small></td><td>${x.tag}</td><td>${x.durationHours}</td><td>${x.cashRequired?'Yes':'No'}</td><td>€${x.estimatedCostEUR}</td><td>${x.daylightSensitive?'Yes':'No'}</td><td>${x.operatingStatusVerified?'Verified listing':'Confirm date'}</td></tr>`).join('');
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab,.pane').forEach(el=>el.classList.remove('active'));btn.classList.add('active');$('#pane-'+btn.dataset.pane).classList.add('active');}));
$('#routeToggle').addEventListener('change',e=>{branch=e.target.checked?'fallback':'primary';if(trip)render();});
const storageKey='montenegro-cash-2026';let carried=Number(localStorage.getItem(storageKey)||0);function cashText(){const b=$('#cashButton');b.textContent=carried>0?`€${carried} marked as carried · undo`:'Mark €150 as carried';$('#cashStatus').textContent=carried>0?'Saved on this device':'Tap to save your cash reminder';}cashText();$('#cashButton').addEventListener('click',()=>{carried=carried>0?0:150;localStorage.setItem(storageKey,String(carried));cashText();});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(()=>$('#connection').textContent='Offline trip data ready').catch(()=>$('#connection').textContent='Offline cache unavailable'));
let installPrompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install').hidden=false;});$('#install').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;});
