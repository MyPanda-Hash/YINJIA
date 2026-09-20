// 一次性排查:从 tools/*.sql 提取所有为 GFDA 插入 yj_field 的 col_name 全集,与库中现状求差集
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const inserted = new Map(); // col -> [file...]
const deleted = new Map();
const reIns = /INSERT\s+INTO\s+yj_field[^;]*?VALUES\s*\(\s*'GFDA'\s*,\s*N?'([^']+)'/gi;
const reDel = /DELETE\s+FROM\s+yj_field[^;]*?panel_code[^;]*?'GFDA'[^;]*?(?:col_name\s*(?:IN|LIKE)\s*[^;]*?N?'([^']+)')?\s*;/gi;
for (const f of files) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  let m;
  while ((m = reIns.exec(txt))) {
    const col = m[1];
    if (!inserted.has(col)) inserted.set(col, []);
    inserted.get(col).push(f);
  }
  while ((m = reDel.exec(txt))) {
    const col = m[1] || '(整面板或条件删除)';
    if (!deleted.has(col)) deleted.set(col, []);
    deleted.get(col).push(f);
  }
}
console.log(`SQL 全集中为 GFDA 插入过的字段数: ${inserted.size}`);
console.log(`DELETE GFDA 字段的语句: ${[...deleted.entries()].map(([c, fs2]) => c + '@' + [...new Set(fs2)].join(',')).join(' | ') || '无'}`);
// 库中现状(33个)
const libCols = ['gysfl','供应商分类编码','增值税税率','开票名称','开户地址','采购员部门','自动抵扣预收款','联系人','供应商联系人手机','供应商联系人座机','供应商联系人邮箱','供应商联系人地址','group_id','生日','QQ','国家-id','国家-名称','国家-编码','省-id','省-名称','省-编码','市-id','市-名称','市-编码','区-id','区-名称','区-编码','性别1-男2-女','微信','是否首要联系人','联系人序号','分类编码','税率'];
const lib = new Set(libCols);
console.log(`\n库中现状: ${lib.size} 个`);
const inSqlNotLib = [...inserted.keys()].filter(c => !lib.has(c));
console.log(`\n【SQL 定义了但库里没有】${inSqlNotLib.length} 个:`);
for (const c of inSqlNotLib) console.log(`  ${c}  <- ${[...new Set(inserted.get(c))].join(', ')}`);
const inLibNotSql = libCols.filter(c => !inserted.has(c));
console.log(`\n【库里有但 SQL 提取不到】${inLibNotSql.length} 个: ${inLibNotSql.join(', ')}`);
