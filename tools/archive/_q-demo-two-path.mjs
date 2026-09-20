// 一次性探针:核对两条测试路径单据的表头字段落库情况(采购订单号 / 检验单号 / 源单行号)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const panels = await q("SELECT panel_code, head_table, line_table FROM yj_panel WHERE panel_code IN (N'QC_RETURN',N'PURCHASE_IN',N'QC_INSP',N'SL_RECV')");
console.log('面板→表:', JSON.stringify(panels, null, 0));

const tmap = Object.fromEntries(panels.map(p => [p.panel_code, p]));
const docs = [['QC_RETURN', 'TH-2026-09-0002'], ['PURCHASE_IN', 'PI-2026-09-0019'], ['PURCHASE_IN', 'PI-2026-09-0020'], ['PURCHASE_IN', 'PI-2026-09-0018']];

for (const [panel, no] of docs) {
  const p = tmap[panel];
  for (const [kind, tbl] of [['表头', p.head_table], ['明细', p.line_table]]) {
    if (!tbl) continue;
    const cols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${tbl}'`)).map(r => r.c);
    if (!cols.length) { console.log(`\n[${panel} ${no}] ${kind}表 ${tbl} 不存在`); continue; }
    const hasNo = cols.includes('单据编号') ? '单据编号' : null;
    if (!hasNo) { console.log(`\n[${panel} ${no}] ${kind}表 ${tbl} 无单据编号列,列=${JSON.stringify(cols)}`); continue; }
    const pick = cols.filter(c => /订单号|检验单号|行号|状态|供应商|备注|单据编号|源单/.test(c));
    const rows = await q(`SELECT ${pick.map(c => `[${c}]`).join(',')} FROM ${tbl} WHERE 单据编号=N'${no}'`);
    console.log(`\n### ${panel} ${no} ${kind}表 ${tbl} — ${rows.length} 行`);
    if (!rows.length) { console.log('  (无记录)'); continue; }
    console.log('  列:', JSON.stringify(pick));
    rows.slice(0, 6).forEach((r, i) => console.log(`  ${i}:`, JSON.stringify(r)));
  }
}
await pool.close();
