// round-53: 实时 rect 真鼠标全套: 查询按钮→单据编号→提交
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
const rectOf = (fnSrc) => page.evaluate(new Function('return (' + fnSrc + ')()'))
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/QC_PROC_INSP_DETAIL', { timeout: 60000 })
await page.waitForTimeout(8000)
const q = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, .el-button')].find((x) => (x.innerText || '').trim() === '查询' && x.className.includes('toolbar'))
  const r = b.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('toolbar 查询:', JSON.stringify(q))
await page.mouse.click(q.x, q.y, { label: 'open query dialog' })
await page.waitForTimeout(1500)
console.log('dialog:', await page.evaluate(() => !!document.querySelector('.header-query-dialog')))
const ip = await page.evaluate(() => {
  const dlg = document.querySelector('.header-query-dialog')
  const lab = [...dlg.querySelectorAll('label')].find((l) => (l.textContent || '').trim() === '单据编号')
  if (!lab) return null
  const item = lab.closest('.el-form-item')
  const i = item.querySelector('input.el-input__inner')
  const r = i.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('docno input:', JSON.stringify(ip))
if (ip) { await page.mouse.click(ip.x, ip.y, { label: 'focus doc no' }); await page.keyboard.insertText('ZC-2026-11-0006'); await page.waitForTimeout(400) }
const bp = await page.evaluate(() => {
  const b = document.querySelector('.header-query-dialog .el-dialog__footer .el-button--primary')
  const r = b.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('submit:', JSON.stringify(bp))
if (bp) await page.mouse.click(bp.x, bp.y, { label: 'submit query' })
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
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-53-query-mouse.png' })
