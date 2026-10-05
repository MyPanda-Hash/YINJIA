/**
 * _probe-route-status.mjs — 工艺路线「状态=按钮、审批状态=单据状态」验收(2026-10-05)
 * 断言:①表头不再有「状态/审核状态」两个可填字段 ②「单据状态」(引擎派生)在位
 *      ③明细无 审核状态 列 ④审核按钮驱动状态翻转 ⑤弃审按钮还原
 * 用法: node tools/archive/_probe-route-status.mjs [base]
 */
const b = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
let pass = 0, fail = 0, tk = ''
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
async function post(p, body) {
  const r = await fetch(b + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: JSON.stringify(body || {}) })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
async function get(p) {
  const r = await fetch(b + p, { headers: tk ? { Authorization: 'Bearer ' + tk } : {} })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
const docOf = async () => ((await get('/px/getFormDescriptor?panelCode=ROUTE&code=GY-CB-STD')).json?.data) || {}
const stateOf = async () => ((await docOf()).data || {})['单据状态']

async function main() {
  console.log('== 工艺路线:状态按钮化 + 审批状态=单据状态 ==')
  const l = await post('/auth/login', { userName: 'admin', password: '123456' })
  tk = l.json?.data?.token
  if (!tk) { bad('登录失败'); return end() }
  const doc = await docOf()
  const hdr = doc.data || {}
  const cols = (((doc.detail || {}).tabs || [])[0] || {}).fields || []
  const hn = Object.keys(hdr)
  console.log('  表头键: ' + hn.join(','))
  console.log('  按钮组: ' + ((doc.buttonGroups || []).map((g) => g.name + '[' + (g.actions || []).join('/') + ']').join(' ')))
  !hn.includes('状态') ? ok('「状态」已不在表单(改由按钮驱动)') : bad('「状态」仍是表单字段')
  !hn.includes('审核状态') ? ok('「审核状态」字段已移除(不再两套状态)') : bad('「审核状态」仍在')
  hn.includes('单据状态') ? ok('单据状态(引擎派生)在位 = ' + hdr['单据状态']) : bad('描述符没有 单据状态')
  !cols.map((f) => f.dataName).includes('审核状态') ? ok('明细也不带 审核状态 列') : bad('明细仍有 审核状态')
  const btn = (doc.buttonGroups || []).flatMap((g) => g.actions || [])
  btn.includes('审核') && btn.includes('弃审') ? ok('面板带 审核/弃审 按钮(=状态按钮)') : bad('缺 审核/弃审 按钮')

  const before = hdr['单据状态']
  const au = await post('/px/callButton', { panelCode: 'ROUTE', buttonName: '审核', formData: { 编号: 'GY-CB-STD' }, buttonParam: {} })
  if (au.status !== 200) { bad('审核按钮调用失败: ' + String(au.json?.message || au.text).slice(0, 120)); return end() }
  const mid = await stateOf()
  mid && mid !== before ? ok('审核按钮驱动状态: ' + before + ' → ' + mid) : bad('审核后状态未变: ' + mid)
  const un = await post('/px/callButton', { panelCode: 'ROUTE', buttonName: '弃审', formData: { 编号: 'GY-CB-STD' }, buttonParam: {} })
  if (un.status !== 200) { bad('弃审按钮调用失败: ' + String(un.json?.message || un.text).slice(0, 120)); return end() }
  const after = await stateOf()
  after === before ? ok('弃审按钮还原状态: ' + after) : bad('弃审后状态 = ' + after + '(期望 ' + before + ')')
  return end()
}
function end() { console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`); process.exit(fail ? 1 : 0) }
main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })