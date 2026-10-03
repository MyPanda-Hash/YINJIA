// _audit-field-vs-table.mjs — 面板字段(yj_field) vs 实际表/视图列 全面核对(2026-09-24)
// 判定:字段的 col_name 必须存在于其面板的 head_table / line_table / line_table(视图) 中;
//      否则 = 界面有字段但取不到值/保存报错(表格字段未对齐的直接形态)。
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const q = (sql) => {
  fs.writeFileSync('tools/archive/_af.sql', 'SET NOCOUNT ON\n' + sql + '\n', 'utf8');
  execSync('docker cp tools/archive/_af.sql mssql2019:/tmp/af2.sql', { shell: true, stdio: 'ignore' });
  return execSync('docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -i /tmp/af2.sql"', { shell: true, encoding: 'utf8', maxBuffer: 5e8, stdio: ['ignore','pipe','ignore'] })
    .split('\n').map(l => l.replace(/\r$/, '').trim()).filter(l => l && !/^-{3,}$/.test(l) && !/^SQLcmd:/.test(l));
};

// 表/视图 -> 列集合
const cols = new Map();
for (const line of q("SELECT o.name+'|'+c.name FROM sys.columns c JOIN sys.objects o ON o.object_id=c.object_id WHERE o.type IN ('U','V') ORDER BY o.name")) {
  const i = line.indexOf('|');
  if (i < 0) continue;
  const t = line.slice(0, i);
  if (!cols.has(t)) cols.set(t, new Set());
  cols.get(t).add(line.slice(i + 1));
}
// 面板 -> head/line 表
const panelTables = new Map();
for (const line of q("SELECT panel_code+'|'+SUBSTRING(ISNULL(head_table,'')+'|'+ISNULL(line_table,''),1,200) FROM yj_panel")) {
  const i = line.indexOf('|');
  if (i < 0) continue;
  const rest = line.slice(i + 1).split('|');
  panelTables.set(line.slice(0, i), rest.filter(Boolean));
}
// 字段注册
const bad = [];
for (const line of q("SELECT panel_code+'|'+col_name FROM yj_field ORDER BY panel_code")) {
  const i = line.indexOf('|');
  if (i < 0) continue;
  const pc = line.slice(0, i), c = line.slice(i + 1);
  const tables = panelTables.get(pc);
  if (!tables || !tables.length) continue;   // 无表(纯前端面板)跳过
  let ok = false;
  for (const t of tables) if (cols.get(t)?.has(c)) { ok = true; break; }
  if (!ok) bad.push({ pc, col: c, tables: tables.join('/') });
}
console.log(`核对 ${panelTables.size} 面板 / 字段缺口: ${bad.length}`);
for (const b of bad) console.log(`  ${b.pc}.${b.col}  ← 表 ${b.tables}`);
fs.writeFileSync('tools/archive/_audit-field-vs-table.json', JSON.stringify(bad, null, 1), 'utf8');
