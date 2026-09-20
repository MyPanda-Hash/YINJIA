// 一次性探针:①各面板缺 asp_time1/asp_time2 的表 ②订单类表的时间列取值形态 ③各单据面板单据数
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const panels = await q("SELECT panel_code, mode, head_table, line_table, group_col FROM yj_panel ORDER BY panel_code");
const has = async (t, c) => (await q(`SELECT COUNT(*) n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' AND COLUMN_NAME='${c}'`))[0].n > 0;
const miss = [];
for (const p of panels) {
  const t = p.line_table; if (!t) continue;
  const a1 = await has(t, 'asp_time1'), a2 = await has(t, 'asp_time2');
  if (!a1 || !a2) miss.push({ panel: p.panel_code, mode: p.mode, line_table: t, asp_time1: a1, asp_time2: a2 });
}
console.log('缺时间列的表:', JSON.stringify(miss, null, 0));

for (const p of panels.filter(x => x.mode === 'doc')) {
  if (!p.line_table) continue;
  try {
    const n = (await q(`SELECT COUNT(DISTINCT [${p.group_col}]) n FROM ${p.head_table || p.line_table} WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0].n;
    console.log(`单据面板 ${p.panel_code}: 单据数 ${n} (${p.head_table || p.line_table})`);
  } catch (e) { console.log(`单据面板 ${p.panel_code}: 查询失败 ${e.message}`); }
}

for (const t of ['bd_pu_order', 'bd_so_order', 'sl_recv', 'qc_insp', 'bd_purchase_in']) {
  try {
    console.log(`\n--- ${t} TOP5 by asp_time1 DESC ---`);
    const rows = await q(`SELECT TOP 5 * FROM ${t} ORDER BY asp_time1 DESC`);
    for (const r of rows.slice(0, 5)) {
      const keys = Object.keys(r).filter(k => /编号|日期|asp_time|状态|来源|创建|修改/.test(k));
      console.log('  ', JSON.stringify(Object.fromEntries(keys.map(k => [k, r[k]]))));
    }
  } catch (e) { console.log(`--- ${t}: ${e.message}`); }
}
await pool.close();
