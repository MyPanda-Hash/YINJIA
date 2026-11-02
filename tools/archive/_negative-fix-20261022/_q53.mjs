/** 在测试库造一张干净的未审检验单(送检 100 / 合格 60 / 不合格 40),链路不挂任何下游 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== qc_insp NOT NULL 列 ===')
const nnH = (await q(`SELECT c.name col FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_insp') AND c.is_nullable=0 AND c.is_identity=0`)).map((x) => x.col)
console.log('   ' + nnH.join(', '))
const nnD = (await q(`SELECT c.name col FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_insp_detail') AND c.is_nullable=0 AND c.is_identity=0`)).map((x) => x.col)
console.log('   明细: ' + nnD.join(', '))

// 参考一张已有检验单的表头值
console.log('\n=== 参考表头 ===')
for (const r of await q(`SELECT TOP 1 单据编号, 供应商, 供应商代码, 采购订单号, 批次号, 批次键, 检验单号 FROM qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`))
  console.log('   ' + JSON.stringify(r))
for (const r of await q(`SELECT TOP 1 * FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`))
  console.log('   明细样例: ' + JSON.stringify(r).slice(0, 600))
await pool.close()
