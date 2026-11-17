// 2026-11-11 工序按量流转:第 6 轮 —— 负在制守卫(带 JWT 弃审切炭报工,期望被拒)
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(2500)

const res = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const call = async (body) => {
    const r = await fetch('/api/px/callButton', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    return { status: r.status, text: (await r.text()).slice(0, 600) }
  }
  const item = { 工单号: 'GD-QTY-TEST-11', 工序: '切炭', 报工数量: 60, 报工单号: 'BG-2026-11-0002', 报工人: 'admin' }
  const formData = { 编号: 'BG-2026-11-0002', detail: { items: [item] } }
  return {
    token: token ? '有' : '无',
    弃审切炭: await call({ panelCode: 'WO_REPORT', buttonName: '弃审', buttonParam: {}, formData }),
  }
})
console.log(JSON.stringify(res, null, 2))
