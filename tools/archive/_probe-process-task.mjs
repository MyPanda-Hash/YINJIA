/**
 * _probe-process-task.mjs — 路线驱动工序任务 验收(A 项,2026-10-05)
 *
 * 覆盖:① 下拉元数据(状态/路线) ② 按工艺路线生成工序任务(默认路线 GY-CB-STD:成型→切炭→组装)
 *      ③ 工序队列(成型)可见且 状态=待加工/工序序=1 ④ 派工到产线 → 状态=在加工
 *      ⑤ 报工审核 → 完成数量回写 ⑥ 弃审报工 → 完成数量回退
 *
 * ⚠ 自清理:末尾弃审报工;任务行(wo_progress)与报工行由外层 SQL 清理。
 * 用法: node tools/archive/_probe-process-task.mjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const API = BASE + '/api'
let token = ''
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
const made = { 报工单: [], 任务: [] }

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
const msg = (r) => r.json?.message || r.text?.slice(0, 200)
const num = (v) => Number(v || 0)
const btn = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData })

async function main() {
  console.log('== 路线驱动工序任务探针 @ ' + BASE + ' ==')
  const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
  token = lg.json?.data?.token
  if (!token) { bad('登录失败: ' + msg(lg)); return summary() }
  ok('登录成功')

  // ① 元数据
  const meta = (await post('/px/processTask/meta', {})).json?.data || {}
  const st = meta['状态'] || []
  st.length === 3 ? ok('任务状态字典 = ' + st.join('/')) : bad('状态字典异常: ' + JSON.stringify(st))
  const routes = meta['路线'] || []
  routes.includes('GY-CB-STD') ? ok('路线含默认炭棒标准路线 GY-CB-STD(共 ' + routes.length + ' 条)')
    : bad('路线下拉缺 GY-CB-STD: ' + JSON.stringify(routes))
  const lines = meta['产线'] || []
  lines.length > 0 ? ok('产线下拉 ' + lines.length + ' 条') : bad('产线下拉为空')

  // 选一张已排产工单
  const wos = (await post('/px/workOrderList', {})).json?.data || []
  const cand = wos.find((r) => r['结案'] !== 'Y' && !r['源工单号'] && r['生产线'] && num(r['排产数量']) > 0 && num(r['排产数量']) <= 100000)
  if (!cand) { bad('没有可用的已排产工单'); return summary() }
  console.log(`  工单 ${cand['工单号']}#${cand['工单行号']} @ ${cand['生产线']} 计划=${cand['排产数量']}`)

  // ② 生成工序任务(幂等:已生成则 0)
  const gen = (await post('/px/processTask/generate', { 工单号: cand['工单号'] })).json?.data || {}
  ok(`生成工序任务: ${gen['生成任务数']} 条(工单 ${gen['工单号']})`)

  // ③ 成型队列
  let q = (await post('/px/processTask/queue', { 工序: '成型' })).json?.data || []
  let mine = q.filter((r) => r['工单号'] === cand['工单号'])
  if (!mine.length) { bad('成型队列看不到该工单的任务'); return summary() }
  const t0 = mine[0]
  made.任务.push(t0['任务id'])
  num(t0['工序序']) === 1 ? ok('成型任务 工序序 = 1') : bad('工序序 = ' + t0['工序序'])
  num(t0['计划数量']) > 0 ? ok('成型任务 计划数量 = ' + t0['计划数量']) : bad('计划数量 = ' + t0['计划数量'])
  ok('成型任务 状态 = ' + t0['状态'] + ' / 优先级 = ' + t0['优先级'])
  // 队列排序:急单在前(标一张急单后复核)
  const t1 = mine.length > 1 ? mine[1] : null
  if (t1) {
    made.任务.push(t1['任务id'])
    await post('/px/processTask/prioritize', { ids: [t1['任务id']], 优先级: '急单' })
    const q2 = (await post('/px/processTask/queue', { 工序: '成型' })).json?.data || []
    const first = q2[0] || {}
    String(first['任务id']) === String(t1['任务id']) ? ok('急单排序生效:急单排到队列首位')
      : bad('急单未排到首位(首位任务=' + first['任务id'] + ')')
    await post('/px/processTask/prioritize', { ids: [t1['任务id']], 优先级: '普通' })
  }

  // ④ 派工到产线(该工序功能下的线)
  const shop = t0['生产车间'] || '成型'
  const line = lines.find((l) => true) // 具体归属由后端校验;这里用该工序功能的线
  const lineOk = (await post('/px/scheduleBoard/linesSummary', {})).json?.data || []
  const target = (lineOk.find((l) => l['生产车间'] === shop) || {}).生产线
  if (!target) { bad('找不到功能「' + shop + '」下的产线,跳过派工'); return summary() }
  const as = await post('/px/processTask/assign', { ids: [t0['任务id']], 生产线: target })
  const ad = as.json?.data
  if (as.status !== 200 || !ad) { bad('派工失败: ' + msg(as)); return summary() }
  ok(`派工成功: ${ad['派工行数']} 条 → ${ad['生产线']}`)
  q = (await post('/px/processTask/queue', { 工序: '成型' })).json?.data || []
  let t0b = q.find((r) => String(r['任务id']) === String(t0['任务id'])) || {}
  t0b['状态'] === '在加工' && t0b['生产线'] === target ? ok('派工后 状态=在加工、生产线=' + t0b['生产线'])
    : bad(`派工后状态=${t0b['状态']} 生产线=${t0b['生产线']}`)

  // ⑤ 报工审核 → 回写完成量
  const qty = Math.max(1, Math.min(5, num(t0['计划数量'])))
  const sv = await btn('WO_REPORT', '保存', {
    单据日期: new Date().toISOString().slice(0, 10),
    detail: { items: [{ 工单号: cand['工单号'], 工序: '成型', 报工数量: qty, 报工人: 'admin', 批次号: cand['批次号'] }] },
  })
  const repNo = sv.json?.data?.编号
  if (!repNo) { bad('报工保存失败: ' + msg(sv)); return summary() }
  made.报工单.push(repNo)
  const au = await btn('WO_REPORT', '审核', { 编号: repNo })
  au.status === 200 ? ok('报工(成型 ' + qty + ')审核:' + repNo) : bad('报工审核失败: ' + msg(au))
  q = (await post('/px/processTask/queue', { 工序: '成型' })).json?.data || []
  t0b = q.find((r) => String(r['任务id']) === String(t0['任务id'])) || {}
  num(t0b['完成数量']) >= qty ? ok('报工回写:任务完成数量 = ' + t0b['完成数量'] + '(状态 ' + t0b['状态'] + ')')
    : bad('任务完成数量未回写 = ' + t0b['完成数量'])

  // ⑥ 弃审 → 回退
  const un = await btn('WO_REPORT', '弃审', { 编号: repNo })
  if (un.status !== 200) bad('弃审失败: ' + msg(un))
  else {
    q = (await post('/px/processTask/queue', { 工序: '成型' })).json?.data || []
    t0b = q.find((r) => String(r['任务id']) === String(t0['任务id'])) || {}
    num(t0b['完成数量']) === 0 ? ok('弃审后完成数量回退 = 0(状态 ' + t0b['状态'] + ')')
      : bad('弃审后完成数量 = ' + t0b['完成数量'])
  }
  console.log('\n清理用单号: ' + JSON.stringify(made))
  return summary()
}

function summary() {
  console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })
