/**
 * 修复后实测:同一条链再走一遍,验证「特采入库 = 不合格数量」
 * 用新的未审检验单,完整走 检验审核 → 退料审核 → 特采两级审批。
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

async function login(user, pwd) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: pwd, factory: FACTORY }),
  })
  const j = await r.json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(`登录失败: ${JSON.stringify(j).slice(0, 300)}`)
  return j.data.token
}
const tok = await login('admin', '123456')
const cb = async (panel, button, formData = {}) => {
  const r = await fetch(`${API}/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + tok },
    body: JSON.stringify({ panelCode: panel, buttonName: button, formData, buttonParam: {} }),
  })
  return r.json()
}

// 选一张干净的未审检验单:合格>0、不合格>0、且没有下游
const cands = await q(`
  SELECT TOP 5 d.单据编号, d.物料编码, CAST(d.合格数量 AS decimal(18,2)) 合格,
         CAST(d.不合格数量 AS decimal(18,2)) 不合格, CAST(d.送检数量 AS decimal(18,2)) 送检
    FROM qc_insp_detail d
   WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.合格数量,0)>0 AND ISNULL(d.不合格数量,0)>0
     AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND s.doc_no=d.单据编号 AND ISNULL(s.shr,'')<>'')
     AND NOT EXISTS (SELECT 1 FROM form_flow_link f WHERE f.source_form_no=d.单据编号)
   ORDER BY d.单据编号 DESC`)
if (!cands.length) { console.error('没有可用的未审检验单'); await pool.close(); process.exit(1) }
const c = cands[0]
console.log(`\n检验单 ${c.单据编号} · ${c.物料编码} · 送检 ${c.送检} / 合格 ${c.合格} / 不合格 ${c.不合格}`)
console.log(`期望: 合格品入库 = ${c.合格}, 特采入库 = ${c.不合格}, 合计 = ${c.送检}\n`)

console.log('① 审核检验单 …')
console.log('   ', JSON.stringify(await cb('QC_INSP', '审核', { 编号: c.单据编号 })).slice(0, 200))

const links1 = await q(`SELECT target_panel_code tgt, target_form_no no FROM form_flow_link WHERE source_form_no='${c.单据编号}' ORDER BY id`)
let piPass = null, retNo = null
for (const l of links1) {
  console.log(`   → ${l.tgt} ${l.no}`)
  if (l.tgt === 'PURCHASE_IN') piPass = l.no
  if (l.tgt === 'QC_RETURN') retNo = l.no
}
if (piPass) for (const r of await q(`SELECT 单据编号, CAST(实收数量 AS decimal(18,2)) 实收, ISNULL(特采,'(null)') 特采 FROM bl_purchase_in WHERE 单据编号='${piPass}'`))
  console.log(`   合格品入库 ${JSON.stringify(r)}`)

if (retNo) {
  console.log(`\n② 审核退料单 ${retNo} …`)
  console.log('   ', JSON.stringify(await cb('QC_RETURN', '审核', { 编号: retNo })).slice(0, 200))
}

const tc = (await q(`SELECT TOP 1 单据编号, 总数量, 不合格品数量 FROM qc_tc_in WHERE 检验单号='${c.单据编号}' ORDER BY id DESC`))[0]
if (!tc) { console.error('未生成特采单'); await pool.close(); process.exit(1) }
console.log(`\n③ 特采单 ${tc.单据编号} · 总数量=${tc.总数量}(送检口径,应不变) · 不合格品数量=${tc.不合格品数量}`)
console.log('   ', JSON.stringify(await cb('QC_TC_IN', '提交审批', { 编号: tc.单据编号 })).slice(0, 160))
console.log('   ', JSON.stringify(await cb('QC_TC_IN', '审批通过', { 编号: tc.单据编号 })).slice(0, 160))
console.log('   ', JSON.stringify(await cb('QC_TC_IN', '审批通过', { 编号: tc.单据编号 })).slice(0, 160))

console.log('\n④ 结果核对')
const tcPi = await q(`SELECT target_form_no no FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no='${tc.单据编号}'`)
let piTc = tcPi[0]?.no
for (const r of await q(`SELECT 单据编号, 存货编码, CAST(实收数量 AS decimal(18,2)) 实收, ISNULL(特采,'(null)') 特采 FROM bl_purchase_in
                          WHERE 单据编号 IN ('${piPass}', '${piTc}')`))
  console.log('   ' + JSON.stringify(r))

// 断言
const passQty = piPass ? Number((await q(`SELECT CAST(实收数量 AS decimal(18,2)) q FROM bl_purchase_in WHERE 单据编号='${piPass}'`))[0].q) : 0
const tcQty = piTc ? Number((await q(`SELECT CAST(实收数量 AS decimal(18,2)) q FROM bl_purchase_in WHERE 单据编号='${piTc}'`))[0].q) : 0
console.log(`\n   合格品入库 = ${passQty} ${passQty === Number(c.合格) ? '✔' : '✘(应 ' + c.合格 + ')'}`)
console.log(`   特采入库   = ${tcQty} ${tcQty === Number(c.不合格) ? '✔' : '✘(应 ' + c.不合格 + ')'}`)
console.log(`   合计       = ${passQty + tcQty} ${passQty + tcQty === Number(c.送检) ? '✔ 等于送检数量' : '✘(应 ' + c.送检 + ')'}`)
await pool.close()
