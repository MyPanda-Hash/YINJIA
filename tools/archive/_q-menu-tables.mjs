// 一次性探针:找可能承载导航/菜单的数据库表,并看采购/销售相关行
import { createRequire } from 'node:module';
const require = createRequire('D:/YINJIA-main/deploy/package.json');
const mssql = require('mssql');

const pool = new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES',
  user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
});
await pool.connect();

console.log('=== 名字像菜单/导航/yj_* 的表 ===');
const t = (await new mssql.Request(pool).query(
  `SELECT name FROM sys.tables WHERE name LIKE '%menu%' OR name LIKE '%nav%' OR name LIKE 'yj[_]%' ORDER BY name`)).recordset;
console.log(t.map((r) => r.name).join(', '));

for (const tbl of t.map((r) => r.name)) {
  if (!/menu|nav/i.test(tbl)) continue;
  const rows = (await new mssql.Request(pool).query(`SELECT TOP 5 * FROM ${tbl}`)).recordset;
  console.log(`\n--- ${tbl} (前5行) ---`);
  for (const r of rows) console.log(JSON.stringify(r));
}

// 销售/采购面板在权限表里的情况
console.log('\n=== yj_role_panel 中 SO_ORDER / PU_ORDER / SALES_ORDER_STATS 的授权行 ===');
const rp = (await new mssql.Request(pool).query(
  `SELECT TOP 30 * FROM yj_role_panel WHERE panel_code IN ('SO_ORDER','PU_ORDER','SALES_ORDER_STATS','PURCHASE_IN_STATS') ORDER BY panel_code`)).recordset;
for (const r of rp) console.log(JSON.stringify(r));

await pool.close();
