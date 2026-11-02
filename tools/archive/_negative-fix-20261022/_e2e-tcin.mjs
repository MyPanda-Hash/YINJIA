/**
 * 端到端实测:特采链的入库数量口径
 *   审核检验单 → 退料单(不合格) + 采购入库单(合格) → 审核退料单 → 特采单 → 两级审批 → 采购入库单(特采?)
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
  if (!(j.code === 0 || j.code === 200)) throw new Error(`登录失败 ${user}: ${JSON.stringify(j).slice(0, 300)}`)
  return j.data.token
}
const client = (token) => async (panelCode, buttonName, formData = {}) => {
  const r = await fetch(`${API}/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, buttonName, formData }),
  })
  return r.json()
}

const admin = client(await login('admin', '123456'))

// ── 选一张未审、合格>0、不合格>0 的检验单 ──
const cands = await q(`SELECT TOP 3 d.单据编号, d.物料编码, CAST(d.合格数量 AS decimal(18,2)) 合格,
                              CAST(IFNULL_不合格 AS decimal(18,2)) 不合格
                         FROM (SELECT 单据编号, 物料编码, 合格数量, ISNULL(不合格数量,0) AS IFNULL_不合格 FROM qc_insp_detail
                                WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(合格数量,0)>0 AND ISNULL(不合格数量,0)>0) d
                        WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND s.doc_no=d.单据编号 AND s.shr IS NOT NULL)
                          AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND s.doc_no=d.单据编号 AND s.canceled='Y')
                        ORDER BY d.单据编号 DESC`)
console.log('候选检验单:', JSON.stringify(cands))
if (!cands.length) { console.error('测试库没有可用的未审检验单'); await pool.close(); process.exit(1) }
const inspNo = cands[0].单据编号
console.log(`\n选用检验单 ${inspNo} · 物料 ${cands[0].物料编码} · 合格 ${cands[0].合格} / 不合格 ${cands[0].不合格}\n`)

// ── ① 审核检验单 ──
console.log('① 审核检验单 …')
const r1 = await admin('QC_INSP', '审核', { 单据编号: inspNo })
console.log('   ', JSON.stringify(r1).slice(0, 300))

// 看生成了什么
const links = await q(`SELECT source_panel_code src, target_panel_code tgt, target_form_no no, link_status
                         FROM form_flow_link WHERE source_form_no='${inspNo}' ORDER BY id`)
console.log('   生成的链路:')
for (const l of links) console.log('     ' + JSON.stringify(l))

const newDocs = {}
for (const l of links) {
  newDocs[l.tgt] = l.no
  if (l.tgt === 'PURCHASE_IN' || l.tgt === 'QC_RETURN') {
    const tbl = l.tgt === 'PURCHASE_IN' ? 'bl_purchase_in' : 'qc_return_detail'
    const col = l.tgt === 'PURCHASE_IN' ? '实收数量' : '退货数量'
    const d = await q(`SELECT 单据编号, ${tbl === 'bl_purchase_in' ? '存货编码' : '物料编码'} 物料, CAST(${col} AS decimal(18,2)) 数量,
                              ${tbl === 'bl_purchase_in' ? 'ISNULL(特采,\'(null)\') 特采' : 'ISNULL(特采,0) 特采'}
                         FROM ${tbl} WHERE 单据编号='${l.no}'`)
    console.log(`     ${l.tgt} ${l.no} → ${JSON.stringify(d)}`)
  }
}

await pool.close()
