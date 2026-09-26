const $ = (s) => document.querySelector(s);
let trip;
fetch('./itinerary.json').then(r => r.json()).then(data => { trip = data; render(); }).catch(() => { $('#days').innerHTML = '<p class="offline-note">Trip data is not cached yet. Open this page online once, then reload offline.</p>'; });

function maps(name) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`; }
function renderSchedule(alpine=false) {
  $('#schedule').innerHTML = trip.days.map(d => {
    const a=trip.alpineBranch.days.find(x=>x.day===d.day);
    const region=alpine&&a?a.region:d.region;
    const base=alpine&&a?a.region.split('·').pop().trim():d.base;
    const morning=alpine&&a?a.morning:d.morning;
    const afternoon=alpine&&a?a.afternoon:d.afternoon;
    const evening=alpine&&a?a.evening:d.evening;
    return `<tr><td><b>${d.day}</b><small>${d.date}</small></td><td>${region}<small>Base: ${base}</small></td><td>${morning}</td><td>${afternoon}</td><td>${evening}</td><td><b>${alpine&&a?'Conditional mountain transfer':d.drive}</b><small>${alpine&&a?'The drive ceiling fails or is uncertain. Check same-day routing and weather.':d.parking+' '+d.cash}</small></td></tr>`;
  }).join('');
}
function renderChecks(alpine=false) {
  const checks=trip.guardrails.map(g=>({...g}));
  if(alpine){checks[0]={...checks[0],status:'FAIL',detail:'Mountain transfer and local driving exceed or cannot be shown to fit the 3.5 h cap with terrain uplift.'};checks[4]={...checks[4],status:'PASS',detail:'North is included, subject to the conditional transfer schedule.'};}
  $('#checks').innerHTML=checks.map(g=>`<div class="check ${g.status.toLowerCase()}"><span>${g.status==='PASS'?'✓':'!'}</span><div><b>${g.name}</b><small>${g.detail}</small></div><strong>${g.status}</strong></div>`).join('');
}
function render() {
  $('#days').innerHTML = trip.days.map(d => `<article class="day-card"><button class="day-toggle" aria-expanded="${d.day === 1}" aria-controls="day-${d.day}"><span class="day-no">${String(d.day).padStart(2,'0')}</span><span class="day-title"><small>${d.date} · ${d.region}</small><strong>${d.base === '—' ? 'Fly home' : d.base}</strong></span><span class="day-drive">${d.drive}</span><span class="chevron">⌄</span></button><div class="day-content" id="day-${d.day}" ${d.day !== 1 ? 'hidden' : ''}><div class="blocks"><section><span>Morning</span><p>${d.morning}</p></section><section><span>Afternoon</span><p>${d.afternoon}</p></section><section><span>Evening</span><p>${d.evening}</p></section></div><div class="day-footer"><span><b>Park & bags</b>${d.parking}</span><span><b>Cash note</b>${d.cash}</span></div><div class="stop-links">${d.stops.map(([n,u])=>`<a href="${u}" target="_blank" rel="noreferrer">↗ ${n}</a>`).join('')}</div><div class="tag-row">${d.tags.map(t=>`<span>${t}</span>`).join('')}</div></div></article>`).join('');
  renderSchedule();
  renderChecks();
  $('#budgetRows').innerHTML = trip.budget.map(x=>`<div class="budget-row"><div><b>${x.label}</b><small>${x.note}</small></div><strong>€${x.min}–${x.max}</strong></div>`).join('');
  $('#budgetMin').textContent=trip.budget.reduce((s,x)=>s+x.min,0); $('#budgetMax').textContent=trip.budget.reduce((s,x)=>s+x.max,0);
  $('#sourceList').innerHTML=trip.sources.map(([n,u])=>`<li><a href="${u}" target="_blank" rel="noreferrer">${n} ↗</a></li>`).join('');
  document.querySelectorAll('.day-toggle').forEach(btn=>btn.addEventListener('click',()=>{const content=document.getElementById(btn.getAttribute('aria-controls')); const open=btn.getAttribute('aria-expanded')==='true'; btn.setAttribute('aria-expanded',String(!open)); content.hidden=open;}));
}
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab,.pane').forEach(el=>el.classList.remove('active'));btn.classList.add('active');$('#pane-'+btn.dataset.pane).classList.add('active');}));
$('#routeToggle').addEventListener('change',e=>{const on=e.target.checked;$('#routeTitle').textContent=on?'Alpine inclusion · conditional option':'Coast + Central · compliant plan';$('#routeWarning').hidden=!on;if(on){$('#days').innerHTML=trip.days.map(d=>`<article class="day-card alpine-card"><div class="day-toggle"><span class="day-no">${String(d.day).padStart(2,'0')}</span><span class="day-title"><small>${d.date} · ${trip.alpineBranch.days.find(x=>x.day===d.day)?.region||d.region}</small><strong>${trip.alpineBranch.days.find(x=>x.day===d.day)?.region?.split('·').pop().trim()||d.base}</strong></span><span class="day-drive">${trip.alpineBranch.days.find(x=>x.day===d.day)?.morning||d.drive}</span></div><div class="day-content"><div class="blocks">${['morning','afternoon','evening'].map(k=>`<section><span>${k}</span><p>${trip.alpineBranch.days.find(x=>x.day===d.day)?.[k]||d[k]}</p></section>`).join('')}</div></div></article>`).join('');renderSchedule(true);renderChecks(true);}else render();});
const key='montenegro-cash';let carried=Number(localStorage.getItem(key)||0);function cashText(){const b=$('#cashButton');b.textContent=carried>=50?'€50 marked as carried · undo':'Mark €50 as carried';$('#cashStatus').textContent=carried>=50?'Saved on this device':'Tap to save your cash reminder';}cashText();$('#cashButton').addEventListener('click',()=>{carried=carried>=50?0:50;localStorage.setItem(key,String(carried));cashText();});
if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(()=>$('#connection').textContent='Offline trip data ready').catch(()=>$('#connection').textContent='Offline cache unavailable'));
let installPrompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install').hidden=false;});$('#install').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install').hidden=true;});
