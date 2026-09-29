'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const itinerary = JSON.parse(fs.readFileSync(path.join(root, 'itinerary.json'), 'utf8'));
const waypoints = JSON.parse(fs.readFileSync(path.join(root, 'waypoints.json'), 'utf8')).waypoints;
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.deepEqual(Object.keys(itinerary.routes), ['primary']);
const route = itinerary.routes.primary;
assert.ok(route.days.length > 0, 'canonical route must contain timeline days');
const waypointById = new Map(waypoints.map(point => [point.id, point]));
assert.equal(waypointById.size, waypoints.length, 'waypoint IDs must be unique');

const timelineIds = new Set();
let foodCount = 0;
for (const day of route.days) {
  for (const period of ['morning', 'afternoon', 'evening']) {
    for (const segment of day[period] || []) {
      assert.ok(segment.id, `day ${day.day} ${period} segment needs a stable anchor`);
      assert.ok(!timelineIds.has(segment.id), `duplicate timeline anchor ${segment.id}`);
      timelineIds.add(segment.id);
    }
  }
  const foodIds = new Set();
  for (const entries of Object.values(day.food || {})) {
    for (const item of entries) {
      assert.ok(item.id, `day ${day.day} food entry needs a stable ID`);
      assert.ok(!foodIds.has(item.id), `duplicate day ${day.day} food ID ${item.id}`);
      foodIds.add(item.id);
      const point = waypointById.get(item.waypointId);
      assert.ok(point, `${item.name}: unresolved waypointId ${item.waypointId}`);
      assert.ok(point.days.primary.includes(day.day), `${item.name}: waypoint is missing day ${day.day}`);
      foodCount++;
    }
  }
}

for (const point of waypoints) {
  for (const field of ['tip', 'address', 'phone']) {
    assert.ok(!(field in point), `${point.name}: auxiliary prose field ${field} must be removed`);
  }
  assert.ok(['Ask', 'Card', 'Cash/Card'].includes(point.cash), `${point.name}: payment badge is not compact`);
}

for (const experience of itinerary.curatedPool) {
  assert.ok(experience.waypointId && waypointById.has(experience.waypointId), `${experience.itemId}: missing stable waypoint reference`);
  assert.deepEqual(Object.keys(experience).sort(), ['itemId', 'region', 'tag', 'waypointId'], 'curated pool entries must remain lightweight references');
}

assert.ok(!app.includes('function renderFoodPane()'), 'food index pane is removed; food lives in the day timeline');
const foodRenderer = app.slice(app.indexOf('function renderFoodStop('), app.indexOf('function renderFoodTimeline('));

assert.ok(foodRenderer.includes('waypointId'), 'food directory must use stable waypoint references');
assert.ok(foodRenderer.includes('id="${escapeHTML(stopId)}"'), 'timeline food cards must expose the indexed food ID as an anchor');
assert.ok(app.includes('routeTab.click()') && app.includes('content.hidden=false') && app.includes('scrollIntoView'), 'timeline links must activate, expand, and scroll to the target');
assert.ok(app.includes('waypointById(x.waypointId)'), 'experience index must resolve names through waypoint IDs');

const popupStart = app.indexOf('function popupHTML(');
const popupEnd = app.indexOf('function initializeMap(', popupStart);
const popup = app.slice(popupStart, popupEnd);
assert.ok(popup.includes('p.name') && popup.includes('p.category') && popup.includes('p.cash') && popup.includes('p.googleUrl'));
assert.ok(popup.includes('data-plan-target'), 'map popup needs a plan shortcut');
assert.ok(app.includes('waypointPlanTarget(p,jumpDay)'), 'map shortcut must resolve to a waypoint-specific timeline target');
for (const field of ['p.tip', 'p.address', 'p.phone']) assert.ok(!popup.includes(field), `popup must not include ${field}`);

assert.ok(!html.includes('Master schedule') && !html.includes('id="schedule"'), 'duplicate master schedule must be removed');
assert.ok(!html.includes('id="groundTips"') && !html.includes('id="routeWarningText"'), 'duplicate global ground and route warning blocks must be removed');
assert.ok(!html.includes('class="notice"'), 'duplicate route warning banner must be removed');
for (const [, id] of app.matchAll(/\$\('#([\w-]+)'\)\.innerHTML\s*=/g)) assert.ok(html.includes(`id="${id}"`), `#${id}: app.js renders into it, so index.html must keep the element`);
assert.ok(!('primaryNotice' in itinerary) && !('crucialGroundTips' in route) && !('foodNotes' in itinerary), 'duplicated global content must be removed from the data model');

console.log(`PASS: ${route.days.length} timeline days, ${timelineIds.size} segment anchors, ${foodCount} food references, ${waypoints.length} compact waypoints, and auxiliary cross-links`);
