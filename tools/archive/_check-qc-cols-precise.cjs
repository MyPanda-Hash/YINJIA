/** 精确核对:按表名锚定,分别取每条 INSERT 的列数与值数(HEAD vs 工作区) */
const { execSync } = require('child_process');
const fs = require('fs');
const root = 'D:/workspace/yinjia';
const head = execSync('git show HEAD:backend/src/main/java/com/yinjia/mes/service/QcCatalogService.java', { cwd: root, encoding: 'utf8' });
const local = fs.readFileSync(root + '/backend/src/main/java/com/yinjia/mes/service/QcCatalogService.java', 'utf8');
const probe = (label, src) => {
  for (const table of ['qc_catalog_detail', 'qc_insp_rec']) {
    const re = new RegExp('INSERT INTO ' + table + ' \\(([\\s\\S]*?)\\)\\s*\\+?\\s*"?\\s*\\+?\\s*"?\\s*VALUES \\(([^)]*)\\)');
    const m = src.match(re) || src.match(new RegExp('INSERT INTO ' + table + ' \\(([\\s\\S]*?)\\)[\\s\\S]{0,120}?VALUES \\(([^)]*)\\)'));
    if (!m) { console.log(`  ${label} ${table}: 未匹配`); continue; }
    const nCols = m[1].replace(/\s|\+|\"/g, '').split(',').filter(Boolean).length;
    const nQ = (m[2].match(/\?/g) || []).length;
    const nNull = (m[2].match(/NULL/gi) || []).length;
    const nFn = (m[2].match(/GETDATE|SYSDATETIME/gi) || []).length;
    const tot = nQ + nNull + nFn;
    console.log(`  ${label.padEnd(6)} ${table.padEnd(18)} 列=${nCols} 值=${tot} (${nQ}? +${nNull}NULL +${nFn}fn)  ${nCols === tot ? 'OK' : '❌ 不匹配'}`);
  }
};
console.log('HEAD(远端)版:'); probe('HEAD', head);
console.log('工作区(本地)版:'); probe('LOCAL', local);
