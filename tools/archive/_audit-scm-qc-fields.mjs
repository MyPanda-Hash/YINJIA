// _audit-scm-qc-fields.mjs — 供应链/品质 11 面板:迁移链声明字段 vs 库现状(排除有意删除)(2026-09-24)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const q = (sql) => {
  fs.writeFileSync('tools/archive/_q4.sql', 'SET NOCOUNT ON\n' + sql + '\n', 'utf8');
  execSync('docker cp tools/archive/_q4.sql mssql2019:/tmp/q4.sql', { shell: true, stdio: 'ignore' });
  return execSync('docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -i /tmp/q4.sql"',
    { shell: true, encoding: 'utf8', maxBuffer: 2e8, stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n').map(x => x.replace(/\r/, '').trim()).filter(x => x && !/^-{3,}$/.test(x) && !/^SQLcmd:/.test(x));
};

const order = fs.readFileSync('tools/db-migrations.txt', 'utf8').split('\n').map(l => l.trim())
  .filter(l => l.endsWith('.sql') && !l.startsWith('#'));

const panels = ['SO_ORDER', 'PU_ORDER', 'QC_INSP', 'QC_RECV', 'QC_RETURN', 'QC_TC_IN',
  'PURCHASE_IN', 'SALE_OUT', 'MATERIAL_OUT', 'FINISH_IN', 'SL_RECV'];
const INTENT = {
  PU_ORDER: new Set(['项目', '到货地址', '发货状态', '合同号', '订金金额', '付款方式', '现存量说明']),
  SO_ORDER: new Set(['品牌', '部门负责人', '项目']),
};
// 各面板有意删除清单(历史迁移明确 DELETE 的,收集自链)
for (const f of order) {
  const p = 'tools/' + f;
  if (!fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  for (const m of txt.matchAll(/DELETE\s+FROM\s+yj_field\s+WHERE\s+panel_code\s*(?:=|IN)\s*\(?\s*'([A-Z_0-9]+)'[\s\S]{0,200}?col_name\s+IN\s*\(([^)]+)\)/gi)) {
    const pc = m[1];
    if (!panels.includes(pc)) continue;
    if (!INTENT[pc]) INTENT[pc] = new Set();
    for (const c of m[2].split(',')) INTENT[pc].add(c.replace(/N?'|'/g, '').trim());
  }
}

let total = 0;
for (const panel of panels) {
  const reg = new Map();
  for (const f of order) {
    const p = 'tools/' + f;
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    for (const m of txt.matchAll(new RegExp(`VALUES\\s*\\(\\s*'${panel}'\\s*,\\s*N?'([^']+)'`, 'gi'))) {
      if (!reg.has(m[1])) reg.set(m[1], f);
    }
  }
  const db = new Set(q(`SELECT col_name FROM yj_field WHERE panel_code='${panel}'`));
  const intent = INTENT[panel] || new Set();
  const miss = [...reg].filter(([c]) => !db.has(c) && !intent.has(c));
  if (miss.length) { console.log(`⚠ ${panel}(库 ${db.size} / 链 ${reg.size}): 缺 ${miss.slice(0, 12).map(x => x[0]).join(', ')}${miss.length > 12 ? ' …共' + miss.length : ''}`); total += miss.length; }
  else console.log(`✓ ${panel}: 链 ${reg.size} / 库 ${db.size}`);
}
console.log(total ? `\n共缺 ${total} 项` : '\n✅ 11 个供应链/品质面板字段全对齐');
