const fs = require('fs');
const fields = fs.readFileSync('archive/_matout-fields.txt', 'utf8').split(/\r?\n/).filter(Boolean);
const i18n = fs.readFileSync('migrate-material-out-i18n.sql', 'utf8');
const list = [...i18n.matchAll(/\(N'([^']+)',\s*N'([^']+)'\)/g)].map(m => ({ k: m[1], ja: m[2] }));
const fk = new Set(fields);
const lk = new Set(list.map(e => e.k));

console.log('== 清单里不存在于面板的(10 个旧名) ==');
list.filter(e => !fk.has(e.k)).forEach(e => console.log(e.k, '=>', e.ja));

console.log('\n== 面板里未被清单覆盖的(无 ja 译名来源) ==');
fields.filter(f => !lk.has(f)).forEach(f => console.log(f));
