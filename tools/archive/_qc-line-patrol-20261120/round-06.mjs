const task = await taskSpace('qc-line-patrol-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
await page.waitForTimeout(3500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
const pick = async (no) => page.evaluate((no) => {
  const row = [...document.querySelectorAll('.doc-select-rail tr')].find((r) => (r.textContent || '').includes(no))
  if (!row) return false
  row.click(); return true
}, no)
const side = async (label) => page.evaluate((label) => {
  const el = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === label)
  if (!el) return false
  el.click(); return true
}, label)
const confirm = async () => page.evaluate(() => {
  const dlg = document.querySelector('.el-message-box, .el-dialog')
  if (!dlg) return null
  const btn = [...dlg.querySelectorAll('button')].find((b) => /确定|确认/.test((b.textContent || '').trim()))
  if (btn) { btn.click(); return (dlg.textContent || '').replace(/\s+/g, ' ').slice(0, 60) }
  return 'no-btn'
})
const railState = async () => page.evaluate(() => [...document.querySelectorAll('.doc-select-rail tr')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()))

console.log('pick 0008 =', await pick('XJ-2026-11-0008'))
await page.waitForTimeout(2000)
console.log('click 弃审 =', await side('弃审'))
await page.waitForTimeout(600)
console.log('confirm =', JSON.stringify(await confirm()))
await page.waitForTimeout(3200)
console.log('after unaudit rail: ' + JSON.stringify(await railState()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/06-unaudited.png' })

// 删除这张测试单(autotest 造的单,用完即清)
console.log('click 删除 =', await side('删除'))
await page.waitForTimeout(800)
console.log('confirm =', JSON.stringify(await confirm()))
await page.waitForTimeout(3000)
console.log('after delete rail: ' + JSON.stringify(await railState()))
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/lp/ego/06-deleted.png' })
await task.finish({ keep: [] })
