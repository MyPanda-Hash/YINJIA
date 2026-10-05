/**
 * _probe-wo-split-lineage.mjs — 切单血缘/多级/根聚合 验收(9.29 批次① 会议口径第二版,2026-10-05)
 *
 * 覆盖:① 单号规则「原工单号-序号」② 根工单号继承(多级切分)③ 子单交期可改 + 备注留痕
 *      ④ 家族汇总按根聚合(张数/Σ计划)⑤ 打印提示 ⑥ 多级撤回(孙→子)后原单数量还原
 *
 * ⚠ 自清理:逐级撤回,不留业务数据(仅 wo_split_log 留痕,按设计保留)。
 * 用法: node tools/archive/_probe-wo-split-lineage.mjs [base]
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
const msg = (r) => r.json?.message || r.text?.slice(0, 200)
const num = (v) => Number(v || 0)

async function main() {
  console.log('== 切单血缘探针 @ ' + BASE + ' ==')
  const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
  token = lg.json?.data?.token
  if (!token) { bad('登录失败: ' + msg(lg)); return summary() }
  ok('登录成功')

  const rows = (await post('/px/workOrderList', {})).json?.data || []
  // 候选要"正常":未结案、非子单、计划量合理(避开遗留巨值行,如 MO-2026-09-0136#3 的 1600 万遗留值)
  const cand = rows.find((r) => r['结案'] !== 'Y' && !r['源工单号'] && num(r['排产数量']) > 0 && num(r['排产数量']) <= 100000)
  if (!cand) { bad('没有可切候选工单'); return summary() }
  const key = { 行id: cand['行id'], 工单号: cand['工单号'], 工单行号: cand['工单行号'], 批次号: cand['批次号'] }
  const orig = num(cand['排产数量'])
  console.log(`  候选 ${key.工单号}#${key.工单行号} 计划=${orig}`)

  const pv = (await post('/px/workOrderList/splitPreview', key)).json?.data || {}
  num(pv['可切上限']) > 0 ? ok('预览可切上限 = ' + pv['可切上限']) : bad('可切上限为 0')
  pv['是否切单'] === 'N' ? ok('原单 是否切单 = N') : bad('原单 是否切单 = ' + pv['是否切单'])
  pv['根工单号'] === key.工单号 ? ok('原单 根工单号 = 自身(' + pv['根工单号'] + ')') : bad('原单根工单号 = ' + pv['根工单号'])

  // ① 一级切单(带交期/备注)
  const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const cut1 = Math.max(1, Math.floor(orig * 0.4))
  const s1 = (await post('/px/workOrderList/split', { ...key, 切出数量: cut1, 继承排产: false, 子单交期: due, 备注: '急单插队(探针)' })).json?.data
  if (!s1) { bad('一级切单失败'); return summary() }
  const child1 = s1['子工单号']
  child1 === key.工单号 + '-1' ? ok('子单号规则 = 原单号-序号:' + child1) : bad(`子单号 ${child1}(期望 ${key.工单号}-1)`)
  s1['根工单号'] === key.工单号 ? ok('子单 根工单号 = 原单号') : bad('子单根工单号 = ' + s1['根工单号'])
  String(s1['子单交期'] || '') === due ? ok('子单交期可改 = ' + s1['子单交期']) : bad('子单交期 = ' + s1['子单交期'] + '(期望 ' + due + ')')
  s1['打印提示'] ? ok('返回打印提示(子工单码):' + String(s1['打印提示']).slice(0, 40) + '…') : bad('未返回打印提示')

  let list = (await post('/px/workOrderList', {})).json?.data || []
  let c1 = list.find((r) => r['工单号'] === child1)
  if (c1) {
    String(c1['备注'] || '') === '急单插队(探针)' ? ok('子单备注留痕(急单插队)') : bad('子单备注 = ' + c1['备注'])
    String(c1['计划完工日期'] || c1['计划完工日期']) === due ? ok('子单交期落库 = ' + due) : bad('子单交期落库 = ' + c1['计划完工日期'])
    c1['根工单号'] === key.工单号 ? ok('列表 子单根工单号 = 原单号') : bad('列表子单根工单号 = ' + c1['根工单号'])
    c1['是否切单'] === 'Y' ? ok('列表 子单 是否切单 = Y') : bad('列表 是否切单 = ' + c1['是否切单'])
  } else bad('列表看不到子单')

  // ② 二级切单(孙单,验证根继承与多级)
  const cut2 = Math.max(1, Math.floor(cut1 * 0.5))
  const s2 = (await post('/px/workOrderList/split', { 行id: c1?.['行id'], 工单号: child1, 工单行号: c1?.['工单行号'], 批次号: c1?.['批次号'], 切出数量: cut2, 继承排产: false, 备注: '分波(探针)' })).json?.data
  if (!s2) { bad('二级切单失败'); return summary() }
  const child2 = s2['子工单号']
  child2 === child1 + '-1' ? ok('多级子单号 = 子单号-序号:' + child2) : bad(`二级子单号 ${child2}(期望 ${child1}-1)`)
  s2['根工单号'] === key.工单号 ? ok('孙单 根工单号 仍指向原单(根继承)') : bad('孙单根工单号 = ' + s2['根工单号'])

  // ③ 家族汇总(按根行精确聚合;传 工单行id 避免把同一工单号的其它行算进来)
  const tr = (await post('/px/scheduleBoard/trace', { 工单号: key.工单号, 工单行id: key.行id })).json?.data || {}
  const fam = tr['家族汇总'] || {}
  const famRows = tr['家族清单'] || []
  console.log(`  家族汇总: 张数=${fam['张数']} Σ计划=${fam['计划数量合计']} 清单=${famRows.map((x) => x['工单号']).join(',')}`)
  if (num(fam['张数']) === 3) ok('家族汇总 张数 = 3(原+子+孙)')
  else bad(`家族张数 = ${fam['张数']}(期望 3)`)
  if (Math.abs(num(fam['计划数量合计']) - orig) < 0.0001) ok('家族 Σ计划 = 原单计划 ' + orig + '(数量守恒)')
  else bad(`家族Σ计划 = ${fam['计划数量合计']}(期望 ${orig})`)
  if (famRows.length === 3) ok('家族清单 3 行(含是否切单/根单号)')
  else bad(`家族清单行数 = ${famRows.length}(期望 3)`)

  // ④ 多级撤回:孙 → 子 → 原单还原
  const u2 = await post('/px/workOrderList/unsplit', { 行id: s2['子工单行id'], 工单号: child2 })
  u2.status === 200 ? ok('撤回孙单成功(数量回到子单)') : bad('撤回孙单失败: ' + msg(u2))
  const u1 = await post('/px/workOrderList/unsplit', { 行id: c1?.['行id'], 工单号: child1 })
  u1.status === 200 ? ok('撤回子单成功(数量回到原单)') : bad('撤回子单失败: ' + msg(u1))
  list = (await post('/px/workOrderList', {})).json?.data || []
  const back = list.find((r) => String(r['行id']) === String(key.行id))
  back && Math.abs(num(back['排产数量']) - orig) < 0.0001 ? ok('原单计划已还原 = ' + back['排产数量']) : bad('原单计划 = ' + (back ? back['排产数量'] : '单子消失') + '(期望 ' + orig + ')')
  const gone1 = list.some((r) => r['工单号'] === child1 || r['工单号'] === child2)
  !gone1 ? ok('子/孙单均已作废(列表不再出现)') : bad('仍有子/孙单在列表')
  const tr2 = (await post('/px/scheduleBoard/trace', { 工单号: key.工单号 })).json?.data || {}
  num((tr2['家族汇总'] || {})['张数']) === 1 ? ok('撤回后家族张数回 1') : bad('撤回后家族张数 = ' + (tr2['家族汇总'] || {})['张数'])

  return summary()
}

function summary() {
  console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })
