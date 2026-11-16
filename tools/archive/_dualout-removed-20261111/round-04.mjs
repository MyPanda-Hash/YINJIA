// round-04:切炭直销下线验证 —— 工序报工单面板里应已无「直销数量」字段
const task = await taskSpace('wo-line-qty-20261111')
const page = task.page('p1')
const URL = 'http://localhost:5173/#/panelx/list/WO_REPORT'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto(URL, { timeout: 30000 })
await page.waitForTimeout(6000)

const data = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const bodyText = (document.body.innerText || '')
  const hits = bodyText.split('\n').map((s) => s.trim()).filter((s) => s.includes('直销'))
  return {
    hash: location.hash,
    headers,
    hasDualHeader: headers.some((h) => h.includes('直销')),
    dualTextHits: hits.slice(0, 5),
    rowCount: document.querySelectorAll('.el-table__body tr').length,
  }
})
console.log(JSON.stringify(data, null, 2))

await restoreWindow()
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-line-qty-20261111/round-04.png' })
console.log('shot=round-04.png')
