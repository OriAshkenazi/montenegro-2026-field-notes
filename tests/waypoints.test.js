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
      const point = byName.get(item.name);
      assert.ok(point, `${branch} day ${day.day}: missing venue ${item.name}`);
      assert.ok(point.days[branch].includes(day.day), `${item.name} missing day binding`);
      count++;
    }
  }
}
const categories = new Set();
for (const point of waypoints) {
  assert.ok(Number.isFinite(point.lat) && point.lat >= 41.5 && point.lat <= 43.7, point.name);
  assert.ok(Number.isFinite(point.lng) && point.lng >= 18.3 && point.lng <= 20.5, point.name);
  assert.ok(point.googleUrl.startsWith('https://www.google.com/maps/dir/'), point.name);
  for (const field of ['name', 'category', 'cash', 'tip']) assert.ok(point[field], `${point.name}: missing ${field}`);
  categories.add(point.category);
}
for (const category of ['Viewpoint', 'Meal', 'Coffee', 'Supermarket', 'Parking']) assert.ok(categories.has(category), `missing category ${category}`);
const app = fs.readFileSync('app.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(app.includes('waypoints.json?rev=2026-09-27i'));
assert.ok(sw.includes('./waypoints.json?rev=2026-09-27i'));
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
assert.ok(html.includes('style.css?rev=2026-09-27p') && html.includes('app.js?rev=2026-09-27m') && html.includes('weather.js?rev=2026-09-27a'));
assert.ok(html.includes('data-pane="weather"') && html.includes('id="pane-weather"'));
assert.ok(sw.includes("const VERSION='26'") && sw.includes('./weather.js?rev=2026-09-27a'));
const weather = fs.readFileSync('weather.js', 'utf8');
assert.ok(weather.includes('https://api.open-meteo.com/v1/forecast'));
assert.ok(weather.includes('low<=2') && weather.includes('chance>60'));
assert.ok(weather.includes("'2026-10-01'") && weather.includes("'2026-10-06'"));
assert.ok(weather.includes('localStorage.setItem(cacheKey') && weather.includes('Offline Mode - Showing Cached Forecast'));
assert.ok(weather.includes("'forecast_days':'16'") || weather.includes("forecast_days:'16'"));
console.log(`PASS: ${count} itinerary stop and food references, ${waypoints.length} waypoint records, offline assets, navigation, weather thresholds, and portrait/landscape drawer behavior`);
