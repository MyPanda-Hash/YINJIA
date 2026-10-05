/**
 * _probe-route-status-switch.mjs — 工艺路线「状态=是否开关、审核状态在明细」验收(2026-10-05)
 * 修正口径:上文的"按钮"= 是否连续委外那种**开关**;状态字段保留;审核状态登记在**明细**。
 * 用法: node tools/archive/_probe-route-status-switch.mjs [base]
 */
const b = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
let pass = 0, fail = 0, tk = ''
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
async function call(p, body, method) {
  const r = await fetch(b + p, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
async function main() {
  console.log('== 工艺路线:状态=是否开关 + 审核状态(明细) ==')
  const l = await call('/auth/login', { userName: 'admin', password: '123456' })
  tk = l.json?.data?.token
  if (!tk) { bad('登录失败'); return end() }
  const doc = (await call('/px/getFormDescriptor?panelCode=ROUTE&code=GY-CB-STD')).json?.data || {}
  const hdr = doc.data || {}
  const cols = (((doc.detail || {}).tabs || [])[0] || {}).fields || []
  const meta = doc.meta || []
  const find = (k) => meta.find((m) => m.code === k) || {}
  console.log('  表头键: ' + Object.keys(hdr).join(','))
  console.log('  状态 字段元数据: ' + JSON.stringify(find('状态')))
  console.log('  明细列: ' + cols.map((f) => f.dataName).join(','))

  const st = find('状态')
  st.dataType === '是否' ? ok('「状态」控件 = 是否开关(与 是否连续委外 同款)') : bad('「状态」dataType = ' + st.dataType)
  Object.keys(hdr).includes('状态') ? ok('「状态」已回到表单(值 = ' + hdr['状态'] + ')') : bad('「状态」不在表头')
  const sh = find('是否连续委外')
  st.dataType === sh.dataType ? ok('与 是否连续委外 控件类型一致(' + sh.dataType + ')') : bad('与 是否连续委外 不一致')
  const cn = cols.map((f) => f.dataName)
  cn.includes('审核状态') ? ok('「审核状态」已在明细列') : bad('明细缺 审核状态')
  const items = Array.isArray(doc.detailData) ? doc.detailData : (doc.detailData?.items || [])
  items.length && items[0]['审核状态'] !== undefined ? ok('明细行带出 审核状态 = ' + items[0]['审核状态']) : bad('明细行没有 审核状态 值')
  hdr['单据状态'] ? ok('引擎单据状态仍在(单据状态 = ' + hdr['单据状态'] + ')') : bad('单据状态丢失')
  return end()
}
function end() { console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`); process.exit(fail ? 1 : 0) }
main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })