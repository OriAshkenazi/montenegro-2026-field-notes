'use strict';
// Fills segment.driveMin from OSRM for every segment with a `leg`. Node 16, https only.
// Usage: node scripts/route-times.js | node scripts/route-times.js --print [--day N]
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { projectTimetable } = require('../timetable.js');

const root = path.resolve(__dirname, '..');
const itPath = path.join(root, 'itinerary.json');
const raw = fs.readFileSync(itPath, 'utf8');
const data = JSON.parse(raw);
const wp = JSON.parse(fs.readFileSync(path.join(root, 'waypoints.json'), 'utf8'));
const points = new Map(wp.waypoints.map(p => [p.id, p]));
const args = process.argv.slice(2);
const dayIdx = args.indexOf('--day');
const dayFilter = dayIdx >= 0 ? Number(args[dayIdx + 1]) : null;
const days = data.routes.primary.days.filter(d => dayFilter === null || d.day === dayFilter);
const periods = ['morning', 'afternoon', 'evening'];

function fail(msg) { process.stderr.write(`route-times: ${msg}\n`); process.exit(1); }
function coordsFor(seg, dayNo) {
  const ids = [seg.leg.from, ...(seg.leg.via || []), seg.leg.to];
  return ids.map(id => {
    const p = points.get(id);
    if (!p) fail(`unknown waypoint id "${id}" (day ${dayNo}, segment ${seg.id})`);
    return `${p.lng},${p.lat}`;
  }).join(';');
}
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'montenegro-2026-pwa route-times (personal trip planner)' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 120)}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function print() {
  for (const day of days) {
    process.stdout.write(`Day ${day.day}\n`);
    const { rows, conflicts, totals } = projectTimetable(day);
    for (const r of rows) process.stdout.write(`${r.when} | ${r.kind} | ${r.what}\n`);
    for (const c of conflicts) process.stdout.write(`CONFLICT ${c.id}: fixedAt ${c.fixedAt} vs cursor ${c.cursor}\n`);
    process.stdout.write(`drive total (adjusted): ${totals.driveAdjustedMin} min\n\n`);
  }
}

async function update() {
  const buffer = data.terrainBufferPercent;
  const today = new Date().toISOString().slice(0, 10);
  const cache = new Map();
  const jobs = [];
  for (const day of days) for (const p of periods) for (const seg of day[p] || []) if (seg.leg) jobs.push({ day, seg, coords: coordsFor(seg, day.day) });
  let changed = 0, first = true;
  for (const { day, seg, coords } of jobs) {
    if (!cache.has(coords)) {
      if (!first) await sleep(1100);
      first = false;
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
      let res;
      try { res = await get(url); } catch (e) { fail(`request failed for ${seg.id}: ${e.message}`); }
      if (!res.routes || !res.routes[0]) fail(`no route for ${seg.id} (day ${day.day}): ${res.code}`);
      cache.set(coords, res.routes[0].duration);
    }
    const nominal = Math.round(cache.get(coords) / 60);
    const adjusted = Math.ceil(nominal * (1 + buffer / 100));
    const old = seg.driveMin;
    if (!old || old.nominal !== nominal || old.adjusted !== adjusted || old.source !== 'OSRM') {
      seg.driveMin = { nominal, adjusted, source: 'OSRM', checked: today };
      changed++;
    }
    process.stdout.write(`day ${day.day} ${seg.id}: ${nominal} min nominal, ${adjusted} adjusted\n`);
  }
  if (!changed) { process.stdout.write('No changes.\n'); return; }
  const indent = /^\{\n( +)"/.exec(raw);
  const out = JSON.stringify(data, null, indent ? indent[1].length : 2) + (raw.endsWith('\n') ? '\n' : '');
  fs.writeFileSync(itPath, out);
  process.stdout.write(`Updated ${changed} segment(s).\n`);
}

if (args.includes('--print')) {
  for (const day of days) for (const p of periods) for (const seg of day[p] || []) if (seg.leg) coordsFor(seg, day.day);
  print();
} else {
  update();
}
