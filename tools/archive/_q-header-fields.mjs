// 一次性探针:7 个目标面板的 **header** 字段现状(查询弹窗按 header 字段渲染)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

for (const pc of ['PU_ORDER', 'SL_RECV', 'QC_RETURN', 'QC_INSP', 'PURCHASE_IN', 'SO_ORDER', 'SALE_OUT']) {
  const rows = await q(`SELECT id, seq, label, col_name, data_type, ref_panel, ref_field, display_field, place, editable FROM yj_field WHERE panel_code=N'${pc}' ORDER BY seq, id`);
  console.log(`\n=== ${pc} ===`);
  for (const r of rows) {
    if (!String(r.place || '').includes('header')) continue;
    const ref = r.ref_panel ? ` → ${r.ref_panel}.${r.ref_field}/${r.display_field}` : '';
    console.log(`  [${String(r.seq).padStart(3)}] ${r.label} | ${r.data_type}${ref} | ${r.place} | edit=${r.editable ? 1 : 0} | id=${r.id}`);
  }
}
await pool.close();
