/**
 * _report-proc-insp.mjs — 从**运行中的后端**取「制程检验记录表」报表(PDF / XLSX),核对版式是否为纵向表。
 *
 * 用法:node tools/archive/_report-proc-insp.mjs [apiBase] [docNo] [format]
 *   默认 http://127.0.0.1:8090  ZC-2026-10-0001  xlsx;产物写到 tools/archive/_qc-proc/。
 * 免口令:token 自签(与 _mk-token.mjs 同算法)。
 * ⚠ 模板解析 = DB 优先 → classpath 兜底;库内 update_at 变了会重编译 ⇒ 落库即生效,无需重启。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'

const api = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const docNo = process.argv[3] || 'ZC-2026-10-0001'
const format = process.argv[4] || 'xlsx'
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64({ alg: 'HS256' })
const b = b64({ sub: 'admin', factory: process.env.YJ_PROBE_FACTORY || 'YJ', iat: now, exp: now + 3600 })
const token = `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`

const url = `${api}/report/export?code=qc_proc_insp&panelCode=QC_PROC_INSP&docNo=${encodeURIComponent(docNo)}&format=${format}`
const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
const buf = Buffer.from(await res.arrayBuffer())
const out = `tools/archive/_qc-proc/qc_proc_insp-${docNo}-${format}.${format}`
fs.writeFileSync(out, buf)
console.log(`HTTP ${res.status} ${res.headers.get('content-type')} ${res.headers.get('content-disposition') || ''}`)
console.log(`bytes=${buf.length} -> ${out}`)
if (res.status !== 200) console.log(buf.toString('utf8').slice(0, 600))
