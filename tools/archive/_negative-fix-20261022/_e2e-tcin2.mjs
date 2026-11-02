/**
 * 端到端实测(续):退料单 → 特采单 → 两级审批 → 采购入库单,核对入库数量
 * 用上一步 IJ-2026-10-0099 生成的单据继续走。
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'
const INSP = 'IJ-2026-10-0099'
const PI_QTY = 'PI-2026-10-0090'   // 合格品入库 60
const RETURN_NO = 'TH-2026-10-0044' // 不合格 40

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

async function login(user, pwd) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: pwd, factory: FACTORY }),
  })
  const j = await r.json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(`登录失败 ${user}: ${JSON.stringify(j).slice(0, 300)}`)
  return { token: j.data.token }
}
const mk = (sess) => async (panel, button, formData = {}) => {
  const r = await fetch(`${API}/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + sess.token },
    body: JSON.stringify({ panelCode: panel, buttonName: button, formData, buttonParam: {} }),
  })
  return r.json()
}
const adminS = await login('admin', '123456')
const admin = mk(adminS)

const dump = (label, j) => console.log(`   ${label}: ${JSON.stringify(j).slice(0, 260)}`)

// ── ② 审核退料单 ──
console.log(`\n② 审核暂收退料单 ${RETURN_NO} …`)
dump('返回', await admin('QC_RETURN', '审核', { 单据编号: RETURN_NO }))

// 退料单审核后应自动生成特采单
const tcs = await q(`SELECT source_panel_code src, source_line_key, target_form_no no, link_status
                       FROM form_flow_link WHERE source_form_no='${RETURN_NO}' OR target_form_no='${RETURN_NO}'`).catch(() => [])
for (const t of tcs) console.log('   ' + JSON.stringify(t))
const tcNo = (await q(`SELECT TOP 1 单据编号 FROM qc_tc_in WHERE 暂收退料单号='${RETURN_NO}' ORDER BY id DESC`))[0]?.单据编号
console.log(`   生成的特采单: ${tcNo || '(没有)'}`)
if (tcNo) {
  for (const t of await q(`SELECT 单据编号, 产品名称, 总数量, 不合格品数量, 不合格品比例, 检验单号, 暂收退料单号 FROM qc_tc_in WHERE 单据编号='${tcNo}'`))
    console.log('   ' + JSON.stringify(t))
}

// ── ③ 特采单两级审批 ──
if (tcNo) {
  console.log(`\n③ 特采单 ${tcNo} 两级审批 …`)
  dump('提交审批', await admin('QC_TC_IN', '提交审批', { 单据编号: tcNo }))
  dump('审批通过(一级)', await admin('QC_TC_IN', '审批通过', { 单据编号: tcNo }))
  dump('审批通过(二级/批准)', await admin('QC_TC_IN', '审批通过', { 单据编号: tcNo }))

  // ── ④ 核对特采生成的入库单 ──
  console.log('\n④ 特采链生成的采购入库单')
  const tclink = await q(`SELECT target_form_no no, link_status FROM form_flow_link
                           WHERE source_panel_code='QC_TC_IN' AND source_form_no='${tcNo}'`)
  for (const l of tclink) console.log('   ' + JSON.stringify(l))
  for (const l of tclink) {
    for (const r of await q(`SELECT 单据编号, 存货编码, 存货名称, CAST(实收数量 AS decimal(18,2)) 实收, ISNULL(特采,'(null)') 特采
                               FROM bl_purchase_in WHERE 单据编号='${l.no}'`))
      console.log('   入库行: ' + JSON.stringify(r))
  }

  // ── ⑤ 该物料本轮全部入库与实际库存流水 ──
  console.log('\n⑤ 检验单 ' + INSP + ' 相关的全部入库单')
  for (const r of await q(`SELECT l.单据编号, CAST(l.实收数量 AS decimal(18,2)) 实收, ISNULL(l.特采,'(null)') 特采,
                                  ISNULL(s.shr,'(未审)') 审核, ISNULL(s.canceled,'N') 作废
                             FROM bl_purchase_in l
                             LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=l.单据编号
                            WHERE l.单据编号 IN ('${PI_QTY}', ${tclink.map((x) => `'${x.no}'`).join(',') || "''"})`))
    console.log('   ' + JSON.stringify(r))
}
await pool.close()
