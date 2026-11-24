// round-03: 仪器使用汇总表点「查询」,确认有数据/无报错
const task = await taskSpace('deploy-smoke-20261124')
const page = task.page('p1')
const OUT = 'C:/Users/vigna/ego/deploy-smoke-20261124/'
const BASE = 'http://36.140.66.163:8090/'

async function normalWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto(BASE + '#/rd/instrSummary', { timeout: 30000 })
await page.waitForTimeout(4000)

// 点「查询」(选「全部」区间,避免今天没记录)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const all = btns.find((b) => (b.textContent || '').trim() === '全部')
  if (all) all.click()
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const q = btns.find((b) => (b.textContent || '').trim() === '查询')
  if (q) q.click()
})
await page.waitForTimeout(6000)

const r = await page.evaluate(() => ({
  hash: location.hash,
  rows: document.querySelectorAll('.el-table__row').length,
  total: ((document.body.innerText || '').match(/共有数据[:：]\s*\d+/) || [''])[0],
  head: (document.body.innerText || '').replace(/\s+/g, ' ').slice(-300),
}))
console.log('INSTR_SUMMARY_QUERY ' + JSON.stringify(r))
await normalWindow()
await page.screenshot({ path: OUT + '04-instr-summary-query.png' })
