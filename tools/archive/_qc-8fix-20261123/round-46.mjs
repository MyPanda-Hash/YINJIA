// round-46: 8090 新包: 查询对话框限高修复 + 真鼠标提交查询
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 60000 })
await page.waitForTimeout(8000)
console.log('chunk:', await page.evaluate(() => [...document.querySelectorAll('script')].map((s) => s.src).find((x) => x.includes('index-'))))
// 鼠标点工具栏「查询」
await page.mouse.click(246, 126, { label: 'open query dialog' })
await page.waitForTimeout(1200)
const box = await page.evaluate(() => {
  const b = document.querySelector('.header-query-dialog .el-dialog__footer button.el-button--primary')
  const r = b.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return { btn: { x: r.x + r.width / 2, y: r.y + r.height / 2, bottom: r.y + r.height }, vh: window.innerHeight, hit: hit ? { tag: hit.tagName, cls: String(hit.className).slice(0, 40), text: (hit.innerText || '').trim().slice(0, 6) } : null }
})
console.log('query btn box:', JSON.stringify(box))
// 鼠标点「单据编号」输入
await page.mouse.click(457, 191, { label: 'focus doc-no filter' })
await page.waitForTimeout(300)
await page.keyboard.insertText('ZC-2026-11-0008')
await page.waitForTimeout(400)
// 鼠标点 footer 查询
await page.mouse.click(box.btn.x, box.btn.y, { label: 'submit query' })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => ({
  total: (document.body.innerText || '').match(/共\s*(\d+)\s*条/)?.[1] || '',
  rows: document.querySelectorAll('.el-table__body tr').length,
  first: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 130),
  dialogOpen: !!document.querySelector('.header-query-dialog'),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-46-query-fixed.png' })
