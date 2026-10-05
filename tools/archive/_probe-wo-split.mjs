/**
 * _probe-wo-split.mjs — 工单切单 / 撤回切单 端到端验收(9.29 生产管理批次 ①,2026-10-05)
 *
 * 覆盖:① 预览可切上限 ② 切单(父单核减 + 子单新建 + 父子关联 + 跨越占用链) ③ 追溯父子互见
 *      ④ 撤回切单(子单软删 + 父单还原) ⑤ 撤回后列表回归原状。
 *
 * ⚠ 自清理:探针末尾必定撤回(撤回=软删子单+父单还原),不向正式账套留业务数据;
 *   仅 yj_usage_log 留两条动作痕迹(审计日志,按设计保留)。
 *
 * 用法: node tools/archive/_probe-wo-split.mjs [base]      (默认 http://127.0.0.1:8090)
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const API = BASE + '/api'
let token = ''
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }

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
const msg = (res) => res.json?.message || res.text?.slice(0, 160) || ('HTTP ' + res.status)
const num = (v) => Number(v || 0)

async function main() {
  console.log('== 工单切单探针 @ ' + BASE + ' ==')
  const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
  token = lg.json?.data?.token
  if (!token) { bad('登录失败: ' + msg(lg)); return summary() }
  ok('登录成功')

  const list = await post('/px/workOrderList', {})
  const rows = list.json?.data || []
  if (!rows.length) { bad('生产工单列表为空,无法验收(需先有已转工单)'); return summary() }
  ok('工单列表 ' + rows.length + ' 行')

  // 挑一张可切工单:未结案、未作废、本身不是子单、排产数量 > 0
  const cand = rows.find((r) => r['结案'] !== 'Y' && !r['源工单号'] && num(r['排产数量']) > 0)
  if (!cand) { bad('没有可切的候选工单(需 未结案 + 非子单 + 排产数量>0)'); return summary() }
  const key = { 行id: cand['行id'], 工单号: cand['工单号'], 工单行号: cand['工单行号'], 批次号: cand['批次号'] }
  const origSl = num(cand['排产数量'])
  console.log(`  候选工单 ${cand['工单号']}#${cand['工单行号']}/${cand['批次号']} 排产数量=${origSl}`)

  // ① 预览
  const pv = await post('/px/workOrderList/splitPreview', key)
  const p = pv.json?.data
  if (pv.status !== 200 || !p) { bad('预览失败: ' + msg(pv)); return summary() }
  ok(`预览: 可切上限=${p['可切上限']} 已入库=${p['入库数量']} 已完工报工=${p['已完工报工']} 已切出=${p['已切出数量']}`)
  const limit = num(p['可切上限'])
  if (limit > 0) ok('可切上限 > 0(未完工部分可切)'); else bad('可切上限 = 0,该单已完工,换一张再验收')

  // ② 切单
  const qty = Math.max(1, Math.round(limit * 0.2))
  const sp = await post('/px/workOrderList/split', { ...key, 切出数量: qty, 继承排产: true })
  const d = sp.json?.data
  if (sp.status !== 200 || !d) { bad('切单失败: ' + msg(sp)); return summary() }
  const childNo = d['子工单号']
  ok(`切单成功: 子工单 ${childNo} 切出 ${d['切出数量']},父单剩余 ${d['父单剩余数量']},继承排产=${d['继承排产']},占用链拆账=${d['占用链已拆账']}`)
  if (!cand['生产线']) ok('父单未排产 → 继承排产=false 属预期(无可继承的产线)')
  else if (d['继承排产']) ok('父单已排产(' + cand['生产线'] + ') → 子单已继承产线')
  else bad('父单已排产但子单未继承产线')
  if (num(d['父单剩余数量']) === origSl - qty) ok('父单核减数量守恒(' + origSl + ' − ' + qty + ' = ' + d['父单剩余数量'] + ')')
  else bad(`父单核减异常: 期望 ${origSl - qty},实际 ${d['父单剩余数量']}`)

  // ③ 复核列表:父单减量 + 子单出现且带父子关联
  const list2 = await post('/px/workOrderList', {})
  const rows2 = list2.json?.data || []
  const parent2 = rows2.find((r) => String(r['行id']) === String(cand['行id']))
  const child2 = rows2.find((r) => r['工单号'] === childNo)
  parent2 && num(parent2['排产数量']) === origSl - qty
    ? ok('列表复核:父单排产数量 = ' + parent2['排产数量'])
    : bad('列表复核:父单排产数量异常 = ' + (parent2 ? parent2['排产数量'] : '父单消失'))
  child2 ? ok(`列表复核:子单 ${childNo} 可见(源工单号=${child2['源工单号']},拆分序号=${child2['拆分序号']},数量=${child2['排产数量']})`)
    : bad('列表复核:子单未出现在工单列表')
  if (child2 && child2['源工单号'] === cand['工单号'] && num(child2['拆分序号']) >= 1) ok('父子关联字段落值正确')
  else bad('父子关联字段未落值: ' + JSON.stringify(child2 && { 源工单号: child2['源工单号'], 拆分序号: child2['拆分序号'] }))

  // ④ 追溯父子互见
  const trChild = await post('/px/scheduleBoard/trace', { 工单号: childNo })
  const trParent = await post('/px/scheduleBoard/trace', { 工单号: cand['工单号'] })
  const parOfChild = trChild.json?.data?.['父工单'] || []
  const kidsOfParent = (trParent.json?.data?.['子工单'] || []).filter((x) => x['工单号'] === childNo)
  parOfChild.length ? ok('子单追溯可见父单:' + JSON.stringify(parOfChild[0])) : bad('子单追溯看不到父单')
  kidsOfParent.length ? ok('父单追溯可见子单:' + JSON.stringify(kidsOfParent[0])) : bad('父单追溯看不到子单')

  // ⑤ 撤回切单
  const us = await post('/px/workOrderList/unsplit', { 行id: child2?.['行id'] ?? d['子工单行id'], 工单号: childNo })
  const u = us.json?.data
  if (us.status !== 200 || !u) { bad('撤回切单失败: ' + msg(us)); return summary() }
  ok(`撤回切单成功: 子单 ${u['子工单号']} 软删,父单 ${u['父工单号']} 还原 ${u['还原数量']},占用链回冲=${u['占用链已回冲']}`)

  const list3 = await post('/px/workOrderList', {})
  const rows3 = list3.json?.data || []
  const parent3 = rows3.find((r) => String(r['行id']) === String(cand['行id']))
  const child3 = rows3.find((r) => r['工单号'] === childNo)
  parent3 && num(parent3['排产数量']) === origSl
    ? ok('撤回复核:父单数量已还原 = ' + parent3['排产数量'])
    : bad('撤回复核:父单数量异常 = ' + (parent3 ? parent3['排产数量'] : '父单消失') + '(期望 ' + origSl + ')')
  !child3 ? ok('撤回复核:子单已从列表消失(软删)') : bad('撤回复核:子单仍在列表')

  return summary()
}

function summary() {
  console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })
