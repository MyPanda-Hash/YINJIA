// round-03:「快速排产」页 ②已排产 —— 列头已改「本线排产数量」
// 说明:8090 现役后端还是旧 jar(没有 today() 的新字段),前端按兜底显示成品排产数量;
//       后端重启后该列会变成 本线量(成型 2500 / 装箱 5000)。
const task = await taskSpace('wo-line-qty-20261111')
const page = task.page('p1')
const URL = 'http://localhost:5173/#/prod/plan/scheduleBoard'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto(URL, { timeout: 30000 })
await page.waitForTimeout(6000)

// ②已排产:切「全部」模式,便于看到今天之外的已排行
await page.evaluate(() => {
  const sw = [...document.querySelectorAll('.sb-block')][1]?.querySelector('.el-switch')
  if (sw) sw.click()
})
await page.waitForTimeout(4000)

const data = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('.sb-block')]
  const b2 = blocks[1]
  const headers = [...(b2?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())
  const rows = [...(b2?.querySelectorAll('.el-table__body tr') || [])].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()))
  const idxQty = headers.indexOf('本线排产数量')
  const idxNo = headers.indexOf('加工单号')
  const sample = rows.slice(0, 6).map((c) => ({ 加工单号: c[idxNo], 本线排产数量: c[idxQty] }))
  const hit = rows.find((c) => c.some((x) => x.includes('GD-2026-11-0012')))
  return { headers, rowCount: rows.length, sample, hitRow: hit ? { 加工单号: hit[idxNo], 本线排产数量: hit[idxQty] } : null }
})
console.log(JSON.stringify(data, null, 2))

await restoreWindow()
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-qty-20261111/round-03.png' })
console.log('shot=round-03.png')
