/**
 * ① 链登记完整性:磁盘上的 tools/*.sql 是否都登记进 db-migrations.txt(未登记=DbSync 永不执行)
 * ② 执行台账差集:链上登记 vs yj_schema_log(已执行)
 * ③ QC 远端(HEAD)版 INSERT 列数/值数核对(判断"以远端为准"是否会改坏)
 */
const fs = require('fs');
const { execSync } = require('child_process');
const root = 'D:/workspace/yinjia';
const run = (c) => execSync(c, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const chain = run('git show HEAD:tools/db-migrations.txt').split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/)[0].replace(/^tools\/\.\.\//, '')).filter((l) => /\.sql$/i.test(l));
const chainSet = new Set(chain);

// 磁盘上的正式迁移脚本(tools 根层,排除 archive)
const onDisk = fs.readdirSync(root + '/tools').filter((f) => f.endsWith('.sql'));
const unregistered = onDisk.filter((f) => !chainSet.has(f));
console.log('=== ① 磁盘有、链(db-migrations.txt)里没登记 共 ' + unregistered.length + ' 个 ===');
unregistered.forEach((f) => console.log('  - ' + f));

// 已执行台账(由 sqlcmd -o + docker cp 导出)
const ledgerFile = root + '/tools/archive/_ledger-names.txt';
const ledger = new Set(fs.readFileSync(ledgerFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
const notRun = [...chainSet].filter((s) => !ledger.has(s));
console.log('\n=== ② 链上登记但台账未执行 共 ' + notRun.length + ' 个 ===');
notRun.forEach((s) => console.log('  - ' + s));

console.log('\n=== ③ HEAD(远端)版两处 QC INSERT 列数 vs 值数 ===');
const head = run('git show HEAD:backend/src/main/java/com/yinjia/mes/service/QcCatalogService.java');
const check = (label, text, colsRe, valsRe) => {
  const cols = (text.match(colsRe) || [])[0] || '';
  const vals = (text.match(valsRe) || [])[0] || '';
  if (!cols || !vals) { console.log('  ' + label + ': 未匹配到'); return; }
  const nCols = cols.replace(/[()]|\s/g, '').split(',').filter(Boolean).length;
  const nQ = (vals.match(/\?/g) || []).length;
  const nNull = (vals.match(/NULL/gi) || []).length;
  const nFn = (vals.match(/GETDATE|SYSDATETIME/gi) || []).length;
  console.log(`  ${label}: HEAD 列=${nCols}  值=${nQ}(?) + ${nNull}(NULL) + ${nFn}(函数) = ${nQ + nNull + nFn}`
    + (nCols === nQ + nNull + nFn ? '  OK' : '  ❌ 不匹配(远端版会报列数错误)'));
};
check('qc_catalog_detail', head, /INSERT INTO qc_catalog_detail \([\s\S]*?\)/, /VALUES \([\s\S]*?\)/);
check('qc_insp_rec', head, /INSERT INTO qc_insp_rec \([\s\S]*?\)/, /VALUES \([\s\S]*?\)/);
