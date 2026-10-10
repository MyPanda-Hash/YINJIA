/*
 * _verify-insp-pass-qty-derived.mjs — 「合格数量 = 报工数量 − 不合格数量」端到端实测(2026-10-15)
 *
 * 【用户口径】「去除合格数量只保留不合格数量即可,最终的合格数量就是[报工数量]减去[不合格数量],
 *   数据要可返回追溯页面」。
 *
 * 【验什么】在测试账套 YJ_TEST 的组装成品检验单上走两遍,证明**减数是活的**:
 *   A. 明细只填 不合格数量 = 3 → 审核 → 自动生成的产成品入库单行「实收数量」= 报工数量 − 3;
 *   B. 明细只填 不合格数量 = 0 → 审核 → 行「实收数量」= 报工数量(= 全部合格)。
 *   两遍都**不写 合格数量**(字段登记行已注销,写了也落不进去)。
 *
 * ⚠ 只在测试账套写数据;跑完可用 tools/archive/_clean-report-approve-probe.sql 清理。
 * 用法: node tools/archive/_verify-insp-pass-qty-derived.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'MO-2026-09-0004'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const api = async (p, b) => fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }).then((x) => x.json())
const listOf = async (panel) => { const d = (await api('/px/queryFormDataList', { panelCode: panel, pageNo: 1, pageSize: 200 })).data || {}; return d.rows || d.list || d.items || [] }
const cb = (panel, btn, formData) => api('/px/callButton', { panelCode: panel, buttonName: btn, buttonParam: {}, formData })

/** 产成品入库单行的「实收数量」
 *  ⚠ detailData 的形状是 `{ items: [...] }`(键=明细页签 key),不是数组 —— 第一版按数组读,恒 null */
const finishLineQty = async (no) => {
  const r = await fetch(`${BASE}/api/px/getFormDescriptor?panelCode=FINISH_IN&code=${encodeURIComponent(no)}`, { headers: H }).then((x) => x.json())
  const dd = r?.data?.detailData
  const rows = Array.isArray(dd) ? dd : (dd?.items || Object.values(dd || {})[0] || [])
  return rows.length ? Number(rows[0]['实收数量'] ?? rows[0]['数量'] ?? 0) : null
}

const WO_ROW = async () => ((await api('/px/workOrderList', { keyword: WO })).data || []).find((r) => String(r['工单号']) === WO) || {}

/** 把该工单的入库单与组装成品检验单都退回草稿,方便重跑
 *  ⚠ 关键:入库单**只弃审是不够的** —— 占用链 form_flow_link 只在「下游删除/作废」时才 RELEASED,
 *    弃审后链仍 ACTIVE ⇒ asmInspToStock 的重审幂等判定直接 return,不会重算数量
 *    (第一版只弃审,结果 A 段读到的是上一轮的值 100,误判成"减法没生效")。
 */
const reset = async () => {
  for (const f of (await listOf('FINISH_IN')).filter((x) => String(x['加工单号']) === WO && String(x['单据状态'] || '') !== '已作废')) {
    const h = { ...f }; delete h['detail']
    if (String(f['单据状态'] || '') === '已审核') await cb('FINISH_IN', '弃审', { ...h, 单据编号: f['单据编号'] })
    await cb('FINISH_IN', '删除', { ...h, 单据编号: f['单据编号'] })
  }
  for (const i of (await listOf('QC_ASM_INSP')).filter((x) => String(x['工单号']) === WO && String(x['单据状态'] || '') === '已审核')) {
    const h = { ...i }; delete h['detail']
    await cb('QC_ASM_INSP', '弃审', { ...h, 单据编号: i['单据编号'] })
  }
}

console.log(`账套 = YJ_TEST,fixture = ${WO}\n`)
await reset()

const insp = (await listOf('QC_ASM_INSP')).find((x) => String(x['工单号']) === WO && String(x['单据状态'] || '') !== '已作废')
ok('① 找到组装成品检验单', !!insp, JSON.stringify((await listOf('QC_ASM_INSP')).map((x) => x['单据编号'])))
if (!insp) { console.log(`\n[结果] pass=${pass} fail=${fail}`); process.exit(1) }
const no = insp['单据编号']
const reportQty = Number(insp['报工数量'] || 0)
const head = { ...insp }; delete head['detail']
console.log(`    检验单=${no} 报工数量=${reportQty}`)
ok('①b 表头「报工数量」有值(派生值的被减数)', reportQty > 0, String(reportQty))

/** 走一遍:填 不合格数量=ng → 保存 → 审核 → 找到生成的入库单 → 读实收数量 */
const runOnce = async (ng) => {
  const items = [{ 单据编号: no, 行号: 1, 检验项目: '成品检验', 不合格数量: ng }]
  const fd = { ...head, 单据编号: no, detail: { items } }
  const sv = await cb('QC_ASM_INSP', '保存', fd)
  const au = await cb('QC_ASM_INSP', '审核', fd)
  console.log(`    不合格=${ng}: 保存=${sv.code} 审核=${au.code} ${au.code === 200 ? '' : JSON.stringify(au).slice(0, 120)}`)
  const fins = (await listOf('FINISH_IN')).filter((x) => String(x['加工单号']) === WO && String(x['单据状态'] || '') !== '已作废')
  if (!fins.length) return { qty: null, n: 0 }
  const qty = await finishLineQty(fins[0]['单据编号'])
  return { qty, n: fins.length, no: fins[0]['单据编号'], items }
}

console.log('\n── A. 不合格数量 = 3 ⇒ 入库行实收数量 = 报工数量 − 3 ──')
const a = await runOnce(3)
console.log(`    生成入库单 = ${a.no} 实收数量 = ${a.qty}`)
ok('A 检验审核后生成了产成品入库单', a.n > 0 && !!a.no, `n=${a.n}`)
ok('A 入库行「实收数量」= 报工数量 − 不合格数量', a.qty !== null && Math.abs(a.qty - (reportQty - 3)) < 0.001,
  `期望 ${reportQty - 3},实际 ${a.qty}`)

console.log('\n── B. 不合格数量 = 0 ⇒ 入库行实收数量 = 报工数量(全部合格) ──')
await reset()
const b = await runOnce(0)
console.log(`    生成入库单 = ${b.no} 实收数量 = ${b.qty}`)
ok('B 入库行「实收数量」= 报工数量 − 0', b.qty !== null && Math.abs(b.qty - reportQty) < 0.001,
  `期望 ${reportQty},实际 ${b.qty}`)

/** 追溯页读数(「数据要可返回追溯页面」) */
const t = (await api('/px/scheduleBoard/trace', { 工单号: WO })).data || {}
const qcRow = (t['质检数据'] || []).find((r) => String(r['检验单号']) === no)
console.log(`\n── C. 追溯页「质检数据」里这一单 = ${JSON.stringify(qcRow)} ──`)
ok('C 追溯页返回该检验单', !!qcRow)
if (qcRow) {
  ok('C 追溯页 合格数量 = 报工数量 − 不合格数量(派生值可回溯)',
    Math.abs(Number(qcRow['合格数量']) - Math.max(0, Number(qcRow['送检数量']) - Number(qcRow['不合格数量']))) < 0.0001,
    `送检${qcRow['送检数量']} 不合格${qcRow['不合格数量']} 合格${qcRow['合格数量']}`)
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
console.log('⚠ 测试账套留下报工/检验/入库单,可跑 tools/archive/_clean-report-approve-probe.sql 清理')
process.exit(fail === 0 ? 0 : 1)
