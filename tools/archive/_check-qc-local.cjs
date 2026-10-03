/** 同一把尺子:本地(工作区)版 QcCatalogService 两处 INSERT 的列数 vs 值数 */
const fs = require('fs');
const src = fs.readFileSync('D:/workspace/yinjia/backend/src/main/java/com/yinjia/mes/service/QcCatalogService.java', 'utf8');
const check = (label, colsRe, valsRe) => {
  const cols = (src.match(colsRe) || [])[0] || '';
  const vals = (src.match(valsRe) || [])[0] || '';
  if (!cols || !vals) { console.log('  ' + label + ': 未匹配'); return; }
  const nCols = cols.replace(/[()]|\s/g, '').split(',').filter(Boolean).length;
  const nQ = (vals.match(/\?/g) || []).length;
  const nNull = (vals.match(/NULL/gi) || []).length;
  const nFn = (vals.match(/GETDATE|SYSDATETIME/gi) || []).length;
  const tot = nQ + nNull + nFn;
  console.log(`  ${label}: 本地列=${nCols} 值=${nQ}(?)+${nNull}(NULL)+${nFn}(fn)=${tot}` + (nCols === tot ? '  OK 一致' : '  ❌ 不匹配'));
};
check('qc_catalog_detail', /INSERT INTO qc_catalog_detail \([\s\S]*?\)/, /VALUES \([\s\S]*?\)/);
check('qc_insp_rec', /INSERT INTO qc_insp_rec \([\s\S]*?\)/, /VALUES \([\s\S]*?\)/);
