/** 收尾核对:A-48-12 / A-48-17 / YJ-ZZ-006 等几行的最终状态 + 配平单是否在面板可见 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 之前几处异常的最终结存 ===')
for (const r of await q(`SELECT wzdm, ckdm, ISNULL(lot_no,'(无)') lot, CAST(yl AS decimal(18,4)) yl, CAST(rkl AS decimal(18,2)) rkl, CAST(ckl AS decimal(18,2)) ckl
                           FROM kucun WHERE (wzdm='A-48-12' OR wzdm='A-48-17' OR wzdm='YJ-ZZ-006' OR wzdm='YJ-GL-047') AND ISNULL(asp_cancel,'N')<>'Y'
                          ORDER BY wzdm`))
  console.log('   ' + JSON.stringify(r))

console.log('\n=== 配平单在面板能否查到(按 yj_doc_status 已审核) ===')
const r = await q(`SELECT COUNT(*) n FROM bd_other_in h
                    JOIN yj_doc_status s ON s.panel_code='OTHER_IN' AND s.doc_no=h.单据编号 AND s.shr IS NOT NULL
                   WHERE h.备注 LIKE N'负库存配平%' AND ISNULL(s.canceled,'N')<>'Y'`)
console.log('   可在列表查到: ' + r[0].n + ' 张')

console.log('\n=== 单据号连续性与唯一性 ===')
const dupNo = await q(`SELECT 单据编号, COUNT(*) c FROM bd_other_in GROUP BY 单据编号 HAVING COUNT(*)>1`)
console.log('   重复单号: ' + dupNo.length)
const rng = await q(`SELECT MIN(单据编号) a, MAX(单据编号) b, COUNT(*) n FROM bd_other_in WHERE 备注 LIKE N'负库存配平%'`)
console.log('   范围: ' + JSON.stringify(rng[0]))

console.log('\n=== 抽一张单看内容(5 行以内) ===')
for (const r of await q(`SELECT TOP 5 h.单据编号, CONVERT(varchar(10),h.单据日期,120) d, h.业务类型, h.供应商, h.审核人,
                                l.存货编码, l.存货名称, l.仓库, l.批号, l.数量, l.单价, l.金额
                           FROM bd_other_in h JOIN bl_other_in l ON l.单据编号=h.单据编号
                          WHERE h.备注 LIKE N'负库存配平%' ORDER BY h.单据编号, l.序号`))
  console.log('   ' + JSON.stringify(r))
await pool.close()
