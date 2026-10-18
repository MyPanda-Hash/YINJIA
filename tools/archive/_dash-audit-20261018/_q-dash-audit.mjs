#!/usr/bin/env node
/**
 * _q-dash-audit.mjs — 我的桌面「数据自洽性」体检(2026-10-18)
 *
 * 只做**可判定的不变量**断言(不猜业务口径):
 *   · 生产:在产 + 已完工 = 总数;趋势「完工」合计 = 状态分布已完工(2026-10-18 修 cp_date→cp_date2 后)
 *   · 库存:入库单量+出库单量 = 面板合计;明细行合计 = 面板行数合计 = 趋势合计
 *   · 销售:客户分布各片合计 = 订单数;金额分布合计 = 金额;已审核 ≤ 订单数
 *   · 质量:合格 + 不合格 = 送检;趋势合计 = 送检/合格
 *   · 单据流量:已审核 ≤ 单数,草稿不为负;流程看板同判
 *   · 研发:各阶段 >= 0;待审批 = 待办条数(≤50)
 * 用法(仓库根): node tools/archive/_dash-audit-20261018/_q-dash-audit.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const USER = process.env.YINJIA_UI_USER || 'admin'
const PASS = process.env.YINJIA_UI_PASS || '123456'

const login = async (factory) => {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: PASS, factory }),
  })
  return (await r.json())?.data?.token || ''
}
const get = async (path, token) => {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } })
  return { status: r.status, json: await r.json() }
}

const token = await login('YINJIA-MES')
if (!token) { console.log('[FAIL] 登录失败'); process.exit(1) }
const [s, f] = await Promise.all([get('/api/dashboard/stats', token), get('/api/dashboard/flow', token)])
const d = s.json?.data || {}
const flow = f.json?.data || {}
let bad = 0
const check = (ok, label, detail = '') => {
  if (!ok) bad++
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`)
}
const near = (a, b, eps = 0.011) => Math.abs(Number(a) - Number(b)) <= eps
const sum = (arr, key) => (arr || []).reduce((n, x) => n + (Number(x[key]) || 0), 0)

// ── 生产 ──
const prod = d.production || {}
const k = d.kpis || {}
const statusDone = (prod.statusDist || []).find((x) => x.name === '已完工')?.value ?? 0
check(Number(k.moTotal) === Number(k.moActive) + Number(k.moDone), '生产:在产 + 已完工 = 总数',
  `${k.moActive} + ${k.moDone} = ${k.moTotal}`)
const trendDone = sum(prod.trend7, 'done')
check(trendDone === Number(statusDone), '生产:趋势完工合计 = 状态分布已完工(实际完工日 cp_date2)',
  `趋势 ${trendDone} / 状态 ${statusDone}`)
check(sum(prod.trend7, 'added') === Number(k.moTotal), '生产:趋势新增合计 = 区间工单数',
  `${sum(prod.trend7, 'added')} / ${k.moTotal}`)

// ── 库存 ──
const st = d.stock || {}
const panelCount = sum(st.panels, 'count')
const panelLines = sum(st.panels, 'lines')
check(Number(st.totalIn) + Number(st.totalOut) === panelCount, '库存:入库+出库 = 面板单量合计',
  `${st.totalIn}+${st.totalOut} / ${panelCount}`)
check(Number(st.totalLines) === panelLines, '库存:明细行合计 = 面板行数合计',
  `${st.totalLines} / ${panelLines}`)
check(sum(st.trend7, 'added') + sum(st.trend7, 'done') === Number(st.totalLines),
  '库存:趋势合计 = 明细行合计', `${sum(st.trend7, 'added') + sum(st.trend7, 'done')} / ${st.totalLines}`)
const topVals = (st.topItems || []).map((x) => Number(x.value) || 0)
check(topVals.every((v, i) => i === 0 || v <= topVals[i - 1]), '库存:现存量 TOP 降序')

// ── 销售 ──
const sa = d.sales || {}
check(sum(sa.customerShare, 'value') === Number(sa.total), '销售:客户分布合计 = 订单数',
  `${sum(sa.customerShare, 'value')} / ${sa.total}`)
check(near(sum(sa.customerShareAmount, 'value'), sa.amount), '销售:客户金额分布合计 = 金额',
  `${sum(sa.customerShareAmount, 'value')} / ${sa.amount}`)
const salesAudited = (sa.byStatus || []).find((x) => x.name === '已审核')?.value ?? 0
check(Number(salesAudited) <= Number(sa.total), '销售:已审核 ≤ 订单数', `${salesAudited} / ${sa.total}`)
check(sum(sa.trend7, 'added') === Number(sa.total), '销售:趋势新增合计 = 订单数',
  `${sum(sa.trend7, 'added')} / ${sa.total}`)

// ── 质量 ──
const q = d.quality || {}
check(Number(q.pass) + Number(q.bad) === Number(q.total), '质量:合格 + 不合格 = 送检',
  `${q.pass}+${q.bad} / ${q.total}`)
check(sum(q.trend7, 'added') === Number(q.total), '质量:趋势送检合计 = 送检', `${sum(q.trend7, 'added')} / ${q.total}`)
check(sum(q.trend7, 'done') === Number(q.pass), '质量:趋势合格合计 = 合格', `${sum(q.trend7, 'done')} / ${q.pass}`)
check(Math.round((Number(q.pass) * 100) / Math.max(1, Number(q.total))) === Number(q.passRate), '质量:合格率 = 合格/送检')

// ── 单据流量 / 流程看板 ──
const neg = (d.docStats || []).filter((x) => Number(x.status?.草稿) < 0)
check(neg.length === 0, '单据流量:没有负数草稿', neg.map((x) => `${x.panelCode}:${x.status.草稿}`).join(',') || '0 个')
const over = (d.docStats || []).filter((x) => Number(x.status?.已审核) > Number(x.count))
check(over.length === 0, '单据流量:已审核 ≤ 单数', over.map((x) => `${x.panelCode}:${x.status.已审核}>${x.count}`).join(',') || '0 个')
for (const [code, n] of Object.entries(flow.nodes || {})) {
  if (n.docs == null) continue
  if (Number(n.audited) > Number(n.docs) || Number(n.draft) < 0) {
    check(false, '流程看板节点', `${code}: docs=${n.docs} audited=${n.audited} draft=${n.draft}`)
  }
}
check(true, '流程看板:所有单据节点 已审核 ≤ 单数 且 草稿 ≥ 0')

// ── 研发 / 待办 ──
const rd = d.rd || {}
check((rd.stageDist || []).every((x) => Number(x.value) >= 0), '研发:阶段分布无负数')
const todos = d.todos || []
check(Number(k.approvePending) === todos.length, '待审批 = 待办条数', `${k.approvePending} / ${todos.length}`)
check((d.latest || []).length > 0, '实时事件流非空', `${(d.latest || []).length} 条`)

console.log(bad === 0 ? '[PASS] 看板数据自洽性全部通过' : `[FAIL] ${bad} 项不满足`)
process.exit(bad === 0 ? 0 : 2)
