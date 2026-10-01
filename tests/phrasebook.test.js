'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const PHRASEBOOK = require('../phrasebook.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8')).ui;
const he = JSON.parse(fs.readFileSync(path.join(root, 'locales/he.json'), 'utf8')).ui;

const HEBREW = /[֐-׿]/, LATIN = /[A-Za-z]/;
const ids = PHRASEBOOK.groups.map(g => g.id);
assert.equal(new Set(ids).size, ids.length, 'phrasebook group ids must be unique');
for (const id of ['airport', 'fuel', 'mountain', 'stay', 'eat', 'sights', 'sos']) assert.ok(ids.includes(id), `phrasebook needs a "${id}" group`);
assert.equal(PHRASEBOOK.groups.filter(g => g.open).length, 1, 'exactly one group opens by default');

const seen = new Set();
let count = 0;
for (const g of PHRASEBOOK.groups) {
  assert.ok(g.title.length === 2 && g.title.every(Boolean), `${g.id}: title needs English and Hebrew`);
  assert.ok(g.tip.length === 2 && g.tip.every(Boolean), `${g.id}: tip needs English and Hebrew`);
  assert.ok(HEBREW.test(g.title[1]) && HEBREW.test(g.tip[1]), `${g.id}: Hebrew title and tip must be Hebrew`);
  assert.ok(g.items.length > 0, `${g.id}: empty group`);
  for (const item of g.items) {
    const [me, meaningEn, meaningHe, phEn, phHe] = item;
    assert.equal(item.length, 5, `${me}: needs [Montenegrin, English, Hebrew, English phonetics, Hebrew phonetics]`);
    assert.ok(item.every(x => typeof x === 'string' && x.trim()), `${me}: empty field`);
    assert.ok(LATIN.test(me) && LATIN.test(phEn), `${me}: Montenegrin and English phonetics must use Latin letters`);
    assert.ok(HEBREW.test(phHe), `${me}: Hebrew phonetics must be Hebrew`);
    assert.ok(HEBREW.test(meaningHe) || /^\d+$/.test(meaningHe), `${me}: Hebrew meaning must be Hebrew`);
    assert.ok(/[A-Z]{2,}/.test(phEn), `${me}: English phonetics should mark stress in CAPITALS`);
    assert.ok(!seen.has(me), `${me}: duplicate phrase`);
    seen.add(me);
    count++;
  }
}
assert.ok(count >= 100, `phrasebook should hold a useful number of phrases, found ${count}`);
for (const [letter, enText, heText] of PHRASEBOOK.pronunciation) assert.ok(letter && enText && HEBREW.test(heText), `pronunciation key ${letter} needs both languages`);

// The Field Guide wires it in: script, jump-bar button, section, render targets, offline cache, UI strings in both languages.
assert.ok(html.includes('phrasebook.js?rev=') && sw.includes('./phrasebook.js?rev='), 'phrasebook.js must load and be cached offline');
assert.ok(html.includes('data-fg="fg-talk"') && html.includes('id="fg-talk"') && html.includes('id="phrasebook"') && html.includes('id="pbKey"') && html.includes('id="pbSearch"') && html.includes('id="showDialog"'), 'Field Guide needs the phrasebook section and jump-bar entry');
assert.ok(app.includes('renderPhrasebook()'), 'render() must draw the phrasebook');
assert.ok(app.includes('openShow(') && app.includes('class="pb-item" role="button"'), 'every phrase row must open Show to a local when tapped');
for (const key of ['fg.nav.talk', 'fg.talk.title', 'fg.talk.lead', 'pb.key', 'pb.how', 'pb.search', 'pb.empty', 'pb.count', 'pb.show', 'pb.close', 'pb.prev', 'pb.next']) assert.ok(en[key] && he[key], `ui.${key} must exist in both languages`);
console.log(`PASS: phrasebook with ${PHRASEBOOK.groups.length} groups and ${count} phrases, both phonetic spellings, wired into the Field Guide`);
