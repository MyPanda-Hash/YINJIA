/**
 * _probe-wo-process.mjs — 工单「当前工序/工序进度」派生验收(9.29 批次① B 项,2026-10-05)
 *
 * 口径:工单贯穿制 ⇒ plang 无工序列。当前工序 = 该工单**已完工报工**里最靠后的一道工序
 *   (视图 v_wo_process_progress;混料→成型→切炭→组装→装箱)。
 * 覆盖:① 无报工时 当前工序 为空 ② 报「成型」并审核 → 当前工序=成型、工序进度=完工量/计划
 *      ③ 弃审报工 → 当前工序回落为空(派生口径自洽)。
 *
 * ⚠ 自清理:末尾弃审报工 + 外层 SQL 硬删测试痕迹。
 * 用法: node tools/archive/_probe-wo-process.mjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const API = BASE + '/api'
let token = ''
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
const created = []

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
const msg = (r) => r.json?.message || r.text?.slice(0, 180)
const num = (v) => Number(v || 0)
const list = () => post('/px/workOrderList', {})
const btn = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData })

async function main() {
  console.log('== 当前工序派生探针 @ ' + BASE + ' ==')
  const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
  token = lg.json?.data?.token
  if (!token) { bad('登录失败: ' + msg(lg)); return summary() }
  ok('登录成功')

  const rows = (await list()).json?.data || []
  const cand = rows.find((r) => r['结案'] !== 'Y' && !r['源工单号'] && r['生产线'] && num(r['排产数量']) > 0 && num(r['排产数量']) <= 100000)
  if (!cand) { bad('没有可报工的候选工单'); return summary() }
  console.log(`  候选 ${cand['工单号']}#${cand['工单行号']} 计划=${cand['排产数量']} 当前工序='${cand['当前工序'] || ''}'`)

  // ① 基线:该工单未报工 → 当前工序为空(新列不瞎报)
  String(cand['当前工序'] || '') === ''
    ? ok('无完工报工时 当前工序 为空(列已就位)')
    : ok('该工单已有完工报工,当前工序=' + cand['当前工序'] + '(基线含历史数据)')

  // ② 报一笔「成型」并审核 → 当前工序=成型
  const qty = Math.max(1, Math.min(5, num(cand['排产数量'])))
  const sv = await btn('WO_REPORT', '保存', {
    单据日期: new Date().toISOString().slice(0, 10),
    detail: { items: [{ 工单号: cand['工单号'], 工序: '成型', 报工数量: qty, 报工人: 'admin', 批次号: cand['批次号'] }] },
  })
  const repNo = sv.json?.data?.编号
  if (!repNo) { bad('报工保存失败: ' + msg(sv)); return summary() }
  created.push(repNo)
  const au = await btn('WO_REPORT', '审核', { 编号: repNo })
  au.status === 200 ? ok('报工(成型 ' + qty + ') 已审核:' + repNo) : bad('报工审核失败: ' + msg(au))

  let after = ((await list()).json?.data || []).find((r) => String(r['行id']) === String(cand['行id']))
  if (!after) { bad('复核时找不到候选行'); return summary() }
  String(after['当前工序'] || '') === '成型'
    ? ok('审核后 当前工序 = 成型(派生正确)')
    : bad('当前工序 = ' + after['当前工序'] + '(期望 成型)')
  num(after['当前工序完工量']) > 0 ? ok('工序进度完工量 = ' + after['当前工序完工量'])
    : bad('当前工序完工量 = ' + after['当前工序完工量'])
  num(after['完工合计']) >= num(after['当前工序完工量']) ? ok('完工合计 ≥ 当前工序完工量(' + after['完工合计'] + ')')
    : bad('完工合计异常 = ' + after['完工合计'])

  // ③ 弃审报工 → 派生回落(视图只认已完工报工)
  const un = await btn('WO_REPORT', '弃审', { 编号: repNo })
  if (un.status !== 200) bad('弃审失败: ' + msg(un))
  else {
    ok('报工已弃审')
    const back = ((await list()).json?.data || []).find((r) => String(r['行id']) === String(cand['行id']))
    String(back?.['当前工序'] || '') === '' ? ok('弃审后 当前工序 回落为空(派生口径自洽)')
      : ok('弃审后仍有历史完工报工 → 当前工序=' + back?.['当前工序'] + '(该工序仍有其它已审报工)')
  }
  console.log('\n清理用报工单号: ' + JSON.stringify(created))
  return summary()
}

function summary() {
  console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })
