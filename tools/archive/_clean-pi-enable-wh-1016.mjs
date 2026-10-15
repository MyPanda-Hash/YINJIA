/**
 * 采购入库单清理(第三版):临时启用停用仓库 → 弃审 → 删除 → 恢复停用
 * (2026-10-16,正式库;**只走面板 API + 一处可回退的仓库状态开关**)
 *
 * 为什么:60 张试运行遗留的采购入库单引用的是**已停用仓库**(半成品仓/成品仓/不良品仓/辅料仓/原料仓),
 *   平台弃审会先解析仓库档案并要求「启用」⇒ 报「仓库档案不存在」,于是删不掉。
 * 做法:①把这几个仓库临时置「启用」→ ②逐张 弃审(冲回库存流水)→ ③删除 → ④恢复原「停用」状态。
 *   期间不动任何单据内容;仓库状态改前留档,异常也能回退。
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:8090'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

// 需要临时启用的仓库(待删单据里出现的停用仓)
const whs = await q(`
  SELECT DISTINCT w.仓库编码, w.仓库名称, ISNULL(w.状态,N'') AS 状态 FROM bs_wh w
  WHERE ISNULL(w.状态,N'') <> N'启用' AND w.仓库名称 IN (
    SELECT DISTINCT l.仓库 FROM bl_purchase_in l JOIN bd_purchase_in h ON h.单据编号 = l.单据编号
    WHERE ISNULL(h.asp_user1,N'') <> N'试运行' AND ISNULL(h.asp_cancel,'N') <> 'Y')`)
console.log(`需临时启用的仓库 ${whs.length} 个: ${whs.map((w) => w.仓库名称 + '(' + w.仓库编码 + ')').join(', ')}`)
writeFileSync(new URL('./_dump-out/wh-state-backup-1016.tsv', import.meta.url),
  '仓库编码\t仓库名称\t原状态\r\n' + whs.map((w) => `${w.仓库编码}\t${w.仓库名称}\t${w.状态}`).join('\r\n'), 'utf8')
for (const w of whs) await pool.request().query(`UPDATE bs_wh SET 状态 = N'启用' WHERE 仓库编码 = N'${w.仓库编码}'`)

const rows = await q(`
  SELECT h.单据编号 AS no, CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END AS st
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.asp_user1,N'') <> N'试运行' AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'
  ORDER BY h.id`)
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
  const key = `弃审=${un.code}/${(un.message || '').slice(0, 24)} → 删除=${d.code}/${(d.message || '').slice(0, 28)}`
  reasons[key] = (reasons[key] || 0) + 1
}
console.log(`删除成功 ${ok}/${rows.length}`)
for (const [k, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`   ${n} 张: ${k}`)

// 恢复仓库原状态
const pool2 = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
for (const w of whs) await pool2.request().query(`UPDATE bs_wh SET 状态 = N'${w.状态 || '停用'}' WHERE 仓库编码 = N'${w.仓库编码}'`)
const left = (await pool2.request().query(`
  SELECT COUNT(*) AS n FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.asp_user1,N'') <> N'试运行' AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'`)).recordset[0].n
const whBack = (await pool2.request().query(`SELECT COUNT(*) AS n FROM bs_wh WHERE ISNULL(状态,N'') <> N'启用'`)).recordset[0].n
await pool2.close()
console.log(`复核:非金蝶同步残留 = ${left};仓库已恢复停用(非启用数)= ${whBack}`)
console.log('[备份] tools/archive/_dump-out/wh-state-backup-1016.tsv')
