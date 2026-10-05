/**
 * _probe-route-status-audit-sync.mjs — 工艺路线「状态=开关、审核状态=单据状态联动」验收(2026-10-05)
 * 断言(全部走 8090 真实接口):
 *   ①配置:状态 dataType=是否(前端 el-switch)、审核状态 readonly=true(只读,不可与单据状态打架);
 *   ②值:状态=Y(默认开);审核前 审核状态=未审核 与 单据状态=草稿 一致;
 *   ③点「审核」→ 审核状态与单据状态同时=已审核;④点「弃审」→ 两者同时退回。
 * 用法: node tools/archive/_probe-route-status-audit-sync.mjs [base]
 */
const b = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const CODE = 'GY-CB-STD'
let pass = 0, fail = 0, tk = ''
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
async function call(p, body) {
  const r = await fetch(b + p, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
const specOf = async (name) => {
  const cfg = (await call('/px/getPanelConfig?panelCode=ROUTE')).json?.data || {}
  const fields = (cfg.dataSchema || {}).fields || []
  return fields.find((f) => f.dataName === name) || {}
}
const snap = async () => {
  const d = (await call('/px/getFormDescriptor?panelCode=ROUTE&code=' + CODE)).json?.data || {}
  return d.data || {}
}
async function main() {
  console.log('== 工艺路线:状态开关 + 审核状态联动 ==')
  const l = await call('/auth/login', { userName: 'admin', password: '123456' })
  tk = l.json?.data?.token
  if (!tk) { bad('登录失败'); return end() }
  const sState = await specOf('状态'), sAudit = await specOf('审核状态')
  console.log('  状态 配置: ' + JSON.stringify(sState))
  console.log('  审核状态 配置: ' + JSON.stringify(sAudit))
  sState.dataType === '是否' ? ok('「状态」= 是否开关(前端渲染 el-switch,同 是否连续委外)') : bad('状态 dataType=' + sState.dataType)
  sAudit.readonly === true ? ok('「审核状态」只读(readonly=true,不可手工改)') : bad('审核状态 readonly=' + sAudit.readonly)

  const h0 = await snap()
  console.log('  审核前: 状态=' + h0['状态'] + ' 审核状态=' + h0['审核状态'] + ' 单据状态=' + h0['单据状态'])
  h0['状态'] === 'Y' ? ok('状态值 = Y(开,默认)') : bad('状态值 = ' + h0['状态'])
  h0['审核状态'] === '未审核' && h0['单据状态'] === '草稿' ? ok('审核前一致:未审核 / 草稿')
    : bad('审核前不一致: ' + h0['审核状态'] + ' vs ' + h0['单据状态'])

  const au = await call('/px/callButton', { panelCode: 'ROUTE', buttonName: '审核', formData: { 编号: CODE }, buttonParam: {} })
  if (au.status !== 200) { bad('审核失败: ' + String(au.json?.message || au.text).slice(0, 120)); return end() }
  const h1 = await snap()
  h1['审核状态'] === '已审核' && h1['单据状态'] === '已审核' ? ok('审核后同步:已审核 / 已审核')
    : bad('审核后不一致: ' + h1['审核状态'] + ' vs ' + h1['单据状态'])

  const un = await call('/px/callButton', { panelCode: 'ROUTE', buttonName: '弃审', formData: { 编号: CODE }, buttonParam: {} })
  if (un.status !== 200) { bad('弃审失败: ' + String(un.json?.message || un.text).slice(0, 120)); return end() }
  const h2 = await snap()
  h2['审核状态'] === '未审核' && h2['单据状态'] === '草稿' ? ok('弃审后同步退回:未审核 / 草稿')
    : bad('弃审后不一致: ' + h2['审核状态'] + ' vs ' + h2['单据状态'])
  return end()
}
function end() { console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`); process.exit(fail ? 1 : 0) }
main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })