// 第 2 轮:等待应用挂载 + 截图 + 报错收集
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
await page.reload({ timeout: 60000 })
await page.waitForTimeout(12000)
const info = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    title: document.title,
    appHtmlLen: (document.querySelector('#app')?.innerHTML || '').length,
    sheet: !!document.querySelector('.qr-sheet'),
    bodySnippet: txt(document.body).slice(0, 200),
  }
})
console.log(JSON.stringify(info, null, 2))
const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-02.png' })
