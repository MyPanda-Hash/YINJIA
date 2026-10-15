/**
 * 修正检验数据记录的日期(2026-10-16,正式库,只走 API)
 *
 * 问题(用户第 3 条 + 实测):我建检验数据记录时把 `单据日期` **硬编码成 2026-10-14**,
 *   导致 35 条记录日期 ≠ 对应来料检验单的日期(界面上看着"都是最近的")。
 * 做法:按记录备注里的 `IJ-…` 找回对应检验单日期 → 逐条 `弃审 → 保存(改日期)→ 提交审批 → 审批通过`;
 *   平台软删除(canceled='Y')的记录跳过。
 *
 * 用法: node tools/archive/_fix-insp-rec-dates-1014.mjs [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const DRY = process.argv.includes('--dry')
const BASE = 'http://127.0.0.1:8090'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const rows = (await pool.request().query(`
  SELECT r.单据编号 AS no, CONVERT(varchar(10), r.单据日期, 120) AS old,
         CONVERT(varchar(10), i.单据日期, 120) AS target, i.单据编号 AS ij
  FROM qc_insp_rec r
  JOIN qc_insp i ON i.单据编号 = SUBSTRING(r.备注, CHARINDEX('IJ-', r.备注), 16)
  LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_INSP_REC' AND s.doc_no = r.单据编号
  WHERE r.备注 LIKE N'%IJ-%' AND ISNULL(r.asp_cancel,'N') <> 'Y' AND ISNULL(s.canceled,'N') <> 'Y'
    AND i.单据日期 IS NOT NULL
    AND CONVERT(varchar(10), r.单据日期, 120) <> CONVERT(varchar(10), i.单据日期, 120)`)).recordset
await pool.close()
console.log(`待改检验数据记录 = ${rows.length} 条`)
if (DRY) { rows.slice(0, 5).forEach((r) => console.log(`   ${r.no}: ${r.old} → ${r.target}(检验单 ${r.ij})`)); process.exit(0) }
if (!rows.length) process.exit(0)

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
const post = async (u, b) => (await (await fetch(BASE + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(b || {}),
})).json())
const btn = async (name, fd) => post('/api/px/callButton', { panelCode: 'QC_INSP_REC', buttonName: name, formData: fd, buttonParam: {} })

let ok = 0, fail = []
for (const r of rows) {
  await btn('弃审', { 编号: r.no, 单据编号: r.no })     // 已审核才需要;草稿会报错,无害
  const s = await btn('保存', { 编号: r.no, 单据编号: r.no, 单据日期: r.target })
  if (s.code === 200 || s.code === 0) {
    await btn('提交审批', { 编号: r.no, 单据编号: r.no })
    const a = await btn('审批通过', { 编号: r.no, 单据编号: r.no })
    if (a.code === 200 || a.code === 0) ok++
    else fail.push(`${r.no}:重审失败 ${(a.message || '').slice(0, 30)}`)
  } else fail.push(`${r.no}:保存失败 ${(s.message || '').slice(0, 30)}`)
}
console.log(`改期成功 ${ok}/${rows.length}` + (fail.length ? `\n失败:${fail.slice(0, 5).join(' | ')}` : ''))

// 复核
const pool2 = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const left = (await pool2.request().query(`
  SELECT COUNT(*) AS n FROM qc_insp_rec r JOIN qc_insp i ON i.单据编号 = SUBSTRING(r.备注, CHARINDEX('IJ-', r.备注), 16)
  WHERE r.备注 LIKE N'%IJ-%' AND ISNULL(r.asp_cancel,'N') <> 'Y' AND i.单据日期 IS NOT NULL
    AND CONVERT(varchar(10), r.单据日期, 120) <> CONVERT(varchar(10), i.单据日期, 120)`)).recordset[0].n
await pool2.close()
console.log(`复核:记录日期仍≠检验单日期 = ${left}`)
