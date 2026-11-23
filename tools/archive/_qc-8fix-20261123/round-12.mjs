// round-12: 重新打开已保存的 0010, 看同一检验项目是否被拆成多块(内容掉到下面)
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(7000)
const sel = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('ZC-2026-11-0010'))
  if (!tr) return 'not found'
  tr.click(); return 'ok'
})
console.log('select:', sel)
await page.waitForTimeout(3500)
const dump = await page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  return {
    head: [...t.querySelectorAll('thead tr')].map((tr) => [...tr.children].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())),
    rows: [...t.querySelectorAll('tbody tr')].map((tr, ri) => ({
      ri,
      cells: [...tr.children].map((td) => [...td.querySelectorAll('textarea')].map((x) => x.value.slice(0, 14)).join('|') || (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 10)),
    })),
  }
})
console.log(JSON.stringify(dump, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-12-reopen.png' })
