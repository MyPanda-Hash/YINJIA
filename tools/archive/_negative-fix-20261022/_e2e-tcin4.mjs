/** 退料单(已勾特采)重走审核 → 生成特采单 → 两级审批 → 核对特采入库数量 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const API = 'http://127.0.0.1:8090/api'
const RET = process.argv[2] || 'TH-2026-10-0049'
const INSP = 'IJ-2026-10-TEST01'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const lr = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) })
const tok = (await lr.json()).data.token
const cb = async (panel, button, formData = {}) => (await (await fetch(`${API}/px/callButton`, {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + tok },
  body: JSON.stringify({ panelCode: panel, buttonName: button, formData, buttonParam: {} }),
})).json())

console.log(`退料单 ${RET} 弃审 → 再审核(此时行已勾特采)`)
console.log('   弃审:', JSON.stringify(await cb('QC_RETURN', '弃审', { 编号: RET })).slice(0, 160))
console.log('   审核:', JSON.stringify(await cb('QC_RETURN', '审核', { 编号: RET })).slice(0, 160))

const tc = (await q(`SELECT TOP 1 单据编号, 总数量, 不合格品数量, 不合格品比例 FROM qc_tc_in WHERE 检验单号='${INSP}' ORDER BY id DESC`))[0]
if (!tc) { console.log('仍无特采单'); await pool.close(); process.exit(1) }
console.log(`\n特采单 ${tc.单据编号} · 总数量=${tc.总数量} · 不合格品数量=${tc.不合格品数量} · 比例=${tc.不合格品比例}`)

console.log('\n特采单两级审批:')
console.log('   提交:', JSON.stringify(await cb('QC_TC_IN', '提交审批', { 编号: tc.单据编号 })).slice(0, 160))
console.log('   一级:', JSON.stringify(await cb('QC_TC_IN', '审批通过', { 编号: tc.单据编号 })).slice(0, 160))
console.log('   二级:', JSON.stringify(await cb('QC_TC_IN', '审批通过', { 编号: tc.单据编号 })).slice(0, 160))

console.log('\n=== 结果 ===')
const links = await q(`SELECT source_panel_code src, source_form_no no, target_panel_code tgt, target_form_no tno, linked_quantity
                         FROM form_flow_link WHERE source_form_no='${INSP}' OR source_form_no='${RET}' OR source_form_no='${tc.单据编号}' ORDER BY id`)
for (const l of links) console.log(`   ${l.src} ${l.no} → ${l.tgt} ${l.tno} (linked=${l.linked_quantity})`)

const pis = await q(`SELECT l.单据编号, CAST(l.实收数量 AS decimal(18,2)) 实收, ISNULL(l.特采,'(null)') 特采
                       FROM bl_purchase_in l
                      WHERE l.单据编号 IN (SELECT target_form_no FROM form_flow_link WHERE source_form_no IN ('${INSP}','${tc.单据编号}') AND target_panel_code='PURCHASE_IN')`)
let pass = 0, tcq = 0
for (const r of pis) { console.log('   入库单: ' + JSON.stringify(r)); if (r.特采 === '是') tcq = Number(r.实收); else pass = Number(r.实收) }
console.log(`\n   检验: 送检 100 / 合格 60 / 不合格 40`)
console.log(`   合格品入库 = ${pass} ${pass === 60 ? '✔' : '✘'}`)
console.log(`   特采入库   = ${tcq} ${tcq === 40 ? '✔ 已修好' : '✘ 应 40'}`)
console.log(`   合计       = ${pass + tcq} ${pass + tcq === 100 ? '✔ 等于送检' : '✘'}`)
const det = await q(`SELECT ISNULL(入库单号,'(空)') 入库单号 FROM qc_insp_detail WHERE 单据编号='${INSP}'`)
console.log(`   检验行「入库单号」= ${det[0].入库单号}(应保留合格品那张,不被特采顶掉)`)
await pool.close()
