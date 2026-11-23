// round-25: 8090 出货检验（功能）批次格顶对齐验收
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(8000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('ZC-2026-11-0008'))
  if (tr) tr.click()
})
await page.waitForTimeout(3000)
// 收起左栏,让纸面完整显示
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('*')].find((x) => (x.innerText || '').trim() === '«' && x.clientWidth < 40)
  if (btn) btn.click()
})
await page.waitForTimeout(1500)
console.log(JSON.stringify(await page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  const rows = [...t.querySelectorAll('tbody tr')]
  return {
    head: [...t.querySelectorAll('thead tr')].map((tr) => [...tr.children].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())),
    rows: rows.slice(0, 4).map((tr, ri) => ({
      ri,
      cells: [...tr.children].map((td) => ({
        va: getComputedStyle(td).verticalAlign,
        taTop: td.querySelector('textarea') ? Math.round(td.querySelector('textarea').getBoundingClientRect().top - td.getBoundingClientRect().top) : null,
        selTop: td.querySelector('.el-select__wrapper') ? Math.round(td.querySelector('.el-select__wrapper').getBoundingClientRect().top - td.getBoundingClientRect().top) : null,
        txt: (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 16),
      })),
    })),
    batchNames: [...document.querySelectorAll('.qr-batch-input input')].map((i) => i.value),
  }
}), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-25-8090-oqc.png' })
