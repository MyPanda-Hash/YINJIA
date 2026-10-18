
const fs = require('fs');
const path = require('path');
const root = 'C:/INCER/YINJIA-MES/frontend/src';
const en = fs.readFileSync(root + '/i18n/locales/en.js', 'utf8');
const loc = new Set();
for (const line of en.split(/\r?\n/)) {
  const m = line.match(/^\s*'((?:[^'\\]|\\.)*)'\s*:/);
  if (m) loc.add(m[1].replace(/\\'/g, "'"));
}
const files = ['views/dc/DcConfig.vue','views/dc/DcMonitor.vue','views/dc/DcStats.vue'];
const missing = [];
for (const rel of files) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const re = /tt\(\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(src))) {
    let k = m[1].replace(/\\'/g, "'");
    k = k.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    if (!loc.has(k)) missing.push(rel + ' :: ' + k);
  }
}
console.log('en keys=' + loc.size + ' missing=' + missing.length);
console.log([...new Set(missing)].join('\n'));
