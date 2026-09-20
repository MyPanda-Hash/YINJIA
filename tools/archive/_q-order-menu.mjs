// 一次性探针:菜单里到底挂了哪些"订单/加工单/工单"面板(决定"所有订单"的范围)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const menus = (await q("SELECT TABLE_NAME t FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%menu%'")).map(r => r.t);
console.log('菜单相关表:', JSON.stringify(menus));
for (const t of menus) {
  const cols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}'`)).map(r => r.c);
  console.log(`\n${t} 列: ${JSON.stringify(cols)}`);
  const textCol = cols.find((c) => /name|title|text|panel/i.test(c));
  if (textCol) {
    const rows = await q(`SELECT * FROM ${t} WHERE ${cols.map((c) => `CAST([${c}] AS nvarchar(200)) LIKE N'%订单%' OR CAST([${c}] AS nvarchar(200)) LIKE N'%加工单%' OR CAST([${c}] AS nvarchar(200)) LIKE N'%工单%'`).join(' OR ')}`);
    for (const r of rows.slice(0, 20)) console.log('  ', JSON.stringify(r).slice(0, 220));
  }
}
await pool.close();
