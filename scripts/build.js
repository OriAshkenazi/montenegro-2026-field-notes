'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const terser = require('terser');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const sourceFiles = ['index.html', 'app.js', 'timetable.js', 'weather.js', 'sw.js', 'style.css', 'itinerary.json', 'waypoints.json', 'manifest.webmanifest', 'icon.svg', 'og-image.jpg'];
const binaryFiles = new Set(['og-image.jpg']);
const revisionHash = crypto.createHash('sha256');
for (const file of sourceFiles) revisionHash.update(file).update('\0').update(fs.readFileSync(path.join(root, file))).update('\0');
const revision = revisionHash.digest('hex').slice(0, 12);
const cacheVersion = String(parseInt(revision.slice(0, 8), 16));

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

async function build() {
  for (const name of sourceFiles) {
    const sourcePath = path.join(root, name);
    if (binaryFiles.has(name)) { fs.copyFileSync(sourcePath, path.join(output, name)); continue; }
    let content = fs.readFileSync(sourcePath, 'utf8');
    if (name === 'sw.js') {
      content = content.replace(/const VERSION\s*=\s*(['"])\d+\1/, `const VERSION='${cacheVersion}'`);
      content = content.replace(/mne-field-notes-v\d+/, `mne-field-notes-v${cacheVersion}`);
    }
    if (name === 'app.js' || name === 'timetable.js' || name === 'weather.js' || name === 'sw.js') {
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
  process.stdout.write(`Built ${sourceFiles.length} production assets in dist/ (revision ${revision}, cache ${cacheVersion}).\n`);
}

build().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
