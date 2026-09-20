// 一次性探针:①相关面板清单(按名找 code) ②这些面板的查询字段现状(是否参照/参照哪张基础资料)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

console.log('=== 面板名匹配(暂收/来料/采购/销售/订单/出入库)===');
for (const r of await q("SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel WHERE panel_name LIKE N'%暂收%' OR panel_name LIKE N'%来料%' OR panel_name LIKE N'%采购%' OR panel_name LIKE N'%销售%' OR panel_name LIKE N'%订单%' ORDER BY panel_code")) {
  console.log(`  ${r.panel_code}\t${r.panel_name}\t${r.mode}\t${r.head_table || r.line_table}`);
}
console.log('\n=== 基础资料类面板(可作参照目标)===');
for (const r of await q("SELECT panel_code, panel_name FROM yj_panel WHERE mode='archive' ORDER BY panel_code")) {
  console.log(`  ${r.panel_code}\t${r.panel_name}`);
}
await pool.close();
