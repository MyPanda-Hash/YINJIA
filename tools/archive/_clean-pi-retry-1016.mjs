/**
 * 采购入库单清理(重试版):逐张「弃审 → 删除」,打印真实响应(2026-10-16,正式库,走面板 API)
 * 只在库里的非「试运行」(金蝶同步)单据上操作;已软删的跳过。
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const BASE = 'http://127.0.0.1:8090'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const rows = (await pool.request().query(`
  SELECT h.单据编号 AS no, ISNULL(h.asp_user1,N'') AS who,
         CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END AS st
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.asp_user1,N'') <> N'试运行' AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
  ORDER BY h.id`)).recordset
await pool.close()
console.log(`待处理 ${rows.length} 张`)

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
const btn = async (name, no) => (await (await fetch(`${BASE}/api/px/callButton`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: name, formData: { 编号: no, 单据编号: no }, buttonParam: {} }),
})).json())

let ok = 0
const reasons = {}
for (const r of rows) {
  let un = { code: 0, message: 'skip' }
  if (r.st !== '草稿') un = await btn('弃审', r.no)
  const d = await btn('删除', r.no)
  if (d.code === 200 || d.code === 0) { ok++; continue }
  const key = `弃审=${un.code}/${(un.message || '').slice(0, 24)} → 删除=${d.code}/${(d.message || '').slice(0, 30)}`
  reasons[key] = (reasons[key] || 0) + 1
}
console.log(`删除成功 ${ok}/${rows.length}`)
for (const [k, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`   ${n} 张: ${k}`)
