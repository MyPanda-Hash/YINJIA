// _audit-meta-vs-chain.mjs — 迁移链声明 vs 库现状 审计(2026-09-24)
// ①INSERT INTO yj_field 声明的 (panel,col) vs 库 yj_field —— 找字段缺口(界面少列不报500,扫描器查不出)
// ②ALTER TABLE x ADD [col] 声明 vs 库列 —— 找缺列(会被跳过迁移隐藏)
// ③INSERT INTO yj_panel 声明 vs 库 —— 找缺面板
// ④库 yj_field 里 panel_code 无面板行 = 孤儿编码(如 SL_RECV 式残留)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const q = (sql) => {
  fs.writeFileSync('tools/archive/_aud.sql', 'SET NOCOUNT ON\n' + sql + '\n', 'utf8');
  execSync('docker cp tools/archive/_aud.sql mssql2019:/tmp/aud.sql', { shell: true, stdio: 'ignore' });
  return execSync('docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -i /tmp/aud.sql"', { shell: true, encoding: 'utf8', maxBuffer: 5e8, stdio: ['ignore','pipe','ignore'] })
    .split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim() && !/^(-+|SQLcmd:)/.test(l.trim()));
};

// ── 库现状 ──
const dbFields = new Set(q("SELECT panel_code+'|'+col_name FROM yj_field"));
const dbPanels = new Set(q('SELECT panel_code FROM yj_panel'));
const dbCols = new Set(q("SELECT t.name+'|'+c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id"));
const dbFieldPanels = new Set(q('SELECT DISTINCT panel_code FROM yj_field'));
console.log(`库: ${dbPanels.size} 面板 / ${dbFields.size} 字段行 / ${dbCols.size} 表列`);

// ── 迁移链声明(清单内脚本) ──
const order = fs.readFileSync('tools/db-migrations.txt', 'utf8').split('\n').map(l => l.trim()).filter(l => l.endsWith('.sql') && !l.startsWith('#'));
const declFields = new Map();   // 'PANEL|col' -> [scripts]
const declCols = new Map();     // 'table|col' -> [scripts]
const declPanels = new Map();
for (const f of order) {
  const p = 'tools/' + f;
  if (!fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  // INSERT INTO yj_field ... VALUES ('XX', N'col' —— 面板码与列名(第一二参数)
  for (const m of txt.matchAll(/INSERT\s+INTO\s+yj_field[\s\S]{0,400}?\(N?'([A-Z_0-9]+)',\s*N?'([^']+)'/gi)) {
    const k = m[1] + '|' + m[2];
    (declFields.get(k) || declFields.set(k, []).get(k)).push(f);
  }
  for (const m of txt.matchAll(/INSERT\s+INTO\s+yj_field\s*\(panel_code,\s*col_name[\s\S]{0,300}?\('([A-Z_0-9]+)',\s*N'([^']+)'/gi)) {
    const k = m[1] + '|' + m[2];
    (declFields.get(k) || declFields.set(k, []).get(k)).push(f);
  }
  // ALTER TABLE x ADD [col](IF COL_LENGTH 守卫式)
  for (const m of txt.matchAll(/ALTER\s+TABLE\s+(?:dbo\.)?\[?([\w\u4e00-\u9fa5]+)\]?\s+ADD\s+\[([^\]]+)\]/gi)) {
    const k = m[1] + '|' + m[2];
    (declCols.get(k) || declCols.set(k, []).get(k)).push(f);
  }
  for (const m of txt.matchAll(/INSERT\s+INTO\s+yj_panel[\s\S]{0,300}?\(N?'([A-Z_0-9]+)'/gi)) {
    if (!declPanels.has(m[1])) declPanels.set(m[1], []);
    declPanels.get(m[1]).push(f);
  }
}
console.log(`链声明: ${declFields.size} 字段 / ${declCols.size} 列 / ${declPanels.size} 面板`);

// ── 差异 ──
const missField = [...declFields].filter(([k]) => !dbFields.has(k));
const missCol = [...declCols].filter(([k]) => !dbCols.has(k));
const missPanel = [...declPanels].filter(([k]) => !dbPanels.has(k));
const orphan = [...dbFieldPanels].filter(p => !dbPanels.has(p));

const byScript = (entries) => {
  const m = new Map();
  for (const [k, fs2] of entries) { const f = fs2[fs2.length - 1]; (m.get(f) || m.set(f, []).get(f)).push(k); }
  return m;
};
console.log(`\n═══ ①声明有库无的字段: ${missField.length} ═══`);
for (const [f, ks] of byScript(missField)) console.log(`  ${f}: ${ks.length} 个 → ${ks.slice(0, 8).join(', ')}${ks.length > 8 ? ' …' : ''}`);
console.log(`\n═══ ②声明有库无的表列: ${missCol.length} ═══`);
for (const [f, ks] of byScript(missCol)) console.log(`  ${f}: ${ks.length} 个 → ${ks.slice(0, 8).join(', ')}${ks.length > 8 ? ' …' : ''}`);
console.log(`\n═══ ③声明有库无的面板: ${missPanel.length} ═══`);
for (const [k, fs2] of missPanel) console.log('  ' + k + ' ← ' + fs2.join(','));
console.log(`\n═══ ④库内孤儿编码(字段指向不存在的面板): ${orphan.length} ═══`);
console.log(orphan.length ? '  ' + orphan.join(', ') : '  无');
fs.writeFileSync('tools/archive/_audit-result.json', JSON.stringify({ missField, missCol, missPanel, orphan }, null, 1), 'utf8');
