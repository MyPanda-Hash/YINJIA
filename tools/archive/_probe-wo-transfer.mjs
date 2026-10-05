/**
 * _probe-wo-transfer.mjs — 工单调拨 / 撤回调拨 端到端验收(9.29 生产管理批次 ②,2026-10-05)
 *
 * 覆盖:① 车间下拉 ② 调拨(产线 A → 车间 B 的线,写轨迹)③ 列表跟随(旧线无、新线有)
 *      ④ 追溯出现「调拨轨迹/生效」⑤ 车间—产线 一致性守卫(错配拒绝)⑥ 撤回调拨(产线调回、轨迹标已撤销)
 *
 * ⚠ 自清理:末尾必定撤回调拨(产线还原原线);仅 wo_transfer_log 留一行"已撤销"轨迹(按设计留痕)。
 * 用法: node tools/archive/_probe-wo-transfer.mjs [base]      (默认 http://127.0.0.1:8090)
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

async function main() {
  console.log('== 工单调拨探针 @ ' + BASE + ' ==')
  const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
  token = lg.json?.data?.token
  if (!token) { bad('登录失败: ' + msg(lg)); return summary() }
  ok('登录成功')

  // ① 车间下拉
  const ws = await post('/px/scheduleBoard/workshops', {})
  const shops = ws.json?.data || []
  if (ws.status !== 200 || !shops.length) { bad('车间下拉为空: ' + msg(ws)); return summary() }
  ok('车间下拉 ' + shops.length + ' 个:' + shops.map((x) => `${x['车间']}(${x['产线数']})`).join('、'))

  // 找源工单:任一条线的已排产、未结案工单
  const ls = await post('/px/scheduleBoard/linesSummary', {})
  const lineSummary = ls.json?.data || []
  let src = null
  for (const l of lineSummary) {
    if (l['停用']) continue
    const sc = await post('/px/scheduleBoard/scheduled', { 生产线: l['生产线'], scope: '全部' })
    const row = (sc.json?.data || []).find((r) => r['结案'] !== 'Y')
    if (row) { src = { line: l['生产线'], shop: l['生产车间'] || '', row }; break }
  }
  if (!src) { bad('没有可调拨的已排产工单(需先有排产且未结案)'); return summary() }
  const wo = { 工单号: src.row['加工单号'], 工单行号: src.row['工单行号'], 批次号: src.row['批次号'] }
  console.log(`  源工单 ${wo.工单号}#${wo.工单行号}/${wo.批次号} @ ${src.line}(${src.shop})`)

  // 选目标线:另一车间(同时验证「车间—产线一致」)
  const otherShop = shops.find((s) => s['车间'] !== src.shop)
  if (!otherShop) { bad('只有一个车间,无法验收跨车间调拨'); return summary() }
  const tgtPrep = await post('/px/scheduleBoard/linesSummary', {})
  const tgtLine = (tgtPrep.json?.data || []).find((l) => !l['停用'] && l['生产车间'] === otherShop['车间'] && l['生产线'] !== src.line)
  if (!tgtLine) { bad('目标车间没有可用产线: ' + otherShop['车间']); return summary() }
  const toLine = tgtLine['生产线']
  console.log(`  目标产线 ${toLine}(${otherShop['车间']})`)

  // ⑤a 车间错配守卫(先跑,避免污染:目标线 + 错误车间)
  const mismatch = await post('/px/scheduleBoard/transfer', {
    rows: [wo], 目标生产线: toLine, 目标车间: '不存在车间',
  })
  mismatch.status >= 400 ? ok('车间—产线错配被拒: ' + msg(mismatch)) : bad('车间错配未被拒(HTTP ' + mismatch.status + ')')

  // ② 调拨
  const tf = await post('/px/scheduleBoard/transfer', {
    rows: [wo], 目标生产线: toLine, 目标车间: otherShop['车间'], 原因: '探针验收',
  })
  const d = tf.json?.data
  if (tf.status !== 200 || !d) { bad('调拨失败: ' + msg(tf)); return summary() }
  ok(`调拨成功: ${d['调拨张数']} 张 → ${d['目标']}` + ((d['失败行'] || []).length ? ' 失败行:' + d['失败行'].join(';') : ''))

  // ③ 列表跟随
  const oldList = (await post('/px/scheduleBoard/scheduled', { 生产线: src.line, scope: '全部' })).json?.data || []
  const newList = (await post('/px/scheduleBoard/scheduled', { 生产线: toLine, scope: '全部' })).json?.data || []
  const inOld = oldList.some((r) => r['加工单号'] === wo.工单号 && String(r['工单行号']) === String(wo.工单行号)
    && String(r['批次号'] || '') === String(wo.批次号 || ''))
  const inNew = newList.some((r) => r['加工单号'] === wo.工单号 && String(r['工单行号']) === String(wo.工单行号)
    && String(r['批次号'] || '') === String(wo.批次号 || ''))
  !inOld ? ok('原产线列表已无该工单') : bad('原产线列表仍能看到该工单')
  inNew ? ok('目标产线列表可见该工单(待加工列表跟随)') : bad('目标产线列表看不到该工单')

  // ④ 追溯轨迹
  const tr = await post('/px/scheduleBoard/trace', { 工单号: wo.工单号 })
  const logs = tr.json?.data?.['调拨轨迹'] || []
  const active = logs.filter((x) => x['状态'] === '生效')
  active.length ? ok('追溯出现调拨轨迹(生效):' + JSON.stringify(active[active.length - 1])) : bad('追溯没有生效调拨轨迹')
  const hdr = tr.json?.data?.['头'] || {}
  String(hdr['生产线'] || '') === toLine ? ok('追溯头.生产线 = ' + hdr['生产线']) : bad('追溯头.生产线 = ' + hdr['生产线'] + '(期望 ' + toLine + ')')

  // ⑥ 撤回调拨
  const rv = await post('/px/scheduleBoard/transferRevoke', { rows: [wo] })
  const r = rv.json?.data
  if (rv.status !== 200 || !r) { bad('撤回调拨失败: ' + msg(rv)); return summary() }
  ok(`撤回调拨成功: ${r['撤回张数']} 张` + ((r['失败行'] || []).length ? ' 失败行:' + r['失败行'].join(';') : ''))

  const backList = (await post('/px/scheduleBoard/scheduled', { 生产线: src.line, scope: '全部' })).json?.data || []
  const backOk = backList.some((x) => x['加工单号'] === wo.工单号 && String(x['工单行号']) === String(wo.工单行号))
  backOk ? ok('撤回复核:工单已回到原产线 ' + src.line) : bad('撤回复核:工单未回到原产线')
  const tr2 = await post('/px/scheduleBoard/trace', { 工单号: wo.工单号 })
  const logs2 = tr2.json?.data?.['调拨轨迹'] || []
  const revoked = logs2.filter((x) => x['状态'] === '已撤销')
  revoked.length ? ok('撤回复核:轨迹标「已撤销」并留痕(撤销人=' + revoked[revoked.length - 1]['撤销人'] + ')') : bad('撤回复核:轨迹未标已撤销')

  // ⑥b 无轨迹可撤时拒绝(再撤一次)
  const rv2 = await post('/px/scheduleBoard/transferRevoke', { rows: [wo] })
  rv2.status >= 400 ? ok('重复撤回被拒: ' + msg(rv2)) : bad('重复撤回未被拒(HTTP ' + rv2.status + ')')

  return summary()
}

function summary() {
  console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })
