/** 核对测试库执行结果:单据/行/流水/结存/审核留痕是否自洽 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 生成的其他入库单 ===')
for (const r of await q(`SELECT h.单据编号, CONVERT(varchar(10),h.单据日期,120) d, h.业务类型, h.供应商, h.审核人, CONVERT(varchar(19),h.审核时间,120) at, h.备注, h.asp_user1
                           FROM bd_other_in h WHERE h.备注 LIKE N'负库存配平%'`)) console.log('   ' + JSON.stringify(r))
console.log('=== 明细 ===')
for (const r of await q(`SELECT l.单据编号, l.序号, l.存货编码, l.存货名称, l.仓库, l.仓库编码, l.批号, l.数量, l.单价, l.金额
                           FROM bl_other_in l JOIN bd_other_in h ON h.单据编号=l.单据编号 WHERE h.备注 LIKE N'负库存配平%'`)) console.log('   ' + JSON.stringify(r))
console.log('=== 流水 inh ===')
for (const r of await q(`SELECT src, rid, 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120) d, 物料编码, 仓库编码, ISNULL(批号,'(null)') lot, 数量, asp_user1
                           FROM inh WHERE 单据编号 IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE N'负库存配平%')`)) console.log('   ' + JSON.stringify(r))
console.log('=== kucun 结果 ===')
for (const r of await q(`SELECT wzdm, ckdm, lot_no, rkl, ckl, yl, asp_user2 FROM kucun WHERE wzdm='YJ-SX-043' AND ckdm='CK00006'`)) console.log('   ' + JSON.stringify(r))
console.log('=== 审核状态/留痕 ===')
for (const r of await q(`SELECT doc_no, shr, CONVERT(varchar(19),shsj,120) shsj, canceled, pending, saved, approve_node FROM yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE N'负库存配平%')`)) console.log('   ' + JSON.stringify(r))
for (const r of await q(`SELECT form_no, action, result, operator FROM yj_form_approval WHERE form_no IN (SELECT 单据编号 FROM bd_other_in WHERE 备注 LIKE N'负库存配平%')`)) console.log('   ' + JSON.stringify(r))
await pool.close()
