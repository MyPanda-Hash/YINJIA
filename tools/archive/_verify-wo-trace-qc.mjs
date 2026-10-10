/*
 * _verify-wo-trace-qc.mjs — 工单追溯「质检段」接口级核查(2026-10-14,一次性探针)
 *
 * 背景:工单结束要能对上成品检验单 ⇒ 追溯弹窗新增「质检数据 + 应检/已检/缺检汇总」。
 *      本探针直接打 /api/px/scheduleBoard/trace,核对后端真的返回这两段、且口径自洽
 *      (SQL 层已由 _ProbeWoTraceQc.java 在实库验过;这里验的是**接口契约与前端消费的键名**)。
 *
 * 用法:
 *   node tools/archive/_verify-wo-trace-qc.mjs                      # 默认 http://127.0.0.1:8090
 *   node tools/archive/_verify-wo-trace-qc.mjs http://127.0.0.1:8091
 *
 * 只读:仅登录 + trace 查询,不写任何业务数据。
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`) }
}
const j = async (path, body, token) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

const login = await j('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = login.body?.data?.token
console.log(`\n[登录] ${BASE} → ${token ? 'OK' : '失败:' + JSON.stringify(login.body)?.slice(0, 200)}`)
if (!token) process.exit(1)

const trace = async (wo) => {
  const r = await j('/api/px/scheduleBoard/trace', { 工单号: wo }, token)
  if (r.status !== 200 || r.body?.code !== 200) throw new Error(`${wo} trace 失败: ${r.status} ${JSON.stringify(r.body)?.slice(0, 200)}`)
  return r.body.data
}

// ── ① 有检验单的工单:三类工序至少出了单,组装成品检验单要能对上 ──────────────────
console.log('\n=== ① GD-2026-10-0002(实测有 7 张工序检验单,含组装成品)===')
{
  const t = await trace('GD-2026-10-0002')
  const rows = t['质检数据'] || []
  const sum = t['质检汇总'] || {}
  ok('返回「质检数据」数组', Array.isArray(rows), `${rows.length} 行`)
  ok('返回「质检汇总」对象', !!sum && typeof sum === 'object')
  ok('汇总键齐全(应检/已检/缺检/单数/结论)',
    ['应检工序', '已检工序', '缺检工序', '检验单数', '已审核数', '结论'].every((k) => k in sum),
    Object.keys(sum).join(','))
  ok('应检工序 = 成型/切炭/组装', JSON.stringify(sum['应检工序']) === JSON.stringify(['成型', '切炭', '组装']),
    JSON.stringify(sum['应检工序']))
  ok('已检工序含「组装」(成品检验单对上了)', (sum['已检工序'] || []).includes('组装'),
    JSON.stringify(sum['已检工序']))
  ok('检验单数 = 明细行数', sum['检验单数'] === rows.length, `${sum['检验单数']} vs ${rows.length}`)
  ok('含一张组装成品检验单(ZJ 前缀)',
    rows.some((r) => String(r['检验单号']).startsWith('ZJ') && r['工序'] === '组装'),
    rows.filter((r) => String(r['检验单号']).startsWith('ZJ')).map((r) => r['检验单号']).join(','))
  // 行契约:前端表格读这些键,少一个就是空白列
  const keys = ['检验单号', '工序', '检验日期', '单据状态', '总结论', '送检数量', '检验数量',
    '合格数量', '不合格数量', '检验员', '批次号', '报工单号', '处理方式', '下游单号']
  const miss = keys.filter((k) => !(k in (rows[0] || {})))
  ok('明细行键齐全(前端列全部有值来源)', miss.length === 0, miss.length ? '缺:' + miss.join(',') : keys.length + ' 键')
  const st = new Set(rows.map((r) => r['单据状态']))
  ok('单据状态取自 yj_doc_status 推导(不读物理空列)',
    [...st].every((x) => ['草稿', '已审核', '审批中', '已中止', '已作废'].includes(x)), [...st].join(','))
  // 🔴 2026-10-15 第三次修订口径(用户:「去除合格数量只保留不合格数量即可,最终的合格数量就是
  //   [报工数量]减去[不合格数量]」「数据要可返回追溯页面」):
  //   追溯页的「合格数量」必须是**派生值** = 送检数量(表头报工数量) − 不合格数量,逐行成立。
  //   ⚠ 这条断言正是"数据要可返回追溯页面"的验收点 —— 明细列已不再录入合格数量。
  const badDerive = rows.filter((r) => {
    const want = Math.max(0, Number(r['送检数量'] || 0) - Number(r['不合格数量'] || 0))
    return Math.abs(Number(r['合格数量'] || 0) - want) > 0.0001
  })
  ok('逐行:合格数量 = 送检数量(报工数量) − 不合格数量(派生值,明细不再录入)',
    badDerive.length === 0,
    badDerive.map((r) => `${r['检验单号']}: 送检${r['送检数量']}−不良${r['不合格数量']}≠合格${r['合格数量']}`).join(' | '))
  const sumDerive = rows.reduce((a, r) => a + Number(r['合格数量'] || 0), 0)
  ok('汇总「合格数量合计」= 各行派生值之和',
    Math.abs(Number(sum['合格数量合计'] || 0) - sumDerive) < 0.0001,
    `汇总${sum['合格数量合计']} vs 逐行和${sumDerive}`)
}

// ── ② 无检验单的工单:缺检要报全三道 ────────────────────────────────────────────
console.log('\n=== ② 无检验单的工单(缺检应报全三道)===')
{
  const r = await j('/api/px/scheduleBoard/trace', { 工单号: 'MO-2026-10-0006' }, token)
  if (r.status === 200 && r.body?.code === 200) {
    const sum = r.body.data['质检汇总'] || {}
    ok('质检数据为空数组', (r.body.data['质检数据'] || []).length === 0)
    ok('缺检工序 = 成型/切炭/组装', JSON.stringify(sum['缺检工序']) === JSON.stringify(['成型', '切炭', '组装']),
      JSON.stringify(sum['缺检工序']))
    ok('结论 = 缺检', sum['结论'] === '缺检', String(sum['结论']))
  } else ok('MO-2026-10-0006 追溯可用', false, `status=${r.status}`)
}

// ── ③ 其它段位不受影响(回归):原有键仍在 ────────────────────────────────────────
console.log('\n=== ③ 原有段位回归(不得因新增质检段而丢键)===')
{
  const t = await trace('GD-2026-10-0002')
  const need = ['头', '时间线', '排产数据', '完工数据', '入库单据', '领料数据', '家族汇总']
  const miss = need.filter((k) => !(k in t))
  ok('原有键全部保留', miss.length === 0, miss.length ? '缺:' + miss.join(',') : need.length + ' 键')
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
