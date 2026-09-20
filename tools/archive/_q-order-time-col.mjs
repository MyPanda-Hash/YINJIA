// 一次性探针:单据面板 头表/行表 asp_time1 存在性与空值率(决定默认排序能否全面改按创建时间)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;
const has = async (t, c) => (await q(`SELECT COUNT(*) n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' AND COLUMN_NAME='${c}'`))[0].n > 0;

const panels = (await q("SELECT panel_code, mode, head_table, line_table, group_col FROM yj_panel WHERE mode='doc' ORDER BY panel_code"));
const problems = [];
for (const p of panels) {
  const ht = p.head_table, lt = p.line_table;
  if (!ht && !lt) continue;
  const useT = ht || lt;
  const okA1 = await has(useT, 'asp_time1');
  let nulls = '-', rows = '-';
  if (okA1) {
    try {
      const r = (await q(`SELECT COUNT(*) n, SUM(CASE WHEN asp_time1 IS NULL THEN 1 ELSE 0 END) nn FROM ${useT}`))[0];
      rows = r.n; nulls = r.nn;
    } catch (e) { nulls = 'ERR'; }
  }
  const line = { panel: p.panel_code, 表: useT, asp_time1: okA1, 行数: rows, 空时间: nulls };
  if (!okA1 || String(nulls) === 'ERR' || (typeof nulls === 'number' && rows > 0 && nulls === rows)) problems.push(line);
  console.log(JSON.stringify(line));
}
console.log('\n有问题的面板:', JSON.stringify(problems));
await pool.close();
