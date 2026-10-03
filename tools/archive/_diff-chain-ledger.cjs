/** db-migrations.txt(链上登记) vs yj_schema_log(实际执行台账) 差集 —— 直接检验"拉过来却没跑"的猜想 */
const fs = require('fs');
const txt = fs.readFileSync('D:/workspace/yinjia/tools/db-migrations.txt', 'utf8');
const chain = txt.split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.replace(/^\d+[.、]\s*/, '').split(/\s+/)[0])
  .filter((l) => /\.sql$/i.test(l));
const ledgerRaw = fs.readFileSync('D:/workspace/yinjia/tools/archive/_ledger-names.txt', 'utf8');
const ledger = new Set(ledgerRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
const uniqChain = [...new Set(chain)];
const notRun = uniqChain.filter((s) => !ledger.has(s));
const extraInLedger = [...ledger].filter((s) => !uniqChain.includes(s));
console.log('链上登记脚本数: ' + uniqChain.length);
console.log('台账已执行数: ' + ledger.size);
console.log('\n【链上登记但台账没有(= 拉过来了却没跑)】共 ' + notRun.length + ' 个:');
notRun.forEach((s) => console.log('  - ' + s));
console.log('\n【台账有但链上已无(= 历史脚本/改名)】共 ' + extraInLedger.length + ' 个(仅列前 10):');
extraInLedger.slice(0, 10).forEach((s) => console.log('  - ' + s));
