// 只读:试探生产库连通性(失败即放弃,不重试)
import { createRequire } from 'node:module';
const targets = [
  { name: 'prod-36.140.66.163', cfg: { server: '36.140.66.163', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { trustServerCertificate: true, encrypt: false, connectTimeout: 8000 } } },
];
for (const t of targets) {
  try {
    const pool = await mssql.connect(t.cfg);
    const r = await pool.request().query(`SELECT @@SERVERNAME s, DB_NAME() db`);
    console.log(`[OK] ${t.name}`, JSON.stringify(r.recordset));
    const l = await pool.request().query(`SELECT TOP 3 单据编号, 行号, 物料编码, 数量, 行已执行数量, 行未执行数量, 行入库状态 FROM bl_pu_order WHERE 单据编号='YJ-20260921-10'`);
    console.log(JSON.stringify(l.recordset, null, 1));
    await pool.close();
  } catch (e) {
    console.log(`[FAIL] ${t.name}: ${e.message}`);
  }
}
