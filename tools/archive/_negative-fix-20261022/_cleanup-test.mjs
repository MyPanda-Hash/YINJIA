/** 清掉测试库这次验证产生的数据(单据 + 流水 + 状态 + 留痕 + 还原 kucun) */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const run = (s) => pool.request().query(s)

const nos = (await run(`SELECT 单据编号 no FROM bd_other_in WHERE 备注 LIKE N'负库存配平%'`)).recordset.map((r) => r.no)
console.log('要清理的单号:', nos.join(',') || '(无)')
for (const no of nos) {
  await run(`DELETE FROM inh WHERE 单据编号 = N'${no}'`)
  await run(`DELETE FROM bl_other_in WHERE 单据编号 = N'${no}'`)
  await run(`DELETE FROM bd_other_in WHERE 单据编号 = N'${no}'`)
  await run(`DELETE FROM yj_doc_status WHERE panel_code='OTHER_IN' AND doc_no = N'${no}'`)
  await run(`DELETE FROM yj_form_approval WHERE panel_code='OTHER_IN' AND form_no = N'${no}'`)
}
// 还原人为造负的那一行(按流水重算:入 0 出 0)
await run(`UPDATE kucun SET yl=0, rkl=0, ckl=0, asp_user2=NULL, asp_time2=NULL
            WHERE wzdm='YJ-SX-043' AND ckdm='CK00006' AND lot_no IS NULL`)

const chk = (await run(`SELECT
  (SELECT COUNT(*) FROM kucun WHERE ISNULL(yl,0)<-0.0001 AND ISNULL(asp_cancel,'N')<>'Y') neg,
  (SELECT COUNT(*) FROM bd_other_in WHERE 备注 LIKE N'负库存配平%') heads,
  (SELECT COUNT(*) FROM inh WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE N'负库存配平%')) flows,
  (SELECT COUNT(*) FROM kucun WHERE wzdm='YJ-SX-043' AND ckdm='CK00006') kucun_rows`)).recordset[0]
console.log('清理后:', JSON.stringify(chk))
const k = (await run(`SELECT yl, rkl, ckl FROM kucun WHERE wzdm='YJ-SX-043' AND ckdm='CK00006' AND lot_no IS NULL`)).recordset[0]
console.log('YJ-SX-043@CK00006 还原为:', JSON.stringify(k))
await pool.close()
