// 2026-11-11 工序按量流转:第 7 轮 —— 正常回退路径
//   ① 先弃审「组装」报工(BG-2026-11-0003)→ 期望通过
//   ② 再弃审「切炭」报工(BG-2026-11-0002)→ 期望通过(组装已清,不再负在制)
//   ③ 手机端复核:成型 180/270 可报 90;切炭 0/90 可报 60;组装 可报 0
const task = await taskSpace('wo-qty-flow-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_REPORT', { timeout: 30000 })
await page.waitForTimeout(2500)

const items = {
  'BG-2026-11-0003': { 工单号: 'GD-QTY-TEST-11', 工序: '组装', 报工数量: 60, 报工单号: 'BG-2026-11-0003', 报工人: 'admin' },
  'BG-2026-11-0002': { 工单号: 'GD-QTY-TEST-11', 工序: '切炭', 报工数量: 60, 报工单号: 'BG-2026-11-0002', 报工人: 'admin' },
}
const out = await page.evaluate(async (items) => {
  const token = localStorage.getItem('mes_token') || ''
  const call = async (no) => {
    const r = await fetch('/api/px/callButton', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        panelCode: 'WO_REPORT', buttonName: '弃审', buttonParam: {},
        formData: { 编号: no, detail: { items: [items[no]] } },
      }),
    })
    return { no, status: r.status, text: (await r.text()).slice(0, 300) }
  }
  return { 第一步弃审组装: await call('BG-2026-11-0003'), 第二步弃审切炭: await call('BG-2026-11-0002') }
}, items)
console.log(JSON.stringify(out, null, 2))

// ③ 复核手机端显示
await page.evaluate(() => {
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('工单号'))
  if (inp) { s.call(inp, 'GD-QTY-TEST-11'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) }
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  if (btn) btn.click()
})
await page.waitForTimeout(3500)
const state = await page.evaluate(() => ({
  ops: [...document.querySelectorAll('.mp-op')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  wo: [...document.querySelectorAll('.mp-kv')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-qty-flow-20261111/round-07-after-rollback.png' })
