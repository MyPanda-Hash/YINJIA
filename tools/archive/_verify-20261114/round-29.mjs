// round-29 — B5 打印预览(真实鼠标点击,避免 popup 拦截 → 新窗口 PDF)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) {}

// 打开「导出报表」并给「打印预览」打标记
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '导出报表')
  if (b) b.click()
})
await page.waitForTimeout(2000)
const marked = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const item = d && [...d.querySelectorAll('.efmt-item')].find((e) => txt(e).includes('打印预览'))
  if (!item) return false
  item.id = 'lp-print-preview'
  return true
})
console.log('MARKED=' + marked)
if (marked) {
  try { await page.click('#lp-print-preview', { label: '打印预览' }) } catch (e) { console.log('CLICK_ERR=' + e.message) }
  await page.waitForTimeout(10000)
}
const tabs = await task.tabs()
console.log('TABS=' + JSON.stringify(tabs.map((t) => ({ label: t.label, title: t.title, url: (t.url || '').slice(0, 90), active: t.active, openedBy: t.openedBy })), null, 1))
for (const t of tabs) {
  if (t.label && t.label !== page.label) {
    try {
      const p2 = task.page(t.label)
      await p2.waitForTimeout(3000)
      const st = await p2.evaluate(() => ({ url: location.href.slice(0, 60), embeds: document.querySelectorAll('embed, iframe').length, body: (document.body.innerText || '').slice(0, 120) }))
      console.log('NEW_WINDOW=' + t.label + ' ' + JSON.stringify(st))
      try {
        const w = await p2.cdp('Browser.getWindowForTarget', {})
        if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
      } catch (e) {}
      await p2.screenshot({ path: OUT + '/round-29-print-preview.png' })
      console.log('SHOT saved')
    } catch (e) { console.log('new window inspect fail: ' + e.message) }
  }
}
await page.evaluate(() => { const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null); if (d) { const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').includes('取消')); if (b) b.click() } })
console.log('DONE round-29')
