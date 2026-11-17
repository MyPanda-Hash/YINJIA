/* round-03:两面板截图取证(SPA 内用 location.hash 切换,避免同文档导航卡住) */
const task = await taskSpace('sample-insp-20261115')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function nav(hash, wait = 3500) {
  await page.evaluate((h) => { location.hash = h }, hash)
  await page.waitForTimeout(wait)
  await restoreWindow()
  return page.evaluate(() => location.hash)
}

// 首次进入(用 goto 带完整地址;后续全用 hash)
let cur = await page.evaluate(() => location.hash)
if (!cur || cur === '#/' || cur === '') {
  await page.goto(BASE + '/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
  await page.waitForTimeout(4000)
}
await restoreWindow()

console.log('hash now:', await nav('/panelx/list/INSP_COMMISSION'))
await page.evaluate(() => { const el = document.querySelector('.ic-sheet'); if (el) el.scrollIntoView({ block: 'start' }) })
await page.waitForTimeout(500)
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-01-commission-paper.png' })
console.log('shot1 ok')
const info1 = await page.evaluate(() => ({
  hasSheet: !!document.querySelector('.ic-sheet'),
  sheetW: document.querySelector('.ic-sheet')?.getBoundingClientRect().width || 0,
  sideBtns: [...document.querySelectorAll('.approval-side .as-side-btn')].map((e) => (e.textContent || '').trim()),
  docNo: (document.querySelector('.ic-meta-no')?.textContent || '').replace(/\s+/g, ' ').trim(),
}))
console.log('COMMISSION:', JSON.stringify(info1))

console.log('hash now:', await nav('/panelx/list/SAMPLE_REG'))
const info2 = await page.evaluate(() => ({
  hash: location.hash,
  gridRows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
  firstRows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140)),
  total: (document.querySelector('.el-pagination__total')?.textContent || '').trim(),
  headers: [...document.querySelectorAll('.el-table__header-wrapper th')].map((th) => (th.innerText || '').trim()).filter(Boolean).slice(0, 14),
}))
console.log('SAMPLE_REG:', JSON.stringify(info2, null, 1))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-02-catalog.png' })
await task.finish({ keep: true })
