// round-28 — 纸宽测量 + B5「导出报表→打印预览」新窗口 PDF
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const pages = await task.pages()
const page = pages[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
console.log('URL=' + await page.url())
const widths = await page.evaluate(() => {
  const lps = document.querySelector('.lp-sheet')
  const scroll = document.querySelector('.lp-grid-scroll')
  const grid = document.querySelector('.lp-grid')
  const m = (e) => (e ? { offsetWidth: e.offsetWidth, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, cls: e.className } : null)
  return { sheet: m(lps), scroll: m(scroll), grid: m(grid), viewport: window.innerWidth }
})
console.log('WIDTHS=' + JSON.stringify(widths, null, 1))

// —— 导出报表 → 打印预览 ——
const beforeTabs = (await task.tabs()).length
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '导出报表')
  if (b) b.click()
})
await page.waitForTimeout(2000)
const dlg = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return d ? { title: txt(d.querySelector('.el-dialog__title')), items: [...d.querySelectorAll('.efmt-item')].map((e) => txt(e)) } : null
})
console.log('REPORT_DIALOG=' + JSON.stringify(dlg))
await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const item = d && [...d.querySelectorAll('.efmt-item')].find((e) => txt(e).includes('打印预览'))
  if (item) item.click()
})
await page.waitForTimeout(9000)
const tabs = await task.tabs()
console.log('TABS=' + JSON.stringify(tabs.map((t) => ({ label: t.label, title: t.title, url: (t.url || '').slice(0, 80), active: t.active, openedBy: t.openedBy })), null, 1))
// 关掉新窗口(不动 p1)
for (const t of tabs) {
  if (t.label && t.label !== page.label) {
    try {
      const p2 = task.page(t.label)
      await p2.screenshot({ path: OUT + '/round-28-print-preview-new-window.png' })
      console.log('NEW_WINDOW_SCREENSHOT=' + t.label)
    } catch (e) { console.log('shot fail ' + e.message) }
  }
}
await normalWin()
await page.screenshot({ path: OUT + '/round-28-after-preview.png' })
await fs.writeFile(OUT + '/b5-preview.json', JSON.stringify({ widths, beforeTabs, dlg, tabs: tabs.map((t) => ({ label: t.label, url: (t.url || '').slice(0, 100), title: t.title })) }, null, 1), 'utf8')
console.log('DONE round-28')
