/** 核对:合格品入库与特采入库,检验行的「入库单号」最终指向谁 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
console.log('IJ-2026-10-0099 检验行:')
for (const r of await q(`SELECT id, 物料编码, CAST(合格数量 AS decimal(18,2)) 合格, CAST(不合格数量 AS decimal(18,2)) 不合格,
                                CAST(送检数量 AS decimal(18,2)) 送检, ISNULL(入库单号,'(空)') 入库单号
                           FROM qc_insp_detail WHERE 单据编号='IJ-2026-10-0099'`))
  console.log('   ' + JSON.stringify(r))
console.log('\n该检验单产生的入库单:')
for (const r of await q(`SELECT l.单据编号, CAST(l.实收数量 AS decimal(18,2)) 实收, ISNULL(l.特采,'(null)') 特采
                           FROM bl_purchase_in l WHERE l.单据编号 IN ('PI-2026-10-0090','PI-2026-10-0091')`))
  console.log('   ' + JSON.stringify(r))
await pool.close()
