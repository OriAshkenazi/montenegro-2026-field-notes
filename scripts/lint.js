'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { HTMLHint } = require('htmlhint');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const jsFiles = ['boot.js', 'app.js', 'weather.js', 'timetable.js', 'i18n.js', 'phrasebook.js', 'sw.js', ...fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.js')).map(file => path.join('tests', file)), ...fs.readdirSync(__dirname).filter(file => file.endsWith('.js')).map(file => path.join('scripts', file))];
const eslintArgs = [
  '--no-eslintrc',
  '--env', 'browser,node,es2021',
  '--global', 'L',
  '--global', 'projectTimetable,foodRows,splitSentences,PHRASEBOOK',
  '--global', 't,tc,tr,placeAliases,bidi,bidiText,bidiRuns,getLang,setLang,onLangChange,i18nReady,applyStatic',
  '--parser-options', '{"ecmaVersion":2021}',
  '--rule', 'no-undef:error',
  '--rule', 'no-unreachable:error',
  '--rule', 'no-dupe-keys:error',
  '--rule', 'no-duplicate-case:error',
  '--rule', 'valid-typeof:error',
  ...jsFiles
];
const lint = spawnSync(process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), ...eslintArgs], { cwd: root, stdio: 'inherit' });
if (lint.error) throw lint.error;
if (lint.status !== 0) process.exit(lint.status || 1);

const htmlPath = path.join(root, 'index.html');
const source = fs.readFileSync(htmlPath, 'utf8');
const rules = {
  'tag-pair': true,
  'attr-no-duplication': true,
  'attr-value-double-quotes': true,
  'id-unique': true,
  'doctype-first': true,
  'doctype-html5': true,
  'src-not-empty': true
};
const messages = HTMLHint.verify(source, rules);
if (messages.length) {
  for (const message of messages) {
    process.stderr.write(`${htmlPath}:${message.line}:${message.col} ${message.message}\n`);
  }
  process.exit(1);
}
process.stdout.write(`HTML lint passed: ${path.relative(root, htmlPath)}\n`);
