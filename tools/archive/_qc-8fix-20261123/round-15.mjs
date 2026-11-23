// round-15: 不合格品处理单(制程) - 左栏列 + 分章节责任人 + 时间
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(8000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  railHeaders: [...document.querySelectorAll('.drp-head, .drp-th, .drp-table th, .drp-row')].slice(0, 6).map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()),
  railText: (document.querySelector('.doc-select, .drp, .doc-rail, .dsr')?.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
  infoRows: [...document.querySelectorAll('.as-info-row')].map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()),
  signLines: [...document.querySelectorAll('.q-signline')].map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()),
  sectionTitles: [...document.querySelectorAll('.q-section-title')].map((x) => (x.innerText || '').trim()),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1600),
})), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-15-bhc.png' })
