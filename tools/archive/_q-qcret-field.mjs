// 一次性探针:核对 QC_RETURN 面板「检验单号」字段定义与取值
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

console.log('yj_field 列:', JSON.stringify((await q("SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_field'")).map(r => r.c)));

for (const pc of ['QC_RETURN', 'QC_INSP']) {
  const rows = await q(`SELECT * FROM yj_field WHERE panel_code=N'${pc}'`);
  console.log(`\n=== ${pc} 字段数 ${rows.length} ===`);
  for (const r of rows) {
    const s = JSON.stringify(r);
    if (/检验单号|采购订单号|源单|单据编号/.test(s)) console.log(' ', s);
  }
}
await pool.close();
