/**
 * 采购入库单:只保留金蝶拉下来的已审核数据(2026-10-16,正式库,走面板 API)
 * 用户口径:「采购入库单只保留从金蝶拉下来的已审核数据」。
 *   保留:asp_user1='试运行'(= 金蝶同步,313 张,全部已审核)
 *   删除:其余全部(草稿直接删;已审核先弃审再删);删前备份单号清单。
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:8090'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const rows = (await pool.request().query(`
  SELECT h.单据编号 AS no, ISNULL(h.asp_user1,N'') AS who,
         CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END AS st
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.asp_user1,N'') <> N'试运行'`)).recordset
await pool.close()
console.log(`待删除 ${rows.length} 张(保留金蝶同步 313 张)`)
writeFileSync(new URL('./_dump-out/pi-removed-non-kingdee-1016.tsv', import.meta.url),
  '单据编号\t落库人\t状态\r\n' + rows.map((r) => `${r.no}\t${r.who}\t${r.st}`).join('\r\n'), 'utf8')

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
const btn = async (name, no) => (await (await fetch(`${BASE}/api/px/callButton`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: name, formData: { 编号: no, 单据编号: no }, buttonParam: {} }),
})).json())

let ok = 0, fail = []
for (const r of rows) {
  if (r.st !== '草稿') await btn('弃审', r.no)          // 已审核/审批中 ⇒ 先弃审(草稿会报错,无害)
  const d = await btn('删除', r.no)
  if (d.code === 200 || d.code === 0) ok++; else fail.push(`${r.no}:${(d.message || '').slice(0, 30)}`)
}
console.log(`删除成功 ${ok}/${rows.length}` + (fail.length ? `\n失败样例: ${fail.slice(0, 5).join(' | ')}` : ''))

const pool2 = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const left = (await pool2.request().query(`
  SELECT COUNT(*) AS n FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.asp_user1,N'') <> N'试运行' AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'`)).recordset[0].n
const keepN = (await pool2.request().query(`SELECT COUNT(*) AS n FROM bd_purchase_in WHERE asp_user1=N'试运行'`)).recordset[0].n
await pool2.close()
console.log(`复核:界面口径下非金蝶同步残留 = ${left};金蝶同步保留 = ${keepN}`)
console.log('[备份] tools/archive/_dump-out/pi-removed-non-kingdee-1016.tsv')
