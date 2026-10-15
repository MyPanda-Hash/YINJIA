/**
 * _api-approval-history.mjs — 只读查一张单据的「审批情况/审核记录」(`yj_form_approval` 全留痕)。
 * 用法:node tools/archive/_qc-proc/_api-approval-history.mjs [apiBase] [面板] [单号]
 *   缺省 http://127.0.0.1:8090 QC_PROC_INSP ZC-2026-10-0026(正式账套,只读)
 * 免口令:token 自签;factory 由 YJ_PROBE_FACTORY 决定(缺省 YJ 正式库,只读)。
 */
import crypto from 'node:crypto'
const api = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const panel = process.argv[3] || 'QC_PROC_INSP'
const docNo = process.argv[4] || 'ZC-2026-10-0026'
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64({ alg: 'HS256' })
const b = b64({ sub: 'admin', factory: process.env.YJ_PROBE_FACTORY || 'YJ', iat: now, exp: now + 3600 })
const tk = `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`
const r = await (await fetch(`${api}/px/getApprovalHistory?panelCode=${encodeURIComponent(panel)}&code=${encodeURIComponent(docNo)}`, { headers: { Authorization: 'Bearer ' + tk } })).json()
const recs = (Array.isArray(r) ? r : r.data) || []
console.log(`${panel} / ${docNo}: ${recs.length} 条审批记录`)
for (const x of recs) console.log(`  #${x.nodeNo} ${x.action} ${x.result} ${x.operator} ${x.createTime}  ${x.opinion || ''}`)
