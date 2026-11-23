// round-14: 验证批次格已顶对齐(内容不再"掉到下面")
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(7000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('ZC-2026-11-0010'))
  if (tr) tr.click()
})
await page.waitForTimeout(3500)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('*')].find((x) => (x.innerText || '').trim() === '«' && x.clientWidth < 40)
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
console.log(JSON.stringify(await page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  const rows = [...t.querySelectorAll('tbody tr')]
  return rows.slice(0, 2).map((tr, ri) => ({
    ri,
    cells: [...tr.children].map((td) => ({
      va: getComputedStyle(td).verticalAlign,
      taTop: td.querySelector('textarea') ? Math.round(td.querySelector('textarea').getBoundingClientRect().top - td.getBoundingClientRect().top) : null,
      selTop: td.querySelector('.el-select__wrapper') ? Math.round(td.querySelector('.el-select__wrapper').getBoundingClientRect().top - td.getBoundingClientRect().top) : null,
    })),
  }))
}), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-14-top-align.png' })
