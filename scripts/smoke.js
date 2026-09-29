'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const expected = ['index.html', 'style.css', 'app.js', 'timetable.js', 'weather.js', 'sw.js', 'itinerary.json', 'waypoints.json', 'manifest.webmanifest', 'icon.svg'];
for (const file of expected) assert.ok(fs.statSync(path.join(dist, file)).isFile(), `dist missing ${file}`);

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
const app = fs.readFileSync(path.join(dist, 'app.js'), 'utf8');
const revisionMatches = [...html.matchAll(/(?:src|href)="([^"]+\?rev=([^"]+))"/g)];
assert.ok(revisionMatches.length >= 3, 'expected revisioned local CSS and JS references');
const revision = revisionMatches[0][2];
for (const [, url, foundRevision] of revisionMatches) {
  assert.equal(foundRevision, revision, `asset revision mismatch in ${url}`);
  assert.ok(fs.existsSync(path.join(dist, url.split('?')[0])), `HTML asset missing: ${url}`);
}
const cacheVersion = String(parseInt(revision.slice(0, 8), 16));
assert.ok(sw.includes(`mne-field-notes-v${cacheVersion}`), 'service worker cache name must derive from the asset revision');
assert.ok(sw.includes(`'${cacheVersion}'`) || sw.includes(`"${cacheVersion}"`), 'service worker cache version must derive from the asset revision');
for (const asset of ['style.css', 'app.js', 'timetable.js', 'weather.js', 'itinerary.json', 'waypoints.json']) {
  assert.ok(sw.includes(`./${asset}?rev=${revision}`), `service worker shell revision mismatch: ${asset}`);
}
for (const pathRef of ['./itinerary.json?rev=', './waypoints.json?rev=']) assert.ok(app.includes(pathRef), `app must retain relative data URL ${pathRef}`);
for (const file of expected) {
  const size = fs.statSync(path.join(dist, file)).size;
  assert.ok(size > 0, `empty production asset ${file}`);
}
assert.ok(!fs.existsSync(path.join(dist, 'tests')), 'test sources must not ship in dist');
assert.ok(!fs.existsSync(path.join(dist, 'scripts')), 'build tooling must not ship in dist');
process.stdout.write(`Production smoke check passed: ${expected.length} assets, relative PWA paths, revision ${revision}, cache version synchronized.\n`);
