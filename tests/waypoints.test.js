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
assert.ok(['Kolašin · town center', 'Biogradsko Lake · lake-loop trailhead'].every(name => day3.stops.some(([stop]) => stop === name)), 'Oct 3 must retain Kolašin and Biogradska Gora');
assert.ok(!day3.stops.some(([stop]) => /bridge|zipline/i.test(stop)), 'Tara viewing and zipline are conditional only');
assert.ok(day3.morning.some(item => /bridge|viewing/i.test(item.text)), 'Tara bridge access must remain conditional');
assert.ok(day3.morning.some(item => /zipline/i.test(item.text)), 'Tara zipline must remain conditional');
assert.match(day3.drive, /≤6 h|6 h/);
assert.ok(day3.food.meals.every(meal => meal.durationMinutes >= 60 && meal.cash), 'route meals must budget realistic windows and cash contingencies');

const categories = new Set();
for (const point of waypoints) {
  assert.ok(Number.isFinite(point.lat) && point.lat >= 41.5 && point.lat <= 43.7, point.name);
  assert.ok(Number.isFinite(point.lng) && point.lng >= 18.3 && point.lng <= 20.5, point.name);
  assert.ok(point.googleUrl.startsWith('https://www.google.com/maps/dir/'), point.name);
  for (const field of ['name', 'category', 'cash', 'googleUrl']) assert.ok(point[field], `${point.name}: missing ${field}`);
  for (const field of ['tip', 'address', 'phone']) assert.ok(!(field in point), `${point.name}: duplicated prose field ${field}`);
  categories.add(point.category);
}
for (const category of ['Viewpoint', 'Meal', 'Coffee', 'Supermarket', 'Parking']) assert.ok(categories.has(category), `missing category ${category}`);
const app = fs.readFileSync('app.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(app.includes('waypoints.json?rev=2026-09-28c'));
assert.ok(!app.includes('routeToggle'), 'separate fallback route control should be removed');
assert.ok(app.includes('data-plan-target'), 'map popup should link to a timeline target');
assert.ok(html.includes('id="stayDirectory"'), 'confirmed stay quick reference should render');
assert.ok(sw.includes('./waypoints.json?rev=2026-09-28c'));
assert.ok(sw.includes('tile.openstreetmap.org') && sw.includes('leaflet@1.9.4'));
assert.ok(css.includes('@media (orientation:landscape)') && css.includes('flex-direction:row-reverse'));
assert.ok(css.includes('@media (orientation:landscape) and (max-height:500px)'));
assert.ok(css.includes('body[data-map-state="half"]{padding-right:calc(min(440px,42vw)'));
assert.ok(css.includes('-webkit-overflow-scrolling:touch'));
assert.ok(app.includes('dragStart.side?dragStart.x-e.clientX:dragStart.y-e.clientY'));
assert.ok(app.includes('document.body.dataset.mapState=state'));
assert.ok(html.includes('viewport-fit=cover'));
assert.ok(css.includes('.day-toggle{grid-template-columns:49px minmax(0,1fr) minmax(0,38%) 26px}'));
assert.ok(css.includes('.day-drive{overflow-wrap:anywhere}'));
assert.ok(css.includes('body{margin:0;background:var(--paper)') && css.includes('main{max-width:1200px'));
assert.ok(css.includes('body{padding-left:env(safe-area-inset-left,0px);padding-right:calc(72px + env(safe-area-inset-right,0px))'));
assert.ok(html.includes('style.css?rev=2026-09-28c') && html.includes('app.js?rev=2026-09-28c') && html.includes('weather.js?rev=2026-09-28c'));
assert.ok(html.includes('data-pane="weather"') && html.includes('id="pane-weather"'));
assert.ok(html.includes('11 route hubs'), 'weather directory count must match the expanded route hubs');
assert.ok(sw.includes("const VERSION='34'") && sw.includes('./weather.js?rev=2026-09-28c'));
const weather = fs.readFileSync('weather.js', 'utf8');
assert.ok(weather.includes('https://api.open-meteo.com/v1/forecast'));
assert.ok(weather.includes('low<=2') && weather.includes('chance>60'));
assert.ok(weather.includes("'2026-10-01'") && weather.includes("'2026-10-06'"));
assert.ok(itinerary.stays[0].confirmation.includes('5203973379') && itinerary.stays[1].confirmation.includes('5198999691'));
assert.equal(itinerary.budget.find(item => item.currency === 'ILS').amount, 2616.81);
assert.equal(itinerary.routes.primary.days.find(day => day.day === 6).morning.find(item => item.id === 'day-6-morning-04').text.includes('13:00'), true);
assert.ok(weather.includes('localStorage.setItem(cacheKey') && weather.includes('Offline Mode - Showing Cached Forecast'));
assert.ok(weather.includes("'forecast_days':'16'") || weather.includes("forecast_days:'16'"));
console.log(`PASS: ${count} itinerary stop and food references, ${waypoints.length} waypoint records, offline assets, navigation, weather thresholds, and portrait/landscape drawer behavior`);
