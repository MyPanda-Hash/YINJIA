// _create-test-docs.mjs — 在 MES 建两张测试单据(供推送脚本测试)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
const mssql = (await import('mssql')).default;
const pool = new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433,
  database: cfg.database.database, user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
});
await pool.connect();

// 先清旧测试数据
await pool.request().query(`DELETE FROM bl_purchase_in WHERE 单据编号 LIKE 'TEST-%'; DELETE FROM bd_purchase_in WHERE 单据编号 LIKE 'TEST-%';`);
await pool.request().query(`DELETE FROM bl_sale_out WHERE 单据编号 LIKE 'TEST-%'; DELETE FROM bd_sale_out WHERE 单据编号 LIKE 'TEST-%';`);

// 采购入库测试单(汇率列可能不存在,用列存在检查)
const purCols = new Set((await pool.request().query(`SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_purchase_in')`)).recordset.map((r) => r.name));
const purHead = { 单据编号: 'TEST-PUR-001', 单据日期: '2026-09-16', 供应商: '测试供应商A', 供应商编码: 'TEST-SUP-A', 经手人: '管理员', 备注: '推送测试-采购入库', 仓库: '正品仓', 单据状态: '已审核' };
if (purCols.has('汇率')) purHead['汇率'] = 1;
{
  const keys = Object.keys(purHead).filter((k) => purCols.has(k));
  const r = new mssql.Request(pool);
  keys.forEach((k, i) => r.input('p' + i, mssql.NVarChar(200), String(purHead[k])));
  await r.query(`INSERT INTO bd_purchase_in (${keys.map((k) => `[${k}]`).join(',')}) VALUES (${keys.map((_, i) => '@p' + i).join(',')})`);
}
const lineCols = new Set((await pool.request().query(`SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_purchase_in')`)).recordset.map((r) => r.name));
async function insLine(table, cols, data) {
  const keys = Object.keys(data).filter((k) => cols.has(k));
  const r = new mssql.Request(pool);
  keys.forEach((k, i) => r.input('l' + i, mssql.NVarChar(200), String(data[k])));
  await r.query(`INSERT INTO dbo.[${table}] (${keys.map((k) => `[${k}]`).join(',')}) VALUES (${keys.map((_, i) => '@l' + i).join(',')})`);
}
await insLine('bl_purchase_in', lineCols, { 单据编号: 'TEST-PUR-001', 存货编码: 'TEST-MAT-A', 存货名称: '测试物料A', 规格型号: 'A-001', 实收数量: 100, 计量单位: '个', 单价: 25.5, 批号: 'LOT20260916', 仓库: '正品仓', 仓库编码: 'CK00001' });
await insLine('bl_purchase_in', lineCols, { 单据编号: 'TEST-PUR-001', 存货编码: 'TEST-MAT-B', 存货名称: '测试物料B', 规格型号: 'B-002', 实收数量: 50, 计量单位: '箱', 单价: 80, 仓库: '正品仓', 仓库编码: 'CK00001' });

// 销售出库测试单
const soCols = new Set((await pool.request().query(`SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_sale_out')`)).recordset.map((r) => r.name));
const soHead = { 单据编号: 'TEST-SALE-001', 单据日期: '2026-09-16', 客户: '测试客户X', 客户编码: 'TEST-CUS-X', 经手人: '管理员', 备注: '推送测试-销售出库', 单据状态: '已审核' };
if (soCols.has('汇率')) soHead['汇率'] = 1;
{
  const keys = Object.keys(soHead).filter((k) => soCols.has(k));
  const r = new mssql.Request(pool);
  keys.forEach((k, i) => r.input('p' + i, mssql.NVarChar(200), String(soHead[k])));
  await r.query(`INSERT INTO bd_sale_out (${keys.map((k) => `[${k}]`).join(',')}) VALUES (${keys.map((_, i) => '@p' + i).join(',')})`);
}
const soLineCols = new Set((await pool.request().query(`SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_sale_out')`)).recordset.map((r) => r.name));
await insLine('bl_sale_out', soLineCols, { 单据编号: 'TEST-SALE-001', 存货编码: 'TEST-MAT-A', 存货名称: '测试物料A', 规格型号: 'A-001', 数量: 30, 计量单位: '个', 售价: 35, 仓库: '正品仓', 仓库编码: 'CK00001' });

console.log('测试单据已创建:');
console.log('  TEST-PUR-001  (采购入库: 测试供应商A, 2行)');
console.log('  TEST-SALE-001 (销售出库: 测试客户X, 1行)');
await pool.close();
