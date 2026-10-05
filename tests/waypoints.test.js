const assert = require('node:assert');
const fs = require('node:fs');
const itinerary = require('../itinerary.json');
const { waypoints } = require('../waypoints.json');
const byName = new Map(waypoints.map(point => [point.name, point]));
let count = 0;
for (const [branch, route] of Object.entries(itinerary.routes)) {
  for (const day of route.days) {
    for (const [name] of day.stops) {
      const point = byName.get(name);
      assert.ok(point, `${branch} day ${day.day}: missing stop ${name}`);
      assert.ok(point.days[branch].includes(day.day), `${name} missing day binding`);
      count++;
    }
    for (const venues of Object.values(day.food || {})) for (const item of venues) {
      const point = waypoints.find(candidate => candidate.id === item.waypointId);
      assert.ok(point, `${branch} day ${day.day}: missing venue waypoint ${item.waypointId}`);
      assert.ok(point.days[branch].includes(day.day), `${item.name} missing day binding`);
      count++;
    }
  }
}
assert.deepEqual(Object.keys(itinerary.routes), ['primary']);
assert.equal(itinerary.routes.primary.nightBreakdown.reduce((sum,item)=>sum+item.nights,0),5);
assert.deepEqual(itinerary.stays.map(stay=>stay.name),['Runolist Chalet','Conte Hotel & Restaurant']);
assert.equal(itinerary.stays[0].dates,'Check-in Oct 1 · check-out Oct 4, 2026');
assert.equal(itinerary.stays[1].dates,'Check-in Oct 4 · check-out Oct 6, 2026');
for (const stay of itinerary.stays) assert.ok(byName.has(stay.name), `${stay.name}: missing stay waypoint`);

assert.equal(itinerary.drivingCeilingAdjustedHours, 6);
const northernDays = itinerary.routes.primary.days.filter(day => [2, 3].includes(day.day));
for (const day of northernDays) assert.ok(day.stops.length && day.drive, `day ${day.day}: route plan missing`);
const day2 = northernDays.find(day => day.day === 2);
assert.ok(['Black Lake trailhead', 'P14 Sedlo Pass route', 'Trsa village pullout', 'Piva viewpoint', 'Plužine lakeside'].every(name => day2.stops.some(([stop]) => stop === name)), 'Oct 2 must retain the Black Lake and P14/Piva/Plužine targets');
assert.match(day2.drive, /Nikšić.*Šavnik|Šavnik.*Nikšić/);
assert.match(day2.drive, /≤6 h|6 h/);
const day3 = northernDays.find(day => day.day === 3);
// Kolašin was dropped on the day (2026-10-03, travellers' decision); Biogradska Gora stays.
assert.ok(day3.stops.some(([stop]) => stop === 'Biogradsko Lake · lake-loop trailhead'), 'Oct 3 must retain Biogradska Gora');
// Oct 3 includes the Tara bridge viewpoint by choice (2026-10-02); the bridge itself stays closed to vehicles, so every Tara segment must say not to cross it.
assert.ok(day3.stops.some(([stop]) => /Tara Bridge/.test(stop)), 'Oct 3 visits the Tara bridge viewpoint');
assert.ok(['morning','afternoon','evening'].flatMap(p => day3[p]).filter(s => /Tara bridge/i.test(s.title || '')).every(s => /do not cross|skip it/i.test(s.text)) || day3.morning.some(s => /do not cross it/.test(s.text)), 'Tara segments must keep the do-not-cross guardrail');
assert.ok(day3.morning.some(item => /bridge|viewing/i.test(item.text)), 'Tara bridge access must remain conditional');
assert.ok(day3.morning.some(item => /zipline/i.test(item.text)), 'Tara zipline must remain conditional');
assert.match(day3.drive, /≤6 h|6 h/);
assert.ok(day3.food.meals.every(meal => meal.durationMinutes >= 60 && meal.cash), 'route meals must budget realistic windows and cash contingencies');

const day4 = itinerary.routes.primary.days.find(day => day.day === 4);
const day5 = itinerary.routes.primary.days.find(day => day.day === 5);
// 2026-10-04: the hotel's arrival email puts Conte parking at the Kotor-side entrance; Day 4 legs now use that pin.
assert.ok(day4.stops.some(([name]) => name === 'Kotor') && day4.stops.some(([name]) => name === 'Conte hotel parking · Perast east entrance'), 'Oct 4 must retain Kotor after the Perast luggage gate');
assert.ok(day4.adjustedHours <= itinerary.drivingCeilingAdjustedHours && /17:30/.test(day4.drive), 'Oct 4 must stay under the adjusted drive ceiling and daylight cutoff');
assert.ok(day4.food.meals.length >= 2 && day4.food.coffee.length, 'Oct 4 must include lunch, dinner and coffee');
// 2026-10-03: travellers check in at Conte on arrival (~15:35) and waived the 17:30 cutoff; require bags in the room and a stated Kotor departure.
assert.ok(day4.afternoon.some(item => /luggage|bags/i.test(item.text)) && day4.afternoon.some(item => /Leave for Kotor around \d\d:\d\d/.test(item.text)), 'Oct 4 must secure luggage and state the Kotor departure');
const day5Names = day5.stops.map(([name]) => name);
// 2026-10-04: the travellers replanned Oct 5 on the day (Alpine Coaster → mausoleum → Cetinje → Pavlova Strana → DARKO Boat at Vranjina, back ~18:45) and waived the 17:30 cutoff.
// 2026-10-05: updated as driven: no Cetinje stop (lunch bought at the mausoleum), boat moved to 16:00, back ~19:15.
for (const name of ['Kotor Alpine Coaster · Kuk','Njegoš Mausoleum','Pavlova Strana viewpoint','DARKO Boat · Vranjina']) assert.ok(day5Names.includes(name), `Oct 5 must retain ${name}`);
assert.ok(['Kotor Alpine Coaster · Kuk','Njegoš Mausoleum','Pavlova Strana viewpoint','DARKO Boat · Vranjina'].every((name, i, all) => !i || day5Names.indexOf(all[i - 1]) < day5Names.indexOf(name)), 'Oct 5 stop order must flow coaster → mausoleum → Pavlova Strana → boat');
assert.ok(day5.adjustedHours <= itinerary.drivingCeilingAdjustedHours && /17:30/.test(day5.drive), 'Oct 5 must stay within the six-hour adjusted ceiling and record the waived 17:30 cutoff');
assert.ok(day5.food.meals.length >= 2 && day5.food.coffee.length, 'Oct 5 must include lunch, dinner and coffee');
assert.ok(day5.afternoon.some(item => item.fixedAt === '16:00' && item.waypointId === 'darko-boat-vranjina') && day5.afternoon.some(item => /19:15/.test(item.text)), 'Oct 5 must keep the confirmed boat time and a return target');
for (const id of ['njegos-mausoleum','kotor-cable-car-kuk','njegos-mausoleum-lower-parking','pavlova-strana-viewpoint','darko-boat-vranjina','conte-hotel-parking']) assert.ok(waypoints.some(point => point.id === id && point.days.primary.includes(5)), `${id}: missing Oct 5 map pin`);

// 2026-10-05: a booked stop (segment with a fixed time) must never navigate by a text search or to a guessed point.
// The DARKO Boat pin was swapped for a village point plus a name search instead of the operator's exact link, and the travellers lost time.
for (const day of itinerary.routes.primary.days) for (const period of ['morning','afternoon','evening']) for (const seg of day[period] || []) {
  if (!seg.fixedAt || !seg.waypointId) continue;
  const point = waypoints.find(p => p.id === seg.waypointId);
  assert.ok(point, `${seg.id}: booked stop has no waypoint`);
  const textSearch = /destination=[^&]*[A-Za-z]{3}/.test(point.googleUrl) && !/destination=-?\d+\.\d+,-?\d+\.\d+/.test(point.googleUrl);
  assert.ok(!textSearch, `${seg.id}: booked stop ${point.name} navigates by a name search; use exact coordinates or the user's own link`);
  if (/village|approximate|could not/i.test(point.precision || '')) assert.ok(!point.googleUrl.includes('/maps/dir/'), `${seg.id}: booked stop ${point.name} has a guessed pin; navigation must use the user's exact link`);
}

const categories = new Set();
for (const point of waypoints) {
  assert.ok(Number.isFinite(point.lat) && point.lat >= 41.5 && point.lat <= 43.7, point.name);
  assert.ok(Number.isFinite(point.lng) && point.lng >= 18.3 && point.lng <= 20.5, point.name);
  // 2026-10-05: DARKO Boat keeps the exact Google Maps listing link the operator sent; a text-search directions link led elsewhere.
  assert.ok(point.googleUrl.startsWith('https://www.google.com/maps/dir/') || (point.id === 'darko-boat-vranjina' && point.googleUrl === 'https://maps.app.goo.gl/VeXVS4RyrZDVpiiLA'), point.name);
  for (const field of ['name', 'category', 'cash', 'googleUrl']) assert.ok(point[field], `${point.name}: missing ${field}`);
  for (const field of ['tip', 'address', 'phone']) assert.ok(!(field in point), `${point.name}: duplicated prose field ${field}`);
  categories.add(point.category);
}
for (const category of ['Viewpoint', 'Meal', 'Coffee', 'Supermarket', 'Parking']) assert.ok(categories.has(category), `missing category ${category}`);
const app = fs.readFileSync('app.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(app.includes('waypoints.json?rev=2026-10-05d'));
assert.ok(app.includes('iconSize:[18,22],iconAnchor:[9,21.7],popupAnchor:[0,-24]'), 'pin tip should align with the exact bottom point of the rotated marker');
assert.ok(!app.includes('routeToggle'), 'separate fallback route control should be removed');
// 2026-10-04: the drive line, segment text and timetable showed → in Hebrew; linkedLocations must flip it like bidi().
assert.ok(/function linkedLocations\(text,plain\)\{if\(!plain&&getLang\(\)==='he'\)text=text\.replace\(\/→\/g,'←'\)/.test(app), 'Hebrew route arrows must point left in linked text');
assert.ok(app.includes('data-plan-target'), 'map popup should link to a timeline target');
assert.ok(html.includes('id="stayDirectory"'), 'confirmed stay quick reference should render');
assert.ok(sw.includes('./waypoints.json?rev=2026-10-05d'));
assert.ok(sw.includes('tile.openstreetmap.org') && sw.includes('./vendor/leaflet/leaflet.js?rev=2026-10-05d'));
assert.ok(!sw.includes('unpkg.com') && !html.includes('unpkg.com'), 'Leaflet must be served from the app origin');
assert.ok(sw.includes("const CACHE='mne-field-notes-v74'") && sw.includes("const VERSION='74'") && sw.includes('./weather.js?rev=2026-10-05d'));
assert.ok(html.includes('type="text/markdown"') && html.includes('trip.md'));
assert.ok(!html.includes('data-pane="food"') && !html.includes('id="pane-food"'), 'food index tab should stay removed');
assert.ok(html.includes('id="contactNumbers"') && app.includes("$('#contactNumbers')"), 'contacts card should render');
const contacts=JSON.parse(fs.readFileSync('itinerary.json','utf8')).contacts;
assert.ok(contacts.length>0, 'itinerary should list key contacts');
for(const c of contacts) assert.equal(c.href, 'tel:'+c.number.replaceAll(' ', ''), `${c.label}: tel link should match number`);
const policy=itinerary.insurancePolicy;
assert.equal(policy.policyNumber,'46388612426');
assert.equal(policy.validFrom,'2026-10-01');
assert.equal(policy.validTo,'2026-10-06');
assert.equal(policy.travelers,2);
assert.equal(policy.premiumAmount,47.04);
assert.equal(policy.premiumIlsEquivalent,144.22);
assert.equal(policy.medicalLimit,5000000);
assert.equal(policy.adventureSportsExtension,true);
assert.equal(policy.assistanceContacts.length,2);
assert.ok(!('insuredNames' in policy) && !('identityNumbers' in policy) && !('policyholderContacts' in policy), 'insurance record must exclude policyholder personal data');
assert.ok(html.includes('id="insuranceCard"') && app.includes("$('#insuranceCard').innerHTML"), 'insurance summary should render in Contacts & safety');
assert.ok(html.includes('id="pane-safety"') && JSON.parse(fs.readFileSync('locales/he.json','utf8')).ui['tab.safety']==='מדריך שטח', 'insurance summary should be reachable under the Hebrew Field Guide tab');
// Budget: paid items hold an exact amount in their own currency; trip items hold a EUR planning range split across the days.
const budgetById=Object.fromEntries(itinerary.budget.map(item=>[item.id,item]));
for(const item of itinerary.budget){
  assert.ok(item.id&&item.label&&item.summary&&item.note,`${item.label}: budget item needs id, label, summary and note`);
  assert.ok(['paid','trip'].includes(item.group),`${item.label}: unknown budget group`);
  if(item.group==='paid')assert.ok(item.amount>0&&!('min' in item),`${item.label}: paid items carry an exact amount`);
  else assert.ok(item.min>=0&&item.max>=item.min&&!('amount' in item),`${item.label}: trip items carry a min–max range`);
}
assert.equal(budgetById.insurance.currency,'USD');
assert.equal(budgetById.insurance.amount,policy.premiumAmount);
assert.equal(budgetById.insurance.ils,policy.premiumIlsEquivalent);
assert.equal(budgetById.flights.currency,'ILS');
assert.equal(budgetById.flights.amount,itinerary.flightPayment.amount);
assert.deepEqual([budgetById.rental.amount,budgetById.conte.amount,budgetById.runolist.amount],[362,271.93,itinerary.cashTracker.target]);
assert.equal(budgetById.runolist.kind,'unconfirmed','Runolist balance stays flagged until the host confirms it');
assert.ok(itinerary.fx.EURILS>0&&itinerary.fx.USDILS>0&&/^\d{4}-\d{2}-\d{2}$/.test(itinerary.fx.asOf),'budget conversion rates need values and a date');
assert.deepEqual(itinerary.budgetDays.map(d=>d.day),itinerary.routes.primary.days.map(d=>d.day),'one budget row per itinerary day');
for(const item of itinerary.budget.filter(x=>x.group==='trip')){
  const [lo,hi]=itinerary.budgetDays.reduce(([a,b],d)=>{const [x,y]=d.costs[item.id]||[0,0];return [a+x,b+y];},[0,0]);
  assert.ok(lo<=item.min&&hi<=item.max,`${item.label}: day allocations (€${lo}–${hi}) exceed the category range`);
}
for(const d of itinerary.budgetDays)for(const id of Object.keys(d.costs))assert.equal(budgetById[id]?.group,'trip',`day ${d.day}: unknown budget category ${id}`);
assert.ok(app.includes('function renderBudget()')&&html.includes('id="budgetDays"'),'budget renders summary, groups and day table');
assert.ok(css.includes('@media (orientation:landscape)') && css.includes('flex-direction:row-reverse'));
assert.ok(css.includes('@media (orientation:landscape) and (max-height:500px)'));
assert.ok(css.includes('--side-half:min(440px,42vw)') && css.includes('body[data-map-state="half"]{padding-inline-end:calc(var(--side-half)'));
assert.ok(css.includes('overscroll-behavior:contain'));
assert.ok(app.includes('side?dragStart.x-e.clientX:dragStart.y-e.clientY') && app.includes('drawerSnapSizes'));
assert.ok(app.includes('document.body.dataset.mapState=state'));
assert.ok(html.includes('viewport-fit=cover'));
assert.ok(css.includes('.day-toggle{position:sticky;top:var(--day-sticky-top);z-index:910'));
assert.ok(css.includes('.day-toggle[aria-expanded="false"]{position:relative;top:auto;z-index:auto}'), 'closed day headers should scroll normally and stay out of the sticky stack');
const renderTargets = [...new Set([...app.matchAll(/\$\('#([\w-]+)'\)/g)].map(match => match[1]))];
const missingTargets = renderTargets.filter(id => !html.includes(`id="${id}"`) && !app.includes(`id="${id}"`));
assert.deepEqual(missingTargets, [], 'every #id the app writes to must exist in index.html or be rendered by app.js');
assert.ok(css.includes('--day-sticky-top:calc(var(--tabs-h) + 68px)'));
assert.ok(app.includes('class="day-meta"') && app.includes('class="day-toggle"') && app.includes('aria-controls="day-content-${d.day}"'), 'day metadata should scroll separately while the title and collapse control remain in the sticky button');
assert.ok(app.includes('new ResizeObserver(syncDayStickyOffset)') && app.includes("document.querySelector('.view-bar')"), 'sticky offset should track the actual tabs and view-bar heights');
assert.ok(app.includes('tabs.getBoundingClientRect().height+bar.getBoundingClientRect().height') && !app.includes('bottomMargin'), 'sticky header should meet the view bar without leaving a gap for moving text to show through');
assert.ok(css.includes('.day-title,.day-drive{min-width:0;overflow-wrap:anywhere}'));
assert.ok(css.includes('body{margin:0;background:var(--surface-0)') && css.includes('main{max-width:1200px'));
assert.ok(css.includes('body{padding-inline-start:env(safe-area-inset-left,0px);padding-inline-end:calc(var(--side-peek) + env(safe-area-inset-right,0px))'));
assert.ok(html.includes('style.css?rev=2026-10-05d') && html.includes('app.js?rev=2026-10-05d') && html.includes('weather.js?rev=2026-10-05d'));
assert.ok(html.includes('data-pane="weather"') && html.includes('id="pane-weather"'));
assert.ok(html.includes('13 route hubs'), 'weather directory count must match the expanded route hubs');
const weather = fs.readFileSync('weather.js', 'utf8');
assert.ok(weather.includes('https://api.open-meteo.com/v1/forecast'));
assert.ok(weather.includes('low<=2') && weather.includes('chance>60'));
assert.ok(weather.includes("'2026-10-01'") && weather.includes("'2026-10-06'"));
assert.ok(itinerary.stays[0].confirmation.includes('5203973379') && itinerary.stays[1].confirmation.includes('5198999691'));
assert.equal(itinerary.budget.find(item => item.currency === 'ILS').amount, 2616.81);
assert.equal(itinerary.routes.primary.days.find(day => day.day === 6).morning.find(item => item.id === 'day-6-morning-04').text.includes('13:00'), true);
assert.ok(weather.includes('localStorage.setItem(cacheKey') && JSON.parse(fs.readFileSync('locales/en.json', 'utf8')).ui['w.mode.offline'] === 'Offline Mode - Showing Cached Forecast');
assert.ok(weather.includes("'forecast_days':'16'") || weather.includes("forecast_days:'16'"));
console.log(`PASS: ${count} itinerary stop and food references, ${waypoints.length} waypoint records, offline assets, navigation, weather thresholds, and portrait/landscape drawer behavior`);

// Pin-placement guards (see scripts/audit-pins.js)
{
  const audit = require('../scripts/audit-pins.js');
  for (const group of audit.clusters(waypoints)) {
    const venues = group.filter(point => audit.VENUE_CATEGORIES.has(point.category));
    if (group.length >= 3 && venues.length) assert.ok(group.every(audit.isLabelledApproximate), `${group.length} pins share ${group[0].lat},${group[0].lng} without an "approximate" precision label: ${group.map(point => point.id).join(', ')}`);
  }
  const ROUTE_OR_REFERENCE_PINS = new Set(['tiv-zabljak-direct-route-via-kotor-risan-grahovo-niksic-and-savnik', 'p14-sedlo-pass-route', 'perast-to-tivat-airport', 'p14-sedlo-pass-out-and-back-from-zabljak-to-pluzine-and-piva-viewpoint', 'dobre-vode-kolasin']);
  for (const miss of audit.townMismatches(waypoints)) assert.ok(ROUTE_OR_REFERENCE_PINS.has(miss.id), `${miss.id} is ${miss.km.toFixed(1)} km from ${miss.town} (limit ${audit.TOWN_RADIUS_KM} km)`);
  for (const point of waypoints.filter(point => point.mapPin === false)) assert.ok(point.precision && !/^navigation pin$/.test(point.precision), `${point.id}: hidden pin needs an explanatory precision`);
  for (const id of ['momcilov-grad', 'kafana-kod-pera-na-bukovici']) {
    const point = waypoints.find(candidate => candidate.id === id);
    assert.ok(point && point.mapPin !== false && /OpenStreetMap/.test(point.precision), `${id}: resolved venue must be visible with sourced coordinates`);
  }
  for (const id of ['amscg-road-conditions', 'amscg-road-updates']) {
    const point = waypoints.find(candidate => candidate.id === id);
    assert.ok(point && point.mapPin === false, `${id}: website resource must remain hidden`);
  }
  const konak = waypoints.find(point => point.id === 'ivanov-konak-lovcen');
  assert.ok(audit.km([konak.lat, konak.lng], [42.3784, 18.8311]) < 2, 'Ivanov Konak belongs at Ivanova Korita');
}
