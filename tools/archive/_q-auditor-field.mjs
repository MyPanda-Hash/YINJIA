// 一次性探针:所有面板的「审核人」字段现状 + 各单据表里审核人存值能否命中职员档案(EMP)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const rows = await q("SELECT panel_code, label, col_name, data_type, ref_panel, ref_field, display_field, place, hidden, editable, id FROM yj_field WHERE label = N'审核人' ORDER BY panel_code");
console.log(`「审核人」字段共 ${rows.length} 处:`);
for (const r of rows) {
  console.log(`  ${r.panel_code.padEnd(16)} type=${String(r.data_type).padEnd(4)} ref=${(r.ref_panel || '-') + '.' + (r.ref_field || '-')} place=${String(r.place).padEnd(16)} hidden=${r.hidden ? 1 : 0} edit=${r.editable ? 1 : 0} col=${r.col_name} id=${r.id}`);
}

// 抽查各面板所在表里 审核人 的存值 vs bs_emp.员工名称
const panels = [...new Set(rows.map((r) => r.panel_code))];
console.log('\n存值命中职员档案(EMP.员工名称)情况:');
for (const pc of panels) {
  const p = (await q(`SELECT head_table, line_table, mode FROM yj_panel WHERE panel_code=N'${pc}'`))[0];
  const t = p?.head_table || p?.line_table;
  const col = rows.find((r) => r.panel_code === pc).col_name;
  if (!t) continue;
  try {
    const r = (await q(`SELECT COUNT(*) n, SUM(CASE WHEN e.员工名称 IS NOT NULL THEN 1 ELSE 0 END) hit FROM (SELECT DISTINCT [${col}] v FROM ${t} WHERE [${col}] IS NOT NULL AND LTRIM(RTRIM([${col}]))<>'') x LEFT JOIN bs_emp e ON e.员工名称 = x.v`))[0];
    const sample = (await q(`SELECT DISTINCT TOP 4 [${col}] v FROM ${t} WHERE [${col}] IS NOT NULL AND LTRIM(RTRIM([${col}]))<>''`)).map(x => x.v);
    console.log(`  ${pc.padEnd(16)} ${t}.${col}: 去重 ${r.n} 命中 ${r.hit} | 样例 ${JSON.stringify(sample)}`);
  } catch (e) { console.log(`  ${pc}: ${e.message}`); }
}
await pool.close();
