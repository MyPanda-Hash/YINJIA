// 一次性探针:带左栏「单据选择」的面板 page_size 配置(确认每页条数)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;
const rails = ['SL_RECV', 'QC_INSP', 'QC_RETURN', 'PU_ORDER', 'SO_ORDER', 'PURCHASE_IN'];
console.log('带左栏面板 page_size:');
for (const r of await q(`SELECT panel_code, panel_name, page_size FROM yj_panel WHERE panel_code IN (${rails.map(x => `N'${x}'`).join(',')})`)) {
  console.log(`  ${r.panel_code}\t${r.panel_name}\tpage_size=${r.page_size}`);
}
console.log('\n全部单据面板 page_size 分布:');
for (const r of await q("SELECT page_size, COUNT(*) n FROM yj_panel WHERE mode='doc' GROUP BY page_size")) console.log(`  page_size=${r.page_size}: ${r.n} 个面板`);
await pool.close();
