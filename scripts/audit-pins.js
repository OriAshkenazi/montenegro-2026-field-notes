#!/usr/bin/env node
// Read-only waypoint audit: coordinate clusters, named-town distance, googleUrl destination.
// Usage: node scripts/audit-pins.js [--geocode]   (--geocode needs Nominatim access, 1 req/s)
const { waypoints } = require('../waypoints.json');
const https = require('node:https');

const TOWNS = {
  Kotor: [42.4247, 18.7712], Tivat: [42.4304, 18.696], Perast: [42.486, 18.696], Budva: [42.2842, 18.84],
  'Žabljak': [43.1555, 19.1226], 'Plužine': [43.155, 18.839], 'Nikšić': [42.7731, 18.9445],
  'Kolašin': [42.8232, 19.5169], Virpazar: [42.2476, 19.0912], 'Radanovići': [42.352, 18.765],
  'Lovćen': [42.3994, 18.83], Godinje: [42.225, 19.0952], Cetinje: [42.3931, 18.911]
};
const VENUE_CATEGORIES = new Set(['Meal', 'Coffee', 'Supermarket', 'Parking']);
const TOWN_RADIUS_KM = 6;
const GEOCODE_FLAG_M = 300;

const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const hasMapPin = p => p.mapPin !== false;
const destination = p => decodeURIComponent((p.googleUrl.match(/destination=([^&]+)/) || [])[1] || '');
const isLabelledApproximate = p => /approximate|placeholder/i.test(p.precision || '');

function clusters(list = waypoints) {
  const groups = new Map();
  for (const p of list.filter(hasMapPin)) {
    const key = `${p.lat},${p.lng}`;
    groups.set(key, [...(groups.get(key) || []), p]);
  }
  return [...groups.values()].filter(g => g.length >= 2);
}

// Pins whose name/destination names a town but sit far from it.
function townMismatches(list = waypoints) {
  const out = [];
  for (const p of list.filter(hasMapPin)) {
    const text = `${p.name} ${destination(p)}`;
    for (const [town, centre] of Object.entries(TOWNS)) {
      if (!new RegExp(`(^|[^\\p{L}])${town}([^\\p{L}]|$)`, 'u').test(text)) continue;
      const d = km(centre, [p.lat, p.lng]);
      if (d > TOWN_RADIUS_KM) out.push({ id: p.id, town, km: d });
    }
  }
  return out;
}

module.exports = { TOWNS, VENUE_CATEGORIES, TOWN_RADIUS_KM, km, clusters, townMismatches, hasMapPin, isLabelledApproximate };

async function geocode() {
  const seen = new Map();
  for (const p of waypoints.filter(hasMapPin)) {
    const query = destination(p);
    if (!query || seen.has(query)) continue;
    let hit = null;
    try { hit = await lookup(query); }
    catch (error) { console.log(`  ! ${p.id}: ${error.message}`); }
    if (!hit) {
      const fallback = `${p.name}, Montenegro`;
      if (fallback !== query && !seen.has(fallback)) {
        await new Promise(resolve => setTimeout(resolve, 1100));
        try { hit = await lookup(fallback); }
        catch (error) { console.log(`  ! ${p.id} name search: ${error.message}`); }
      } else hit = seen.get(fallback) || null;
    }
    seen.set(query, hit);
    if (hit) {
      const m = km([p.lat, p.lng], [+hit.lat, +hit.lon]) * 1000;
      console.log(`${m > GEOCODE_FLAG_M ? 'FLAG' : 'ok  '} ${p.id}  ${Math.round(m)} m  osm=${hit.lat},${hit.lon}  (${hit.display_name})`);
    } else console.log(`none ${p.id}  (${query})`);
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  async function lookup(query) {
    if (seen.has(query)) return seen.get(query);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=me&q=${encodeURIComponent(query)}`;
    const hit = (await nominatim(url))[0] || null;
    seen.set(query, hit);
    return hit;
  }
}

function nominatim(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'montenegro-field-notes-audit/1.0' } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`Nominatim HTTP ${response.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

if (require.main === module) {
  console.log(`# ${waypoints.length} waypoints, ${waypoints.filter(hasMapPin).length} on the map\n\n## Clusters (>=2 pins on one coordinate)`);
  for (const g of clusters()) console.log(`${g[0].lat},${g[0].lng}  x${g.length}${g.length >= 3 && g.some(p => VENUE_CATEGORIES.has(p.category)) && !g.every(isLabelledApproximate) ? '  UNLABELLED' : ''}\n   ${g.map(p => `${p.id} → ${destination(p)}`).join('\n   ')}`);
  console.log(`\n## Named-town mismatches (> ${TOWN_RADIUS_KM} km)`);
  const bad = townMismatches();
  console.log(bad.length ? bad.map(b => `${b.id}: ${b.km.toFixed(1)} km from ${b.town}`).join('\n') : 'none');
  if (process.argv.includes('--geocode')) { console.log('\n## Nominatim distance'); geocode(); }
}
