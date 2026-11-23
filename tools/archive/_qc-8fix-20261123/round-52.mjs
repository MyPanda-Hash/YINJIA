// round-52: 真鼠标坐标(按实时 rect 中心)提交查询
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 60000 })
await page.waitForTimeout(8000)
// 打开查询
await page.mouse.click(246, 126, { label: 'open query' })
await page.waitForTimeout(1200)
// 单据编号输入框:按 label 找最近的 input
const ip = await page.evaluate(() => {
  const lab = [...document.querySelectorAll('.header-query-dialog label')].find((l) => (l.textContent || '').trim() === '单据编号')
  const item = lab.closest('.el-form-item')
  const i = item.querySelector('input.el-input__inner')
  const r = i.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.click(ip.x, ip.y, { label: 'focus doc no' })
await page.keyboard.insertText('ZC-2026-11-0006')
await page.waitForTimeout(400)
const bp = await page.evaluate(() => {
  const b = document.querySelector('.header-query-dialog .el-dialog__footer .el-button--primary')
  const r = b.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('click points:', JSON.stringify({ ip, bp }))
await page.mouse.click(bp.x, bp.y, { label: 'submit query' })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => ({
  total: (document.body.innerText || '').match(/共\s*(\d+)\s*条/)?.[1] || '',
  rows: document.querySelectorAll('.el-table__body tr').length,
  first: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140),
  dialogOpen: !!document.querySelector('.header-query-dialog'),
})), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-52-query-mouse.png' })
