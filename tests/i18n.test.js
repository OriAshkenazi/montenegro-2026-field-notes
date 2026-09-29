'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extractUnits } = require('../scripts/i18n-extract.js');

const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const en = read('locales/en.json'), he = read('locales/he.json');
const itinerary = read('itinerary.json'), waypoints = read('waypoints.json').waypoints;

// UI dictionaries must carry the same keys in both languages.
const enKeys = Object.keys(en.ui).sort(), heKeys = Object.keys(he.ui).sort();
assert.deepEqual(heKeys.filter(k => !en.ui[k]), [], 'he.ui has keys missing from en.ui');
assert.deepEqual(enKeys.filter(k => !he.ui[k]), [], 'en.ui keys missing a Hebrew translation');
for (const [key, value] of Object.entries({ 'tt.when': 'מתי', 'tt.what': 'מה', 'tt.details': 'פירוט', 'tt.notes': 'דגשים והערות' })) assert.equal(he.ui[key], value, `he.ui.${key}`);
// Hebrew may drop a placeholder (e.g. singular "לילה אחד") but must never invent one.
for (const [key, value] of Object.entries(en.ui)) for (const v of he.ui[key].match(/\{\w+\}/g) || []) assert.ok(value.includes(v), `ui.${key}: unknown placeholder ${v}`);

// Every itinerary sentence has a Hebrew entry, and the dictionary holds nothing stale.
const units = extractUnits(itinerary), unitSet = new Set(units);
const missing = units.filter(u => typeof he.content[u] !== 'string' || !he.content[u].trim());
assert.deepEqual(missing, [], `${missing.length} itinerary sentences lack Hebrew`);
const orphans = Object.keys(he.content).filter(k => !unitSet.has(k));
assert.deepEqual(orphans, [], `${orphans.length} stale Hebrew entries no longer in itinerary.json`);

// Facts and map links survive translation: codes, times, amounts, phones and waypoint names stay verbatim.
const FACT = /[A-Z]{1,4}-?\d[\w]*|\d{1,2}:\d{2}|[€₪]\s?\d[\d.,]*\d?|\+\d[\d ]{6,}\d/g;
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const linkRe = (name, prefix) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${prefix ? '[והבכלמש]{0,2}' : ''}${escape(name)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
// Mirrors app.js linkedLocations: a Hebrew sentence must still link each waypoint the English one links.
const places = waypoints.map(p => ({ id: p.id, en: [p.name, ...(p.aliases || [])].filter(n => n.length > 3).map(n => linkRe(n, false)), he: [p.name, ...(p.aliases || []), ...((he.aliases || {})[p.id] || [])].filter(n => n.length > 3).map(n => linkRe(n, true)) }));
for (const id of Object.keys(he.aliases || {})) assert.ok(places.some(p => p.id === id), `he.aliases references unknown waypoint ${id}`);
const drift = [];
for (const unit of units) {
  const hebrew = he.content[unit];
  for (const fact of unit.match(FACT) || []) if (!hebrew.includes(fact.trim())) drift.push(`${fact} :: ${unit}`);
  for (const place of places) if (place.en.some(re => re.test(unit)) && !place.he.some(re => re.test(hebrew))) drift.push(`${place.id} :: ${unit}`);
}
assert.deepEqual(drift, [], `${drift.length} facts or place names were altered in translation`);
process.stdout.write(`i18n tests passed: ${enKeys.length} UI keys, ${units.length} content sentences, facts and place names preserved.\n`);
