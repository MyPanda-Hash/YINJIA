// round-09:第二次转单(同订单另一行)→ 期待新工单号;再用接口模拟「同一订单行重复转单(备品)」→ 也应是新工单号
const task = await taskSpace('wo-merge-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.waitForTimeout(500)

// —— 第二次转单(界面上再转第 3 行)——
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tr')]
  const out = []
  for (const tr of rows) {
    const tds = tr.querySelectorAll('td')
    const doc = (tds[1] || {}).innerText || ''
    const xc = ((tds[4] || {}).innerText || '').trim()
    if (doc.startsWith('ZL-20261016-01') && xc === '3') {
      const cb = tr.querySelector('.el-checkbox')
      if (cb) cb.click()
      out.push(doc.split('\n')[0] + ' #' + xc)
    }
  }
  return out
})
console.log('checked:', JSON.stringify(picked))
await page.waitForTimeout(600)
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('选择工艺路线'))
  if (b && !b.disabled) { b.click(); return true }
  return false
})
await page.waitForTimeout(1200)
const applied = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-dialog .el-table__body tr')]
  const target = rows.find((tr) => (tr.innerText || '').includes('GY-CB-STD'))
  if (!target) return false
  target.click()
  return true
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog__footer button, .el-dialog button')].find((x) => (x.innerText || '').trim() === '确定' && !x.disabled)
  if (b) b.click()
})
console.log('route dialog:', opened, 'applied:', applied)
await page.waitForTimeout(1200)
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('转工单'))
  if (b && !b.disabled) { b.click(); return (b.innerText || '').trim() }
  return null
})
await page.waitForTimeout(1200)
const boxText = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => ['确认', '确定'].includes((x.innerText || '').trim()))
  if (b) b.click()
})
console.log('转工单:', clicked, 'box:', JSON.stringify(boxText))
await page.waitForTimeout(4000)
const toast = await page.evaluate(() => [...document.querySelectorAll('.el-message__content, .el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('toast:', JSON.stringify(toast))

// —— 同一订单行重复转单(备品,接口层;界面行已转满会自动消失)——
const api = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/orderConvert/toManu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ rows: [{ 订单号: 'ZL-20261016-01', 行id: '8770', 生单数量: 10, 工艺路线: 'GY-CB-STD' }] }),
  })
  const j = await r.json()
  return { status: r.status, body: j }
})
console.log('备品重转接口:', JSON.stringify(api).slice(0, 1200))
