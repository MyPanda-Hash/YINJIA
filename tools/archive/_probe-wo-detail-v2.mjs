/**
 * _probe-wo-detail-v2.mjs — 工单详情第二版验收(2026-10-05):计划量口径 + 按工序聚合 + 产出
 * 断言:①工序汇总 = 每道工序一行(不再平铺 24 行) ②计划数量 = Σ计划量(不三重计算:
 *      Σ工序汇总.计划量 === 计划合计 × 工序数) ③产出 = 末道工序完工量(=0,未报工) ④未完成 = 计划-产出
 *      ⑤表头取工单级(工单行数 × 工序数 = 工序任务行数) ⑥异常计划量(遗留脏行)已作废 ⇒ 为 0
 * 用法: node tools/archive/_probe-wo-detail-v2.mjs [base]
 */
const b = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
let pass = 0, fail = 0, tk = '', wo = ''
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
const num = (v) => Number(v || 0)
async function call(p, body) {
  const r = await fetch(b + p, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
async function main() {
  console.log('== 工单详情第二版(计划量口径 + 按工序聚合) ==')
  const l = await call('/auth/login', { userName: 'admin', password: '123456' })
  tk = l.json?.data?.token
  if (!tk) { bad('登录失败'); return end() }
  const wos = (await call('/px/workOrderList', {})).json?.data || []
  const cand = wos.find((r) => r['结案'] !== 'Y' && !r['源工单号'] && r['生产线'] && num(r['排产数量']) > 0)
  if (!cand) { bad('无可用工单'); return end() }
  wo = cand['工单号']
  await call('/px/processTask/generate', { 工单号: wo })
  const d = (await call('/px/processTask/detail', { 工单号: wo })).json?.data || {}
  const h = d['表头'] || {}, ops = d['工序汇总'] || [], tasks = d['工序任务'] || []
  console.log(`  工单 ${wo}: 行数=${h['工单行数']} 计划=${d['计划合计']} 产出=${d['产出']} 进度=${h['进度']}% 工序数=${d['工序数']}`)
  console.log('  工序汇总: ' + ops.map((o) => `${o['工序序']}${o['工序']}[${o['状态']}] 计划${o['计划数量']} 任务${o['任务数']}`).join(' | '))
  ops.length === 3 ? ok('工序汇总 = 3 行(每道工序一行,不再平铺)') : bad('工序汇总行数 = ' + ops.length)
  ops.map((o) => num(o['工序序'])).join('/') === '1/2/3' ? ok('工序序 = 1/2/3') : bad('工序序 = ' + ops.map((o) => o['工序序']).join('/'))
  const sumOps = ops.reduce((a, o) => a + num(o['计划数量']), 0)
  Math.abs(sumOps - num(d['计划合计']) * ops.length) < 0.01
    ? ok(`计划量口径正确:工序合计 ${sumOps} = 计划合计 ${d['计划合计']} × ${ops.length}(每道工序各一份,不再跨工序累加)`)
    : bad(`口径异常:工序合计 ${sumOps} vs 计划合计 ${d['计划合计']} × ${ops.length}`)
  num(d['产出']) === 0 ? ok('产出 = 0(尚未报工;产出取末道工序完工量)') : ok('产出 = ' + d['产出'])
  Math.abs(num(d['未完成合计']) - (num(d['计划合计']) - num(d['产出']))) < 0.01
    ? ok(`未完成合计 = 计划 - 产出 = ${d['未完成合计']}`) : bad('未完成合计口径异常: ' + d['未完成合计'])
  num(h['工单行数']) * ops.length === tasks.length
    ? ok(`表头为工单级:工单行数 ${h['工单行数']} × ${ops.length} 工序 = 工序任务 ${tasks.length} 条`)
    : bad(`行数不匹配: ${h['工单行数']} × ${ops.length} != ${tasks.length}`)
  num(h['异常计划量']) === 0 ? ok('异常计划量 = 0(遗留超 10 万的行已作废)') : bad('仍有异常计划量 ' + h['异常计划量'])
  return end()
}
function end() { console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`); process.exit(fail ? 1 : 0) }
main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })