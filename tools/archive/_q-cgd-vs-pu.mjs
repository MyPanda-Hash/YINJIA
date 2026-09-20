import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== CGD 与 PU_ORDER 对照(回答"CGD 是不是采购订单")===');
for (const pc of ['CGD','PU_ORDER']) {
  const p = (await q(`SELECT panel_code, panel_name, mode, head_table, line_table, group_col, prefix, module_group, category FROM yj_panel WHERE panel_code=N'${pc}'`))[0];
  const t = p.head_table || p.line_table;
  let n = '-', last = '-';
  try { n = (await q(`SELECT COUNT(*) n FROM ${t}`))[0].n; } catch {}
  try { last = JSON.stringify((await q(`SELECT TOP 2 * FROM ${t}`)).map(r => Object.values(r).slice(0, 6).join('|'))); } catch {}
  console.log(`  ${pc}: 名=${p.panel_name} 表=${t} 行数=${n} 模块=${p.module_group}/${p.category} 前缀=${p.prefix}`);
  console.log(`     样例: ${String(last).slice(0, 200)}`);
}
console.log('\n=== SALE_OUT 现状 ===');
const p = (await q("SELECT head_table, line_table, group_col FROM yj_panel WHERE panel_code='SALE_OUT'"))[0];
const cols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${p.head_table}' AND (COLUMN_NAME LIKE N'附件%' OR COLUMN_NAME LIKE N'%附件%')`)).map(r => r.c);
console.log(`  ${p.head_table} 附件相关列:`, JSON.stringify(cols), 'group=', p.group_col);
console.log('  单据数:', (await q(`SELECT COUNT(DISTINCT [${p.group_col}]) n FROM ${p.head_table} WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0].n);
console.log('  附件字段:', JSON.stringify(await q("SELECT col_name, data_type, place FROM yj_field WHERE panel_code='SALE_OUT' AND data_type=N'附件'")));
await pool.close();
