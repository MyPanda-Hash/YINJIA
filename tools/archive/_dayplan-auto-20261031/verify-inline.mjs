/**
 * verify-inline.mjs —— 复核「双击就地改」两条链路(2026-10-31)
 *
 *   ① 改当天数量:POST /dayPlan/save(数量>0 = 人工指定;0 = 恢复自动)
 *   ② 改排产日期:POST /rowDates(写 plang + 镜像 plang_pc + 同步当前工序台账区间)
 *
 * 用法: node verify-inline.mjs [base] [rowId]
 * 复完会自动**还原**(清人工指定 + 日期改回原值),不把测试数据留在正式账。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const ROW = Number(process.argv[3] || 2173)

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
if (!token) { console.log('登录失败'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const post = async (p, b) => {
  const r = await fetch(BASE + '/api/px/scheduleBoard/' + p, { method: 'POST', headers: H, body: JSON.stringify(b) })
  let j = null
  try { j = await r.json() } catch { /* ignore */ }
  return { status: r.status, ...(j || {}) }
}

const dump = async () => {
  const r = await post('dayPlan/data', { 生产线: '1号机', scope: '未完工' })
  const row = (r.data?.['行'] || []).find((x) => x['行id'] === ROW) || {}
  return { dates: r.data?.['日期'] || [], row }
}

let t = await dump()
const op = t.row['工序'] || ''
const manualBefore = t.row['人工指定'] || {}
console.log('== 初始: 工序=%s 交期=%s 人工指定=%s', op, t.row['交期'], JSON.stringify(manualBefore))
console.log('   日计划 =', JSON.stringify(t.row['日计划']), '合计 =', t.row['计划合计'])

// ① 改当天数量:把最后一天改成 3
const last = t.dates[t.dates.length - 1]
const r1 = await post('dayPlan/save', { rows: [{ 工单行id: ROW, 工序: op, 生产线: '1号机', 计划日期: last, 计划数量: 3 }] })
console.log('\n== ① 改 %s 为 3 ⇒', last, JSON.stringify(r1.data))
t = await dump()
console.log('   日计划 =', JSON.stringify(t.row['日计划']), '合计 =', t.row['计划合计'],
  '人工指定 =', JSON.stringify(t.row['人工指定']), '超分配 =', t.row['超分配'])

// ①b 超分配:改成 999(只提示不拦)
const over = await post('dayPlan/save', { rows: [{ 工单行id: ROW, 工序: op, 生产线: '1号机', 计划日期: last, 计划数量: 999 }] })
t = await dump()
console.log('   超分配用例(999):超分配 =', t.row['超分配'], '接口返回 =', JSON.stringify(over.data?.['超分配'] || []))

// ①c 恢复自动
const rst = await post('dayPlan/save', { rows: [{ 工单行id: ROW, 工序: op, 生产线: '1号机', 计划日期: last, 计划数量: 0 }] })
t = await dump()
console.log('   恢复自动:日计划 =', JSON.stringify(t.row['日计划']), '人工指定 =', JSON.stringify(t.row['人工指定']),
  '清空格数 =', rst.data?.['清空格数'])

// ② 改排产日期:交期 +2 天(再改回)
const oldCp = t.row['交期']
const dt = new Date(oldCp + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + 2)
const newCp = dt.toISOString().slice(0, 10)
const r2 = await post('rowDates', { 行id: ROW, 交期: newCp })
console.log('\n== ② 交期 %s → %s ⇒ %s', oldCp, newCp, JSON.stringify(r2.data))
t = await dump()
console.log('   新日期列 =', t.dates.join(' '), '\n   日计划 =', JSON.stringify(t.row['日计划']))

// ②b 非法日期(完工早于开工)应被拒
const bad = await post('rowDates', { 行id: ROW, 交期: '2026-01-01' })
console.log('   完工早于开工应被拒:', bad.status, bad.message)

// 还原
const back = await post('rowDates', { 行id: ROW, 交期: oldCp })
t = await dump()
console.log('\n== 还原 ⇒', JSON.stringify(back.data), '\n   日期列 =', t.dates.join(' '),
  '\n   日计划 =', JSON.stringify(t.row['日计划']), '人工指定 =', JSON.stringify(t.row['人工指定']))
