/**
 * 这一批单据的「日期对齐来源单」(2026-10-14,正式库,只走 API)
 *
 * 用户口径:「只是这次与单据日期一致,采用当天这个逻辑不要修改到,后面程序还是按照这个来」
 *   ⇒ **不改代码**,只把已生成的这一批单据的单据日期改成来源单日期。
 *
 * 已验证的路线(单号不变):
 *   弃审(code=200) → 保存(单据日期=来源日期;不传 items 时**原有明细保留**,实测 2 行未丢)
 *   → 提交审批 → 审批通过
 *
 * 对齐口径:
 *   送料暂收单 ← 采购订单(`sl_recv.采购订单号` → `bd_pu_order.单据日期`)
 *   来料检验单 ← 送料暂收单(`qc_insp.暂收单号` → `sl_recv.单据日期`,即采购订单日期)
 *   检验数据记录 ← 检验单(备注里记的 `按检验单 IJ-…`)
 *   生产工单 ← 销售订单(**面板保存改不动 plang.pl_date,已实测无效**,见报告)
 *
 * 用法: node tools/archive/_align-doc-dates-1014.mjs [--base http://127.0.0.1:8090] [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const BASE = arg('base', 'http://127.0.0.1:8090')
const DRY = argv.includes('--dry')

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset
// ⚠ 必须只改**这一批**(今天由本会话生成):否则会把平台历史单据一起改期
//   (dry-run 实测:不过滤会命中 303 张,含 SL-2026-09-0169 这类历史单,日期甚至映射到 2025-04-16)
const TODAY = "CONVERT(varchar(10), h.asp_time1, 120) = '2026-10-14'"
const sl = await q(`SELECT h.单据编号 AS no, CONVERT(varchar(10), o.单据日期, 120) AS d
  FROM sl_recv h JOIN bd_pu_order o ON o.单据编号 = h.采购订单号
  WHERE h.采购订单号 IS NOT NULL AND h.采购订单号 <> N'' AND ${TODAY}
    AND CONVERT(varchar(10), h.单据日期, 120) <> CONVERT(varchar(10), o.单据日期, 120)`)
const ij = await q(`SELECT i.单据编号 AS no, CONVERT(varchar(10), s.单据日期, 120) AS d
  FROM qc_insp i JOIN sl_recv s ON s.单据编号 = i.暂收单号
  WHERE i.暂收单号 IS NOT NULL AND i.暂收单号 <> N'' AND CONVERT(varchar(10), i.asp_time1, 120) = '2026-10-14'
    AND CONVERT(varchar(10), i.单据日期, 120) <> CONVERT(varchar(10), s.单据日期, 120)`)
const rec = await q(`SELECT r.单据编号 AS no, CONVERT(varchar(10), i.单据日期, 120) AS d
  FROM qc_insp_rec r JOIN qc_insp i ON i.单据编号 = SUBSTRING(r.备注, CHARINDEX('IJ-', r.备注), 16)
  WHERE r.备注 LIKE N'%IJ-%' AND CONVERT(varchar(10), r.asp_time1, 120) = '2026-10-14'
    AND CONVERT(varchar(10), r.单据日期, 120) <> CONVERT(varchar(10), i.单据日期, 120)`)
// 重复头:有头无明细的检验数据记录(清理用)
const dup = await q(`SELECT 单据编号 AS no FROM qc_insp_rec r
  WHERE r.备注 LIKE N'历史回填%' AND NOT EXISTS (SELECT 1 FROM qc_insp_rec_detail d WHERE d.单据编号 = r.单据编号)`)
await pool.close()
console.log(`待改期:暂收单 ${sl.length} / 检验单 ${ij.length} / 检验记录 ${rec.length};待清理空记录 ${dup.length}`)

if (DRY) { for (const x of sl.slice(0, 5)) console.log(`  SL ${x.no} → ${x.d}`); process.exit(0) }

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
const post = async (u, b) => (await (await fetch(BASE + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(b || {}),
})).json())
/** ⚠ 第三个参数必须是**完整 formData 对象**;早先写成"只接受字符串单号"的版本把对象当成单号塞进
 *  {编号: <对象>} ⇒ 平台定位不到单据、**什么都不存**(asp_user2 全空),却一路 success —— 实测踩到。 */
const btn = async (p, name, fd) => post('/api/px/callButton', {
  panelCode: p, buttonName: name,
  formData: typeof fd === 'string' ? { 编号: fd, 单据编号: fd } : fd,
  buttonParam: {},
})

const out = []
const fix = async (panel, rows) => {
  let ok = 0, bad = 0
  for (const r of rows) {
    await btn(panel, '弃审', r.no)                                     // 已审核才需要;失败无害
    // ⚠ 表单键必须是 编号/单据编号(平台按它定位单据);写成 no/d 会**定位不到单据**、
    //   表面返回 success 但日期根本没改(实测踩到:112 张全没生效)
    const s = await btn(panel, '保存', { 编号: r.no, 单据编号: r.no, 单据日期: r.d })
    let st = '保存失败:' + (s.message || '')
    if (s.code === 200 || s.code === 0) {
      await btn(panel, '提交审批', r.no)
      const a = await btn(panel, '审批通过', r.no)
      st = (a.code === 200 || a.code === 0) ? '已改期并重审' : '改期成功但重审失败:' + (a.message || '')
    }
    if (st === '已改期并重审') ok++; else { bad++; out.push({ panel, no: r.no, err: st }) }
  }
  return { ok, bad }
}
console.log('改送料暂收单…'); const r1 = await fix('QC_RECV', sl)
console.log('改来料检验单…'); const r2 = await fix('QC_INSP', ij)
console.log('改检验数据记录…'); const r3 = await fix('QC_INSP_REC', rec)
// 清理:有头无明细的重复记录(先弃审再删除)
let delOk = 0
for (const d of dup) {
  await btn('QC_INSP_REC', '弃审', d.no)
  const r = await post('/api/px/deleteForms', { panelCode: 'QC_INSP_REC', ids: [d.no], formData: { 编号: d.no } })
  if (r.code === 200 || r.code === 0) delOk++
}
console.log(`\n暂收单 ${r1.ok}/${sl.length};检验单 ${r2.ok}/${ij.length};检验记录 ${r3.ok}/${rec.length};清理空记录 ${delOk}/${dup.length}`)
mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/align-doc-dates-1014.md', import.meta.url),
  [`# 单据日期对齐来源单(正式库,只走 API)`, '', `- 时间:${new Date().toISOString()}`,
    `- 送料暂收单 ${r1.ok}/${sl.length};来料检验单 ${r2.ok}/${ij.length};检验数据记录 ${r3.ok}/${rec.length};清理空记录 ${delOk}/${dup.length}`,
    '', '## 失败明细', '', ...(out.length ? out.map((x) => `- ${x.panel} ${x.no}: ${x.err}`) : ['(无)'])].join('\n'), 'utf8')
console.log('[产物] tools/archive/_dump-out/align-doc-dates-1014.md')
