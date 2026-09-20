// 一次性探针:①现有附件字段分布 ②"订单"类面板清单(表/行数/是否已有附件)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

console.log('=== 现有「附件」字段(按面板)===');
for (const r of await q("SELECT panel_code, COUNT(*) n, MIN(place) place FROM yj_field WHERE data_type=N'附件' GROUP BY panel_code ORDER BY panel_code")) {
  console.log(`  ${r.panel_code}: ${r.n} 个 (place=${r.place})`);
}

console.log('\n=== 名称含「订单/加工单/工单」的面板 ===');
for (const p of await q("SELECT panel_code, panel_name, mode, head_table, line_table, group_col FROM yj_panel WHERE panel_name LIKE N'%订单%' OR panel_name LIKE N'%加工单%' OR panel_name LIKE N'%工单%' OR panel_name LIKE N'%委托%' OR panel_name LIKE N'%采购单%' OR panel_name LIKE N'%验收单%' ORDER BY panel_code")) {
  const t = p.head_table || p.line_table;
  let rows = '-', attachCols = 0, attachFields = 0;
  try { rows = (await q(`SELECT COUNT(DISTINCT [${p.group_col}]) n FROM ${t} WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0].n; } catch (e) { rows = 'ERR'; }
  try { attachCols = (await q(`SELECT COUNT(*) n FROM sys.columns WHERE object_id=OBJECT_ID('dbo.${t}') AND name LIKE N'附件%'`))[0].n; } catch {}
  attachFields = (await q(`SELECT COUNT(*) n FROM yj_field WHERE panel_code=N'${p.panel_code}' AND data_type=N'附件'`))[0].n;
  console.log(`  ${p.panel_code.padEnd(18)} ${String(p.panel_name).padEnd(14)} ${p.mode.padEnd(8)} ${String(t).padEnd(22)} 单据 ${String(rows).padStart(5)} | 表附件列 ${attachCols} | 字段 ${attachFields}`);
}
console.log('\n=== 已登记附件的迁移 ===');
await pool.close();
