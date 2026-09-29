'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const expected = ['index.html', 'boot.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'style.css', 'app.js', 'timetable.js', 'i18n.js', 'weather.js', 'sw.js', 'itinerary.json', 'waypoints.json', 'locales/en.json', 'locales/he.json', 'manifest.webmanifest', 'icon.svg', 'og-image.jpg'];
const fontsSource = path.join(root, 'fonts');
if (fs.existsSync(fontsSource)) for (const file of fs.readdirSync(fontsSource).sort()) expected.push(`fonts/${file}`);
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
for (const asset of ['boot.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'style.css', 'app.js', 'timetable.js', 'i18n.js', 'weather.js', 'itinerary.json', 'waypoints.json', 'locales/en.json', 'locales/he.json']) {
  assert.ok(sw.includes(`./${asset}?rev=${revision}`), `service worker shell revision mismatch: ${asset}`);
}
for (const pathRef of ['./itinerary.json?rev=', './waypoints.json?rev=']) assert.ok(app.includes(pathRef), `app must retain relative data URL ${pathRef}`);
const i18n = fs.readFileSync(path.join(dist, 'i18n.js'), 'utf8');
for (const locale of ['en', 'he']) assert.ok(i18n.includes(`./locales/${locale}.json?rev=${revision}`), `i18n.js must fetch ./locales/${locale}.json with the current revision`);
for (const font of expected.filter(file => file.endsWith('.woff2'))) assert.ok(sw.includes(`./${font}`), `service worker shell missing font ${font}`);
assert.ok(html.includes(`i18n.js?rev=${revision}`), 'index.html must load i18n.js');
assert.ok(html.includes('og-image.jpg') && html.includes('twitter:card'), 'link-preview image tags must ship');
for (const file of expected) {
  const size = fs.statSync(path.join(dist, file)).size;
  assert.ok(size > 0, `empty production asset ${file}`);
}
const sha = file => require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('base64');
assert.equal(sha('vendor/leaflet/leaflet.js'), '20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=', 'vendored leaflet.js must match the published Leaflet 1.9.4 hash');
assert.equal(sha('vendor/leaflet/leaflet.css'), 'p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=', 'vendored leaflet.css must match the published Leaflet 1.9.4 hash');
assert.ok(!/https?:\/\/unpkg\.com/.test(html + sw), 'no third-party script CDN may be referenced');
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
assert.ok(/script-src 'self'(;|$)/.test(csp) && csp.includes("object-src 'none'"), 'CSP must restrict scripts to same origin');
assert.ok(!/<script>[^<]/.test(html), 'inline scripts are blocked by the CSP');
assert.ok(!fs.existsSync(path.join(dist, 'tests')), 'test sources must not ship in dist');
assert.ok(!fs.existsSync(path.join(dist, 'scripts')), 'build tooling must not ship in dist');
process.stdout.write(`Production smoke check passed: ${expected.length} assets, relative PWA paths, revision ${revision}, cache version synchronized.\n`);
