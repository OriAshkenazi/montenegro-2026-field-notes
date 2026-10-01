'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const terser = require('terser');
const { buildExports } = require('./llm-export');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const fontsDir = path.join(root, 'fonts');
// Fonts are optional at build time so the pipeline still runs before they are added.
const fontFiles = fs.existsSync(fontsDir) ? fs.readdirSync(fontsDir).filter(file => fs.statSync(path.join(fontsDir, file)).isFile()).sort().map(file => `fonts/${file}`) : [];
const vendorFiles = ['vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/LICENSE'];
const sourceFiles = ['index.html', 'boot.js', 'app.js', 'timetable.js', 'i18n.js', 'weather.js', 'phrasebook.js', 'sw.js', 'style.css', 'itinerary.json', 'waypoints.json', 'locales/en.json', 'locales/he.json', 'manifest.webmanifest', 'icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.jpg', ...vendorFiles, ...fontFiles];
const textExtensions = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg']);
const revisionHash = crypto.createHash('sha256');
for (const file of sourceFiles) revisionHash.update(file).update('\0').update(fs.readFileSync(path.join(root, file))).update('\0');
const revision = revisionHash.digest('hex').slice(0, 12);
const cacheVersion = String(parseInt(revision.slice(0, 8), 16));

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

async function build() {
  for (const name of sourceFiles) {
    const sourcePath = path.join(root, name);
    fs.mkdirSync(path.dirname(path.join(output, name)), { recursive: true });
    // Vendored libraries ship byte-for-byte so they still match their published integrity hashes.
    if (name.startsWith('vendor/') || !textExtensions.has(path.extname(name))) { fs.copyFileSync(sourcePath, path.join(output, name)); continue; }
    let content = fs.readFileSync(sourcePath, 'utf8');
    if (name === 'sw.js') {
      content = content.replace(/const VERSION\s*=\s*(['"])\d+\1/, `const VERSION='${cacheVersion}'`);
      content = content.replace(/mne-field-notes-v\d+/, `mne-field-notes-v${cacheVersion}`);
    }
    if (name === 'boot.js' || name === 'app.js' || name === 'timetable.js' || name === 'i18n.js' || name === 'weather.js' || name === 'phrasebook.js' || name === 'sw.js') {
      const result = await terser.minify(content, { compress: { defaults: true, reduce_vars: false, collapse_vars: false }, mangle: true, format: { comments: false } });
      if (result.error) throw result.error;
      content = result.code;
    } else if (name === 'style.css') {
      const result = new CleanCSS({ level: 2 }).minify(content);
      if (result.errors.length) throw new Error(result.errors.join('\n'));
      content = result.styles;
    } else if (name === 'index.html') {
      content = await minifyHtml(content, {
        collapseWhitespace: true,
        conservativeCollapse: true,
        removeComments: true,
        removeAttributeQuotes: false,
        minifyCSS: true,
        minifyJS: true,
        keepClosingSlash: true
      });
    }
    content = content.replace(/rev=[^&"']+/g, `rev=${revision}`);
    fs.writeFileSync(path.join(output, name), content);
  }
  // Plain-text copies of the trip for chatbots and other readers that do not run JavaScript.
  const { markdown, html, jsonLd, llmsTxt } = buildExports();
  fs.writeFileSync(path.join(output, 'trip.md'), markdown);
  fs.writeFileSync(path.join(output, 'llms-full.txt'), markdown);
  fs.writeFileSync(path.join(output, 'llms.txt'), llmsTxt);
  // Without this GitHub Pages runs Jekyll, which turns trip.md into HTML instead of serving it.
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  const indexPath = path.join(output, 'index.html');
  const placeholder = '<article id="trip-text" class="trip-text" lang="en" dir="ltr" hidden></article>';
  let index = fs.readFileSync(indexPath, 'utf8');
  if (!index.includes(placeholder)) throw new Error('index.html is missing the #trip-text placeholder');
  const ld = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  index = index.replace(placeholder, () => placeholder.replace('></article>', `>${html}</article>`)).replace('</head>', () => `<script type="application/ld+json">${ld}</script></head>`);
  fs.writeFileSync(indexPath, index);
  process.stdout.write(`Built ${sourceFiles.length} production assets plus trip.md, llms.txt and llms-full.txt in dist/ (revision ${revision}, cache ${cacheVersion}).\n`);
}

build().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
