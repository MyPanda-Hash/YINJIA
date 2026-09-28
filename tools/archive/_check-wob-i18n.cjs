const fs = require('fs');
const base = 'D:/workspace/yinjia/frontend/src/';
const en = fs.readFileSync(base + 'i18n/locales/en.js', 'utf8');
const src = fs.readFileSync(base + 'views/modules/plan/WorkOrderBoard.vue', 'utf8');
const re = /tt\('([^']+)'\)/g;
let m;
const miss = new Set();
while ((m = re.exec(src))) {
  if (!en.includes("'" + m[1] + "'")) miss.add(m[1]);
}
console.log(miss.size ? '仍缺: ' + [...miss].join(' | ') : 'OK WorkOrderBoard 全部词条有 en 译名');
