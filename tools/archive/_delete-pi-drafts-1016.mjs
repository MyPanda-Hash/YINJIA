/**
 * 删除「流转产生的采购入库单草稿」(2026-10-16,正式库,只走 API)
 *
 * 用户口径:「删除采购入库单的草稿单据,这些都是检验单审批流转过来的,和我们下拉金蝶重复了」。
 *   金蝶同步下来的 313 张采购入库单(落库人=试运行)已审核;而送料暂收单/来料检验单
 *   生单产生的采购入库单是**草稿**,内容与金蝶那批重复 ⇒ 删草稿。
 * 安全:只删**派生状态=草稿**(工作流口径)且**来源单据**属于流转链(送料暂收单/来料检验单/暂收退回单)的单;
 *   已审核的一律不动;删前把单号+来源备份成 TSV。
 *
 * 用法: node tools/archive/_delete-pi-drafts-1016.mjs [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')
const BASE = 'http://127.0.0.1:8090'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 采购入库单 按「来源单据 × 派生状态」分布 ===')
for (const r of await q(`
  SELECT ISNULL(h.来源单据,N'(空)') AS 来源, CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核'
         WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END AS 派生状态, COUNT(*) AS n
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  GROUP BY ISNULL(h.来源单据,N'(空)'), CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核'
         WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END
  ORDER BY 来源, 派生状态`)) console.log('   ' + JSON.stringify(r))

const targets = await q(`
  SELECT h.单据编号 AS no, ISNULL(h.来源单据,N'') AS src, ISNULL(h.来源单号,N'') AS srcNo
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.来源单据,N'') IN (N'送料暂收单', N'来料检验单', N'暂收退回单')
    AND ISNULL(s.shr,'') = '' AND ISNULL(s.pending,'N') <> 'Y'
    AND ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'`)
console.log(`\n待删除(流转产生 + 草稿)= ${targets.length} 张`)
if (DRY) { targets.slice(0, 5).forEach((t) => console.log(`   ${t.no} ← ${t.src} ${t.srcNo}`)); process.exit(0) }
if (!targets.length) process.exit(0)

writeFileSync(new URL('./_dump-out/pi-drafts-deleted-1016.tsv', import.meta.url),
  '单据编号\t来源单据\t来源单号\r\n' + targets.map((t) => `${t.no}\t${t.src}\t${t.srcNo}`).join('\r\n'), 'utf8')

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
let ok = 0, fail = []
for (const t of targets) {
  const r = await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: '删除', formData: { 编号: t.no, 单据编号: t.no }, buttonParam: {} }),
  })).json()
  if (r.code === 200 || r.code === 0) ok++; else fail.push(`${t.no}:${(r.message || '').slice(0, 30)}`)
}
console.log(`删除成功 ${ok}/${targets.length}` + (fail.length ? `\n失败样例: ${fail.slice(0, 5).join(' | ')}` : ''))

const left = (await pool.request().query(`
  SELECT COUNT(*) AS n FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.来源单据,N'') IN (N'送料暂收单', N'来料检验单', N'暂收退回单')
    AND ISNULL(s.shr,'') = '' AND ISNULL(s.pending,'N') <> 'Y' AND ISNULL(h.asp_cancel,'N') <> 'Y'`)).recordset[0].n
await pool.close()
console.log(`复核:仍残留(未审核且来源为流转链,含界面已删)= ${left}`)
console.log('[备份] tools/archive/_dump-out/pi-drafts-deleted-1016.tsv')
