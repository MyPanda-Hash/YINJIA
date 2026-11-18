const task = await taskSpace('purinsplit-20261117')
const page = task.page('p1')

// 守卫实测:① 合计不等 ② 非草稿(已作废/已审核) ③ 只给一个仓库
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const post = async (body) => {
    const r = await fetch('/api/px/purIn/split', { method: 'POST', headers: h, body: JSON.stringify(body) })
    return { s: r.status, b: (await r.text()).slice(0, 220) }
  }
  const one = await post({ docNo: 'PI-2026-11-0002', lineId: 1242, allocs: [{ 仓库: '恒亿仓', 数量: 6200 }] })
  const mismatch = await post({ docNo: 'PI-2026-11-0002', lineId: 1242, allocs: [{ 仓库: '恒亿仓', 数量: 3000 }, { 仓库: '成品B仓', 数量: 3000 }] })
  const noWh = await post({ docNo: 'PI-2026-11-0002', lineId: 1242, allocs: [{ 仓库: '不存在的仓', 数量: 3100 }, { 仓库: '成品B仓', 数量: 3100 }] })
  // 已作废的单据(PI-2026-11-0016 之前实测是已作废)
  const voided = await post({ docNo: 'PI-2026-11-0016', lineId: 1263, allocs: [{ 仓库: '恒亿仓', 数量: 3 }, { 仓库: '成品B仓', 数量: 2 }] })
  return { one, mismatch, noWh, voided }
})
console.log(JSON.stringify(out, null, 2))
