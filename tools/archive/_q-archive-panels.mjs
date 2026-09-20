// 一次性探针:档案面板清单(找行数最大的那个,用于看"顶层/底层"翻页位置)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;
const rows = await q("SELECT panel_code, panel_name, mode, line_table, page_size FROM yj_panel WHERE mode IN ('archive','flat') ORDER BY panel_code");
for (const r of rows) {
  let n = '-';
  try { n = (await q(`SELECT COUNT(*) n FROM ${r.line_table} WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0].n; } catch {}
  console.log(`${r.panel_code}\t${r.panel_name}\t${r.mode}\t${r.line_table}\t${r.page_size}\t${n}`);
}
await pool.close();
