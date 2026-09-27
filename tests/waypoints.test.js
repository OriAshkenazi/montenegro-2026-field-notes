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
assert.ok(css.includes('.map-drawer[data-state="half"]{width:min(440px'));
assert.ok(app.includes('dragStart.side?dragStart.x-e.clientX:dragStart.y-e.clientY'));
assert.ok(html.includes('style.css?rev=2026-09-27j') && html.includes('app.js?rev=2026-09-27j'));
assert.ok(sw.includes("const VERSION='20'"));
console.log(`PASS: ${count} itinerary stop and food references, ${waypoints.length} waypoint records, offline asset checks, and portrait/landscape drawer behavior`);
