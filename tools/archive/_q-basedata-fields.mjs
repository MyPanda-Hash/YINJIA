// 一次性探针:7 面板里"基础资料类"字段的全量现状(任意 place),用于写关联迁移
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

for (const pc of ['PU_ORDER', 'SL_RECV', 'QC_RETURN', 'QC_INSP', 'PURCHASE_IN', 'SO_ORDER', 'SALE_OUT']) {
  const rows = await q(`SELECT id, label, col_name, data_type, ref_panel, ref_field, display_field, place, hidden, dict_sql FROM yj_field WHERE panel_code=N'${pc}' AND (label LIKE N'%${'供应商'}%' OR label LIKE N'%客户%' OR label LIKE N'%仓库%' OR label IN (N'物料编码',N'存货编码',N'存货名称',N'物料名称') OR label IN (N'部门',N'部门编码',N'业务员',N'经手人',N'检验员',N'币种',N'计量单位',N'单位')) AND seq < 900 ORDER BY seq, id`);
  console.log(`\n=== ${pc} ===`);
  for (const r of rows) {
    const ref = r.ref_panel ? `${r.ref_panel}.${r.ref_field}/${r.display_field}` : '-';
    console.log(`  ${String(r.label).padEnd(10)} col=${String(r.col_name).padEnd(10)} type=${String(r.data_type).padEnd(4)} ref=${ref.padEnd(28)} place=${String(r.place).padEnd(18)} hidden=${r.hidden ? 1 : 0} dict=${r.dict_sql ? 'Y' : 'N'} id=${r.id}`);
  }
}
await pool.close();
