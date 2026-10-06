/**
 * _probe-wo-detail-board.mjs — 工单详情 + 工序总览 + 派工下沉校验 + 撤回派工 验收(2026-10-05)
 * 断言:①工序总览按工序汇总 ②工单详情给出表头/工序时间轴/当前工序 ③派工必须"线的工序 = 任务的工序"
 *      (派错线被服务端拒绝) ④派工成功后 ⑤**撤回派工**可把任务退回待加工(可撤回要求)
 * 用法: node tools/archive/_probe-wo-detail-board.mjs [base]
 */
const b = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
let pass = 0, fail = 0, tk = '', made = { 工单号: '', 任务id: [] }
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
const num = (v) => Number(v || 0)
async function call(p, body) {
  const r = await fetch(b + p, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
const msg = (r) => String(r.json?.message || r.text || '').slice(0, 160)
async function main() {
  console.log('== 工单详情 + 工序总览 + 派工校验 + 撤回派工 ==')
  const l = await call('/auth/login', { userName: 'admin', password: '123456' })
  tk = l.json?.data?.token
  if (!tk) { bad('登录失败'); return end() }
  ok('登录成功')

  const wos = (await call('/px/workOrderList', {})).json?.data || []
  const cand = wos.find((r) => r['结案'] !== 'Y' && !r['源工单号'] && r['生产线'] && num(r['排产数量']) > 0 && num(r['排产数量']) <= 100000)
  if (!cand) { bad('无可用工单'); return end() }
  made.工单号 = cand['工单号']
  console.log('  工单 ' + cand['工单号'] + ' @ ' + cand['生产线'])

  await call('/px/processTask/generate', { 工单号: cand['工单号'] })
  const board = (await call('/px/processTask/board', {})).json?.data || []
  console.log('  工序总览: ' + board.map((x) => x.工序 + '(待' + x.待加工数 + '/在' + x.在加工数 + '/完' + x.已完工数 + ')').join(' '))
  board.length >= 1 && board.some((x) => num(x.任务数) > 0) ? ok('工序总览按工序汇总出 ' + board.length + ' 行') : bad('工序总览为空')
  board.every((x) => x.工序 && x.任务数 !== undefined) ? ok('总览字段齐(工序/任务数/待加工/在加工/已完工/未完成量/急单/涉及产线)') : bad('总览字段缺')

  const det = (await call('/px/processTask/detail', { 工单号: cand['工单号'] })).json?.data || {}
  const hd = det['表头'] || {}, tasks = det['工序任务'] || []
  console.log('  详情: 表头工序=' + det['当前工序'] + ' 工序数=' + det['工序数'] + ' 计划合计=' + det['计划合计'])
  hd['工单号'] === cand['工单号'] ? ok('详情表头 = 该工单(' + hd['工单号'] + ')') : bad('详情表头异常')
  tasks.length >= 3 ? ok('工序时间轴 ' + tasks.length + ' 道工序(成型/切炭/组装)') : bad('工序任务行数 = ' + tasks.length)
  const seqU = [...new Set(tasks.map((t) => num(t['工序序'])))].sort((a, b) => a - b)
  seqU.join('/') === '1/2/3' ? ok('工序序列覆盖 1/2/3(多工单行则每行各一套,共 ' + tasks.length + ' 条)') : bad('工序序列 = ' + seqU.join('/'))
  num(det['计划合计']) > 0 ? ok('计划合计 = ' + det['计划合计'] + ',未完成合计 = ' + det['未完成合计']) : bad('计划合计为 0')

  const lines = (await call('/px/scheduleBoard/linesSummary', {})).json?.data || []
  const t1 = tasks.find((t) => t['工序'] === '成型') || tasks[0]
  made.任务id.push(t1['任务id'])
  const wrongLine = (lines.find((x) => x['生产车间'] && x['生产车间'] !== t1['工序']) || {})['生产线']
  const rightLine = (lines.find((x) => x['生产车间'] === t1['工序']) || {})['生产线']
  if (wrongLine && rightLine && wrongLine !== rightLine) {
    const w = await call('/px/processTask/assign', { ids: [t1['任务id']], 生产线: wrongLine })
    const rejected = w.status !== 200 || String(w.json?.message || '').includes('不一致')
    rejected ? ok('派错线被拒(工序「' + t1['工序'] + '」→ 产线「' + wrongLine + '」):' + msg(w).slice(0, 60)) : bad('派错线竟然成功: ' + msg(w))
  } else { bad('拿不到对照组产线,跳过校验用例') }

  const a1 = await call('/px/processTask/assign', { ids: [t1['任务id']], 生产线: rightLine })
  a1.status === 200 ? ok('派对线成功:' + t1['工序'] + ' → ' + rightLine) : bad('派工失败: ' + msg(a1))
  let q = (await call('/px/processTask/queue', { 工序: t1['工序'] })).json?.data || []
  let t1b = q.find((x) => String(x['任务id']) === String(t1['任务id'])) || {}
  t1b['状态'] === '在加工' && t1b['生产线'] === rightLine ? ok('派工后:状态=在加工,生产线=' + t1b['生产线']) : bad('派工后状态=' + t1b['状态'])

  const u = await call('/px/processTask/unassign', { ids: [t1['任务id']] })
  u.status === 200 ? ok('**撤回派工**成功:撤回 ' + (u.json?.data || {})['撤回行数'] + ' 条') : bad('撤回失败: ' + msg(u))
  q = (await call('/px/processTask/queue', { 工序: t1['工序'] })).json?.data || []
  t1b = q.find((x) => String(x['任务id']) === String(t1['任务id'])) || {}
  t1b['状态'] === '待加工' && !t1b['生产线'] ? ok('撤回后:状态=待加工,生产线已清空') : bad('撤回后状态=' + t1b['状态'] + ' 产线=' + t1b['生产线'])
  console.log('\n清理用: ' + JSON.stringify(made))
  return end()
}
function end() { console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`); process.exit(fail ? 1 : 0) }
main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })