// 一次性探针:7 个目标面板的「查询」字段现状(place 含 query),以及与基础资料的关联情况
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const PANELS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['PU_ORDER', 'SL_RECV', 'QC_RETURN', 'QC_INSP', 'PURCHASE_IN', 'SO_ORDER', 'SALE_OUT'];

for (const pc of PANELS) {
  const p = (await q(`SELECT panel_code, panel_name, head_table, line_table, group_col FROM yj_panel WHERE panel_code=N'${pc}'`))[0];
  console.log(`\n=== ${pc} ${p?.panel_name} (${p?.head_table || p?.line_table}) ===`);
  const rows = await q(`SELECT id, col_name, label, data_type, ref_panel, ref_field, display_field, dict_sql, place, seq, editable, hidden, visible FROM yj_field WHERE panel_code=N'${pc}' ORDER BY seq`);
  for (const r of rows) {
    const isQuery = String(r.place || '').includes('query');
    if (!isQuery) continue;
    const ref = r.data_type === '参照' ? ` → 参照 ${r.ref_panel}.${r.ref_field}/${r.display_field}` : (r.dict_sql ? ` dict=${String(r.dict_sql).slice(0, 40)}` : '');
    console.log(`  [${String(r.seq).padStart(3)}] ${r.label} | col=${r.col_name} | type=${r.data_type}${ref} | place=${r.place} | editable=${r.editable ? 1 : 0} | id=${r.id}`);
  }
}
await pool.close();
