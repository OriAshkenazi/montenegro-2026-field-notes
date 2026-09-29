'use strict';

// The plain-text export must carry every value in the trip data: nothing the app
// shows may be missing when a chatbot reads trip.md instead of running the app.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { buildExports } = require(path.join(root, 'scripts/llm-export.js'));
const itinerary = JSON.parse(fs.readFileSync(path.join(root, 'itinerary.json'), 'utf8'));
const waypointsFile = JSON.parse(fs.readFileSync(path.join(root, 'waypoints.json'), 'utf8'));
const { markdown, html, jsonLd, llmsTxt } = buildExports();
const text = markdown.replace(/\\([|[\]])/g, '$1');
const encodedUrl = url => url.replace(/[()\s]/g, encodeURIComponent);

// Internal cross-reference keys are resolved to names instead of printed; note: true
// is shown by nesting the note under the item it annotates.
// Source placements (days/waypoints/cards) are printed as a readable "used on" note.
const REFERENCE_KEYS = new Set(['note', 'id', 'waypointId', 'mapWaypointId', 'foodId', 'from', 'to', 'via', 'waypoints', 'cards']);
const waypointById = new Map(waypointsFile.waypoints.map(point => [point.id, point]));
const missing = [];
function walk(value, trail, key) {
  if (Array.isArray(value)) return value.forEach((item, i) => walk(item, `${trail}[${i}]`, key));
  if (value && typeof value === 'object') return Object.entries(value).forEach(([k, v]) => walk(v, `${trail}.${k}`, k));
  if (value === null || value === undefined || value === '') return;
  if (REFERENCE_KEYS.has(key)) {
    if (key !== 'id' && typeof value === 'string' && waypointById.has(value) && !text.includes(waypointById.get(value).name)) missing.push(`${trail} → ${waypointById.get(value).name}`);
    return;
  }
  const s = String(value);
  if (!text.includes(s) && !text.includes(encodedUrl(s))) missing.push(`${trail} = ${JSON.stringify(s).slice(0, 120)}`);
}
walk(itinerary, 'itinerary', null);
walk(waypointsFile, 'waypoints', null);
assert.deepEqual(missing, [], `trip.md is missing trip data:\n${missing.join('\n')}`);

// Every timeline segment and every food record is rendered.
for (const day of itinerary.routes.primary.days) {
  assert.ok(text.includes(day.heading), `day ${day.day} heading`);
  for (const period of ['morning', 'afternoon', 'evening']) for (const seg of day[period] || []) assert.ok(text.includes(seg.text), `segment ${seg.id}`);
}
assert.ok(text.includes('13:50–14:30 · LOGISTICS · Land at Tivat'), 'segments carry computed timetable clock times');
assert.ok(text.includes('Travel insurance') && text.includes('46388612426') && text.includes('IMA · Medical Assistance'), 'plain-text export must include the confirmed insurance summary and assistance contacts');
assert.ok(text.includes('USD 47.04 actual') && text.includes('₪144.22 equivalent per policy'), 'insurance premium must stay in USD, separate from the EUR subtotal');
assert.ok(!text.includes('EUR planning range €0–€0'), 'non-EUR actuals must not be represented as EUR budget ranges');

// The HTML copy carries the same content, escaped.
assert.ok(html.includes('<h2>') && html.includes('Runolist Chalet') && !html.includes('<script'), 'embedded HTML');
assert.equal(jsonLd['@type'], 'TouristTrip');
assert.equal(jsonLd.startDate, '2026-10-01');
assert.equal(jsonLd.endDate, '2026-10-06');
assert.equal(jsonLd.itinerary.itemListElement.length, itinerary.routes.primary.days.length);
assert.ok(llmsTxt.startsWith('# ') && llmsTxt.includes('/trip.md)'), 'llms.txt links trip.md');
process.stdout.write(`LLM export tests passed (${markdown.length} chars of Markdown).\n`);
