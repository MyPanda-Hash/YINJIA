/**
 * _clean-test-probe-docs.mjs — 清理**测试账套**里探针留下的制程检验单(弃审 → 删除)。
 *
 * 背景:几张 CDP/API 探针都会在 HSDZ_MES_TEST 里建单验证,探针自身尽量自清;
 * 早期几轮(2026-10-17 复现「未保存直接审核」时)因为取不到单号,留下 ZC-2026-10-0003..0009 若干张。
 * 本脚本按单号逐个走**业务动作**(弃审 → 删除),不直接改库;已作废/不存在的忽略。
 *
 * 用法:node tools/archive/_qc-proc/_clean-test-probe-docs.mjs [apiBase] [单号...]
 *   缺省 apiBase=http://127.0.0.1:8090,缺省单号 = ZC-2026-10-0003 .. 0009
 */
import crypto from 'node:crypto'

const api = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const nos = process.argv.length > 3
  ? process.argv.slice(3)
  : ['ZC-2026-10-0003', 'ZC-2026-10-0004', 'ZC-2026-10-0005', 'ZC-2026-10-0006', 'ZC-2026-10-0007', 'ZC-2026-10-0008', 'ZC-2026-10-0009']
const SECRET = process.env.YINJIA_JWT_SECRET || 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const h = b64({ alg: 'HS256' })
const b = b64({ sub: 'admin', factory: 'YJ_TEST', iat: now, exp: now + 3600 })   // ⚠ 只动测试账套
const tk = `${h}.${b}.${crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url')}`
const post = async (buttonName, formData) => (await fetch(api + '/px/callButton', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
  body: JSON.stringify({ panelCode: 'QC_PROC_INSP', buttonName, formData, buttonParam: {} }),
})).json()
const state = async (no) => {
  const r = await (await fetch(`${api}/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=${encodeURIComponent(no)}`, { headers: { Authorization: 'Bearer ' + tk } })).json()
  return String(r.data?.data?.['单据状态'] || (r.code === 200 ? '' : '不存在'))
}

for (const no of nos) {
  const before = await state(no)
  if (before === '已审核') await post('弃审', { 编号: no })
  const del = await post('删除', { 编号: no })
  const after = await state(no)
  console.log(`${no}: ${before} → 删除(${del.code}) → ${after}`)
}
