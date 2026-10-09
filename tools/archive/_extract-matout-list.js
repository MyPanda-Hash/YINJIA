const fs = require('fs');
const txt = fs.readFileSync('migrate-material-out-i18n.sql', 'utf8');
const ks = [...txt.matchAll(/\(N'([^']+)',\s*N'[^']+'\)/g)].map(m => m[1]);
console.log('entries:', ks.length);
const vals = ks.map(k => `(N'${k}')`).join(',');
fs.writeFileSync('archive/_matout-vals.txt', vals);
