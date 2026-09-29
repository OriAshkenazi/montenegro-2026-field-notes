'use strict';

// Enumerates the translatable English units of itinerary.json. A unit is one sentence
// (as produced by timetable.js splitSentences), so the timetable projection can run on the
// English source and each projected fragment still has a direct translation.
const fs = require('node:fs');
const path = require('node:path');
const { splitSentences } = require('../timetable.js');

const root = path.resolve(__dirname, '..');
const TEXT_KEYS = new Set(['text', 'title', 'date', 'region', 'drive', 'parking', 'cash', 'heading', 'slot', 'specialty', 'hours', 'plan', 'why', 'dates', 'label', 'note', 'status', 'amenities', 'checkIn', 'room', 'checkout', 'price', 'payment', 'cancellation', 'confirmation']);
const SKIP_BRANCHES = new Set(['leg', 'driveMin', 'cashTracker', 'flightPayment']);

function extractUnits(itinerary) {
  const units = new Set();
  const add = value => { for (const s of splitSentences(value)) units.add(s); };
  (function walk(node, key) {
    if (Array.isArray(node)) {
      if (key === 'sources') { for (const [name] of node) add(name); return; }
      if (key === 'tags') { node.forEach(add); return; }
      if (key === 'stops') return;
      node.forEach(item => walk(item, key));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_BRANCHES.has(k)) continue;
      if (typeof v === 'string') {
        if (TEXT_KEYS.has(k) && !(key === 'checks' && k === 'status') && !(key === 'nightBreakdown' && k === 'base')) add(v);
        else if ((key === 'curatedPool' && (k === 'region' || k === 'tag')) || (key === 'checks' && k === 'name') || (k === 'primary' && key === 'routeNames')) add(v);
      } else walk(v, k);
    }
  })(itinerary, '');
  return [...units];
}

module.exports = { extractUnits };

if (require.main === module) {
  const itinerary = JSON.parse(fs.readFileSync(path.join(root, 'itinerary.json'), 'utf8'));
  process.stdout.write(JSON.stringify(extractUnits(itinerary), null, 1) + '\n');
}
